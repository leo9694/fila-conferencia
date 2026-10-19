const test = require('node:test');
const assert = require('node:assert/strict');

const { quantidadeSeparadaExibida, tituloDocumentoConferencia } = require('../api/pedidoVendaPdf');

test('título distingue notas de venda e bonificação sem alterar pedidos antigos ou entrada', () => {
  for (const [tipMov, top, titulo] of [
    ['V', 35, 'NOTA DE VENDA'], ['V', 10, 'NOTA DE BONIFICACAO'],
    ['P', 5, 'PEDIDO DE VENDA'], ['P', 6, 'PEDIDO DE BONIFICACAO'],
    ['C', 13, 'NOTA DE COMPRA'], ['C', 21, 'BONIFICACAO DE ENTRADA']
  ]) assert.equal(tituloDocumentoConferencia({ TIPMOV: tipMov, CODTIPOPER: top }), titulo);
});

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
