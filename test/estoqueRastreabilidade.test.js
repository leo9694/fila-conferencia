const test = require('node:test');
const assert = require('node:assert/strict');
const { planejarDatasRastreabilidade } = require('../api/estoqueRastreabilidade');

test('detecta cadastro de fabricacao quando lote, quantidade e validade nao mudam', () => {
  const plano = planejarDatasRastreabilidade({
    registro: { DTFABRICACAO: null, DTVAL: '2028-12-31' },
    dtFabricacao: '2026-05-05',
    dtValidade: '2028-12-31'
  });

  assert.deepEqual(plano.camposAlterados, { DTFABRICACAO: '2026-05-05' });
  assert.deepEqual(plano.datasAtualizadas, ['fabricacao']);
});

test('detecta alteracao isolada de validade', () => {
  const plano = planejarDatasRastreabilidade({
    registro: { DTFABRICACAO: '2026-05-05', DTVAL: '2027-12-31' },
    dtFabricacao: '2026-05-05',
    dtValidade: '2028-12-31'
  });

  assert.deepEqual(plano.camposAlterados, { DTVAL: '2028-12-31' });
  assert.deepEqual(plano.datasAtualizadas, ['validade']);
});

test('nao solicita gravacao quando as datas ja sao iguais', () => {
  const plano = planejarDatasRastreabilidade({
    registro: { DTFABRICACAO: '2026-05-05', DTVAL: '2028-12-31' },
    dtFabricacao: '2026-05-05',
    dtValidade: '2028-12-31'
  });

  assert.deepEqual(plano.camposAlterados, {});
  assert.deepEqual(plano.datasAtualizadas, []);
});
