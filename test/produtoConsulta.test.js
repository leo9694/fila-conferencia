const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pesquisarProdutos, listarFiltrosProdutos } = require('../api/produtoConsulta');

test('combina grupo e marca com nome e permite consultar somente pelos filtros', async () => {
  for (const busca of ['flor', '']) {
    await pesquisarProdutos({ busca, grupo: '12', marca: "D'ÁGUA", executeQuery: async (sql) => {
      assert.match(sql, /AND PRO.CODGRUPOPROD = 12/);
      assert.match(sql, /AND TRIM\(PRO.MARCA\) = 'D''ÁGUA'/);
      if (busca) assert.match(sql, /WHERE \(\(PRO.REFERENCIA[\s\S]+OR \(INSTR[\s\S]+\)\)\s+AND PRO.CODGRUPOPROD/);
      else assert.match(sql, /WHERE 1 = 1/);
      return [];
    } });
  }
  for (const grupo of ['1 OR 1=1', '-1', '0.5', '9007199254740992']) {
    await assert.rejects(pesquisarProdutos({ busca: 'flor', grupo, executeQuery: () => assert.fail() }), { statusCode: 400 });
  }
  await assert.rejects(pesquisarProdutos({ marca: 'x'.repeat(121), executeQuery: () => assert.fail() }), { statusCode: 400 });
});

test('lista grupos e marcas do cadastro inclusive de produtos sem saldo', async () => {
  const filtros = await listarFiltrosProdutos({ executeQuery: async (sql) => {
    assert.doesNotMatch(sql, /TGFEST|ESTOQUE/);
    return sql.includes('TGFGRU') ? [{ CODGRUPOPROD: 12, DESCRGRUPOPROD: 'Sementes' }] : [{ MARCA: 'CIMO' }];
  } });
  assert.deepEqual(filtros.marcas, ['CIMO']);
  assert.equal(filtros.grupos[0].CODGRUPOPROD, 12);
});

test('busca palavras do nome sem acentos e agrega estoque de todos os resultados em uma consulta', async () => {
  const sqls = [];
  const resultado = await pesquisarProdutos({ busca: 'Óleo motor', executeQuery: async (sql) => {
    sqls.push(sql);
    return sqls.length === 1 ? [{ CODPROD: 1, DESCRPROD: 'OLEO MOTOR' }, { CODPROD: 2, DESCRPROD: 'MOTOR OLEO' }]
      : [{ CODPROD: 1, CODEMP: 1, NOMEEMPRESA: 'Matriz', ESTOQUE: 10, DISPONIVEL: 8 }, { CODPROD: 2, CODEMP: 2, NOMEEMPRESA: 'Filial', ESTOQUE: 4, DISPONIVEL: 4 }];
  } });
  assert.match(sqls[0], /INSTR\(TRANSLATE\(UPPER\(PRO.DESCRPROD\)[\s\S]*'OLEO'\) > 0 AND INSTR/);
  assert.match(sqls[0], /'MOTOR'\) > 0/);
  assert.match(sqls[1], /EST.CODPROD IN \(1, 2\)/);
  assert.equal(resultado.produtos[0].estoquePorEmpresa[0].DISPONIVEL, 8);
  assert.equal(resultado.empresas.length, 2);
  assert.equal(sqls.length, 2);
});

test('prioriza correspondência exata de código referência ou barras e preserva produto sem estoque', async () => {
  let chamada = 0;
  const resultado = await pesquisarProdutos({ busca: '1113', executeQuery: async (sql) => {
    if (++chamada === 1) {
      assert.match(sql, /PRO.CODPROD = 1113/);
      assert.match(sql, /VOA.CODBARRA = '1113'/);
      return [{ CODPROD: 1113, EXATO: 1 }, { CODPROD: 9999, EXATO: 0 }];
    }
    assert.match(sql, /EST.CODPROD IN \(1113\)/);
    return [];
  } });
  assert.equal(resultado.produtos.length, 1);
  assert.deepEqual(resultado.produtos[0].estoquePorEmpresa, []);
});

test('limita resultados valida entrada e escapa apóstrofos sem tratar percentual como curinga', async () => {
  const resultado = await pesquisarProdutos({ busca: "d'agua 10%", executeQuery: async (sql) => {
    if (sql.includes('FROM TGFPRO')) {
      assert.match(sql, /'D''AGUA'/);
      assert.match(sql, /'10%'/);
      assert.match(sql, /ROWNUM <= 101/);
      return Array.from({ length: 101 }, (_, i) => ({ CODPROD: i + 1 }));
    }
    return [];
  } });
  assert.equal(resultado.produtos.length, 100);
  assert.equal(resultado.limitado, true);
  for (const busca of ['', ' '.repeat(5), 'x'.repeat(121)]) await assert.rejects(pesquisarProdutos({ busca, executeQuery: () => assert.fail() }), { statusCode: 400 });
  const vazio = await pesquisarProdutos({ busca: 'inexistente', executeQuery: async () => [] });
  assert.deepEqual(vazio.produtos, []);
});

test('seleção por CODPROD não se confunde com referência ou barras iguais de outro produto', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
  let handler;
  let sqlProduto;
  const ctx = vm.createContext({ router: { get(_url, fn) { handler = fn; } }, console,
    obterNumeroInteiro: Number, textoSql: (v) => v.replaceAll("'", "''"),
    executeQuery: async (sql) => { sqlProduto = sql; return []; }
  });
  vm.runInContext(fonte.slice(fonte.indexOf("router.get('/produtos/consulta'"), fonte.indexOf('function serializarSessaoContagemEstoque(')), ctx);
  const res = { status(c) { this.code = c; return this; }, json(v) { this.payload = v; } };
  await handler({ query: { codProd: '1113' } }, res);
  assert.match(sqlProduto, /AND PRO.CODPROD = 1113\s+ORDER BY/);
  assert.equal(res.code, 404);
  await handler({ query: { codProd: '1 OR 1=1' } }, res);
  assert.equal(res.code, 400);
});
