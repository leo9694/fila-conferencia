const test = require('node:test');
const assert = require('node:assert/strict');
const { distanciaViagem, totalPercorrido } = require('../frontend/diario-bordo-quilometragem');

test('calcula ida e volta pela distância do destino', () => {
  assert.equal(distanciaViagem({ distanciaIda: 25 }), 50);
  assert.equal(distanciaViagem({ distanciaIda: 0.1 }), 0.2);
});
test('soma cada viagem encerrada mesmo repetindo o destino', () => {
  const registros = Array.from({ length: 3 }, () => ({ placa: 'ABC1234', distanciaIda: 5, retorno: '2026-01-01' }));
  assert.equal(totalPercorrido(registros), 30);
});
test('não conta viagens abertas como percorridas', () => {
  assert.equal(totalPercorrido([{ distanciaIda: 25, retorno: null }, { distanciaIda: 10, retorno: '2026-01-01' }]), 20);
});
test('não converte odômetros antigos em distância de destino', () => {
  assert.equal(distanciaViagem({ kmInicial: 5, kmFinal: 5 }), null);
  assert.equal(totalPercorrido([{ kmInicial: 100, kmFinal: 200, retorno: '2026-01-01' }]), 0);
  assert.equal(distanciaViagem({ distanciaIda: 0 }), null);
});
