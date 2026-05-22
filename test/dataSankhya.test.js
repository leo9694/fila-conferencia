const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../routes');

test('normaliza data da API Sankhya no formato DDMMYYYY HH:mm:ss', () => {
  assert.equal(
    routes._internals.normalizarDataSankhya('13052026 00:00:00'),
    '2026-05-13T00:00:00'
  );
});

test('normaliza data brasileira quando recebida com barras', () => {
  assert.equal(
    routes._internals.normalizarDataSankhya('13/05/2026 08:30:15'),
    '2026-05-13T08:30:15'
  );
});
