const enderecoHostinger = 'https://api.mail.hostinger.com';
const idFrete = /<frete-\d+-[a-f0-9-]{36}@[a-z0-9.-]+>/i;

function identificarDevolucao(texto, originais) {
  const resultado = /(?:^\s*Diagnostic-Code:\s*(?:smtp;\s*)?|\bsaid:\s*)([245]\d{2})(?:[ -]+([245]\.\d{1,3}\.\d{1,3}))?/im.exec(texto);
  const codigo = resultado?.slice(1).filter(Boolean).join(' ');
  const motivos = [
    [/out of storage|over.?quota|mailbox full|quota exceeded/i, 'Caixa de e-mail cheia'],
    [/mailbox unavailable/i, 'Caixa de e-mail indisponível'],
    [/user unknown|does not exist|no such user|recipient.*unknown|address not found/i, 'Destinatário inexistente'],
    [/host or domain|domain.*not found|name service error/i, 'Domínio do destinatário não encontrado'],
    [/relay(?: access)? denied|relaying denied/i, 'Servidor recusou o encaminhamento']
  ];
  if (/^Action:\s*(delayed|delivered|relayed|expanded)\b/im.test(texto) && !/^Action:\s*failed\b/im.test(texto)) return null;
  if (/^4/.test(codigo || '') && !/(?:could not|not be delivered|returned to sender|^Action:\s*failed)/im.test(texto)) return null;
  const motivo = motivos.find(([regra]) => regra.test(texto))?.[1];
  if (!motivo && !/^5/.test(codigo || '') && !/^Action:\s*failed\b/im.test(texto)) return null;
  const cabecalhos = originais.map((original) => original.split(/\r?\n\r?\n/, 1)[0]).join('\n');
  const ids = new Set();
  for (const origem of [cabecalhos.matchAll(/^Message-ID:\s*(<[^<>\s]+>)/gim),
    texto.matchAll(/^Original-Message-ID:\s*(<[^<>\s]+>)/gim)]) {
    for (const [, id] of origem) if (idFrete.test(id)) ids.add(id.toLowerCase());
  }
  if (ids.size !== 1) return null;
  return { messageId: [...ids][0], motivo: `${motivo || 'Servidor do destinatário devolveu a mensagem'}${codigo ? ` (${codigo})` : ''}.` };
}

async function consultarDevolucoesHostinger({ caixa, desde, conhecidos, token = process.env.FRETE_HOSTINGER_API_TOKEN, requisitar = fetch }) {
  if (!token || !caixa) return [];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function consultar(rota, { body, comoTexto = false } = {}) {
    const resposta = await requisitar(enderecoHostinger + rota, {
      headers, redirect: 'error', signal: AbortSignal.timeout(8000),
      ...(body && { method: 'POST', body: JSON.stringify(body) })
    });
    if (!resposta.ok) throw Object.assign(new Error('Falha ao consultar devoluções na Hostinger.'), { code: `HOSTINGER_HTTP_${resposta.status}` });
    return comoTexto ? resposta.text() : resposta.json();
  }

  const { data } = await consultar('/api/v1/me');
  const mailbox = data.mailboxes.find((item) => item.address.toLowerCase() === caixa.toLowerCase());
  if (!mailbox) throw Object.assign(new Error('Remetente SMTP fora do escopo do token.'), { code: 'HOSTINGER_CAIXA_INDISPONIVEL' });
  const base = `/api/v1/mailboxes/${encodeURIComponent(mailbox.resourceId)}/folders`;
  const { data: pastas } = await consultar(`${base}?perPage=100`);
  const resultado = [];
  for (const pasta of pastas.filter(({ path, specialUse }) => path === 'INBOX' || specialUse === '\\Junk')) {
    const mensagens = `${base}/${encodeURIComponent(pasta.path)}/messages`;
    let pagina = 1;
    let totalPaginas;
    do {
      const lista = await consultar(`${mensagens}/search?perPage=100&page=${pagina}`, { body: {
        since: desde, from: 'mailer-daemon', subject: 'returned mail', body: 'Diagnostic-Code:'
      } });
      totalPaginas = lista.pagination.totalPages;
      for (const aviso of lista.data) {
        const chave = aviso.messageId || `${pasta.path}:${aviso.uid}:${aviso.date}`;
        if (conhecidos.has(chave)) continue;
        const rota = `${mensagens}/${aviso.uid}`;
        const { data: conteudo } = await consultar(`${rota}/text`);
        const originais = [];
        const partes = [conteudo.text || ''];
        for (const anexo of aviso.attachments || []) {
          const tipo = anexo.contentType?.split(';', 1)[0].toLowerCase();
          if (anexo.sizeBytes > 128 * 1024 || !['text/rfc822-headers', 'message/rfc822', 'message/delivery-status'].includes(tipo)) continue;
          const texto = await consultar(`${rota}/attachments/${encodeURIComponent(anexo.id)}`, { comoTexto: true });
          (tipo === 'message/delivery-status' ? partes : originais).push(texto);
        }
        resultado.push({ chave, data: aviso.date, ...identificarDevolucao(partes.join('\n'), originais) });
        conhecidos.add(chave);
      }
      pagina++;
    } while (pagina <= totalPaginas);
  }
  return resultado;
}

module.exports = { consultarDevolucoesHostinger, identificarDevolucao };
