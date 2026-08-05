const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function criarNamespace(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'padrao';
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function carregar(filePath) {
  if (!fs.existsSync(filePath)) return { sessoes: {} };

  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return state && typeof state === 'object'
      ? { sessoes: state.sessoes || {} }
      : { sessoes: {} };
  } catch (error) {
    console.error('Falha ao carregar contagens de estoque:', error);
    return { sessoes: {} };
  }
}

function criarChaveItem(item) {
  return [
    numero(item.codProd || item.CODPROD),
    numero(item.codLocal || item.CODLOCAL),
    texto(item.controle || item.CONTROLE) || 'SEM_CONTROLE'
  ].join('|');
}

function normalizarItem(item = {}) {
  const codProd = numero(item.codProd || item.CODPROD);
  const codLocal = numero(item.codLocal || item.CODLOCAL);
  const controle = texto(item.controle || item.CONTROLE);

  return {
    chave: texto(item.chave) || criarChaveItem({ codProd, codLocal, controle }),
    codProd,
    descrProd: texto(item.descrProd || item.DESCRPROD) || `Produto ${codProd}`,
    referencia: texto(item.referencia || item.REFERENCIA),
    codVol: texto(item.codVol || item.CODVOL) || 'UN',
    codGrupoProd: numero(item.codGrupoProd || item.CODGRUPOPROD) || null,
    descrGrupoProd: texto(item.descrGrupoProd || item.DESCRGRUPOPROD) || 'Sem grupo',
    codLocal,
    descrLocal: texto(item.descrLocal || item.DESCRLOCAL) || `Local ${codLocal}`,
    controle,
    dtFabricacao: texto(item.dtFabricacao || item.DTFABRICACAO) || null,
    dtVal: texto(item.dtVal || item.DTVAL) || null,
    estoqueSistema: numero(item.estoqueSistema ?? item.ESTOQUE),
    adicionadoManualmente: item.adicionadoManualmente === true,
    contagens: item.contagens && typeof item.contagens === 'object' ? { ...item.contagens } : {},
    atualizadoEm: item.atualizadoEm || null,
    atualizadoPor: item.atualizadoPor ?? null
  };
}

function versaoSessao(sessao) {
  return Math.max(1, Math.trunc(numero(sessao?.versao)) || 1);
}

function atualizarSessao(sessao, agora, usuario) {
  sessao.versao = versaoSessao(sessao) + 1;
  sessao.atualizadoEm = agora;
  sessao.atualizadoPor = usuario;
}

function erroConflitoItem() {
  const erro = new Error(
    'Este item foi atualizado em outro dispositivo. A contagem foi sincronizada; revise o valor antes de tentar novamente.'
  );
  erro.codigo = 'ESTOQUE_CONTAGEM_CONFLITO';
  return erro;
}

function obterContagemRodada(item, rodada) {
  const valor = item?.contagens?.[String(rodada)];
  return valor === null || valor === undefined ? null : numero(valor);
}

function obterContagemAtual(sessao, item) {
  const atual = obterContagemRodada(item, sessao.rodadaAtual);
  if (atual !== null || numero(sessao.rodadaAtual) <= 1) return atual;
  return obterContagemRodada(item, 1);
}

function itemDivergente(sessao, item) {
  const contagem = obterContagemAtual(sessao, item);
  return contagem !== null && Math.abs(contagem - numero(item.estoqueSistema)) > 0.000001;
}

function itensDaRecontagem(sessao) {
  return (sessao.itens || []).filter((item) => {
    const primeiraContagem = obterContagemRodada(item, 1);
    return primeiraContagem !== null
      && Math.abs(primeiraContagem - numero(item.estoqueSistema)) > 0.000001;
  });
}

function resumir(sessao) {
  const itens = sessao.itens || [];
  const contados = itens.filter((item) => obterContagemAtual(sessao, item) !== null);
  const divergentes = contados.filter((item) => itemDivergente(sessao, item));
  const unidadesSistema = itens.reduce((total, item) => total + numero(item.estoqueSistema), 0);
  const unidadesSistemaContadas = contados.reduce(
    (total, item) => total + numero(item.estoqueSistema),
    0
  );
  const unidadesContadas = contados.reduce((total, item) => total + numero(obterContagemAtual(sessao, item)), 0);

  return {
    totalItens: itens.length,
    itensContados: contados.length,
    itensPendentes: itens.length - contados.length,
    itensDivergentes: divergentes.length,
    unidadesSistema,
    unidadesContadas,
    diferencaUnidades: unidadesContadas - unidadesSistemaContadas
  };
}

function criarEstoqueContagemStore(options = {}) {
  const namespace = criarNamespace(options.namespace);
  const baseDir = options.baseDir || path.join(process.cwd(), 'data');
  const filePath = options.filePath || path.join(baseDir, `estoque-contagem-${namespace}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const state = carregar(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(id) {
    return state.sessoes[String(id)] || null;
  }

  function exigir(id) {
    const sessao = obter(id);
    if (!sessao) throw new Error('Contagem de estoque nao encontrada.');
    return sessao;
  }

  function listar() {
    return Object.values(state.sessoes)
      .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
      .map((sessao) => {
        const grupoSelecionado = numero(sessao.filtros?.grupo);
        const itemGrupo = grupoSelecionado
          ? (sessao.itens || []).find((item) => numero(item.codGrupoProd) === grupoSelecionado)
          : null;
        return {
          ...sessao,
          nomeGrupo: texto(sessao.nomeGrupo) || itemGrupo?.descrGrupoProd || null,
          resumo: resumir(sessao),
          itens: undefined
        };
      });
  }

  function excluir({ id }) {
    const sessao = exigir(id);
    delete state.sessoes[String(id)];
    persistir();
    return sessao;
  }

  function criar({
    empresa,
    nomeEmpresa,
    nomeGrupo = '',
    local = null,
    nomeLocal = '',
    filtros = {},
    usuario = null,
    itens = []
  }) {
    const agora = new Date().toISOString();
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const itensNormalizados = itens.map(normalizarItem).filter((item) => item.codProd && item.codLocal);

    state.sessoes[id] = {
      id,
      versao: 1,
      ambiente: namespace,
      empresa: numero(empresa),
      nomeEmpresa: texto(nomeEmpresa) || `Empresa ${numero(empresa)}`,
      nomeGrupo: texto(nomeGrupo) || null,
      local: local === null || local === undefined || local === '' ? null : numero(local),
      nomeLocal: texto(nomeLocal),
      filtros: { ...filtros },
      status: 'EM_CONTAGEM',
      rodadaAtual: 1,
      criadoEm: agora,
      criadoPor: usuario,
      atualizadoEm: agora,
      atualizadoPor: usuario,
      finalizadoEm: null,
      ajuste: null,
      itens: itensNormalizados
    };
    persistir();
    return state.sessoes[id];
  }

  function validarLancamento({ id, chave, quantidade, atualizadoEmEsperado }) {
    const sessao = exigir(id);
    if (!['EM_CONTAGEM', 'EM_RECONTAGEM'].includes(sessao.status)) {
      throw new Error('Esta contagem nao esta aberta para lancamentos.');
    }

    const item = sessao.itens.find((registro) => registro.chave === texto(chave));
    if (!item) throw new Error('Item nao pertence a esta copia de estoque.');
    if (
      atualizadoEmEsperado !== undefined
      && String(item.atualizadoEm || '') !== String(atualizadoEmEsperado || '')
    ) {
      throw erroConflitoItem();
    }
    if (sessao.status === 'EM_RECONTAGEM' && !itemDivergente({ ...sessao, rodadaAtual: 1 }, item)) {
      throw new Error('Na recontagem, somente itens divergentes podem ser alterados.');
    }

    const valor = Number(quantidade);
    if (!Number.isFinite(valor) || valor < 0) throw new Error('Informe uma quantidade valida.');

    return { sessao, item, valor };
  }

  function registrar({
    id,
    chave,
    quantidade,
    controle,
    dtFabricacao,
    dtValidade,
    estoqueSistema,
    atualizadoEmEsperado,
    usuario = null
  }) {
    const { sessao, item, valor } = validarLancamento({
      id,
      chave,
      quantidade,
      atualizadoEmEsperado
    });

    const agora = new Date().toISOString();
    if (controle !== undefined) item.controle = texto(controle);
    if (dtFabricacao !== undefined) item.dtFabricacao = texto(dtFabricacao) || null;
    if (dtValidade !== undefined) item.dtVal = texto(dtValidade) || null;
    if (estoqueSistema !== undefined) item.estoqueSistema = numero(estoqueSistema);
    item.contagens[String(sessao.rodadaAtual)] = valor;
    item.atualizadoEm = agora;
    item.atualizadoPor = usuario;
    atualizarSessao(sessao, agora, usuario);
    persistir();
    return sessao;
  }

  function adicionarItem({ id, item, quantidade, usuario = null }) {
    const sessao = exigir(id);
    if (sessao.status !== 'EM_CONTAGEM' || numero(sessao.rodadaAtual) !== 1) {
      throw new Error('Novos itens somente podem ser adicionados durante a primeira contagem.');
    }

    const novoItem = normalizarItem({
      ...item,
      adicionadoManualmente: true
    });
    if (!novoItem.codProd || !novoItem.codLocal) {
      throw new Error('Informe um produto e um local validos.');
    }
    if (!novoItem.controle) {
      throw new Error('Informe o lote/controle do novo item.');
    }
    if (sessao.itens.some((registro) => registro.chave === novoItem.chave)) {
      throw new Error('Este produto e lote ja fazem parte da foto. Abra a linha existente para informar a contagem.');
    }

    const valor = Number(quantidade);
    if (!Number.isFinite(valor) || valor < 0) throw new Error('Informe uma quantidade valida.');
    const agora = new Date().toISOString();
    novoItem.contagens[String(sessao.rodadaAtual)] = valor;
    novoItem.atualizadoEm = agora;
    novoItem.atualizadoPor = usuario;
    sessao.itens.push(novoItem);
    atualizarSessao(sessao, agora, usuario);
    persistir();
    return sessao;
  }

  function finalizarRodada({ id, usuario = null }) {
    const sessao = exigir(id);
    if (!['EM_CONTAGEM', 'EM_RECONTAGEM'].includes(sessao.status)) {
      throw new Error('Esta contagem nao esta aberta.');
    }
    if (
      sessao.status === 'EM_RECONTAGEM'
      && itensDaRecontagem(sessao).some((item) => obterContagemRodada(item, 2) === null)
    ) {
      throw new Error('Confira todos os itens antes de concluir a recontagem.');
    }

    const resumo = resumir(sessao);
    const agora = new Date().toISOString();
    sessao.status = resumo.itensDivergentes > 0 ? 'EM_ANALISE' : 'CONCLUIDA';
    atualizarSessao(sessao, agora, usuario);
    sessao.finalizadoEm = sessao.status === 'CONCLUIDA' ? agora : null;
    persistir();
    return sessao;
  }

  function iniciarRecontagem({ id, usuario = null }) {
    const sessao = exigir(id);
    if (sessao.status !== 'EM_ANALISE') throw new Error('A contagem precisa estar em analise.');
    if (sessao.rodadaAtual >= 2) throw new Error('A segunda contagem ja foi realizada.');
    if (!resumir(sessao).itensDivergentes) throw new Error('Nao existem itens divergentes.');

    const agora = new Date().toISOString();
    sessao.rodadaAtual = 2;
    sessao.status = 'EM_RECONTAGEM';
    atualizarSessao(sessao, agora, usuario);
    persistir();
    return sessao;
  }

  function concluirAnalise({ id, usuario = null }) {
    const sessao = exigir(id);
    if (sessao.status !== 'EM_ANALISE') throw new Error('A contagem precisa estar em analise.');
    if (numero(sessao.rodadaAtual) < 2 && resumir(sessao).itensDivergentes > 0) {
      throw new Error('Conclua a recontagem antes de preparar o ajuste.');
    }

    const agora = new Date().toISOString();
    sessao.status = resumir(sessao).itensDivergentes > 0 ? 'PRONTA_PARA_AJUSTE' : 'CONCLUIDA';
    sessao.finalizadoEm = agora;
    atualizarSessao(sessao, agora, usuario);
    persistir();
    return sessao;
  }

  function registrarAjustes({ id, notas = [], usuario = null }) {
    const sessao = exigir(id);
    if (sessao.status === 'AJUSTE_GERADO' && sessao.ajuste?.notas?.length) {
      return sessao;
    }
    if (sessao.status !== 'PRONTA_PARA_AJUSTE') {
      throw new Error('A contagem precisa estar pronta para ajuste.');
    }
    if (!Array.isArray(notas) || !notas.length) {
      throw new Error('Nenhuma nota de ajuste foi informada.');
    }

    const agora = new Date().toISOString();
    sessao.ajuste = {
      geradoEm: agora,
      geradoPor: usuario,
      notas: notas.map((nota) => ({
        nunota: numero(nota.nunota),
        tipo: texto(nota.tipo),
        codTipOper: numero(nota.codTipOper),
        quantidadeItens: numero(nota.quantidadeItens),
        observacao: texto(nota.observacao),
        status: texto(nota.status) || 'PENDENTE_CONFIRMACAO'
      }))
    };
    sessao.status = 'AJUSTE_GERADO';
    atualizarSessao(sessao, agora, usuario);
    persistir();
    return sessao;
  }

  return {
    filePath,
    namespace,
    state,
    obter,
    listar,
    excluir,
    criar,
    validarLancamento,
    registrar,
    adicionarItem,
    finalizarRodada,
    iniciarRecontagem,
    concluirAnalise,
    registrarAjustes,
    resumir
  };
}

module.exports = {
  criarChaveItem,
  criarEstoqueContagemStore,
  obterContagemAtual,
  resumir
};
