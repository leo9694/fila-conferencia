const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { criarEventosCompartilhados } = require('../api/eventosCompartilhados');

test('SSE remove assinaturas e heartbeat ao fechar e não entrega eventos atrasados ou de outro canal', async () => {
  const eventosAtendimento = criarEventosCompartilhados();
  const globais = new Set();
  const individuais = new Set();
  const temporizadores = new Set();
  let handler;
  const subscribe = (grupo) => (callback) => { grupo.add(callback); return () => grupo.delete(callback); };
  const contexto = vm.createContext({
    router: { get(_path, callback) { handler = callback; } }, eventosAtendimento,
    realtime: { subscribe: subscribe(globais) }, whatsappApi: { createRealtimeBridge: () => ({ subscribe: subscribe(individuais) }) },
    criarRepassadorChamada: (_atendente, write) => ({ event, payload }) => write(event, payload),
    atendenteChamada: (atendente) => atendente,
    atendentePodeAcessarConversa: (atendente, conversa) => atendente.channelIds.includes(conversa.channel?.id),
    atendentePodeReceberEventoChamada: () => false,
    conversaOcultaParaUsuario: () => false, comAcessoAtendente: (conversa) => conversa,
    processarEventoTempoReal: async (_event, payload) => payload,
    setInterval(callback) { temporizadores.add(callback); return callback; },
    clearInterval(callback) { temporizadores.delete(callback); }
  });
  const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');
  vm.runInContext(fonte.slice(fonte.indexOf("router.get('/events'"), fonte.indexOf('router.use((error, _req, res, next)')), contexto);
  const conexoes = Array.from({ length: 25 }, () => {
    const req = Object.assign(new EventEmitter(), { query: {}, usuario: { codUsu: 72 }, atendente: { channelIds: ['mt'] } });
    const escritas = [];
    const res = Object.assign(new EventEmitter(), { setHeader() {}, flushHeaders() {}, write(text) { escritas.push(text); } });
    handler(req, res);
    return { req, res, escritas };
  });
  assert.equal(eventosAtendimento.listenerCount('assignment'), 25);
  assert.equal(globais.size, 25);
  for (const callback of globais) callback({ event: 'message:new', payload: { conversation: { id: 12, channel: { id: 'ms' } } } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(conexoes[0].escritas.length, 0);
  for (const callback of globais) callback({ event: 'message:new', payload: { conversation: { id: 12, channel: { id: 'mt' } } } });
  conexoes[0].res.emit('close');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(conexoes[0].escritas.length, 0);
  assert.ok(conexoes[1].escritas.length > 0);
  for (const { req, res } of conexoes) { res.emit('close'); req.emit('aborted'); }
  assert.equal(eventosAtendimento.listenerCount('assignment'), 0);
  assert.equal(eventosAtendimento.listenerCount('call'), 0);
  assert.equal(globais.size, 0);
  assert.equal(individuais.size, 0);
  assert.equal(temporizadores.size, 0);
});
