const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../frontend/whatsapp-call-core');

function fixture(fetch = async () => ({ ok: true, json: async () => ({}) }), callCore = Core, compartilhar = false) {
  const elements = new Map();
  const intervals = [];
  const sources = [];
  const element = () => ({
    hidden: true, dataset: {}, classList: { remove() {}, toggle() {} },
    addEventListener(event, listener) { this[event] = listener; },
    removeAttribute() {}, setAttribute() {}, remove() {}
  });
  class AudioMock {
    cloneNode() { return new AudioMock(); }
    async play() { this.playing = true; }
    pause() { this.playing = false; }
  }
  class SourceMock {
    constructor() { this.handlers = {}; sources.push(this); }
    addEventListener(event, listener) { this.handlers[event] = listener; }
    close() {}
  }
  const window = { WhatsAppCallCore: callCore, crypto: { randomUUID: () => 'device-test-123' } };
  if (compartilhar) window.chatRealtime = require('../frontend/chat-realtime').criarChatRealtime({ EventSource: SourceMock, clientId: 'device-shared-123' });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/whatsapp-call.js'), 'utf8'), {
    window, navigator: {}, Audio: AudioMock, EventSource: SourceMock, fetch,
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      addEventListener() {}, createElement: element, body: { append() {} }
    },
    setInterval(callback) { intervals.push(callback); return intervals.length; }, clearInterval() {},
    setTimeout() { return 1; }, clearTimeout() {}, URLSearchParams
  });
  const controller = window.whatsappCallController;
  controller.start({ id: '72' });
  return { controller, elements, intervals, sources, hub: window.chatRealtime };
}

test('telefonia compartilhada mantém a identidade da aba e recebe chamada sem abrir outra conexão para o chat', () => {
  const { controller, sources, hub } = fixture(undefined, Core, true);
  const chat = hub.subscribe();
  let mensagens = 0;
  chat.addEventListener('message:new', () => mensagens++);
  assert.equal(sources.length, 1);
  assert.equal(controller.state.clientId, 'device-shared-123');
  sources[0].handlers['call:incoming']({ data: JSON.stringify(incoming) });
  assert.equal(controller.state.status, 'RINGING');
  sources[0].handlers['call:claimed']({ data: JSON.stringify({ callId: incoming.callId,
    attendant: { id: '72' }, clientId: 'outra-aba' }) });
  assert.equal(controller.state.call, null);
  sources[0].handlers['message:new']({ data: '{}' });
  assert.equal(mensagens, 1);
  controller.stop();
  chat.close();
});

const incoming = { callId: 'call-1', conversationId: 12, direction: 'INBOUND', status: 'RINGING' };

test('fecha a tela de falha imediatamente sem tentar encerrar uma chamada já finalizada na API', async () => {
  let requests = 0;
  const { controller, elements } = fixture(async () => { requests += 1; return new Promise(() => {}); });
  controller.handleEvent('call:incoming', incoming);
  controller.handleEvent('call:failed', { ...incoming, status: 'FAILED' });
  const before = requests;
  assert.equal(elements.get('whatsapp-call-end').hidden, false);
  await elements.get('whatsapp-call-end').click();
  assert.equal(controller.state.status, 'IDLE');
  assert.equal(elements.get('whatsapp-call-overlay').hidden, true);
  assert.equal(requests, before);
});

test('para o toque ao receber a posse de outro atendente e ignora incoming atrasado', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  const audio = controller.state.ringtone.audio;
  controller.handleEvent('call:claimed', { callId: 'call-1', attendant: { id: '81', name: 'Ana' } });
  assert.equal(audio.playing, false);
  assert.equal(controller.state.status, 'IDLE');
  controller.handleEvent('call:incoming', incoming);
  assert.equal(controller.state.call, null);
});

test('mantém o aceite do próprio dispositivo e não volta a tocar com incoming repetido', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.handleEvent('call:claimed', {
    callId: 'call-1', attendant: { id: '72' }, clientId: 'device-test-123'
  });
  controller.handleEvent('call:incoming', incoming);
  assert.equal(controller.state.status, 'CONNECTING');
  assert.equal(controller.state.ringtone, null);
});

test('outra aba do mesmo atendente para de tocar quando o primeiro dispositivo atende', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.handleEvent('call:claimed', { callId: 'call-1', attendant: { id: '72' }, clientId: 'other-device' });
  assert.equal(controller.state.call, null);
  assert.equal(controller.state.ringtone, null);
});

test('atualização ACTIVE sem mídia local fecha o aviso em vez de simular atendimento', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.handleEvent('call:updated', { call: { id: 'database-uuid', callId: 'call-1', status: 'ACTIVE' } });
  assert.equal(controller.state.call, null);
  assert.equal(controller.state.ringtone, null);
});

test('encerramento anterior ao incoming impede toque por evento fora de ordem', () => {
  const { controller } = fixture();
  controller.handleEvent('call:ended', incoming);
  controller.handleEvent('call:incoming', incoming);
  assert.equal(controller.state.call, null);
});

test('consulta o estado enquanto toca e recupera aviso de atendimento perdido', async () => {
  const { controller, intervals } = fixture(async () => ({
    ok: true, json: async () => ({
      atendimento: { userId: '81', userName: 'Ana', clientId: 'other-device' }, call: incoming
    })
  }));
  controller.handleEvent('call:incoming', incoming);
  intervals[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.call, null);
  assert.equal(controller.state.ringtone, null);
});

test('sinaliza desconexão da telefonia mesmo com o canal geral de chat conectado', () => {
  const { controller } = fixture();
  controller.state.source.handlers['call:connection']({ data: JSON.stringify({ state: 'disconnected' }) });
  assert.equal(controller.state.reconnecting, true);
});

test('não regride chamada ativa nem encerramento com eventos de progresso atrasados', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.state.client = { cleanup() {} };
  controller.handleEvent('call:active', incoming);
  controller.handleEvent('call:ringing', incoming);
  assert.equal(controller.state.status, 'ACTIVE');
  controller.state.status = 'ENDING';
  controller.handleEvent('call:updated', { ...incoming, status: 'ACTIVE' });
  assert.equal(controller.state.status, 'ENDING');
  controller.stop();
});

test('outra sessão para de tocar quando uma transferência é aceita no ambiente vencedor', () => {
  const { controller } = fixture();
  controller.handleEvent('call:transfer:incoming', { ...incoming, transferId: 'transfer-1' });
  const audio = controller.state.ringtone.audio;
  controller.handleEvent('call:transfer:accepted', { transferId: 'transfer-1', clientId: 'browser-production' });
  assert.equal(audio.playing, false);
  assert.equal(controller.state.call, null);
});

test('sinalização da Meta não renegocia o áudio do navegador já conectado ao gateway', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  let applied = false;
  controller.state.client = {
    peer: {}, cleanup() {},
    applySignal() { applied = true; return Promise.reject(new Error('SDP de outra conexão')); }
  };
  controller.handleEvent('call:active', incoming);
  controller.handleEvent('call:signal', { callId: incoming.callId, session: { sdpType: 'answer', sdp: 'meta-answer' } });
  assert.equal(applied, false);
  assert.equal(controller.state.status, 'ACTIVE');
  controller.stop();
});

test('falha antiga e eventos sem identidade não afetam uma nova ligação bem-sucedida', () => {
  const { controller } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.handleEvent('call:ended', incoming);
  controller.stop();
  controller.start({ id: '72' });
  const next = { ...incoming, callId: 'call-2' };
  controller.handleEvent('call:incoming', next);
  controller.state.client = { cleanup() {} };
  controller.handleEvent('call:active', next);
  controller.handleEvent('call:failed', incoming);
  controller.handleEvent('call:failed', {});
  assert.equal(controller.state.status, 'ACTIVE');
  assert.equal(controller.state.call.callId, 'call-2');
  controller.stop();
});

test('erro tardio de reprodução da primeira ligação não altera o painel da segunda', async () => {
  const clients = [];
  class ClientMock {
    constructor(options) { this.options = options; clients.push(this); }
    unlockRemoteAudio() {}
    async acceptIncoming() {}
    cleanup() { this.closed = true; }
  }
  const { controller, elements } = fixture(undefined, { ...Core, WhatsAppCallClient: ClientMock });
  controller.handleEvent('call:incoming', incoming);
  await elements.get('whatsapp-call-accept').click();
  assert.equal(controller.state.status, 'ACTIVE');
  controller.handleEvent('call:ended', incoming);
  controller.stop();
  controller.start({ id: '72' });
  controller.handleEvent('call:incoming', { ...incoming, callId: 'call-2' });
  await elements.get('whatsapp-call-accept').click();
  const status = elements.get('whatsapp-call-status');
  const message = status.textContent;
  clients[0].options.onMediaError(new Error('Reprodução atrasada'));
  clients[0].options.onRemoteMedia();
  assert.equal(status.textContent, message);
  assert.equal(controller.state.status, 'ACTIVE');
  assert.equal(controller.state.call.callId, 'call-2');
  controller.stop();
});

test('erro de sinalização tardio não transforma uma ligação encerrada com sucesso em falha', async () => {
  const { controller, elements } = fixture();
  controller.handleEvent('call:incoming', incoming);
  controller.state.client = {
    peer: {}, cleanup() {},
    applySignal: async () => { throw new Error('Peer já encerrado'); }
  };
  controller.handleEvent('call:active', incoming);
  controller.handleEvent('call:signal', {
    callId: incoming.callId, session: { sdpType: 'answer', sdp: 'meta-answer-atrasado' }
  });
  controller.handleEvent('call:ended', incoming);
  const message = elements.get('whatsapp-call-status').textContent;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controller.state.status, 'ENDED');
  assert.equal(controller.state.call, null);
  assert.equal(elements.get('whatsapp-call-status').textContent, message);
  controller.stop();
});
