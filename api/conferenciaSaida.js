const { planejarSincronizacaoDetalhesEntrada, validarDetalhesConferenciaEntrada } = require('./conferenciaEntrada');

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

async function gravarDetalhesConferenciaSaida({ nuconf, itens, existentes, dhAlter, executeService, consultarGravados }) {
  if (!Number.isSafeInteger(Number(nuconf)) || Number(nuconf) <= 0) throw new Error('Conferência inválida.');
  const plano = planejarDetalhesConferenciaSaida(itens, existentes);
  const fields = ['NUCONF', 'SEQCONF', 'CODBARRA', 'CODPROD', 'CODVOL', 'CONTROLE', 'QTDCONF', 'QTDCONFVOLPAD', 'DHALTER'];
  const porSequencia = new Map(existentes.map((d) => [Number(d.SEQCONF), d]));
  const records = [];
  const iguais = (atual, desejado) => Object.entries(desejado).every(([campo, valor]) => {
    if (['CODPROD', 'QTDCONF', 'QTDCONFVOLPAD'].includes(campo)) {
      return atual[campo] != null && Number(atual[campo]) === Number(valor);
    }
    return String(atual[campo] ?? '').trim() === String(valor ?? '').trim();
  });
  const adicionar = (seqConf, existente, campos) => {
    const valores = { NUCONF: Number(nuconf), SEQCONF: seqConf, ...campos, DHALTER: dhAlter };
    records.push({
      ...(existente ? { pk: { NUCONF: Number(nuconf), SEQCONF: seqConf } } : { foreignKey: { NUCONF: Number(nuconf) } }),
      values: Object.fromEntries(Object.entries(valores).map(([campo, valor]) => [fields.indexOf(campo), valor]))
    });
  };
  for (const { detalhe, seqConf, existente } of plano.atribuicoes) {
    if (!existente || !iguais(porSequencia.get(seqConf), detalhe)) adicionar(seqConf, existente, detalhe);
  }
  for (const seqConf of plano.sequenciasObsoletas) {
    const zerado = { QTDCONF: 0, QTDCONFVOLPAD: 0 };
    if (!iguais(porSequencia.get(seqConf), zerado)) adicionar(seqConf, true, zerado);
  }
  // Lotes sequenciais limitam o tamanho da requisição e preservam a ordem das gravações.
  // Não repetir automaticamente nem cair em inclusão individual após resposta incerta.
  for (let inicio = 0; inicio < records.length; inicio += 100) {
    await executeService('DatasetSP.save', {
      entityName: 'DetalhesConferencia', standAlone: false, fields,
      records: records.slice(inicio, inicio + 100)
    }, { forceAccessSession: true });
  }
  const gravados = await consultarGravados();
  const validacao = validarDetalhesConferenciaEntrada(plano.atribuicoes.map((a) => a.detalhe), gravados);
  if (!validacao.valido) {
    throw new Error(`A conferência de saída não foi gravada integralmente no Sankhya. ${validacao.erros.slice(0, 5).join('; ')}`);
  }
  return { registros: records.length, lotes: Math.ceil(records.length / 100) };
}

module.exports = { planejarDetalhesConferenciaSaida, gravarDetalhesConferenciaSaida };
