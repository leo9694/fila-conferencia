const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Pipeline = require('../frontend/chat-pipeline');
const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');

test('filtro distingue pipeline atual, histórico e ambos inclusive categoria zero', () => {
  const conversa = { bitrix: { pipelines: [{ categoryId: 0 }], history: [{ categoryId: 7 }] } };
  assert.equal(Pipeline.matches(conversa, '0', 'current'), true);
  assert.equal(Pipeline.matches(conversa, 7, 'current'), false);
  assert.equal(Pipeline.matches(conversa, 7, 'history'), true);
  assert.equal(Pipeline.matches(conversa, 0, 'history'), false);
  assert.equal(Pipeline.matches(conversa, 7, 'all'), true);
  assert.equal(Pipeline.matches(conversa, 8), false);
  assert.equal(Pipeline.matches({}, ''), true);
  assert.equal(Pipeline.matches(conversa, false), false);
});

test('opções incluem pipelines históricos removidos do Bitrix sem duplicar categorias', () => {
  assert.deepEqual(Pipeline.options([{ categoryId: 0, name: 'Principal' }], [{ bitrixPipelines: [{ categoryId: 0, categoryName: 'Antigo nome' }], bitrixPipelineHistory: [{ categoryId: 7, categoryName: 'Histórico' }] }]),
    [{ categoryId: 7, name: 'Histórico' }, { categoryId: 0, name: 'Principal' }]);
});

function rota(inicio, fim, extras = {}) {
  let handler;
  const ctx = vm.createContext({ Pipeline, id: Number, idPipelineBitrix: Pipeline.id,
    router: { post(_url, fn) { handler = fn; }, get(_url, fn) { handler = fn; } }, asyncRoute: (fn) => fn,
    ...extras });
  vm.runInContext(fonte.slice(fonte.indexOf(inicio), fonte.indexOf(fim, fonte.indexOf(inicio))), ctx);
  return { handler, ctx };
}

function resposta() {
  return { code: 200, status(value) { this.code = value; return this; }, json(payload) { this.payload = payload; } };
}

test('assume sem pipeline somente com janela de resposta aberta pelo cliente e escolha explícita', async () => {
  for (const window of [{}, { canSendFreeform: false }, { canSendFreeform: true }]) {
    for (const body of [{ withoutPipeline: true }, {}, { withoutPipeline: true, pipelineId: 0 }]) {
      const eventos = [];
      const { handler } = rota("router.post('/conversations/:id/claim'", "router.post('/conversations/:id/bitrix-pipelines'", {
        obterConversaConsolidada: async () => ({ id: 1, serviceWindow: window }),
        obterAtribuicaoConversa: () => null, impedirReassumirAtendimento() {},
        vincularPipelineBitrix: () => assert.fail('Não deve criar card nesta escolha'),
        atribuirGrupoConversa: () => { eventos.push('assumir'); return { historico: [{}] }; },
        idsRelacionadosConversa: () => [1, 2],
        atendentes: { marcarConversaSemPipeline: (id) => eventos.push(id) },
        mensagemInternaAtribuicao: () => null, marcarGrupoConversaComoLida: async () => {},
        comAtribuicao: (v) => v, eventosAtendimento: { emit() {} }
      });
      const res = resposta();
      await handler({ params: { id: '1' }, body, atendente: { id: 72 } }, res);
      const permitido = window.canSendFreeform === true && body.withoutPipeline && body.pipelineId === undefined;
      assert.equal(res.code, permitido ? 200 : 400);
      assert.deepEqual(eventos, permitido ? ['assumir', 1, 2] : []);
    }
  }
  assert.equal(Pipeline.canAssumeWithoutPipeline({ metaWindow: { canSendFreeform: true } }), true);
  assert.equal(Pipeline.canAssumeWithoutPipeline({ lastMessage: { direction: 'OUTBOUND' } }), false);
});

test('assumir exige pipeline antes de atribuir e falha do Bitrix não deixa atendimento assumido', async () => {
  for (const body of [{}, { withoutPipeline: true }, { pipelineId: -1 }, { pipelineId: 0 }]) {
    const eventos = [];
    const { handler } = rota("router.post('/conversations/:id/claim'", "router.post('/conversations/:id/bitrix-pipelines'", {
      obterConversaConsolidada: async () => ({ id: 1 }), obterAtribuicaoConversa: () => null,
      impedirReassumirAtendimento() {},
      vincularPipelineBitrix: async () => { eventos.push('bitrix'); throw new Error('Bitrix indisponível'); },
      atribuirGrupoConversa: () => assert.fail('Não pode assumir sem vínculo')
    });
    const res = resposta();
    await handler({ params: { id: '1' }, body, atendente: { id: 72 } }, res);
    assert.equal(res.code, body.pipelineId === 0 ? 502 : 400);
    assert.equal(eventos.length, body.pipelineId === 0 ? 1 : 0);
  }
});

test('vincula antes de assumir e reutiliza pipeline atual em trocas de atendente', async () => {
  for (const existente of [false, true]) {
    const eventos = [];
    const { handler } = rota("router.post('/conversations/:id/claim'", "router.post('/conversations/:id/bitrix-pipelines'", {
      obterConversaConsolidada: async () => ({ id: 1 }),
      obterAtribuicaoConversa: () => existente ? { userId: 81, bitrixPipelines: [{ categoryId: 0, dealId: 99 }] } : null,
      impedirReassumirAtendimento() {}, vincularPipelineBitrix: async () => { eventos.push('bitrix'); },
      atribuirGrupoConversa: () => { eventos.push('assumir'); return { historico: [{}] }; },
      mensagemInternaAtribuicao: () => null, marcarGrupoConversaComoLida: async () => {},
      comAtribuicao: (v) => v, eventosAtendimento: { emit() {} }
    });
    const res = resposta();
    await handler({ params: { id: '1' }, body: existente ? {} : { pipelineId: 0 }, atendente: { id: 72 } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(eventos, existente ? ['assumir'] : ['bitrix', 'assumir']);
  }
});

test('criar conversa sem pipeline é rejeitado antes de chamar integrações', async () => {
  const { handler } = rota("router.post('/conversations',", "router.use('/conversations/:id'", {
    textoContatoChat: String, normalizarTelefoneWhatsapp: String,
    whatsappApi: { getChannels: () => assert.fail('Não deve criar contato') }
  });
  const res = resposta();
  await handler({ body: {} }, res);
  assert.equal(res.code, 400);
});

test('falha do Bitrix ao criar contato não atribui atendimento nem publica sucesso', async () => {
  const { handler } = rota("router.post('/conversations',", "router.use('/conversations/:id'", {
    textoContatoChat: String, normalizarTelefoneWhatsapp: String, identidadeTelefoneWhatsapp: String,
    whatsappApi: { getChannels: async () => ({ data: [{ id: 1 }] }), createConversation: async () => ({ conversation: { id: 1 } }) },
    atendentePodeAcessarCanal: () => true, buscarConversaPorTelefone: async () => null,
    consolidarConversas: (v) => v, chavesIdentidadeConversa: () => [], comAtribuicao: (v) => v,
    atendentes: { marcarConversaAvulsa() {}, revelarConversa() {}, atribuirConversa: () => assert.fail('Não deve assumir') },
    vincularPipelineBitrix: async () => { throw new Error('Falha no Bitrix'); }, eventosAtendimento: { emit: () => assert.fail('Não deve publicar atribuição') }
  });
  const res = resposta();
  await handler({ body: { contatoAvulso: true, nome: 'Cliente', telefone: '5565999999999', channelId: 1, pipelineId: 0 }, atendente: { id: 72 }, usuario: { codUsu: 72 } }, res);
  assert.equal(res.code, 502);
});

test('serializa vínculos de um mesmo chat e libera trava após falha para permitir nova tentativa', async () => {
  const ctx = vm.createContext({ id: Number, vinculandoPipelines: new Map() });
  vm.runInContext(fonte.slice(fonte.indexOf('function vincularPipelineBitrix('), fonte.indexOf('async function criarOuReutilizarPipelineBitrix(')), ctx);
  let ativas = 0;
  let maximo = 0;
  let numero = 0;
  ctx.criarOuReutilizarPipelineBitrix = async () => {
    ativas += 1;
    maximo = Math.max(maximo, ativas);
    await new Promise((resolve) => setImmediate(resolve));
    ativas -= 1;
    if (++numero === 1) throw new Error('Falha temporária');
    return { dealId: 99 };
  };
  const resultados = await Promise.allSettled([vm.runInContext('vincularPipelineBitrix({ id: 1 }, 0)', ctx), vm.runInContext('vincularPipelineBitrix({ id: 1 }, 0)', ctx)]);
  assert.equal(maximo, 1);
  assert.equal(resultados[0].status, 'rejected');
  assert.equal(resultados[1].status, 'fulfilled');
  assert.equal(ctx.vinculandoPipelines.size, 0);
});

test('filtra todas as páginas antes de paginar resultados e combina histórico com atendente e canal', async () => {
  const paginas = [];
  const conversas = [
    { id: 1, channelId: 1, assignment: { userId: '72' }, bitrix: { pipelines: [{ categoryId: 7 }] } },
    { id: 2, channelId: 1, assignment: { userId: '81' }, bitrix: { history: [{ categoryId: 7 }] } },
    { id: 3, channelId: 1, assignment: { userId: '72' }, bitrix: { history: [{ categoryId: 7 }] } }
  ];
  const { handler, ctx } = rota("router.get('/conversations',", "router.get('/channels'", {
    whatsappApi: { getConversations: async ({ page }) => { paginas.push(page); return { data: [conversas[page - 1]], pagination: { totalPages: 3 } }; } },
    consolidarConversas: (v) => v, comAtribuicao: (v) => v, vincularCadastrosSankhyaDoCache: (v) => v,
    enriquecerConversasEmSegundoPlano: async () => {}, atendentePodeAcessarConversa: () => true,
    acessoTemporarioPorTransferencia: () => false, conversaOcultaParaUsuario: () => false, comAcessoAtendente: (v) => v
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function conversaCorrespondeFiltroAtendente('), fonte.indexOf('function atribuicaoExpirada(')), ctx);
  const res = resposta();
  await handler({ query: { pipelineId: '7', pipelineScope: 'history', agentId: '72', channelId: '1' }, atendente: { id: '72' }, usuario: { codUsu: 72 } }, res);
  assert.deepEqual(paginas, [1, 2, 3]);
  assert.equal(res.payload.data.length, 1);
  assert.equal(res.payload.data[0].id, 3);
  assert.equal(res.payload.pagination.total, 1);
});

test('interface exige pipeline no cadastro e restringe assumir sem pipeline a mensagens do cliente', () => {
  assert.match(frontend, /if \(allowWithoutPipeline\)/);
  assert.match(frontend, /allowWithoutPipeline: Pipeline.canAssumeWithoutPipeline\(state.conversation\)/);
  const ctx = vm.createContext({ Pipeline, state: { manualContact: true }, refs: {
    manualContactName: { value: 'Cliente' }, manualContactPhone: { value: '65999999999' },
    newChannel: { value: '1' }, newPipeline: { value: '' }, contactSubmit: {}
  } });
  vm.runInContext(frontend.slice(frontend.indexOf('  function updateNewContactSubmit('), frontend.indexOf('  function renderConversationSkeleton(')), ctx);
  vm.runInContext('updateNewContactSubmit()', ctx);
  assert.equal(ctx.refs.contactSubmit.disabled, true);
  ctx.refs.newPipeline.value = '0';
  vm.runInContext('updateNewContactSubmit()', ctx);
  assert.equal(ctx.refs.contactSubmit.disabled, false);
});
