const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deveMigrarPosicaoControle,
  deveMigrarPosicaoSemControle,
  planejarSaldosMigracaoControle,
  planejarDatasRastreabilidade
} = require('../api/estoqueRastreabilidade');

test('item novo sem registro anterior cria posicao em vez de tentar migrar nulo', () => {
  assert.equal(deveMigrarPosicaoSemControle({
    alterouControle: true,
    registroOrigem: null,
    controleOrigem: '',
    controleNovo: 'LOTE-10'
  }), false);
});

test('migra somente quando a posicao sem controle realmente existe', () => {
  assert.equal(deveMigrarPosicaoSemControle({
    alterouControle: true,
    registroOrigem: { CONTROLE: '', ESTOQUE: 10 },
    controleOrigem: '',
    controleNovo: 'LOTE-10'
  }), true);
  assert.equal(deveMigrarPosicaoSemControle({
    alterouControle: true,
    registroOrigem: { CONTROLE: 'LOTE-ANTIGO', ESTOQUE: 10 },
    controleOrigem: 'LOTE-ANTIGO',
    controleNovo: 'LOTE-10'
  }), false);
});

test('migra integralmente tambem quando troca um lote existente por outro', () => {
  assert.equal(deveMigrarPosicaoControle({
    alterouControle: true,
    registroOrigem: { CONTROLE: 'LOTE-ANTIGO', ESTOQUE: 2 },
    controleNovo: 'LOTE-NOVO'
  }), true);
  assert.equal(deveMigrarPosicaoControle({
    alterouControle: false,
    registroOrigem: { CONTROLE: 'LOTE-ANTIGO', ESTOQUE: 2 },
    controleNovo: 'LOTE-ANTIGO'
  }), false);
  assert.equal(deveMigrarPosicaoControle({
    alterouControle: true,
    registroOrigem: null,
    controleNovo: 'LOTE-NOVO'
  }), false);
});

test('migracao comum leva estoque e reserva para o novo controle', () => {
  assert.deepEqual(planejarSaldosMigracaoControle({
    saldoOrigem: 8,
    reservadoOrigem: 8
  }), {
    origem: { estoque: 0, reservado: 0, devePermanecer: false },
    destino: { estoque: 8, reservado: 8 }
  });
});

test('lote tecnico recebe saldo fisico e preserva reserva na posicao original', () => {
  assert.deepEqual(planejarSaldosMigracaoControle({
    saldoOrigem: 8,
    reservadoOrigem: 8,
    preservarReservaOrigem: true
  }), {
    origem: { estoque: 0, reservado: 8, devePermanecer: true },
    destino: { estoque: 8, reservado: 0 }
  });
});

test('lote tecnico remove a origem quando nao existe reserva para preservar', () => {
  assert.deepEqual(planejarSaldosMigracaoControle({
    saldoOrigem: 8,
    reservadoOrigem: 0,
    preservarReservaOrigem: true
  }), {
    origem: { estoque: 0, reservado: 0, devePermanecer: false },
    destino: { estoque: 8, reservado: 0 }
  });
});

test('aceita item sem posicao anterior durante contagem ou recontagem', () => {
  const plano = planejarDatasRastreabilidade({
    registro: null,
    dtFabricacao: '2026-05-05',
    dtValidade: '2028-12-31'
  });

  assert.deepEqual(plano.camposCompletos, {
    DTFABRICACAO: '2026-05-05',
    DTVAL: '2028-12-31'
  });
  assert.deepEqual(plano.camposAlterados, {
    DTFABRICACAO: '2026-05-05',
    DTVAL: '2028-12-31'
  });
});

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
