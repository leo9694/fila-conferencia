const test = require('node:test');
const assert = require('node:assert/strict');
const { criarChatRealtime } = require('../frontend/chat-realtime');

function ambiente() {
  const sources = [];
  class Source {
    constructor(url) { this.url = url; this.callbacks = new Map(); sources.push(this); }
    addEventListener(evento, callback) { this.callbacks.set(evento, callback); }
    close() { this.closed = true; }
    emit(evento, payload) { this.callbacks.get(evento)?.({ data: JSON.stringify(payload) }); }
  }
  const errors = [];
  const hub = criarChatRealtime({ EventSource: Source, clientId: 'device-123', onError: (error) => errors.push(error) });
  return { hub, sources, errors };
}

test('chat e telefonia usam uma única conexão com a identidade do dispositivo', () => {
  const { hub, sources } = ambiente();
  const chat = hub.subscribe();
  const call = hub.subscribe();
  assert.equal(sources.length, 1);
  assert.match(sources[0].url, /clientId=device-123/);
  let recebidas = 0;
  chat.addEventListener('message:new', () => recebidas++);
  call.addEventListener('call:incoming', () => recebidas++);
  sources[0].emit('message:new', {});
  sources[0].emit('call:incoming', {});
  assert.equal(recebidas, 2);
  call.close();
  assert.equal(sources[0].closed, undefined);
  sources[0].emit('message:new', {});
  assert.equal(recebidas, 3);
  chat.close();
  assert.equal(sources[0].closed, true);
  hub.subscribe();
  assert.equal(sources.length, 2);
});

test('falha de um assinante não bloqueia chamada de outro e não repete ringing para assinantes novos', () => {
  const { hub, sources, errors } = ambiente();
  const chat = hub.subscribe();
  const call = hub.subscribe();
  let chamadas = 0;
  chat.addEventListener('call:incoming', () => { throw new Error('UI do chat falhou'); });
  call.addEventListener('call:incoming', () => chamadas++);
  sources[0].emit('call:incoming', {});
  assert.equal(chamadas, 1);
  assert.equal(errors.length, 1);
  hub.subscribe().addEventListener('call:incoming', () => chamadas++);
  assert.equal(chamadas, 1);
});

test('distribui desconexão e repassa estado atual da telefonia sem manter estado antigo após queda', () => {
  const { hub, sources } = ambiente();
  const chat = hub.subscribe();
  let erros = 0;
  chat.onerror = () => erros++;
  chat.addEventListener('call:connection', () => {});
  sources[0].emit('call:connection', { state: 'connected' });
  let estados = 0;
  const call = hub.subscribe();
  call.onerror = () => erros++;
  call.addEventListener('call:connection', () => estados++);
  assert.equal(estados, 1);
  sources[0].onerror();
  assert.equal(erros, 2);
  hub.subscribe().addEventListener('call:connection', () => estados++);
  assert.equal(estados, 1);
});
