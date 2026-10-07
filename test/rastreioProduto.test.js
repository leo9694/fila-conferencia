const test = require('node:test');
const assert = require('node:assert/strict');
const { validarFiltrosRastreio, montarSqlRastreio, consultarRastreioProduto, consultarFiltrosRastreio, consultarValoresColuna } = require('../api/rastreioProduto');
const filtros = { codProd: '1052', dataInicial: '2026-10-01', dataFinal: '2026-10-05' };

test('valida produto e período antes de consultar o Sankhya', async () => {
  let chamadas = 0;
  for (const query of [
    { ...filtros, codProd: '1 OR 1=1' }, { ...filtros, codProd: '' },
    { ...filtros, codProd: '-1' }, { ...filtros, dataInicial: '2026-02-30' },
    { ...filtros, dataFinal: '2026-09-01' }, { ...filtros, pagina: '0' },
    { ...filtros, pagina: '99999999999999999' }
  ]) {
    await assert.rejects(consultarRastreioProduto(query, async () => { chamadas += 1; }), { statusCode: 400 });
  }
  assert.equal(chamadas, 0);
});

test('pagina em ordem cronológica estável incluindo todos os tipos e situações', () => {
  const sql = montarSqlRastreio({ ...filtros, pagina: 2, limite: 50 });
  assert.match(sql, /ITE.CODPROD = 1052/);
  assert.match(sql, /LINHA > 50 AND LINHA <= 100/);
  assert.match(sql, /ORDER BY NVL\(CAB.DTENTSAI, CAB.DTNEG\), CAB.NUNOTA, ITE.SEQUENCIA/);
  assert.match(sql, /TOP.DHALTER = CAB.DHTIPOPER/);
  assert.match(sql, /< TO_DATE\('2026-10-05', 'YYYY-MM-DD'\) \+ 1/);
  assert.doesNotMatch(sql, /AND CAB.TIPMOV|AND CAB.STATUSNOTA|AND ITE.SEQUENCIA|DISTINCT/);
});

test('limita tamanho da página sem truncar a contagem de movimentações', () => {
  assert.equal(validarFiltrosRastreio({ ...filtros, limite: 500 }).limite, 100);
  assert.match(montarSqlRastreio(filtros), /COUNT\(\*\) OVER \(\) AS TOTAL/);
});

test('preserva linhas por lote e documento e informa total para navegação', async () => {
  const linhas = [{ NUNOTA: 123, SEQUENCIA: 1, TOTAL: 120 }, { NUNOTA: 123, SEQUENCIA: 2, TOTAL: 120 }];
  let chamadas = 0;
  const result = await consultarRastreioProduto(filtros, async () => ++chamadas === 1 ? [{ CODPROD: 1052, DESCRPROD: 'Salsa' }] : linhas);
  assert.equal(result.total, 120);
  assert.equal(result.totalPaginas, 3);
  assert.deepEqual(result.movimentacoes, linhas);
  assert.equal(chamadas, 2);
});

test('informa produto inexistente e período sem movimentações', async () => {
  await assert.rejects(consultarRastreioProduto(filtros, async () => []), { statusCode: 404 });
  let chamadas = 0;
  const result = await consultarRastreioProduto(filtros, async () => ++chamadas === 1 ? [{ CODPROD: 1052 }] : []);
  assert.equal(result.total, 0);
  assert.equal(result.totalPaginas, 0);
});

test('filtra empresa e TOP antes da contagem e paginação sem restringir quando vazios', () => {
  const sql = montarSqlRastreio({ ...filtros, empresa: '6', top: '35', pagina: 2 });
  assert.match(sql, /AND CAB.CODEMP = 6/);
  assert.match(sql, /AND CAB.CODTIPOPER = 35/);
  assert.match(sql, /LINHA > 50 AND LINHA <= 100/);
  assert.doesNotMatch(montarSqlRastreio({ ...filtros, empresa: '', top: '' }), /AND CAB.CODEMP =|AND CAB.CODTIPOPER =/);
  for (const query of [{ empresa: '1 OR 1=1' }, { top: '35; DELETE' }, { empresa: '-1' }, { top: '3.5' }]) {
    assert.throws(() => validarFiltrosRastreio({ ...filtros, ...query }), { statusCode: 400 });
  }
});

test('lista empresas e uma versão atual por TOP para os filtros', async () => {
  const consultas = [];
  const result = await consultarFiltrosRastreio(async (sql) => { consultas.push(sql); return []; });
  assert.deepEqual(result, { empresas: [], tops: [] });
  assert.match(consultas[0], /FROM TSIEMP ORDER BY CODEMP/);
  assert.match(consultas[1], /MAX\(T.DHALTER\)/);
});

test('aplica filtros das seis colunas no banco antes da paginação', () => {
  const sql = montarSqlRastreio({ ...filtros, colData: '03/10', colMovimento: 'Venda', colDocumento: '82800', colTop: '35', colEmpresa: 'Norte', colParceiro: 'Casa', pagina: 2 });
  for (const valor of ['03/10', 'VENDA', '82800', '35', 'NORTE', 'CASA']) assert.ok(sql.includes(`LIKE '%${valor}%'`));
  assert.ok(sql.indexOf("LIKE '%CASA%'") < sql.indexOf('WHERE LINHA >'));
  assert.match(sql, /CAB.NUNOTA/);
  assert.throws(() => validarFiltrosRastreio({ ...filtros, colParceiro: 'a'.repeat(161) }), { statusCode: 400 });
  assert.throws(() => validarFiltrosRastreio({ ...filtros, colEmpresa: {} }), { statusCode: 400 });
});

test('escapa aspas e curingas ao filtrar texto de coluna', () => {
  const sql = montarSqlRastreio({ ...filtros, colParceiro: "D'AGUA_100%" });
  assert.ok(sql.includes("D''AGUA\\_100\\%"));
  assert.ok(sql.includes("ESCAPE '\\'"));
});

test('filtra seleções exatas e distingue nenhuma seleção de selecionar tudo', () => {
  const sql = montarSqlRastreio({ ...filtros, selecoes: { colParceiro: { modo: 'incluir', valores: ["123 - D'AGUA", '456 - CASA'] } } });
  assert.match(sql, /IN \('123 - D''AGUA','456 - CASA'\)/);
  assert.match(montarSqlRastreio({ ...filtros, selecoes: { colTop: { modo: 'incluir', valores: [] } } }), /AND 1 = 0/);
  assert.doesNotMatch(montarSqlRastreio({ ...filtros, selecoes: { colTop: { modo: 'excluir', valores: [] } } }), /AND 1 = 0/);
  assert.throws(() => validarFiltrosRastreio({ ...filtros, selecoes: { invalida: { modo: 'incluir', valores: [] } } }), { statusCode: 400 });
});

test('carrega valores de todas as páginas ignorando somente a seleção da própria coluna', async () => {
  const result = await consultarValoresColuna({ ...filtros, coluna: 'colParceiro', selecoes: {
    colParceiro: { modo: 'incluir', valores: ['CASA'] }, colEmpresa: { modo: 'excluir', valores: ['6 - TURRA'] }
  } }, async (sql) => {
    assert.match(sql, /SELECT DISTINCT VALOR/);
    assert.doesNotMatch(sql, /WHERE LINHA >|IN \('CASA'\)/);
    assert.match(sql, /NOT IN \('6 - TURRA'\)/);
    return [{ VALOR: '123 - CASA' }, { VALOR: '456 - LOJA' }];
  });
  assert.deepEqual(result.valores, ['123 - CASA', '456 - LOJA']);
});

test('divide listas grandes em grupos aceitos pelo Oracle sem perder valores', () => {
  const valores = Array.from({ length: 1001 }, (_, index) => String(index));
  const sql = montarSqlRastreio({ ...filtros, selecoes: { colDocumento: { modo: 'incluir', valores } } });
  assert.match(sql, / OR /);
  assert.ok(sql.includes("'1000'"));
});
