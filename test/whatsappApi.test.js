const test = require('node:test');
const assert = require('node:assert/strict');
const whatsappApi = require('../api/whatsappApi');

test('monta query da API omitindo valores vazios', () => {
  assert.equal(
    whatsappApi._internals.queryString({ page: 2, search: 'João Silva', status: '' }),
    '?page=2&search=Jo%C3%A3o+Silva'
  );
});

test('usa URL oficial por padrão e remove barra final configurada', () => {
  const original = process.env.WHATSAPP_API_URL;
  delete process.env.WHATSAPP_API_URL;
  assert.equal(whatsappApi._internals.baseUrl(), 'https://whatsapp-api.nortesulsementes.com');
  process.env.WHATSAPP_API_URL = 'https://exemplo.local///';
  assert.equal(whatsappApi._internals.baseUrl(), 'https://exemplo.local');
  if (original === undefined) delete process.env.WHATSAPP_API_URL;
  else process.env.WHATSAPP_API_URL = original;
});

test('normaliza MIME genérico de gravação conforme a extensão segura', () => {
  assert.equal(whatsappApi._internals.uploadMime('audio', {
    mimetype: 'application/octet-stream', originalname: 'gravacao.webm'
  }), 'audio/webm');
  assert.equal(whatsappApi._internals.uploadMime('audio', {
    mimetype: '', originalname: 'gravacao.ogg'
  }), 'audio/ogg');
});

test('explica quando a API de atendimento ainda não possui a exclusão de chats', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('Not Found', { status: 404 });
  try {
    await assert.rejects(
      () => whatsappApi.deleteConversation(123),
      /ainda não está atualizada para excluir chats/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('envia a reação para a mensagem da conversa sem montar URL manualmente', async () => {
  const originalFetch = global.fetch;
  let requestUrl = '';
  let requestOptions = {};
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    await whatsappApi.sendReaction(44, 'wamid.HBgMNTU=', '👏');
    assert.match(requestUrl, /\/api\/conversations\/44\/messages\/reaction$/);
    assert.deepEqual(JSON.parse(requestOptions.body), { messageId: 'wamid.HBgMNTU=', emoji: '👏' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('normaliza o envelope da API ao criar uma conversa', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: { conversation: { id: 91, contact: { waId: '5566999990000' } }, created: true }
  }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const result = await whatsappApi.createConversation({ name: 'Cliente Teste', phone: '5566999990000' });
    assert.equal(result.conversation.id, 91);
    assert.equal(result.created, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('bridge em tempo real assina eventos e encerra socket sem ouvintes', () => {
  const handlers = new Map();
  let disconnected = false;
  let options;
  const socket = {
    on(event, handler) { handlers.set(event, handler); },
    disconnect() { disconnected = true; }
  };
  const bridge = whatsappApi.createRealtimeBridge({
    ioFactory(_url, receivedOptions) { options = receivedOptions; return socket; }
  });
  const received = [];
  const unsubscribe = bridge.subscribe((event) => received.push(event));
  handlers.get('message:new')({ conversationId: 9, message: { id: 2 } });
  assert.equal(received[0].event, 'message:new');
  assert.deepEqual(options.transports, ['websocket', 'polling']);
  unsubscribe();
  assert.equal(disconnected, true);
});

test('token individual é curto, assinado e não expõe o segredo', () => {
  const original = process.env.CALL_AGENT_AUTH_SECRET;
  process.env.CALL_AGENT_AUTH_SECRET = 'segredo-de-teste-comprido-com-32-caracteres';
  try {
    const token = whatsappApi._internals.createAgentToken({ id: 42, name: 'Ana' }, 1000);
    const [payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    assert.equal(claims.sub, '42');
    assert.equal(claims.exp, 1090);
    assert.ok(signature);
    assert.doesNotMatch(token, /segredo-de-teste/);
  } finally {
    if (original === undefined) delete process.env.CALL_AGENT_AUTH_SECRET;
    else process.env.CALL_AGENT_AUTH_SECRET = original;
  }
});
