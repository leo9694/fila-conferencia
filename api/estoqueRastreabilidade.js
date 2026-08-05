function textoData(valor) {
  return String(valor || '').trim() || null;
}

function planejarDatasRastreabilidade({ registro = {}, dtFabricacao = null, dtValidade = null } = {}) {
  const desejadas = {
    DTFABRICACAO: textoData(dtFabricacao),
    DTVAL: textoData(dtValidade)
  };
  const atuais = {
    DTFABRICACAO: textoData(registro.DTFABRICACAO),
    DTVAL: textoData(registro.DTVAL)
  };
  const camposCompletos = {};
  const camposAlterados = {};
  const datasAtualizadas = [];

  for (const [campo, valor] of Object.entries(desejadas)) {
    if (!valor) continue;
    camposCompletos[campo] = valor;
    if (valor === atuais[campo]) continue;
    camposAlterados[campo] = valor;
    datasAtualizadas.push(campo === 'DTFABRICACAO' ? 'fabricacao' : 'validade');
  }

  return { camposCompletos, camposAlterados, datasAtualizadas };
}

module.exports = { planejarDatasRastreabilidade };
