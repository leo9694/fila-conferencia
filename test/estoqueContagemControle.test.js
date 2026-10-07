const test = require('node:test');
const assert = require('node:assert/strict');
const { semControleAdicional, validarRastreabilidadeNovoItem } = require('../api/estoqueContagemControle');

test('dispensa lote e datas somente para produto cadastrado sem controle adicional', () => {
  assert.equal(semControleAdicional('N'), true);
  assert.equal(semControleAdicional(null), false);
  assert.doesNotThrow(() => validarRastreabilidadeNovoItem({ tipoControle: 'N' }));
  for (const tipoControle of ['L', 'S', 'X', null, undefined]) {
    assert.throws(() => validarRastreabilidadeNovoItem({ tipoControle }), /lote/);
    assert.throws(() => validarRastreabilidadeNovoItem({ tipoControle, controle: 'L1' }), /fabricacao.*validade/);
  }
  assert.doesNotThrow(() => validarRastreabilidadeNovoItem({ tipoControle: 'L', controle: 'L1', dtFabricacao: '2026-01-01', dtValidade: '2027-01-01' }));
});
