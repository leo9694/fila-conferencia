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
    console.error('Falha ao carregar separacoes de pedidos:', error);
    return {};
  }
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function normalizarItem(item = {}) {
  return {
    chave: String(item.chave || '').trim(),
    sequencia: numero(item.sequencia) || null,
    codProd: numero(item.codProd) || null,
    qtdEsperada: Math.max(0, numero(item.qtdEsperada)),
    qtdSeparada: Math.max(0, numero(item.qtdSeparada)),
    processado: item.processado === true,
    ajustado: item.ajustado === true,
    controleSeparado: String(item.controleSeparado || '').trim() || null,
    dtValidadeSeparada: String(item.dtValidadeSeparada || '').trim() || null,
    atualizadoEm: item.atualizadoEm || null,
    atualizadoPor: item.atualizadoPor === null || item.atualizadoPor === undefined
      ? null
      : numero(item.atualizadoPor)
  };
}

function criarSeparacaoStore(options = {}) {
  const namespace = criarNamespace(options.namespace);
  const baseDir = options.baseDir || path.join(process.cwd(), 'data');
  const filePath = options.filePath || path.join(baseDir, `separacao-${namespace}.json`);
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

  function iniciar({ nunota, codUsu = null, itens = [] }) {
    const chavePedido = String(nunota);
    const existente = state[chavePedido];
    if (existente?.status === 'SEPARADO') return existente;

    const agora = new Date().toISOString();
    const itensExistentes = new Map((existente?.itens || []).map((item) => [item.chave, item]));
    const itensNormalizados = itens
      .map(normalizarItem)
      .filter((item) => item.chave)
      .map((item) => ({
        ...item,
        ...(itensExistentes.get(item.chave) || {}),
        chave: item.chave,
        sequencia: item.sequencia,
        codProd: item.codProd,
        qtdEsperada: item.qtdEsperada
      }));

    state[chavePedido] = {
      nunota: numero(nunota),
      status: 'EM_SEPARACAO',
      iniciadoEm: existente?.iniciadoEm || agora,
      iniciadoPor: existente?.iniciadoPor ?? (codUsu === null ? null : numero(codUsu)),
      atualizadoEm: agora,
      atualizadoPor: codUsu === null ? null : numero(codUsu),
      concluidoEm: null,
      concluidoPor: null,
      versao: numero(existente?.versao) + 1,
      itens: itensNormalizados
    };
    persistir();
    return state[chavePedido];
  }

  function atualizarItem({ nunota, codUsu = null, item }) {
    const separacao = obter(nunota);
    if (!separacao) throw new Error('A separacao ainda nao foi iniciada.');
    if (separacao.status === 'SEPARADO') throw new Error('A separacao deste pedido ja foi concluida.');

    const atualizado = normalizarItem(item);
    if (!atualizado.chave) throw new Error('Item de separacao invalido.');
    const indice = separacao.itens.findIndex((registro) => registro.chave === atualizado.chave);
    if (indice < 0) throw new Error('Item nao pertence a esta separacao.');

    const agora = new Date().toISOString();
    separacao.itens[indice] = {
      ...separacao.itens[indice],
      qtdSeparada: atualizado.qtdSeparada,
      processado: atualizado.processado,
      ajustado: atualizado.ajustado,
      controleSeparado: atualizado.controleSeparado,
      dtValidadeSeparada: atualizado.dtValidadeSeparada,
      atualizadoEm: agora,
      atualizadoPor: codUsu === null ? null : numero(codUsu)
    };
    separacao.atualizadoEm = agora;
    separacao.atualizadoPor = codUsu === null ? null : numero(codUsu);
    separacao.versao = numero(separacao.versao) + 1;
    persistir();
    return separacao;
  }

  function concluir({ nunota, codUsu = null }) {
    const separacao = obter(nunota);
    if (!separacao) throw new Error('A separacao ainda nao foi iniciada.');
    if (separacao.status === 'SEPARADO') return separacao;
    if (!separacao.itens.length || separacao.itens.some((item) => item.processado !== true)) {
      throw new Error('Todos os itens precisam ser separados ou ajustados antes da conclusao.');
    }

    const agora = new Date().toISOString();
    separacao.status = 'SEPARADO';
    separacao.concluidoEm = agora;
    separacao.concluidoPor = codUsu === null ? null : numero(codUsu);
    separacao.atualizadoEm = agora;
    separacao.atualizadoPor = codUsu === null ? null : numero(codUsu);
    separacao.versao = numero(separacao.versao) + 1;
    persistir();
    return separacao;
  }

  return { filePath, namespace, state, obter, iniciar, atualizarItem, concluir };
}

module.exports = { criarSeparacaoStore };
