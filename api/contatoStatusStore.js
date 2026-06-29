const fs = require('node:fs');
const path = require('node:path');

function carregarEstado(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Falha ao carregar status de atualizacao de contato:', error);
    return {};
  }
}

function criarContatoStatusStore(options = {}) {
  const namespace = String(options.namespace || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'padrao';
  const baseDir = options.baseDir || path.join(process.cwd(), 'data');
  const filePath = options.filePath || path.join(baseDir, `contato-status-${namespace}.json`);
  const diretorio = path.dirname(filePath);

  fs.mkdirSync(diretorio, { recursive: true });

  const state = carregarEstado(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(codParc) {
    return state[String(codParc)] || null;
  }

  function salvar(codParc, status) {
    const chave = String(codParc);
    state[chave] = {
      codParc: Number(codParc),
      status,
      atualizadoEm: new Date().toISOString()
    };
    persistir();
    return state[chave];
  }

  return {
    filePath,
    namespace,
    state,
    obter,
    salvar
  };
}

module.exports = {
  criarContatoStatusStore
};
