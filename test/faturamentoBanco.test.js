const test = require('node:test');
const assert = require('node:assert/strict');
const { garantirContaItauEmpresa8 } = require('../api/faturamentoBanco');

test('corrige para o Itaú os títulos de boleto da empresa 8 e confirma a gravação', async () => {
  const consultas = [
    [{ NUNOTA: 100, CODEMP: 8, AD_BANCO: 71 }],
    [{ NUFIN: 200, CODCTABCOINT: 50, CODBCO: 1, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: null }],
    [{ NUFIN: 200, CODCTABCOINT: 71, CODBCO: 341, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: null }]
  ];
  const atualizacoes = [];

  const resultado = await garantirContaItauEmpresa8({
    nunota: 100,
    executeQuery: async () => consultas.shift(),
    atualizarRegistro: async (...args) => atualizacoes.push(args)
  });

  assert.deepEqual(resultado, { aplicavel: true, corrigidos: 1 });
  assert.deepEqual(atualizacoes, [[
    'Financeiro',
    { NUFIN: 200 },
    { CODCTABCOINT: 71, CODBCO: 341 }
  ]]);
});

test('não altera outras empresas ou contas bancárias', async () => {
  let atualizou = false;
  const resultado = await garantirContaItauEmpresa8({
    nunota: 100,
    executeQuery: async () => [{ NUNOTA: 100, CODEMP: 1, AD_BANCO: 1 }],
    atualizarRegistro: async () => { atualizou = true; }
  });

  assert.deepEqual(resultado, { aplicavel: false, corrigidos: 0 });
  assert.equal(atualizou, false);
});

test('não altera títulos baixados e acusa divergência que persistir', async () => {
  const consultas = [
    [{ NUNOTA: 100, CODEMP: 8, AD_BANCO: 71 }],
    [
      { NUFIN: 200, CODCTABCOINT: 50, CODBCO: 1, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: null },
      { NUFIN: 201, CODCTABCOINT: 50, CODBCO: 1, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: '2026-09-04' }
    ],
    [{ NUFIN: 200, CODCTABCOINT: 50, CODBCO: 1, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: null }]
  ];
  const atualizados = [];

  await assert.rejects(
    garantirContaItauEmpresa8({
      nunota: 100,
      executeQuery: async () => consultas.shift(),
      atualizarRegistro: async (_entidade, chave) => atualizados.push(chave.NUFIN)
    }),
    (erro) => erro.codigo === 'CONTA_BANCARIA_FATURAMENTO_DIVERGENTE'
  );
  assert.deepEqual(atualizados, [200]);
});
