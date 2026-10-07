const test = require('node:test');
const assert = require('node:assert/strict');
const { configurarUra } = require('../api/chatUra');

test('mapeia a gravação pelo nome dos setores independentemente da ordem na tela', () => {
  const config = configurarUra([
    { nome: 'Compras', atendentes: ['155'] },
    { nome: 'Vendas', atendentes: ['116', '72'] },
    { nome: ' financeiro ', atendentes: ['151'] }
  ], true);
  assert.deepEqual(config.options['1'].agentIds, ['151']);
  assert.deepEqual(config.options['2'].agentIds, ['116', '72']);
  assert.deepEqual(config.options['3'].agentIds, ['155']);
});

test('permite desativar a URA e recusa ativação sem os setores da gravação', () => {
  assert.deepEqual(configurarUra([], false), { enabled: false });
  assert.throws(() => configurarUra([], true), { status: 400 });
});
