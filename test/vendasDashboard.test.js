const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidarDashboardVendas,
  montarSqlDimensoesVendas,
  montarSqlGruposVendas,
  montarSqlTotaisVendas,
  normalizarEmpresa,
  validarPeriodoVendas
} = require('../api/vendasDashboard');

test('valida periodo inclusivo e limita a 24 meses', () => {
  assert.deepEqual(validarPeriodoVendas('2026-01-01', '2026-01-31'), {
    inicio: '2026-01-01', fim: '2026-01-31', dias: 31
  });
  assert.throws(() => validarPeriodoVendas('2026-02-30', '2026-03-01'), /validas/);
  assert.throws(() => validarPeriodoVendas('2026-04-02', '2026-04-01'), /posterior/);
  assert.throws(() => validarPeriodoVendas('2023-01-01', '2026-01-01'), /24 meses/);
});

test('normaliza empresa sem permitir entrada SQL', () => {
  assert.equal(normalizarEmpresa('3'), 3);
  assert.equal(normalizarEmpresa(''), null);
  assert.throws(() => normalizarEmpresa('1 OR 1=1'), /invalida/);
});

test('SQL usa somente faturamentos confirmados da TOP 35, periodo inclusivo e empresa segura', () => {
  const periodo = validarPeriodoVendas('2026-01-01', '2026-06-30');
  for (const sql of [
    montarSqlDimensoesVendas(periodo, 2),
    montarSqlTotaisVendas(periodo, 2),
    montarSqlGruposVendas(periodo, 2)
  ]) {
    assert.match(sql, /CAB\.CODTIPOPER = 35/);
    assert.match(sql, /CAB\.TIPMOV = 'V'/);
    assert.match(sql, /CAB\.STATUSNOTA = 'L'/);
    assert.doesNotMatch(sql, /CAB\.TIPMOV = 'P'/);
    assert.match(sql, /CAB\.DTNEG < TO_DATE\('2026-06-30'/);
    assert.match(sql, /CAB\.CODEMP = 2/);
  }

  const sqlDimensoes = montarSqlDimensoesVendas(periodo, 2);
  const sqlTotais = montarSqlTotaisVendas(periodo, 2);
  const sqlGrupos = montarSqlGruposVendas(periodo, 2);
  assert.match(sqlDimensoes, /SUM\(NVL\(ITE\.VLRTOT, 0\)\)/);
  assert.match(sqlDimensoes, /COUNT\(DISTINCT NUNOTA\) AS PEDIDOS/);
  assert.match(sqlTotais, /COUNT\(DISTINCT NUNOTA\) AS PEDIDOS/);
  assert.match(sqlTotais, /SUM\(VLRNOTA\) \/ NULLIF\(COUNT\(DISTINCT NUNOTA\), 0\)/);
  assert.match(sqlGrupos, /SUM\(NVL\(ITE\.VLRTOT, 0\)\)/);
  assert.doesNotMatch(sqlGrupos, /VLRUNIT/);
});

test('consolida indicadores, ranking e empresas com totais exatos', () => {
  const resultado = consolidarDashboardVendas({
    dimensoes: [
      { CODEMP: 1, EMPRESA: 'NORTE', MES: '2026-01', CODVEND: 10, VENDEDOR: 'ANA', STATUS_VENDA: 'FATURADO', PEDIDOS: 2, CLIENTES: 2, VALOR: 300 },
      { CODEMP: 1, EMPRESA: 'NORTE', MES: '2026-02', CODVEND: 10, VENDEDOR: 'ANA', STATUS_VENDA: 'LIBERADO', PEDIDOS: 1, CLIENTES: 1, VALOR: 150 },
      { CODEMP: 2, EMPRESA: 'SUL', MES: '2026-02', CODVEND: 20, VENDEDOR: 'BIA', STATUS_VENDA: 'PENDENTE', PEDIDOS: 1, CLIENTES: 1, VALOR: 50 }
    ],
    totais: [
      { CODEMP: null, PEDIDOS: 4, CLIENTES: 3, VENDEDORES: 2, VALOR: 500, TICKET_MEDIO: 125 },
      { CODEMP: 1, EMPRESA: 'NORTE', PEDIDOS: 3, CLIENTES: 2, VENDEDORES: 1, VALOR: 450, TICKET_MEDIO: 150 },
      { CODEMP: 2, EMPRESA: 'SUL', PEDIDOS: 1, CLIENTES: 1, VENDEDORES: 1, VALOR: 50, TICKET_MEDIO: 50 }
    ],
    grupos: [{ CODEMP: 1, EMPRESA: 'NORTE', CODGRUPOPROD: 100, GRUPO: 'SEMENTES', QUANTIDADE: 10, VALOR: 400 }]
  });

  assert.deepEqual(resultado.resumo, { pedidos: 4, clientes: 3, vendedores: 2, valor: 500, ticketMedio: 125 });
  assert.equal(resultado.vendedores[0].nome, 'ANA');
  assert.equal(resultado.vendedores[0].valor, 450);
  assert.equal(resultado.empresas[0].clientes, 2);
  assert.equal(resultado.status.find((item) => item.status === 'FATURADO').pedidos, 2);
  assert.equal(resultado.grupos[0].percentual, 100);
});
