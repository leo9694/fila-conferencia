function textoData(valor) {
  return String(valor || '').trim() || null;
}

function planejarDatasRastreabilidade({ registro = {}, dtFabricacao = null, dtValidade = null } = {}) {
  const registroAtual = registro || {};
  const desejadas = {
    DTFABRICACAO: textoData(dtFabricacao),
    DTVAL: textoData(dtValidade)
  };
  const atuais = {
    DTFABRICACAO: textoData(registroAtual.DTFABRICACAO),
    DTVAL: textoData(registroAtual.DTVAL)
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

function deveMigrarPosicaoSemControle({
  alterouControle = false,
  registroOrigem = null,
  controleOrigem = '',
  controleNovo = ''
} = {}) {
  return Boolean(
    alterouControle
    && registroOrigem
    && !String(controleOrigem || '').trim()
    && String(controleNovo || '').trim()
  );
}

module.exports = {
  deveMigrarPosicaoSemControle,
  planejarDatasRastreabilidade
};
