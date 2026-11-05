const partesFormatadas = /\[((?:\\.|[^\]\\\r\n])+)\]\(([^)\r\n]+)\)|\*\*([^*]+)\*\*|(https?:\/\/(?:{{\s*\w+\s*}}|[^\s<>"'\[\](){}*])+)/gi;
const entidades = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHtml(texto) {
  return texto.replace(/[&<>"']/g, (caractere) => entidades[caractere]);
}

function obterLink(valor, substituir) {
  const texto = substituir(valor.trim(), encodeURIComponent);
  if (!/^https?:\/\/[^\s]/i.test(texto) || /\s/.test(texto)) return null;
  try {
    const url = new URL(texto);
    return url.username || url.password ? null : url.href;
  } catch {
    return null;
  }
}

function formatarMensagem(modelo, substituir) {
  let html = '';
  let text = '';
  let posicao = 0;

  function adicionarTexto(trecho) {
    const valor = substituir(trecho);
    text += valor;
    html += escaparHtml(valor);
  }

  for (const parte of modelo.matchAll(partesFormatadas)) {
    const [trecho, rotulo, link, negrito, urlAvulsa] = parte;
    adicionarTexto(modelo.slice(posicao, parte.index));
    posicao = parte.index + trecho.length;
    if (negrito) {
      const formato = formatarMensagem(negrito, substituir);
      html += `<strong>${formato.html}</strong>`;
      text += formato.text;
      continue;
    }

    const url = link || urlAvulsa.replace(/[.,;!]+$/, '');
    const href = obterLink(url, substituir);
    if (!href) {
      adicionarTexto(trecho);
      continue;
    }
    const partesRotulo = rotulo
      ? rotulo.replace(/\\([\\\]])/g, '$1').split(/\*\*([^*]+)\*\*/).map((valor) => substituir(valor))
      : [href];
    const legenda = partesRotulo.join('');
    const htmlRotulo = partesRotulo.map((valor, indice) => indice % 2
      ? `<strong>${escaparHtml(valor)}</strong>` : escaparHtml(valor)).join('');
    html += `<a href="${escaparHtml(href)}">${htmlRotulo}</a>`;
    text += legenda === href ? href : `${legenda} (${href})`;
    if (urlAvulsa) adicionarTexto(urlAvulsa.slice(url.length));
  }
  adicionarTexto(modelo.slice(posicao));
  return { text, html };
}

module.exports = { formatarMensagem };
