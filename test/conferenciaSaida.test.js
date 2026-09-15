const test = require('node:test');
const assert = require('node:assert/strict');
const { planejarDetalhesConferenciaSaida } = require('../api/conferenciaSaida');

const item = { CODPROD: 1072, CODBARRA: '7896061734915', CODVOL: 'UN', CONTROLE: '0070702310000020', QTDNEG: 10, QTDCORTE: 0 };

test('consolida as linhas 24 e 30 do pedido sem duplicar a quantidade ja salva', () => {
  const existentes = [{ ...item, SEQCONF: 24, QTDCONF: 10 }];
  const plano = planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 30 }
  ], existentes);
  assert.equal(plano.atribuicoes.length, 1);
  assert.equal(plano.atribuicoes[0].seqConf, 24);
  assert.equal(plano.atribuicoes[0].existente, true);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 20);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONFVOLPAD, 20);
  assert.equal(existentes[0].QTDCONF, 10);
  const repeticao = planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 30 }
  ], [{ ...plano.atribuicoes[0].detalhe, SEQCONF: 24 }]);
  assert.equal(repeticao.atribuicoes[0].detalhe.QTDCONF, 20);
});

test('bloqueia a mesma linha retornada duas vezes por unidades alternativas', () => {
  assert.throws(() => planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 24 }
  ], []), /sequencia 24 mais de uma vez/);
});

test('aloca os itens restantes depois das 29 linhas parcialmente salvas', () => {
  const itens = Array.from({ length: 29 }, (_, i) => ({ ...item, SEQUENCIA: i + 1, CODPROD: 9000 + i }));
  itens[23] = { ...item, SEQUENCIA: 24 };
  const existentes = itens.map((r) => ({ ...r, SEQCONF: r.SEQUENCIA }));
  itens.push({ ...item, SEQUENCIA: 30 }, { ...item, SEQUENCIA: 31, CODPROD: 1092 });
  const plano = planejarDetalhesConferenciaSaida(itens, existentes);
  assert.equal(plano.atribuicoes.length, 30);
  assert.equal(plano.atribuicoes[23].detalhe.QTDCONF, 20);
  assert.equal(plano.atribuicoes[29].seqConf, 30);
  assert.equal(plano.atribuicoes[29].existente, false);
});

test('retoma um detalhe existente sem somar a quantidade novamente', () => {
  const plano = planejarDetalhesConferenciaSaida([{ ...item, SEQUENCIA: 24 }], [
    { ...item, SEQCONF: 24, QTDCONF: 10 }
  ]);
  assert.equal(plano.atribuicoes[0].seqConf, 24);
  assert.equal(plano.atribuicoes[0].existente, true);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 10);
});

test('preserva lotes, unidades e barras diferentes e desconta cortes por linha', () => {
  const plano = planejarDetalhesConferenciaSaida([
    { ...item, QTDCORTE: 3 },
    { ...item, CONTROLE: 'outro' }, { ...item, CODVOLCONF: 'PC' },
    { ...item, CODBARRACONF: 'outra' }, { ...item, CODPROD: 8888, QTDCORTE: 10 }
  ], []);
  assert.equal(plano.atribuicoes.length, 4);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 7);
});

test('mantem sequencias das chaves existentes e zera detalhes que foram cortados', () => {
  const existentes = [{ ...item, SEQCONF: 7 }, { ...item, CONTROLE: 'outro', SEQCONF: 1 }];
  const plano = planejarDetalhesConferenciaSaida([item], existentes);
  assert.equal(plano.atribuicoes[0].seqConf, 7);
  assert.deepEqual(plano.sequenciasObsoletas, [1]);
});
