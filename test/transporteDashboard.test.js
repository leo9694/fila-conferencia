const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidarDashboardTransporte,
  normalizarFiltrosTransporte,
  validarPeriodoTransporte
} = require('../api/transporteDashboard');

const linhas = [
  { CHAVE_CTE: 'A', NUM_CTE: 10, TRANSPORTADORA: 'Trans A', EMPRESA: 'Norte Sul', PARCEIRO: 'Cliente A', CIDADE: 'Dourados', ESTADO: 'MS', NUM_NOTA: '100', VALOR_PEDIDO: 1000, PESO: 100, VOLUMES: 10, VALOR_FRETE: 100 },
  { CHAVE_CTE: 'B', NUM_CTE: 11, TRANSPORTADORA: 'Trans A', EMPRESA: 'Norte Sul', PARCEIRO: 'Cliente B', CIDADE: 'Campo Grande', ESTADO: 'MS', NUM_NOTA: '101', VALOR_PEDIDO: 500, PESO: 50, VOLUMES: 5, VALOR_FRETE: 75 },
  { CHAVE_CTE: 'C', NUM_CTE: 12, TRANSPORTADORA: 'Trans B', EMPRESA: 'Turra', PARCEIRO: 'Cliente C', CIDADE: 'Porto Velho', ESTADO: 'RO', NUM_NOTA: '102', VALOR_PEDIDO: 300, PESO: 30, VOLUMES: 3, VALOR_FRETE: 60 }
];

test('consolida transporte por estado, cidade e transportadora', () => {
  const resultado = consolidarDashboardTransporte(linhas, {});
  assert.equal(resultado.resumo.ctes, 3);
  assert.equal(resultado.resumo.valorFrete, 235);
  assert.equal(resultado.estados[0].uf, 'MS');
  assert.equal(resultado.estados[0].valorFrete, 175);
  assert.equal(resultado.cidades.find((item) => item.cidade === 'Dourados').participacaoEstado, 100 / 175 * 100);
  assert.equal(resultado.transportadoras[0].transportadora, 'Trans A');
  assert.equal(resultado.transportadoras[0].freteMedio, 87.5);
});

test('aplica filtros e compara transportadoras selecionadas', () => {
  const filtros = normalizarFiltrosTransporte({ transportadoras: 'Trans A|Trans B', estado: 'MS' });
  const resultado = consolidarDashboardTransporte(linhas, filtros, 'peso');
  assert.equal(resultado.resumo.ctes, 2);
  assert.equal(resultado.comparacao.length, 1);
  assert.equal(resultado.transportadoras[0].transportadora, 'Trans A');
});

test('normaliza o nome do estado para a UF usada no mapa', () => {
  const resultado = consolidarDashboardTransporte([
    { ...linhas[0], CHAVE_CTE: 'UF-1', ESTADO: 'Mato Grosso do Sul' }
  ]);
  assert.equal(resultado.estados[0].uf, 'MS');
});

test('valida período de transporte sem aceitar intervalo excessivo', () => {
  assert.deepEqual(validarPeriodoTransporte('2026-01-01', '2026-01-31'), { inicio: '2026-01-01', fim: '2026-01-31', dias: 31 });
  assert.throws(() => validarPeriodoTransporte('2024-01-01', '2026-12-31'), /24 meses/i);
});
