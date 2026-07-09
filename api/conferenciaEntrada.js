function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function controle(valor) {
  return String(valor ?? '').trim() || ' ';
}

function consolidarLeiturasEntrada(itensNota, itensInformados) {
  const porSequencia = new Map(itensNota.map((item) => [Number(item.SEQUENCIA), item]));
  const agrupados = new Map();

  for (const informado of itensInformados) {
    const item = porSequencia.get(Number(informado.sequencia));
    if (!item) throw new Error(`Item ${informado.sequencia} nao pertence a nota de entrada.`);

    const qtdConferida = Math.max(0, numero(informado.qtdConferida));

    const leituras = Array.isArray(informado.leituras) && informado.leituras.length > 0
      ? informado.leituras
      : qtdConferida > 0
        ? [{
            codigo: item.CODBARRA || item.CODPROD,
            codVol: item.CODVOL || 'UN',
            quantidade: qtdConferida,
            quantidadeConvertida: qtdConferida
          }]
        : [];
    const totalConvertido = leituras.reduce(
      (total, leitura) => total + Math.max(0, numero(leitura.quantidadeConvertida)),
      0
    );
    if (Math.abs(totalConvertido - qtdConferida) > 0.0001) {
      throw new Error(`Leituras do produto ${item.CODPROD} nao correspondem a quantidade conferida.`);
    }

    for (const leitura of leituras) {
      const codigo = String(leitura.codigo || item.CODBARRA || item.CODPROD).trim();
      const codVol = String(leitura.codVol || item.CODVOL || 'UN').trim();
      const controleLeitura = String(leitura.controle ?? '').trim();
      const controleItem = controle(controleLeitura || item.CONTROLE);
      const quantidade = Math.max(0, numero(leitura.quantidade));
      const quantidadeConvertida = Math.max(0, numero(leitura.quantidadeConvertida));
      if (!codigo || quantidade <= 0 || quantidadeConvertida <= 0) continue;

      const chave = `${item.CODPROD}|${controleItem}|${codVol}|${codigo}`;
      const existente = agrupados.get(chave) || {
        CODBARRA: codigo,
        CODPROD: item.CODPROD,
        CODVOL: codVol,
        CONTROLE: controleItem,
        QTDCONF: 0,
        QTDCONFVOLPAD: 0
      };
      existente.QTDCONF += quantidade;
      existente.QTDCONFVOLPAD += quantidadeConvertida;
      agrupados.set(chave, existente);
    }
  }

  return [...agrupados.values()];
}

function deveAplicarDivergenciaEntrada(resultadoFinalizacao) {
  const body = resultadoFinalizacao?.responseBody || {};
  return String(body.status || '').toUpperCase() === 'D'
    && String(body.podeCortar || '').toLowerCase() === 'true';
}

function documentosAuxiliaresConferencia(conferencia) {
  const pedidoComplementar = numero(conferencia?.NUPEDCOMP);
  const notaDevolucao = numero(conferencia?.NUNOTADEV);

  return {
    pedidoComplementar: pedidoComplementar > 0 ? pedidoComplementar : null,
    notaDevolucao: notaDevolucao > 0 ? notaDevolucao : null
  };
}

function retornoPossuiDocumentosAuxiliares(resultado) {
  const notas = resultado?.responseBody?.notas;
  if (!notas) return false;
  if (Array.isArray(notas)) return notas.length > 0;
  if (Array.isArray(notas.nota)) return notas.nota.length > 0;
  return Boolean(notas.nota);
}

module.exports = {
  consolidarLeiturasEntrada,
  deveAplicarDivergenciaEntrada,
  documentosAuxiliaresConferencia,
  retornoPossuiDocumentosAuxiliares
};
