const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../frontend/whatsapp-call-core');

function fixture(fetch = async () => ({ ok: true, json: async () => ({}) })) {
  const elements = new Map();
  const intervals = [];
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
    constructor() { this.handlers = {}; }
    addEventListener(event, listener) { this.handlers[event] = listener; }
    close() {}
  }
  const window = { WhatsAppCallCore: Core, crypto: { randomUUID: () => 'device-test-123' } };
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
  return { controller, elements, intervals };
}

const incoming = { callId: 'call-1', conversationId: 12, direction: 'INBOUND', status: 'RINGING' };

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
