const test = require('node:test');
const assert = require('node:assert/strict');
const {
  montarSqlEstimativaFrete,
  normalizarEstimativaFrete,
  calcularIntervaloFrete
} = require('../api/estimativaFrete');

test('calcula estimativa pelo frete por kg do histórico da mesma cidade e empresa', () => {
  const estimativa = normalizarEstimativaFrete({
    CIDADE: 'Jaciara', UF: 'MT', PESO_PEDIDO: 25,
    VALOR_PEDIDO: 1000, N_CIDADE_TRANSP_FAIXA: 12,
    FRETE_CIDADE_TRANSP_FAIXA: 1500, PESO_CIDADE_TRANSP_FAIXA: 600,
    PEDIDO_CIDADE_TRANSP_FAIXA: 30000
  });

  assert.equal(estimativa.fretePorKg, 2.5);
  assert.equal(estimativa.freteEstimado, 62.5);
  assert.equal(estimativa.percentualFreteSobrePedido, 0.05);
  assert.equal(estimativa.freteEstimadoPorValor, 50);
  assert.equal(estimativa.ctesHistorico, 12);
  assert.equal(estimativa.fonteHistorico, 'cidade, transportadora e faixa de peso');
  assert.equal(estimativa.confianca, 'alta');
});

test('calibra a faixa pelo nivel de confianca sem inventar precisao', () => {
  assert.deepEqual(calcularIntervaloFrete(300, 'alta'), {
    minimo: 240,
    maximo: 360,
    margemPercentual: 20
  });
  assert.deepEqual(calcularIntervaloFrete(300, 'média'), {
    minimo: 180,
    maximo: 420,
    margemPercentual: 40
  });
  assert.deepEqual(calcularIntervaloFrete(300, 'baixa'), {
    minimo: 105,
    maximo: 495,
    margemPercentual: 65
  });
});

test('consulta usa somente CT-es importados dos últimos três meses', () => {
  const sql = montarSqlEstimativaFrete(3874385);
  assert.match(sql, /IX\.STATUS = 2/);
  assert.match(sql, /IX\.TIPO = 'C'/);
  assert.match(sql, /ADD_MONTHS\(TRUNC\(SYSDATE\), -3\)/);
  assert.match(sql, /P\.CODEMP = CAB\.CODEMP/);
  assert.match(sql, /P\.CODPARCTRANSP > 0/);
  assert.match(sql, /H\.PESO BETWEEN GREATEST\(P\.PESO_PEDIDO \/ 2, 1\) AND P\.PESO_PEDIDO \* 2/);
  assert.match(sql, /THEN PAR\.CODCID/);
  assert.match(sql, /CID_PAR\.NOMECID/);
  assert.match(sql, /NVL\(CAB\.VLRNOTA, 0\) VALOR_PEDIDO/);
  assert.match(sql, /PEDIDO_CIDADE_TRANSP_FAIXA/);
});

test('usa a faixa de peso do estado quando a cidade não possui histórico suficiente', () => {
  const estimativa = normalizarEstimativaFrete({
    CIDADE: 'Cidade nova', UF: 'MT', PESO_PEDIDO: 100, VALOR_PEDIDO: 2000,
    N_CIDADE_FAIXA: 1, FRETE_CIDADE_FAIXA: 80, PESO_CIDADE_FAIXA: 50, PEDIDO_CIDADE_FAIXA: 1000,
    N_UF_FAIXA: 9, FRETE_UF_FAIXA: 900, PESO_UF_FAIXA: 450, PEDIDO_UF_FAIXA: 18000
  });

  assert.equal(estimativa.fonteHistorico, 'estado e faixa de peso');
  assert.equal(estimativa.confianca, 'baixa');
  assert.equal(estimativa.freteEstimado, 200);
  assert.equal(estimativa.freteEstimadoPorValor, 100);
});

test('prioriza dois CT-es da mesma cidade e faixa antes da media estadual', () => {
  const estimativa = normalizarEstimativaFrete({
    CIDADE: 'Carlinda', UF: 'MT', PESO_PEDIDO: 24.345, VALOR_PEDIDO: 3773.24,
    N_CIDADE_FAIXA: 2, FRETE_CIDADE_FAIXA: 745.34, PESO_CIDADE_FAIXA: 60.652, PEDIDO_CIDADE_FAIXA: 7041.77,
    N_UF_TRANSP_FAIXA: 142, FRETE_UF_TRANSP_FAIXA: 19431.49, PESO_UF_TRANSP_FAIXA: 3476.93685, PEDIDO_UF_TRANSP_FAIXA: 333206.1
  });

  assert.equal(estimativa.fonteHistorico, 'cidade e faixa de peso');
  assert.equal(estimativa.ctesHistorico, 2);
  assert.ok(Math.abs(estimativa.freteEstimado - 299.17) < 0.01);
  assert.ok(Math.abs(estimativa.freteEstimadoPorValor - 399.38) < 0.01);
});

test('aceita período fixo somente quando as duas datas são válidas', () => {
  const sql = montarSqlEstimativaFrete(3874385, { inicio: '2026-01-01', fim: '2026-03-31' });
  assert.match(sql, /TO_DATE\('2026-01-01', 'YYYY-MM-DD'\)/);
  assert.match(sql, /TO_DATE\('2026-03-31', 'YYYY-MM-DD'\)/);
  assert.throws(() => montarSqlEstimativaFrete(1, { inicio: '2026-03-31', fim: '2026-01-01' }));
});
