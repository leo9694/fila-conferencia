const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrosDefinicaoFrete, consultarDefinicaoFrete, consultarHistoricoDefinicaoFrete } = require('../api/definicaoFrete');

const periodo = { dataInicial: '2026-11-04', dataFinal: '2026-11-05' };

test('valida empresa, parceiro e período em conjunto', () => {
  assert.throws(() => filtrosDefinicaoFrete({ cliente: '410' }), /data inicial/);
  assert.throws(() => filtrosDefinicaoFrete({ ...periodo, empresa: '1 OR 1=1' }), /empresa/);
  assert.throws(() => filtrosDefinicaoFrete({ ...periodo, cliente: '99999999999999999' }), /parceiro/);
  assert.equal(filtrosDefinicaoFrete({ ...periodo, cliente: ' 410 ' }).cliente, '410');
});

test('consulta tabelas de toda a seleção e calcula apenas as rotas aplicáveis às notas da página', async () => {
  const filtros = filtrosDefinicaoFrete({ ...periodo, empresa: '1', cliente: "D'Ávila_10%", pagina: '2' });
  const notas = Array.from({ length: 31 }, (_, i) => ({ NUNOTA: 100 + i, NUMNOTA: 10 + i }));
  notas[0].ORDEMCARGA = 5679;
  notas[0].DATA_FATURAMENTO = '05/11/2026';
  notas[0].TRANSPORTADORA_CARGA = 'Transportadora da ordem';
  notas[1].ORDEMCARGA = null;
  const chamadas = [];
  const dados = await consultarDefinicaoFrete(filtros, async (sql) => {
    chamadas.push(sql);
    if (sql.startsWith('WITH NOTAS')) return notas;
    if (sql.startsWith('WITH DESTINOS')) return [
      { NUCFR: 3, DESCRCALCFRET: 'ALT MT 2026' },
      { NUCFR: 5, DESCRCALCFRET: 'Tabela aplicável em outra página' }
    ];
    return [{ NUNOTA: 100, NUCFR: 3, CODEVENTO: 1, FORMULA: 'VALOR', VALOR: 27.5, REGIAO: 'MT' }];
  });
  assert.match(chamadas[0], /CAB\.DTNEG >= TO_DATE\('2026-11-04'/);
  assert.match(chamadas[0], /CAB\.CODEMP=1/);
  assert.match(chamadas[0], /CAB\.ORDEMCARGA/);
  assert.match(chamadas[0], /N\.ORDEMCARGA/);
  assert.match(chamadas[0], /TO_CHAR\(N\.DTFATUR,'DD\/MM\/YYYY'\) DATA_FATURAMENTO/);
  assert.match(chamadas[0], /LEFT JOIN TGFORD ORD ON ORD\.CODEMP=N\.CODEMP AND ORD\.ORDEMCARGA=N\.ORDEMCARGA AND N\.ORDEMCARGA>0/);
  assert.match(chamadas[0], /TRA\.CODPARC=ORD\.CODPARCTRANSP/);
  assert.match(chamadas[0], /D''Ávila\\_10\\%/);
  assert.match(chamadas[0], /OFFSET 30 ROWS FETCH NEXT 31 ROWS ONLY/);
  assert.match(chamadas[1], /SELECT DISTINCT CAB\.CODEMP, CAB\.CODPARC/);
  assert.match(chamadas[2], /CAB\.NUNOTA IN \(100,.*129\)/);
  assert.ok(chamadas.every((sql) => !/TGFIXN|TGFCFP|CAB\.CODPARCTRANSP/.test(sql)));
  assert.deepEqual(dados.colunas.map((tabela) => tabela.codigo), [3, 5]);
  assert.equal(dados.linhas[0].NUNOTA, 100);
  assert.equal(dados.linhas[0].ORDEMCARGA, 5679);
  assert.equal(dados.linhas[0].DATA_FATURAMENTO, '05/11/2026');
  assert.equal(dados.linhas[0].TRANSPORTADORA_CARGA, 'Transportadora da ordem');
  assert.equal(dados.linhas[1].ORDEMCARGA, null);
  assert.deepEqual(dados.linhas[0].sugestoes, [{ codigo: 3, valor: 27.5, regiao: 'MT' }]);
  assert.deepEqual(dados.linhas[1].sugestoes, []);
  assert.equal(dados.linhas.length, 30);
  assert.equal(dados.temMais, true);
});

test('simula todas as tabelas aplicáveis a cada venda anterior e preserva o frete real', async () => {
  const chamadas = [];
  const chavesCte = ['1'.repeat(44), '2'.repeat(44), '3'.repeat(44)];
  const pedidos = await consultarHistoricoDefinicaoFrete(104, async (sql) => {
    chamadas.push(sql);
    if (chamadas.length === 1) return [
      { NUNOTA: 103, TRANSPORTADORA: 'ALT TRANSPORTES' },
      { NUNOTA: 102, TRANSPORTADORA: 'CARVALIMA TRANSPORTES' },
      { NUNOTA: 101, TRANSPORTADORA: null }
    ];
    if (sql.startsWith('SELECT CAB.NUNOTA')) {
      return [['103', 6], [102, 8], [101, 10]].flatMap(([NUNOTA, PESO]) => [
        { NUNOTA, NUCFR: 3, DESCRCALCFRET: 'ALT', CODEVENTO: 1, FORMULA: 'VALOR * PESO', VALOR: 5, PESO },
        { NUNOTA, NUCFR: 4, DESCRCALCFRET: 'Gercadi', CODEVENTO: 1, FORMULA: 'VALOR * PESO', VALOR: 7, PESO },
        { NUNOTA, NUCFR: 5, DESCRCALCFRET: 'Carvalima', CODEVENTO: 1, FORMULA: 'VALOR * PESO', VALOR: 9, PESO }
      ]);
    }
    if (sql.startsWith('WITH XML_CTE')) return [
      { CHAVEACESSO: chavesCte[0], VALOR_TDE: '14.75' },
      { CHAVEACESSO: chavesCte[1], VALOR_TDE: 10.50 },
      { CHAVEACESSO: chavesCte[2], VALOR_TDE: 0 }
    ];
    return [
      { PEDIDO: '103', CHAVEACESSO: chavesCte[0], NUM_CTE: 1010, FRETE_REAL: 25, FRETE_CTE_TOTAL: 100, COMPARTILHADO: 1 },
      { PEDIDO: 103, CHAVEACESSO: chavesCte[1], NUM_CTE: 1011, FRETE_REAL: 5 },
      { PEDIDO: 103, CHAVEACESSO: chavesCte[1], NUM_CTE: 1011, FRETE_REAL: 5 },
      { PEDIDO: 102, CHAVEACESSO: chavesCte[2], NUM_CTE: 1012, FRETE_REAL: 0 }
    ];
  });
  assert.match(chamadas[0], /CAB\.CODPARC=ATUAL\.CODPARC/);
  assert.match(chamadas[0], /LEFT JOIN TGFPAR TRA ON TRA\.CODPARC=CAB\.CODPARCTRANSP/);
  assert.match(chamadas[0], /COALESCE\(TRA\.NOMEPARC, TRA\.RAZAOSOCIAL\) TRANSPORTADORA/);
  assert.match(chamadas[0], /ATUAL\.NUNOTA=104/);
  assert.match(chamadas[0], /CAB\.CODTIPOPER=35/);
  assert.match(chamadas[0], /CAB\.DTNEG < ATUAL\.DTNEG.*CAB\.NUNOTA < ATUAL\.NUNOTA/);
  assert.match(chamadas[0], /ORDER BY CAB\.DTNEG DESC, CAB\.NUNOTA DESC\s+FETCH FIRST 3 ROWS ONLY/);
  assert.match(chamadas[1], /C\.NUNOTA IN \(103,102,101\)/);
  assert.doesNotMatch(chamadas[2], /TGFCFP|CAB\.CODPARCTRANSP/);
  assert.match(chamadas[2], /F\.CODCID=PAR\.CODCID/);
  assert.match(chamadas[2], /CAB\.NUNOTA IN \(103,102,101\)/);
  assert.match(chamadas[3], new RegExp(chavesCte.map((chave) => "'" + chave + "'").join(',')));
  assert.match(chamadas[3], /\*:\bComp[\s\S]+\*:\bvComp/);
  assert.match(chamadas[3], /NLS_NUMERIC_CHARACTERS=''\.,''/);
  assert.deepEqual(pedidos.map((pedido) => [pedido.NUNOTA, pedido.freteReal]), [[103, 30], [102, 0], [101, null]]);
  assert.deepEqual(pedidos.map((pedido) => pedido.documentosCte), [
    [{ chave: chavesCte[0], numero: 1010 }, { chave: chavesCte[1], numero: 1011 }],
    [{ chave: chavesCte[2], numero: 1012 }],
    []
  ]);
  assert.deepEqual(pedidos.map(({ temTde, valorTde }) => [temTde, valorTde]), [[true, 25.25], [false, null], [null, null]]);
  assert.deepEqual(pedidos.map((pedido) => pedido.TRANSPORTADORA), ['ALT TRANSPORTES', 'CARVALIMA TRANSPORTES', null]);
  assert.deepEqual(pedidos.map((pedido) => pedido.sugestoes.map(({ codigo, nome, valor }) => [codigo, nome, valor])), [
    [[3, 'ALT', 30], [4, 'Gercadi', 42], [5, 'Carvalima', 54]],
    [[3, 'ALT', 40], [4, 'Gercadi', 56], [5, 'Carvalima', 72]],
    [[3, 'ALT', 50], [4, 'Gercadi', 70], [5, 'Carvalima', 90]]
  ]);
});

test('dispensa consulta de CT-e quando o cliente não tem vendas anteriores', async () => {
  let chamadas = 0;
  const pedidos = await consultarHistoricoDefinicaoFrete(104, async () => {
    chamadas += 1;
    return [];
  });
  assert.deepEqual(pedidos, []);
  assert.equal(chamadas, 1);
});
