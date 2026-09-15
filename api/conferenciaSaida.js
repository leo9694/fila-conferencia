const { planejarSincronizacaoDetalhesEntrada } = require('./conferenciaEntrada');

function planejarDetalhesConferenciaSaida(itens, existentes) {
  const sequencias = new Set();
  for (const item of itens) {
    if (item.SEQUENCIA == null) continue;
    const sequencia = Number(item.SEQUENCIA);
    if (sequencias.has(sequencia)) {
      throw new Error(`A consulta retornou a sequencia ${sequencia} mais de uma vez. Revise as unidades alternativas do produto ${item.CODPROD} antes de confirmar a conferencia.`);
    }
    sequencias.add(sequencia);
  }
  const detalhes = itens.map((item) => {
    const quantidade = Math.max(0, Number(item.QTDNEG || 0) - Number(item.QTDCORTE || 0));
    return {
      CODBARRA: String(item.CODBARRACONF || item.CODBARRA || item.CODPROD).trim(),
      CODPROD: item.CODPROD,
      CODVOL: String(item.CODVOLCONF || item.CODVOL || 'UN').trim(),
      CONTROLE: String(item.CONTROLE ?? '').trim() || ' ',
      QTDCONF: quantidade,
      QTDCONFVOLPAD: quantidade
    };
  }).filter((detalhe) => detalhe.QTDCONF > 0);
  return planejarSincronizacaoDetalhesEntrada(existentes, detalhes);
}

module.exports = { planejarDetalhesConferenciaSaida };
