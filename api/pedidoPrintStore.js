const fs = require('node:fs');
const path = require('node:path');

function criarNamespace(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'padrao';
}

function carregar(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Falha ao carregar historico de impressao de pedidos:', error);
    return {};
  }
}

function criarPedidoPrintStore(options = {}) {
  const namespace = criarNamespace(options.namespace);
  const baseDir = options.baseDir || path.join(process.cwd(), 'data');
  const filePath = options.filePath || path.join(baseDir, `pedido-print-${namespace}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const state = carregar(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(nunota) {
    return state[String(nunota)] || null;
  }

  function registrar(nunota, codUsu = null) {
    const chave = String(nunota);
    const anterior = state[chave] || {};
    state[chave] = {
      nunota: Number(nunota),
      impresso: true,
      quantidade: Number(anterior.quantidade || 0) + 1,
      impressoEm: new Date().toISOString(),
      codUsu: codUsu === null || codUsu === undefined ? null : Number(codUsu)
    };
    persistir();
    return state[chave];
  }

  return { filePath, namespace, state, obter, registrar };
}

module.exports = { criarPedidoPrintStore };
