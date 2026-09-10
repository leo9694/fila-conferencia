const test = require('node:test');
const assert = require('node:assert/strict');
const { garantirContaItauEmpresa8 } = require('../api/faturamentoBanco');
const { garantirContaFaturamento } = require('../api/faturamentoBanco');

test('migra Sicredi selecionado para conta 82 e preserva títulos baixados e outras modalidades', async () => {
  const titulos = [
    { NUFIN: 1, CODCTABCOINT: 3, CODBCO: 748, CODTIPTIT: 19, RECDESP: 1 },
    { NUFIN: 2, CODCTABCOINT: 3, CODBCO: 748, CODTIPTIT: 4, RECDESP: 1, DHBAIXA: '10/09/2026' },
    { NUFIN: 3, CODCTABCOINT: 3, CODBCO: 748, CODTIPTIT: 1, RECDESP: 1 }
  ];
  const alterados = [];
  const deps = {
    nunota: 100,
    executeQuery: async (sql) => sql.includes('FROM TGFCAB')
      ? [{ CODEMP: 1, AD_BANCO: 3, BANCO_SELECIONADO: 748, BANCO_CONTA_SICREDI: 748 }]
      : titulos.map((titulo) => ({ ...titulo })),
    atualizarRegistro: async (entity, key, fields) => {
      assert.equal(entity, 'Financeiro');
      alterados.push(key.NUFIN);
      Object.assign(titulos.find((titulo) => titulo.NUFIN === key.NUFIN), fields);
    }
  };
  assert.deepEqual(await garantirContaFaturamento(deps), { aplicavel: true, corrigidos: 1 });
  assert.equal(titulos[0].CODCTABCOINT, 82);
  assert.equal(titulos[0].CODBCO, 748);
  assert.deepEqual(alterados, [1]);
  assert.deepEqual(await garantirContaFaturamento(deps), { aplicavel: true, corrigidos: 0 });
});

test('recusa conta 82 cadastrada com banco incompatível sem alterar títulos', async () => {
  await assert.rejects(garantirContaFaturamento({
    nunota: 100,
    executeQuery: async () => [{ AD_BANCO: 82, BANCO_CONTA_SICREDI: 756 }],
    atualizarRegistro: async () => assert.fail('Não deve gravar conta incompatível')
  }), /não está cadastrada como Sicredi/);
});

test('não confunde Sicoob com Sicredi', async () => {
  assert.deepEqual(await garantirContaFaturamento({
    nunota: 100,
    executeQuery: async () => [{ CODEMP: 8, AD_BANCO: 51, BANCO_SELECIONADO: 756 }],
    atualizarRegistro: async () => assert.fail('Não deve alterar Sicoob')
  }), { aplicavel: false, corrigidos: 0 });
});

test('prepara financeiro do pedido Itaú que veio com a conta Sicoob sem duplicar correção', async () => {
  const titulo = { NUFIN: 516287, CODCTABCOINT: 51, CODBCO: 756, CODTIPTIT: 19, RECDESP: 1, DHBAIXA: null };
  const atualizacoes = [];
  const dependencias = {
    nunota: 3882540,
    executeQuery: async (sql) => sql.includes('FROM TGFCAB')
      ? [{ NUNOTA: 3882540, CODEMP: 8, AD_BANCO: '71' }]
      : [{ ...titulo }],
    atualizarRegistro: async (entidade, chave, campos) => {
      atualizacoes.push({ entidade, chave, campos });
      Object.assign(titulo, campos);
    }
  };
  assert.deepEqual(await garantirContaItauEmpresa8(dependencias), { aplicavel: true, corrigidos: 1 });
  assert.deepEqual(atualizacoes, [{
    entidade: 'Financeiro', chave: { NUFIN: 516287 },
    campos: { CODCTABCOINT: 71, CODBCO: 341 }
  }]);
  assert.deepEqual(await garantirContaItauEmpresa8(dependencias), { aplicavel: true, corrigidos: 0 });
  assert.equal(atualizacoes.length, 1);
});

test('preserva banco selecionado diferente de Itaú mesmo na empresa 8', async () => {
  await garantirContaItauEmpresa8({
    nunota: 100,
    executeQuery: async () => [{ NUNOTA: 100, CODEMP: 8, AD_BANCO: '50' }],
    atualizarRegistro: async () => assert.fail('Não deveria alterar outra conta')
  });
});

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
