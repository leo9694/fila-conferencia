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
    controlePedido: String(item.controlePedido || '').trim() || null,
    qtdEsperada: Math.max(0, numero(item.qtdEsperada)),
    qtdSeparada: Math.max(0, numero(item.qtdSeparada)),
    processado: item.processado === true,
    ajustado: item.ajustado === true,
    controleSeparado: String(item.controleSeparado || '').trim() || null,
    dtValidadeSeparada: String(item.dtValidadeSeparada || '').trim() || null,
    lotesSeparados: Array.isArray(item.lotesSeparados) ? item.lotesSeparados.map((lote) => ({
      controle: String(lote.controle || '').trim(), qtdSeparada: Math.max(0, numero(lote.qtdSeparada)),
      dtValidade: String(lote.dtValidade || '').trim() || null
    })) : [],
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
        qtdEsperada: item.qtdEsperada,
        controlePedido: item.controlePedido
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
    const anterior = separacao.itens[indice];
    let lotesSeparados = anterior.lotesSeparados || [];
    if (atualizado.qtdSeparada !== anterior.qtdSeparada && lotesSeparados.length) {
      if (atualizado.qtdSeparada === 0) lotesSeparados = [];
      else if (lotesSeparados.length === 1) lotesSeparados = [{ ...lotesSeparados[0], qtdSeparada: atualizado.qtdSeparada }];
      else throw new Error('Não é possível ajustar o total de vários lotes sem informar a quantidade de cada lote.');
    }

    const agora = new Date().toISOString();
    separacao.itens[indice] = {
      ...separacao.itens[indice],
      qtdSeparada: atualizado.qtdSeparada,
      processado: atualizado.processado,
      ajustado: atualizado.ajustado,
      controleSeparado: atualizado.controleSeparado,
      dtValidadeSeparada: atualizado.dtValidadeSeparada,
      lotesSeparados,
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

  function registrarLeituraFeltrin({ nunota, codUsu = null, chave, lote, leituraId, quantidade = 1 }) {
    const separacao = obter(nunota);
    if (!separacao || separacao.status === 'SEPARADO') throw new Error('A separação não está aberta.');
    const origem = separacao.itens.find((entrada) => entrada.chave === chave);
    if (!origem || Number(origem.codProd) !== Number(lote.codProd)) throw new Error('A caixa não pertence ao produto selecionado.');
    const mesmoProduto = separacao.itens.filter((entrada) => entrada.codProd === origem.codProd);
    if (leituraId && mesmoProduto.some((entrada) => (entrada.leiturasFeltrin || []).includes(leituraId))) return separacao;
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade da leitura inválida.');
    const correspondentes = mesmoProduto.filter((entrada) => entrada.controlePedido === lote.controle);
    if (!correspondentes.length && new Set(mesmoProduto.map((entrada) => entrada.controlePedido).filter(Boolean)).size > 1) {
      throw new Error('O lote bipado não corresponde às linhas deste produto no pedido.');
    }
    const item = correspondentes.length
      ? correspondentes.find((entrada) => !entrada.processado && entrada.qtdSeparada + quantidade <= entrada.qtdEsperada)
      : origem;
    if (!item) throw new Error('A leitura excede a quantidade pendente das linhas deste lote.');
    const total = Math.round((item.qtdSeparada + quantidade) * 1000000) / 1000000;
    if (item.processado || total > item.qtdEsperada) throw new Error('A leitura excede a quantidade pendente do item.');
    const lotes = (item.lotesSeparados || []).map((entrada) => ({ ...entrada }));
    if (!lotes.length && item.qtdSeparada > 0) {
      if (!item.controleSeparado) throw new Error('A separação anterior não informa o lote. Revise o item antes de bipar.');
      lotes.push({ controle: item.controleSeparado, dtValidade: item.dtValidadeSeparada, qtdSeparada: item.qtdSeparada });
    }
    const encontrado = lotes.find((entrada) => entrada.controle === lote.controle);
    if (encontrado) encontrado.qtdSeparada = Math.round((encontrado.qtdSeparada + quantidade) * 1000000) / 1000000;
    else lotes.push({ controle: lote.controle, dtValidade: lote.dtValidade, qtdSeparada: quantidade });
    const itemAnterior = { ...item };
    const estadoAnterior = { atualizadoEm: separacao.atualizadoEm, atualizadoPor: separacao.atualizadoPor, versao: separacao.versao };
    const agora = new Date().toISOString();
    Object.assign(item, { lotesSeparados: lotes, qtdSeparada: total,
      leiturasFeltrin: leituraId ? [...(item.leiturasFeltrin || []), leituraId].slice(-1000) : (item.leiturasFeltrin || []),
      processado: total >= item.qtdEsperada, ajustado: false,
      controleSeparado: lotes.length === 1 ? lotes[0].controle : null,
      dtValidadeSeparada: lotes.length === 1 ? lotes[0].dtValidade : null,
      atualizadoEm: agora, atualizadoPor: codUsu });
    separacao.atualizadoEm = agora;
    separacao.atualizadoPor = codUsu;
    separacao.versao = numero(separacao.versao) + 1;
    try {
      persistir();
    } catch (error) {
      Object.assign(item, itemAnterior);
      Object.assign(separacao, estadoAnterior);
      throw error;
    }
    return separacao;
  }

  return { filePath, namespace, state, obter, iniciar, atualizarItem, concluir, registrarLeituraFeltrin };
}

module.exports = { criarSeparacaoStore };
