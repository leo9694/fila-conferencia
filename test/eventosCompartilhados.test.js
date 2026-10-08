const test = require('node:test');
const assert = require('node:assert/strict');
const { criarEventosCompartilhados, criarProcessadorCompartilhado } = require('../api/eventosCompartilhados');

test('distribui para cem assinantes e remove todos sem acumular listeners', () => {
  const hub = criarEventosCompartilhados();
  let recebidos = 0;
  const callbacks = Array.from({ length: 100 }, () => () => recebidos++);
  for (const callback of callbacks) hub.on('message', callback);
  hub.emit('message');
  assert.equal(recebidos, 100);
  assert.equal(hub.listenerCount('message'), 100);
  for (const callback of callbacks) hub.off('message', callback);
  hub.emit('message');
  assert.equal(recebidos, 100);
  assert.equal(hub.listenerCount('message'), 0);
});

test('normaliza o mesmo evento uma vez para todas as conexões sem misturar eventos distintos', async () => {
  let chamadas = 0;
  const processar = criarProcessadorCompartilhado(async (evento, payload) => { chamadas++; return { evento, payload }; });
  const payload = { id: 1 };
  const resultados = await Promise.all(Array.from({ length: 50 }, () => processar('message:new', payload)));
  assert.equal(chamadas, 1);
  assert.equal(resultados[0], resultados[49]);
  await processar('message:status', payload);
  await processar('message:new', { id: 2 });
  assert.equal(chamadas, 3);
});
