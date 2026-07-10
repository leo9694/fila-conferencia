const fs = require('node:fs');
const path = require('node:path');

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function carregarEstado(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Falha ao carregar progresso de conferencia:', error);
    return {};
  }
}

function criarConferenciaProgressStore(options = {}) {
  const filePath = options.filePath || path.join(process.cwd(), 'data', 'conferencia-progress-state.json');
  const diretorio = path.dirname(filePath);

  fs.mkdirSync(diretorio, { recursive: true });

  const state = carregarEstado(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(nunota) {
    return state[String(nunota)] || null;
  }

  function salvar({ nunota, nuconf, codUsu, itens }) {
    const chave = String(nunota);
    const itensNormalizados = Array.isArray(itens) ? itens.map((item) => ({
      sequencia: Number(item.sequencia),
      qtdConferida: normalizarNumero(item.qtdConferida),
      qtdCortada: normalizarNumero(item.qtdCortada),
      leituras: Array.isArray(item.leituras) ? item.leituras.map((leitura) => {
        const dtValidade = String(leitura.dtValidade ?? '').trim();
        const dtFabricacao = String(leitura.dtFabricacao ?? '').trim();
        return {
          codigo: String(leitura.codigo || '').trim(),
          tipo: String(leitura.tipo || 'CODIGO_BARRAS').trim(),
          codVol: String(leitura.codVol || '').trim(),
          controle: String(leitura.controle ?? '').trim(),
          ...(dtValidade ? { dtValidade } : {}),
          ...(dtFabricacao ? { dtFabricacao } : {}),
          multiplicador: normalizarNumero(leitura.multiplicador) || 1,
          quantidade: normalizarNumero(leitura.quantidade),
          quantidadeConvertida: normalizarNumero(leitura.quantidadeConvertida)
        };
      }).filter((leitura) => leitura.codigo && leitura.quantidade > 0 && leitura.quantidadeConvertida > 0) : []
    })).filter((item) => Number.isInteger(item.sequencia) && item.sequencia > 0) : [];

    state[chave] = {
      nunota: Number(nunota),
      nuconf: nuconf ? Number(nuconf) : null,
      codUsu: codUsu === null || codUsu === undefined ? null : Number(codUsu),
      atualizadoEm: new Date().toISOString(),
      itens: itensNormalizados
    };
    persistir();
    return state[chave];
  }

  function remover(nunota) {
    const chave = String(nunota);
    if (!state[chave]) {
      return false;
    }

    delete state[chave];
    persistir();
    return true;
  }

  return {
    filePath,
    state,
    obter,
    salvar,
    remover
  };
}

module.exports = {
  criarConferenciaProgressStore
};
