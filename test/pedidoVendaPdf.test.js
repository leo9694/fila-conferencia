const test = require('node:test');
const assert = require('node:assert/strict');

const { quantidadeSeparadaExibida } = require('../api/pedidoVendaPdf');

test('mantem quantidade original antes da conclusao da separacao', () => {
  assert.equal(quantidadeSeparadaExibida({ QTDNEG: 10 }), '10');
});

test('mostra divergencia e item zerado no PDF depois da separacao', () => {
  assert.equal(quantidadeSeparadaExibida({
    QTDNEG: 10,
    QTD_SEPARADA: 5,
    SEPARACAO_CONCLUIDA: true
  }), '5/10');
  assert.equal(quantidadeSeparadaExibida({
    QTDNEG: 10,
    QTD_SEPARADA: 0,
    SEPARACAO_CONCLUIDA: true
  }), 'X');
  assert.equal(quantidadeSeparadaExibida({
    QTDNEG: 10,
    QTD_SEPARADA: 10,
    SEPARACAO_CONCLUIDA: true
  }), '10');
});
