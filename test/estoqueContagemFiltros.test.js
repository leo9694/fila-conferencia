const test = require('node:test');
const assert = require('node:assert/strict');
const {
  montarSqlFiltrosCopiaEstoque,
  normalizarFiltrosCopiaEstoque
} = require('../api/estoqueContagemFiltros');

test('normaliza todos os filtros da copia e corrige intervalo invertido', () => {
  const filtros = normalizarFiltrosCopiaEstoque({
    empresa: '2',
    local: '0',
    grupo: '101',
    incluirSubgrupos: false,
    marca: ' Norte Sul ',
    produtoInicial: 900,
    produtoFinal: 100,
    situacao: 'inativos',
    controle: 'com_controle',
    saldo: 'negativo'
  });

  assert.deepEqual(filtros, {
    empresa: 2,
    local: 0,
    grupo: 101,
    grupos: [101],
    incluirSubgrupos: false,
    marca: 'Norte Sul',
    produtoInicial: 100,
    produtoFinal: 900,
    situacao: 'INATIVOS',
    controle: 'COM_CONTROLE',
    saldo: 'NEGATIVO'
  });
});

test('normaliza varios grupos sem duplicar e gera filtro seguro', () => {
  const filtros = normalizarFiltrosCopiaEstoque({
    empresa: 1,
    grupos: ['3000300', 3000100, '3000300', 'invalido'],
    incluirSubgrupos: false
  });

  assert.deepEqual(filtros.grupos, [3000300, 3000100]);
  assert.equal(filtros.grupo, 3000300);
  const sql = montarSqlFiltrosCopiaEstoque(filtros);
  assert.match(sql, /PRO\.CODGRUPOPROD IN \(3000300, 3000100\)/);
  assert.doesNotMatch(sql, /invalido/);
});

test('gera filtro hierarquico e escapa marca para SQL', () => {
  const filtros = normalizarFiltrosCopiaEstoque({
    empresa: 1,
    grupo: 10,
    marca: "D'Agro",
    saldo: 'nao_zero'
  });
  const sql = montarSqlFiltrosCopiaEstoque(filtros);

  assert.match(sql, /START WITH GRU\.CODGRUPOPROD IN \(10\)/);
  assert.match(sql, /D''Agro/);
  assert.match(sql, /ABS\(NVL\(EST\.ESTOQUE, 0\)\) > 0\.000001/);
  assert.match(sql, /NVL\(PRO\.ATIVO, 'S'\) = 'S'/);
});
