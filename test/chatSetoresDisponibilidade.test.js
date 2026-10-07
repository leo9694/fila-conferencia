const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function criarRotas(getCallIvrConfig) {
  const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');
  const inicio = fonte.indexOf("router.get('/settings/calls',");
  const fim = fonte.indexOf("router.put('/settings/users/:codUsu'", inicio);
  const handlers = {};
  const configuracoes = [];
  vm.runInNewContext(fonte.slice(inicio, fim), {
    router: {
      get: (route, _auth, handler) => { handlers.get = handler; },
      put: (route, _auth, handler) => { handlers.put = handler; }
    },
    exigirDiretoria: () => {},
    perfilAtendente: (usuario) => ({ id: String(usuario?.codUsu), name: usuario?.nome, director: usuario?.grupos?.includes('DIRETORIA') === true }),
    asyncRoute: (handler) => handler,
    carregarConfiguracaoAtendentes: async () => ({ canais: [{ id: 'numero-1' }, { id: 'numero-2' }], usuarios: [] }),
    whatsappApi: {
      getCallIvrConfig,
      callClientEnvironment: () => 'production',
      configureCallIvr: async (...args) => { configuracoes.push(args); }
    },
    setoresChamadas: {
      listar: () => ({ setores: [], revisao: 0 }),
      salvar: (_channelId, dados) => ({ setores: dados.setores, revisao: 1 })
    },
    configurarUra: (setores, enabled) => ({ enabled, setores }),
    configurandoUra: new Set()
  });
  const res = {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; }
  };
  return { handlers, configuracoes, res };
}

for (const status of [401, 404, 500, 503, undefined]) {
  test(`carrega números e setores mesmo quando a consulta de URA falha com ${status ?? 'erro de conexão'}`, async () => {
    const { handlers, res } = criarRotas(async () => { throw Object.assign(new Error('segredo interno'), { status }); });
    await handlers.get({ query: {}, atendente: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.canais.length, 2);
    assert.equal(res.body.channelId, 'numero-1');
    assert.equal(res.body.ura.unavailable, true);
    assert.match(res.body.ura.aviso, /URA não será alterada/);
    assert.doesNotMatch(res.body.ura.aviso, /segredo interno/);
    await handlers.get({ query: { channelId: 'numero-2' }, atendente: {} }, res);
    assert.equal(res.body.channelId, 'numero-2');
  });
}

test('preserva configuração de URA consultada com sucesso', async () => {
  const { handlers, res } = criarRotas(async () => ({ enabled: true }));
  await handlers.get({ query: {}, atendente: {} }, res);
  assert.equal(res.body.ura.enabled, true);
  assert.equal(res.body.ura.unavailable, undefined);
});

test('consulta e salva URA com identidade da diretoria antes do middleware do chat', async () => {
  const usuario = { codUsu: 72, nome: 'LEONARDO', grupos: ['DIRETORIA'] };
  const { handlers, configuracoes, res } = criarRotas(async (_channelId, agent) => {
    assert.equal(agent.id, '72');
    assert.equal(agent.name, 'LEONARDO');
    assert.equal(agent.director, true);
    return { enabled: false };
  });
  // As rotas de configuração vêm antes de router.use(exigirAcessoChat).
  await handlers.get({ query: {}, usuario }, res);
  assert.equal(res.body.ura.unavailable, undefined);
  await handlers.put({ params: { channelId: 'numero-1' }, usuario,
    body: { setores: [], uraEnabled: true } }, res);
  assert.equal(configuracoes.length, 1);
  assert.equal(configuracoes[0][2].id, '72');
  assert.equal(configuracoes[0][2].director, true);
  assert.equal(res.body.ura.enabled, true);
});

test('salvar setores sem consultar URA não sobrescreve seu estado nem configura a API', async () => {
  const { handlers, configuracoes, res } = criarRotas(async () => { throw new Error('offline'); });
  await handlers.get({ query: {}, atendente: {} }, res);
  let payload = res.body;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    await handlers.put({ params: { channelId: 'numero-1' }, body: { setores: [] }, usuario: { codUsu: 72 } }, res);
    assert.equal(Object.hasOwn(res.body, 'ura'), false);
    payload = { ...payload, ...res.body };
    assert.equal(payload.ura.unavailable, true);
  }
  assert.equal(configuracoes.length, 0);
});
