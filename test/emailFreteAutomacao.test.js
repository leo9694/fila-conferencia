const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarAutomacaoEmailFrete } = require('../api/emailFreteAutomacao');

const chave = '1'.repeat(44);
const nota = {
  NUNOTA: 3890001, NUMNOTA: 83001, CODEMP: 1, ORDEMCARGA: 5953, CODPARC: 41, CODPARCTRANSP: 52,
  DATA_NOTA: '2026-11-03', DATA_FATURAMENTO: '2026-11-05', CLIENTE: 'Cliente Teste', TRANSPORTADORA: 'Transportadora Teste',
  EMAILNFE: 'fiscal@example.com', EMAIL: 'geral@example.com', CHAVENFE: chave, EVENTO: '20261105120500'
};

function montarAutomacao(t, {
  notasCarga = [nota], notasSemCarga = notasCarga, revalidar = () => notasCarga,
  contatos = [], origens = [], datasFaturamento = [], transportadorasCargas = [], obterDanfe, enviar, ambienteTeste = false
} = {}) {
  const baseAnterior = process.env.SANKHYA_API_BASE_URL;
  process.env.SANKHYA_API_BASE_URL = ambienteTeste
    ? 'https://api.sandbox.sankhya.com.br' : 'https://api.sankhya.com.br';
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'email-frete-automacao-'));
  t.after(() => {
    if (baseAnterior === undefined) delete process.env.SANKHYA_API_BASE_URL;
    else process.env.SANKHYA_API_BASE_URL = baseAnterior;
    for (const arquivo of fs.readdirSync(diretorio)) fs.unlinkSync(path.join(diretorio, arquivo));
    fs.rmdirSync(diretorio);
  });
  let tempo = Date.parse('2026-11-05T16:10:00Z');
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('MAX(ORDEMCARGA)')) {
      return [{ CODEMP: 1, ULTIMA_CARGA: 5952 }, { CODEMP: 0, AGORA: '20261105120000' }];
    }
    if (sql.includes('SOBREPOSICAO')) return [{ ATE: '20261105120900', SOBREPOSICAO: '20261105120400' }];
    if (sql.includes('FROM TGFCAB CAB WHERE CAB.NUNOTA IN')) return datasFaturamento;
    if (sql.includes('WHERE (ORD.CODEMP, ORD.ORDEMCARGA) IN')) {
      assert.match(sql, /TRA\.CODPARC = ORD\.CODPARCTRANSP/);
      return transportadorasCargas;
    }
    if (sql.includes('FROM TGFVAR VAR')) {
      assert.match(sql, /ORIG\.NUNOTA = VAR\.NUNOTAORIG AND ORIG\.TIPMOV = 'P'/);
      assert.match(sql, /WHERE VAR\.NUNOTA IN/);
      return origens;
    }
    if (sql.includes('FROM TGFCTT CTT')) {
      assert.match(sql, /NVL\(CTT\.ATIVO, 'S'\) = 'S'/);
      assert.match(sql, /ORDER BY CTT\.CODPARC, NVL\(CTT\.PRIORIDADE, 999\)/);
      const codigos = sql.match(/CTT\.CODPARC IN \(([^)]+)\)/)[1].split(', ').map(Number);
      return contatos.filter(({ CODPARC }) => codigos.includes(CODPARC));
    }
    assert.match(sql, /CONF\.STATUS = 'F'/);
    assert.match(sql, /CAB\.STATUSNOTA = 'L'/);
    if (sql.includes('NVL(CAB.ORDEMCARGA, 0) = 0')) {
      assert.match(sql, /TRA\.CODPARC = CAB\.CODPARCTRANSP/);
      assert.match(sql, /CAB\.CODTIPOPER IN \(35, 10\)/);
      assert.match(sql, /ORDER BY CAB\.DTFATUR DESC/);
      const [, inicio, fim] = sql.match(/CAB\.DTFATUR >= TO_DATE\('(\d{8})000000'[^)]+\) AND CAB\.DTFATUR < TO_DATE\('(\d{8})000000'[^)]+\) \+ 1/);
      return notasSemCarga.filter((item) => {
        const data = item.DATA_FATURAMENTO?.replaceAll('-', '');
        return data >= inicio && data <= fim;
      }).map((item) => ({ ...item, ORDEMCARGA: 0 }));
    }
    assert.match(sql, /ORD\.ORDEMCARGA > CASE ORD\.CODEMP WHEN 1 THEN 5952 ELSE 0 END/);
    assert.match(sql, /ORD\.CODEMP = CAB\.CODEMP AND ORD\.ORDEMCARGA = CAB\.ORDEMCARGA/);
    assert.match(sql, /TRA\.CODPARC = ORD\.CODPARCTRANSP/);
    assert.doesNotMatch(sql, /CAB\.CODPARCTRANSP/);
    if (sql.includes('TGFNFE')) {
      if (ambienteTeste) assert.doesNotMatch(sql, /CAB\.STATUSNFE = 'A'|XMLPROTAUTNOT/);
      else assert.match(sql, /CAB\.STATUSNFE = 'A'.*XMLPROTAUTNOT/s);
      return revalidar();
    }
    return notasCarga;
  });
  const enviarMock = t.mock.fn(enviar || (async () => ({ accepted: [nota.EMAILNFE] })));
  const verificar = t.mock.fn(async () => true);
  const opcoes = {
    diretorio, query, enviar: enviarMock, verificar, obterDanfe, agora: () => tempo,
    obterConta: async () => ({ configurado: true, user: 'frete@example.com' })
  };
  return {
    automacao: criarAutomacaoEmailFrete(opcoes), reiniciar: () => criarAutomacaoEmailFrete(opcoes),
    query, enviarMock, verificar, diretorio, avancar: (ms) => { tempo += ms; }
  };
}

test('lista notas aguardando carga e envia uma vez após o vínculo, com modelo e destinatário registrados', async (t) => {
  const { automacao, reiniciar, query, enviarMock, verificar } = montarAutomacao(t);
  assert.equal(automacao.configuracao().ativa, false);
  await automacao.executar();
  assert.equal(query.mock.callCount(), 0);
  const espera = await automacao.listar({ visao: 'aguardando' });
  assert.equal(espera.itens[0].ordem, null);
  assert.equal(enviarMock.mock.callCount(), 0);
  automacao.salvarModelo({
    assunto: 'Saiu para entrega, {{nome_cliente}}',
    mensagem: '{{ nome_transportadora }}\nChave: {{chave_nfe}}'
  });
  await automacao.ativar(true);
  assert.equal(verificar.mock.callCount(), 1);
  await Promise.all([automacao.executar(), automacao.executar()]);
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.to, 'fiscal@example.com');
  assert.equal(envio.subject, 'Saiu para entrega, Cliente Teste');
  assert.equal(envio.text, `Transportadora Teste\nChave: ${chave}`);
  const reiniciada = reiniciar();
  await reiniciada.executar();
  assert.equal(enviarMock.mock.callCount(), 1);
  const [historico] = (await reiniciada.listar({ visao: 'historico' })).itens;
  assert.equal(historico.ordem, 5953);
  assert.equal(historico.status, 'enviado');
  assert.equal(historico.destinatario, 'fiscal@example.com');
  assert.ok(historico.enviadoEm);
});

test('registra a carga gerada no app antes da consulta periódica e só mostra enviando durante o SMTP', async (t) => {
  let iniciarEnvio;
  let concluirEnvio;
  const envioIniciado = new Promise((resolve) => { iniciarEnvio = resolve; });
  const resultadoEnvio = new Promise((resolve) => { concluirEnvio = resolve; });
  const { automacao, query, enviarMock } = montarAutomacao(t, {
    enviar: async () => {
      iniciarEnvio();
      return resultadoEnvio;
    }
  });
  await automacao.ativar(true);
  await automacao.registrarCargaConfirmada({ empresa: nota.CODEMP, ordem: nota.ORDEMCARGA, notas: [nota.NUNOTA] });
  const fila = () => automacao.listar({ visao: 'historico' });
  const [pendente] = (await fila()).itens;
  assert.equal(pendente.status, 'pendente');
  assert.equal(pendente.ordem, nota.ORDEMCARGA);
  assert.equal(enviarMock.mock.callCount(), 0);
  assert.ok(query.mock.calls.every(({ arguments: [sql] }) => !sql.includes('SOBREPOSICAO')));

  const execucao = automacao.executar();
  try {
    await envioIniciado;
    assert.equal((await fila()).itens[0].status, 'enviando');
  } finally {
    concluirEnvio({ accepted: [nota.EMAILNFE] });
    await execucao;
  }
  assert.equal((await fila()).itens[0].status, 'enviado');
  await automacao.registrarCargaConfirmada({ empresa: nota.CODEMP, ordem: nota.ORDEMCARGA, notas: [nota.NUNOTA] });
  assert.equal((await fila()).itens.length, 1);
  assert.equal(enviarMock.mock.callCount(), 1);
});

test('ignora vínculo de outra carga no registro imediato e mantém a automação desligada antes da primeira ativação', async (t) => {
  const { automacao, query } = montarAutomacao(t);
  await automacao.registrarCargaConfirmada({ empresa: nota.CODEMP, ordem: nota.ORDEMCARGA, notas: [nota.NUNOTA] });
  assert.equal(query.mock.callCount(), 0);
  await automacao.ativar(true);
  await automacao.registrarCargaConfirmada({ empresa: nota.CODEMP, ordem: nota.ORDEMCARGA + 1, notas: [nota.NUNOTA] });
  assert.equal((await automacao.listar({ visao: 'historico' })).itens.length, 0);
});

test('envia negrito, links clicáveis e o e-mail da transportadora com versão em texto simples', async (t) => {
  const { automacao, enviarMock } = montarAutomacao(t, {
    notasCarga: [{ ...nota, CLIENTE: 'Cliente <b>Teste</b>', EMAIL_TRANSPORTADORA: 'inválido; rastreio@example.com' }]
  });
  automacao.salvarModelo({
    assunto: 'Saiu para entrega',
    mensagem: [
      '**{{nome_cliente}}**',
      'https://ssw.inf.br/2/rastreamento_danfe?',
      '[**Acompanhar**](https://example.com/rastreio?chave={{chave_nfe}}&origem=email)',
      'Contato: {{email_transportadora}}',
      '[Link inválido](javascript:alert(1))'
    ].join('\n')
  });
  await automacao.ativar(true);
  await automacao.executar();
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.to, nota.EMAILNFE);
  assert.match(envio.html, /<strong>Cliente &lt;b&gt;Teste&lt;\/b&gt;<\/strong><br>/);
  assert.ok(envio.html.includes('<a href="https://ssw.inf.br/2/rastreamento_danfe?">'));
  assert.ok(envio.html.includes(`<a href="https://example.com/rastreio?chave=${chave}&amp;origem=email"><strong>Acompanhar</strong></a>`));
  assert.match(envio.html, /Contato: rastreio@example.com/);
  assert.doesNotMatch(envio.html, /href="javascript:/i);
  assert.ok(envio.text.includes(`Acompanhar (https://example.com/rastreio?chave=${chave}&origem=email)`));
  assert.doesNotMatch(envio.text, /\*\*/);
});

test('envia o modelo quando a transportadora está sem e-mail cadastrado', async (t) => {
  const { automacao, enviarMock } = montarAutomacao(t);
  automacao.salvarModelo({ assunto: 'Saiu para entrega', mensagem: 'Contato: {{email_transportadora}}' });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.calls[0].arguments[0].text, 'Contato: não disponível');
});

test('usa a transportadora da ordem de carga no aviso e o contato do cadastro dessa transportadora', async (t) => {
  const { automacao, enviarMock } = montarAutomacao(t, {
    notasSemCarga: [{ ...nota, TRANSPORTADORA: 'Transportadora prevista' }],
    notasCarga: [{ ...nota, CODPARCTRANSP: 78, TRANSPORTADORA: 'Transportadora da ordem' }],
    contatos: [{ CODPARC: 52, EMAIL: 'prevista@example.com' }, { CODPARC: 78, EMAIL: 'ordem@example.com' }]
  });
  assert.equal((await automacao.listar({ visao: 'aguardando' })).itens[0].transportadora, 'Transportadora prevista');
  automacao.salvarModelo({ assunto: 'Entrega', mensagem: '{{nome_transportadora}} | {{email_transportadora}}' });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.calls[0].arguments[0].text, 'Transportadora da ordem | ordem@example.com');
  const [historico] = (await automacao.listar({ visao: 'historico' })).itens;
  assert.equal(historico.transportadora, 'Transportadora da ordem');
});

test('corrige a transportadora das cargas antigas no histórico pelo par empresa e ordem', async (t) => {
  const { automacao, diretorio, query } = montarAutomacao(t, {
    transportadorasCargas: [
      { CODEMP: 1, ORDEMCARGA: 5953, TRANSPORTADORA: 'Transportadora empresa 1' },
      { CODEMP: 6, ORDEMCARGA: 5953, TRANSPORTADORA: 'Transportadora empresa 6' }
    ]
  });
  const antiga = { detectadaEm: '2026-11-05T15:00:00Z', ordem: 5953, status: 'enviado', transportadora: 'Transportadora da nota', dataFaturamento: '2026-11-05' };
  fs.writeFileSync(path.join(diretorio, 'estado.json'), JSON.stringify({
    notas: { 1: { ...antiga, nunota: 1, empresa: 1 }, 2: { ...antiga, nunota: 2, empresa: 6 } }
  }));
  const historico = await automacao.listar({ visao: 'historico' });
  assert.deepEqual(historico.itens.map((item) => item.transportadora), ['Transportadora empresa 6', 'Transportadora empresa 1']);
  assert.match(query.mock.calls[0].arguments[0], /IN \(\(6, 5953\), \(1, 5953\)\)/);
});

test('anexa o PDF da nota e inclui os números dos pedidos de origem no modelo', async (t) => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  const obterDanfe = t.mock.fn(async () => pdf);
  const { automacao, enviarMock } = montarAutomacao(t, {
    obterDanfe,
    origens: [3889900, 3889900, 3889901].map((origem) => ({ NUNOTA: nota.NUNOTA, NUNOTAORIG: origem }))
  });
  automacao.salvarModelo({
    assunto: 'Pedido {{numero_pedido}}', mensagem: 'Origem: {{ numero_pedido }}', anexarDanfe: true
  });
  await automacao.ativar(true);
  await automacao.executar();
  assert.deepEqual(obterDanfe.mock.calls[0].arguments, [nota.NUNOTA]);
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.subject, 'Pedido 3889900 / 3889901');
  assert.equal(envio.text, 'Origem: 3889900 / 3889901');
  assert.deepEqual(envio.attachments, [{ filename: 'DANFE-83001.pdf', content: pdf, contentType: 'application/pdf' }]);
  const [historico] = (await automacao.listar({ visao: 'historico' })).itens;
  assert.equal(historico.danfeAnexado, true);
});

test('em produção tenta obter o DANFE novamente antes de enviar quando o PDF está indisponível', async (t) => {
  let disponivel = false;
  const { automacao, enviarMock, avancar } = montarAutomacao(t, {
    obterDanfe: async () => disponivel ? Buffer.from('%PDF-1.4\n%%EOF') : null
  });
  automacao.salvarModelo({ assunto: 'Entrega', mensagem: 'Segue o DANFE.', anexarDanfe: true });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 0);
  assert.match((await automacao.listar({ visao: 'historico' })).itens[0].motivo, /Aguardando o PDF/);
  disponivel = true;
  avancar(600_000);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 1);
  assert.equal(enviarMock.mock.calls[0].arguments[0].attachments.length, 1);
});

test('no sandbox envia sem DANFE quando a nota não tem autorização e não usa o número da nota como pedido', async (t) => {
  const obterDanfe = t.mock.fn();
  const { automacao, enviarMock } = montarAutomacao(t, {
    obterDanfe, notasCarga: [{ ...nota, CHAVENFE: null }], ambienteTeste: true
  });
  automacao.salvarModelo({ assunto: 'Entrega', mensagem: 'Pedido: {{numero_pedido}}', anexarDanfe: true });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(obterDanfe.mock.callCount(), 0);
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.text, 'Pedido: não disponível');
  assert.equal(envio.attachments, undefined);
});

test('procura outros campos do cadastro antes dos contatos do cliente e da transportadora', async (t) => {
  const { automacao, query, enviarMock } = montarAutomacao(t, {
    notasCarga: [{
      ...nota, EMAILNFE: '', EMAIL: 'inválido', EMAILDANFE: 'danfe@example.com',
      EMAIL_TRANSPORTADORA: '', EMAILCTE_TRANSPORTADORA: 'cte@example.com'
    }]
  });
  automacao.salvarModelo({ assunto: 'Entrega', mensagem: 'Contato: {{email_transportadora}}' });
  await automacao.ativar(true);
  await automacao.executar();
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.to, 'danfe@example.com');
  assert.equal(envio.text, 'Contato: cte@example.com');
  assert.ok(query.mock.calls.every(({ arguments: [sql] }) => !sql.includes('FROM TGFCTT')));
});

test('usa o primeiro e-mail válido dos contatos ativos para ambos quando o cadastro principal não tem endereço', async (t) => {
  const { automacao, query, enviarMock } = montarAutomacao(t, {
    notasCarga: [{ ...nota, EMAILNFE: '', EMAIL: '', EMAIL_TRANSPORTADORA: 'inválido' }],
    contatos: [
      { CODPARC: 41, EMAIL: 'inválido' },
      { CODPARC: 41, EMAIL: 'cliente-contato@example.com' },
      { CODPARC: 41, EMAIL: 'segundo-contato@example.com' },
      { CODPARC: 52, EMAIL: 'transportadora-contato@example.com' }
    ]
  });
  assert.equal((await automacao.listar({ visao: 'aguardando' })).itens[0].email, 'cliente-contato@example.com');
  automacao.salvarModelo({ assunto: 'Entrega', mensagem: 'Contato: {{email_transportadora}}' });
  await automacao.ativar(true);
  await automacao.executar();
  const [envio] = enviarMock.mock.calls[0].arguments;
  assert.equal(envio.to, 'cliente-contato@example.com');
  assert.equal(envio.text, 'Contato: transportadora-contato@example.com');
  const [historico] = (await automacao.listar({ visao: 'historico' })).itens;
  assert.equal(historico.destinatario, 'cliente-contato@example.com');
  assert.ok(query.mock.calls.some(({ arguments: [sql] }) => sql.includes('CTT.CODPARC IN (41, 52)')));
});

test('aguarda NF-e autorizada e usa o e-mail geral quando não há endereço fiscal válido', async (t) => {
  let autorizado = false;
  const { automacao, avancar, enviarMock } = montarAutomacao(t, {
    revalidar: () => [{ ...nota, EMAILNFE: '', CHAVENFE: autorizado ? chave : null }]
  });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 0);
  assert.match((await automacao.listar({ visao: 'historico' })).itens[0].motivo, /autorização/);
  autorizado = true;
  avancar(600_000);
  await automacao.executar();
  assert.equal(enviarMock.mock.calls[0].arguments[0].to, nota.EMAIL);
});

test('envia no sandbox após a carga mesmo sem chave da NF-e e inclui a chave existente quando disponível', async (t) => {
  const notasCarga = [{ ...nota, CHAVENFE: null }, { ...nota, NUNOTA: nota.NUNOTA + 1 }];
  const { automacao, enviarMock } = montarAutomacao(t, { notasCarga, ambienteTeste: true });
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 2);
  assert.match(enviarMock.mock.calls[0].arguments[0].text, /Chave da NF-e: não disponível/);
  assert.match(enviarMock.mock.calls[1].arguments[0].text, new RegExp(chave));
});

test('registra a nova ordem durante uma pausa e envia somente após retomar', async (t) => {
  const { automacao, enviarMock } = montarAutomacao(t);
  await automacao.ativar(true);
  await automacao.ativar(false);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 0);
  assert.equal((await automacao.listar({ visao: 'historico' })).itens[0].ordem, nota.ORDEMCARGA);
  await automacao.ativar(true);
  await automacao.executar();
  assert.equal(enviarMock.mock.callCount(), 1);
});

test('filtra o histórico pela data local da detecção antes de paginar e usa hoje e ontem por padrão', async (t) => {
  const { automacao, diretorio, avancar } = montarAutomacao(t);
  avancar(9 * 60 * 60_000 + 50 * 60_000);
  const registrar = (nunota, detectadaEm) => ({ nunota, detectadaEm, status: 'enviado', enviadoEm: '2026-11-06T01:30:00Z' });
  const notas = [
    registrar(1, '2026-11-04T03:59:59Z'),
    registrar(2, '2026-11-04T04:00:00Z'),
    registrar(3, '2026-11-06T03:59:59Z'),
    registrar(4, '2026-11-06T04:00:00Z'),
    ...Array.from({ length: 31 }, (_, i) => registrar(100 + i, '2026-11-05T15:00:00Z'))
  ];
  fs.writeFileSync(path.join(diretorio, 'estado.json'), JSON.stringify({ notas: Object.fromEntries(notas.map((n) => [n.nunota, n])) }));
  const padrao = await automacao.listar({ visao: 'historico' });
  assert.deepEqual(padrao.intervalo, { inicio: '2026-11-04', fim: '2026-11-05' });
  assert.equal(padrao.itens.length, 30);
  assert.equal(padrao.itens[0].nunota, 3);
  assert.equal(padrao.temMais, true);
  const segunda = await automacao.listar({ visao: 'historico', pagina: 2 });
  assert.deepEqual(segunda.itens.map((n) => n.nunota), [101, 100, 2]);
  const antigo = await automacao.listar({ visao: 'historico', inicio: '2026-11-03', fim: '2026-11-03' });
  assert.deepEqual(antigo.itens.map((n) => n.nunota), [1]);
  await assert.rejects(automacao.listar({ visao: 'historico', inicio: '2026-02-30', fim: '2026-11-05' }), { code: 'FRETE_HISTORICO_PERIODO_INVALIDO' });
  await assert.rejects(automacao.listar({ visao: 'historico', inicio: '2026-11-06', fim: '2026-11-05' }), { code: 'FRETE_HISTORICO_PERIODO_INVALIDO' });
});

test('filtra a fila de TOPs 10 e 35 pela data de faturamento e usa hoje e ontem por padrão', async (t) => {
  const { automacao } = montarAutomacao(t, {
    notasSemCarga: [nota, { ...nota, NUNOTA: 3890002, DATA_NOTA: '2026-11-05', DATA_FATURAMENTO: '2026-11-03' }]
  });
  const padrao = await automacao.listar({ visao: 'aguardando' });
  assert.deepEqual(padrao.intervalo, { inicio: '2026-11-04', fim: '2026-11-05' });
  assert.deepEqual(padrao.itens.map((item) => item.dataFaturamento), ['2026-11-05']);
  const personalizado = await automacao.listar({ visao: 'aguardando', inicio: '2026-11-03', fim: '2026-11-03' });
  assert.deepEqual(personalizado.itens.map((item) => [item.nunota, item.dataFaturamento]), [[3890002, '2026-11-03']]);
  await assert.rejects(automacao.listar({ visao: 'aguardando', inicio: '2026-11-03' }), { code: 'FRETE_HISTORICO_PERIODO_INVALIDO' });
});

test('recupera a data de faturamento dos registros antigos visíveis no histórico', async (t) => {
  const { automacao, diretorio, query } = montarAutomacao(t, {
    datasFaturamento: [{ NUNOTA: 1, DATA_FATURAMENTO: '2026-11-03' }]
  });
  fs.writeFileSync(path.join(diretorio, 'estado.json'), JSON.stringify({
    notas: {
      1: { nunota: 1, detectadaEm: '2026-11-05T15:00:00Z', status: 'enviado' },
      2: { nunota: 2, detectadaEm: '2026-11-05T14:00:00Z', status: 'enviado', dataFaturamento: '2026-11-04' },
      3: { nunota: 3, detectadaEm: '2026-11-03T15:00:00Z', status: 'enviado' }
    }
  }));
  const historico = await automacao.listar({ visao: 'historico' });
  assert.deepEqual(historico.itens.map((item) => item.dataFaturamento), ['2026-11-03', '2026-11-04']);
  assert.match(query.mock.calls[0].arguments[0], /WHERE CAB\.NUNOTA IN \(1\)/);
});

test('expõe envio ambíguo para revisão e não reenvia automaticamente após reiniciar', async (t) => {
  const { automacao, reiniciar, enviarMock } = montarAutomacao(t, {
    enviar: async () => { throw Object.assign(new Error('Erro simulado'), { code: 'ETIMEDOUT' }); }
  });
  await automacao.ativar(true);
  await automacao.executar();
  const reiniciada = reiniciar();
  await reiniciada.executar();
  const [registro] = (await reiniciada.listar({ visao: 'historico' })).itens;
  assert.equal(registro.status, 'revisar');
  assert.equal(registro.destinatario, nota.EMAILNFE);
  assert.equal(enviarMock.mock.callCount(), 1);
});

test('rejeita marcadores desconhecidos ou incompletos no modelo', (t) => {
  const { automacao } = montarAutomacao(t);
  for (const mensagem of ['{{desconhecida}}', '{{chave_nfe']) {
    assert.throws(() => automacao.salvarModelo({ assunto: 'Aviso', mensagem }), { code: 'FRETE_MODELO_VARIAVEL' });
  }
});
