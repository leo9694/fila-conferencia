const fs = require('node:fs');
const path = require('node:path');

function normalizarCodigo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? String(numero) : null;
}

function normalizarTexto(valor, limite = 160) {
  return String(valor || '').trim().slice(0, limite);
}

function normalizarCanais(valores) {
  if (!Array.isArray(valores)) return null;
  return [...new Set(valores
    .map((valor) => String(valor || '').trim())
    .filter((valor) => /^[A-Za-z0-9_-]{1,80}$/.test(valor)))];
}

function estadoVazio() {
  return { usuarios: {}, conversas: {}, ocultas: {}, ocultasGlobais: {} };
}

function carregar(filePath) {
  if (!fs.existsSync(filePath)) return estadoVazio();
  try {
    const conteudo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return conteudo && typeof conteudo === 'object'
      ? {
        usuarios: conteudo.usuarios && typeof conteudo.usuarios === 'object' ? conteudo.usuarios : {},
        conversas: conteudo.conversas && typeof conteudo.conversas === 'object' ? conteudo.conversas : {},
        ocultas: conteudo.ocultas && typeof conteudo.ocultas === 'object' ? conteudo.ocultas : {},
        ocultasGlobais: conteudo.ocultasGlobais && typeof conteudo.ocultasGlobais === 'object'
          ? conteudo.ocultasGlobais
          : {}
      }
      : estadoVazio();
  } catch (error) {
    console.error('Falha ao carregar configuracao dos atendentes do chat:', error.message);
    return estadoVazio();
  }
}

function criarChatAtendenteStore(options = {}) {
  const filePath = options.filePath || path.join(options.baseDir || path.join(process.cwd(), 'data'), 'chat-atendentes.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const state = carregar(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(codUsu) {
    const codigo = normalizarCodigo(codUsu);
    if (codigo === null) return null;
    const registro = state.usuarios[codigo];
    return registro ? { codUsu: Number(codigo), ...registro } : null;
  }

  function listarHabilitados() {
    return Object.entries(state.usuarios)
      .filter(([, item]) => item?.habilitado === true)
      .map(([codigo, item]) => ({ codUsu: Number(codigo), ...item }))
      .sort((a, b) => String(a.nomeExibicao || a.nome || '').localeCompare(String(b.nomeExibicao || b.nome || ''), 'pt-BR'));
  }

  function salvar(codUsu, dados = {}, atualizadoPor = null) {
    const codigo = normalizarCodigo(codUsu);
    if (codigo === null) throw new TypeError('Codigo de usuario invalido.');
    const anterior = state.usuarios[codigo] || {};
    const registro = {
      ...anterior,
      habilitado: dados.habilitado === undefined ? anterior.habilitado === true : dados.habilitado === true,
      nome: normalizarTexto(dados.nome ?? anterior.nome),
      nomeExibicao: normalizarTexto(dados.nomeExibicao ?? anterior.nomeExibicao ?? dados.nome ?? anterior.nome),
      assinatura: normalizarTexto(dados.assinatura ?? anterior.assinatura, 80),
      canaisPermitidos: dados.canaisPermitidos === undefined
        ? (Array.isArray(anterior.canaisPermitidos) ? anterior.canaisPermitidos : undefined)
        : normalizarCanais(dados.canaisPermitidos),
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: Number.isInteger(Number(atualizadoPor)) ? Number(atualizadoPor) : anterior.atualizadoPor || null
    };
    state.usuarios[codigo] = registro;
    persistir();
    return { codUsu: Number(codigo), ...registro };
  }

  function permitido(codUsu) {
    return obter(codUsu)?.habilitado === true;
  }

  function normalizarConversa(id) {
    const numero = Number(id);
    return Number.isInteger(numero) && numero > 0 ? String(numero) : null;
  }

  function obterConversa(id) {
    const chave = normalizarConversa(id);
    if (!chave) return null;
    const registro = state.conversas[chave];
    return registro ? { conversationId: Number(chave), ...registro } : null;
  }

  function atribuirConversa(id, { acao, ator, destino } = {}) {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa inválida.');
    const atual = state.conversas[chave] || {};
    const agora = new Date().toISOString();
    const historico = Array.isArray(atual.historico) ? atual.historico.slice(-49) : [];
    const liberar = ['RELEASE', 'EXPIRE'].includes(String(acao || '').toUpperCase());
    const proximo = liberar
      ? { userId: null, userName: null, assignedAt: null }
      : {
        userId: String(destino?.id || ator?.id || ''),
        userName: normalizarTexto(destino?.name || ator?.name || 'Atendente'),
        assignedAt: agora,
        lastInteractionAt: agora
      };
    if (!proximo.userId && !liberar) throw new TypeError('Atendente inválido.');
    const registro = {
      ...atual,
      ...proximo,
      assignmentAction: liberar ? null : normalizarTexto(acao, 20).toUpperCase(),
      historico: [...historico, {
        acao: normalizarTexto(acao, 20),
        atorId: String(ator?.id || ''),
        atorNome: normalizarTexto(ator?.name || 'Atendente'),
        destinoId: proximo.userId,
        destinoNome: proximo.userName,
        em: agora
      }]
    };
    state.conversas[chave] = registro;
    persistir();
    return { conversationId: Number(chave), ...registro };
  }

  function registrarInteracao(id, momento = new Date()) {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa inválida.');
    const atual = state.conversas[chave] || {};
    if (!atual.userId) return obterConversa(chave);
    const when = new Date(momento).toISOString();
    state.conversas[chave] = { ...atual, lastInteractionAt: when };
    persistir();
    return obterConversa(chave);
  }

  function renomearConversa(id, nome) {
    const chave = normalizarConversa(id);
    const nomeExibicao = normalizarTexto(nome);
    if (!chave || !nomeExibicao) throw new TypeError('Nome da conversa inválido.');
    const atual = state.conversas[chave] || {};
    state.conversas[chave] = {
      ...atual,
      nomeExibicao,
      renomeadoEm: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function marcarConversaAvulsa(id) {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa inválida.');
    const atual = state.conversas[chave] || {};
    state.conversas[chave] = {
      ...atual,
      contatoAvulso: true,
      atualizadoEm: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function marcarConversaSemPipeline(id) {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa inválida.');
    const atual = state.conversas[chave] || {};
    state.conversas[chave] = {
      ...atual,
      bitrixPending: false,
      bitrixPendingReason: '',
      bitrixWithoutPipeline: true,
      bitrixUpdatedAt: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function vincularPipeline(id, pipeline = {}) {
    const chave = normalizarConversa(id);
    const categoryId = Number(pipeline.categoryId);
    if (!chave || !Number.isInteger(categoryId) || categoryId < 0 || !pipeline.dealId) {
      throw new TypeError('Vinculo Bitrix invalido.');
    }
    const atual = state.conversas[chave] || {};
    const pipelines = Array.isArray(atual.bitrixPipelines) ? [...atual.bitrixPipelines] : [];
    const registroPipeline = {
      categoryId,
      categoryName: normalizarTexto(pipeline.categoryName),
      stageId: normalizarTexto(pipeline.stageId, 80),
      stageName: normalizarTexto(pipeline.stageName, 120),
      dealId: normalizarTexto(pipeline.dealId, 40),
      dealTitle: normalizarTexto(pipeline.dealTitle, 255),
      linkedAt: pipeline.linkedAt || new Date().toISOString()
    };
    const indice = pipelines.findIndex((item) => Number(item.categoryId) === categoryId);
    if (indice >= 0) pipelines[indice] = { ...pipelines[indice], ...registroPipeline };
    else pipelines.push(registroPipeline);
    state.conversas[chave] = {
      ...atual,
      bitrixPipelines: pipelines,
      bitrixPending: false,
      bitrixPendingReason: '',
      bitrixWithoutPipeline: false,
      bitrixUpdatedAt: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function arquivarPipelinesConcluidos(id, pipelinesConcluidos = []) {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa invalida.');
    const atual = state.conversas[chave] || {};
    const concluidos = (Array.isArray(pipelinesConcluidos) ? pipelinesConcluidos : [pipelinesConcluidos])
      .filter((item) => item?.dealId);
    if (!concluidos.length) return obterConversa(chave);
    const dealIds = new Set(concluidos.map((item) => String(item.dealId)));
    const ativos = (Array.isArray(atual.bitrixPipelines) ? atual.bitrixPipelines : [])
      .filter((item) => !dealIds.has(String(item.dealId)));
    const historicoAtual = Array.isArray(atual.bitrixPipelineHistory) ? atual.bitrixPipelineHistory : [];
    const historicoPorDeal = new Map(historicoAtual.map((item) => [String(item.dealId), item]));
    concluidos.forEach((item) => {
      historicoPorDeal.set(String(item.dealId), {
        ...historicoPorDeal.get(String(item.dealId)),
        ...item,
        completedAt: item.completedAt || new Date().toISOString()
      });
    });
    state.conversas[chave] = {
      ...atual,
      bitrixPipelines: ativos,
      bitrixPipelineHistory: [...historicoPorDeal.values()]
        .sort((a, b) => new Date(b.completedAt || b.linkedAt || 0) - new Date(a.completedAt || a.linkedAt || 0))
        .slice(0, 100),
      bitrixPending: ativos.length ? false : atual.bitrixPending === true,
      bitrixPendingReason: ativos.length ? '' : atual.bitrixPendingReason || '',
      bitrixWithoutPipeline: ativos.length ? false : atual.bitrixWithoutPipeline === true,
      bitrixUpdatedAt: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function marcarPipelinePendente(id, motivo = '') {
    const chave = normalizarConversa(id);
    if (!chave) throw new TypeError('Conversa invalida.');
    const atual = state.conversas[chave] || {};
    state.conversas[chave] = {
      ...atual,
      bitrixPending: true,
      bitrixPendingReason: normalizarTexto(motivo, 240),
      bitrixWithoutPipeline: false,
      bitrixUpdatedAt: new Date().toISOString()
    };
    persistir();
    return obterConversa(chave);
  }

  function normalizarIdentidades(identidades) {
    return [...new Set((Array.isArray(identidades) ? identidades : [identidades])
      .map((item) => normalizarTexto(item, 160))
      .filter(Boolean))];
  }

  function ocultarConversa(codUsu, identidades, dados = {}) {
    const codigo = normalizarCodigo(codUsu);
    const chaves = normalizarIdentidades(identidades);
    if (codigo === null || !chaves.length) throw new TypeError('Conversa inválida para ocultação.');
    if (!state.ocultas[codigo] || typeof state.ocultas[codigo] !== 'object') state.ocultas[codigo] = {};
    const registro = {
      ocultadaEm: new Date().toISOString(),
      nome: normalizarTexto(dados.nome),
      telefone: normalizarTexto(dados.telefone, 40)
    };
    chaves.forEach((chave) => { state.ocultas[codigo][chave] = registro; });
    persistir();
    return { identidades: chaves, ...registro };
  }

  function ocultarConversaGlobal(identidades, dados = {}) {
    const chaves = normalizarIdentidades(identidades);
    if (!chaves.length) throw new TypeError('Conversa inválida para ocultação global.');
    const registro = {
      ocultadaEm: new Date().toISOString(),
      nome: normalizarTexto(dados.nome),
      telefone: normalizarTexto(dados.telefone, 40)
    };
    chaves.forEach((chave) => { state.ocultasGlobais[chave] = registro; });
    persistir();
    return { identidades: chaves, ...registro };
  }

  function obterOcultacaoGlobal(identidades) {
    const registros = normalizarIdentidades(identidades)
      .map((chave) => state.ocultasGlobais[chave])
      .filter(Boolean)
      .sort((a, b) => new Date(b.ocultadaEm || 0) - new Date(a.ocultadaEm || 0));
    return registros[0] ? { ...registros[0] } : null;
  }

  function obterOcultacao(codUsu, identidades) {
    const codigo = normalizarCodigo(codUsu);
    if (codigo === null) return null;
    const registros = normalizarIdentidades(identidades)
      .map((chave) => state.ocultas[codigo]?.[chave])
      .filter(Boolean)
      .sort((a, b) => new Date(b.ocultadaEm || 0) - new Date(a.ocultadaEm || 0));
    return registros[0] ? { ...registros[0] } : null;
  }

  function revelarConversa(codUsu, identidades) {
    const codigo = normalizarCodigo(codUsu);
    if (codigo === null || !state.ocultas[codigo]) return false;
    let alterado = false;
    normalizarIdentidades(identidades).forEach((chave) => {
      if (Object.prototype.hasOwnProperty.call(state.ocultas[codigo], chave)) {
        delete state.ocultas[codigo][chave];
        alterado = true;
      }
    });
    if (alterado) persistir();
    return alterado;
  }

  function revelarConversaGlobal(identidades) {
    const chaves = normalizarIdentidades(identidades);
    const ocultacoesRelacionadas = new Set(chaves
      .map((chave) => state.ocultasGlobais[chave]?.ocultadaEm)
      .filter(Boolean));
    if (!ocultacoesRelacionadas.size) return false;
    let alterado = false;
    Object.keys(state.ocultasGlobais).forEach((chave) => {
      if (ocultacoesRelacionadas.has(state.ocultasGlobais[chave]?.ocultadaEm)) {
        delete state.ocultasGlobais[chave];
        alterado = true;
      }
    });
    if (alterado) persistir();
    return alterado;
  }

  return {
    filePath,
    state,
    obter,
    listarHabilitados,
    salvar,
    permitido,
    obterConversa,
    atribuirConversa,
    registrarInteracao,
    renomearConversa,
    marcarConversaAvulsa,
    marcarConversaSemPipeline,
    vincularPipeline,
    arquivarPipelinesConcluidos,
    marcarPipelinePendente,
    ocultarConversa,
    ocultarConversaGlobal,
    obterOcultacao,
    obterOcultacaoGlobal,
    revelarConversa,
    revelarConversaGlobal
  };
}

module.exports = { criarChatAtendenteStore, normalizarCodigo, normalizarCanais };
