const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sqlHistoricoPedidosSaida } = require('../api/conferenciaSaidaNota');
const routes = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

test('ícones e rótulos dos cartões pendentes usam colunas fixas sem afetar conferidos', () => {
  const css = fs.readFileSync(path.join(__dirname, '../frontend/home-dashboard.css'), 'utf8');
  assert.match(css, /\.pool-fila \.pedido-card-status-group\s*\{\s*display: grid;\s*grid-template-columns: 103px 132px/);
  assert.match(css, /\.pool-fila \.pedido-status-indicadores\s*\{\s*display: grid;\s*grid-template-columns: repeat\(4, 22px\)/);
  assert.match(css, /\.pool-fila \.pedido-card-status-group\s*\{\s*grid-template-columns: 132px/);
});

test('painel de pedidos ganha 20% de largura relativa sem alterar o empilhamento em telas menores', () => {
  const css = fs.readFileSync(path.join(__dirname, '../frontend/home-dashboard.css'), 'utf8');
  const board = css.match(/body\.has-global-sidebar \.board\.acompanhamento-board\s*\{([^}]+)\}/)[1];
  const colunas = board.match(/minmax\(340px, ([\d.]+)fr\) minmax\(500px, ([\d.]+)fr\)/);
  assert.ok(colunas);
  const esquerda = Number(colunas[1]);
  const direita = Number(colunas[2]);
  assert.ok(Math.abs((esquerda / (esquerda + direita)) / (0.88 / (0.88 + 1.35)) - 1.2) < 0.000001);
  assert.match(css.slice(css.indexOf('@media (max-width: 1240px)')), /\.board\.acompanhamento-board\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

function contextoApi(executeQuery = async () => []) {
  const ctx = vm.createContext({ executeQuery, sqlHistoricoPedidosSaida, separacaoStore: { state: { 88: { status: 'SEPARADO' } } },
    obterNumeroInteiro: (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null,
    sqlTopsConferencia: () => '35, 10', sqlFiltroEmpresa: () => 'AND CAB.CODEMP = 6' });
  vm.runInContext(routes.slice(routes.indexOf('function montarSqlConferencias('), routes.indexOf("router.get('/empresas'")), ctx);
  return ctx;
}

test('consulta mostra pedidos aprovados com saldo a faturar, notas sem liberação e histórico antigo', () => {
  const ctx = contextoApi();
  const sql = ctx.montarSqlConferencias({ inicio: '2026-10-20', fim: '2026-10-22' }, 6);
  assert.match(sql, /AND CAB.CODEMP = 6/);
  assert.match(sql, /CAB.DTNEG >= TO_DATE\('2026-10-20'/);
  assert.match(sql, /NVL\(CAB.AD_STATUSINTPED, '0'\) = '1' AND NVL\(CAB.AD_STATUSCOMERCIAL, '0'\) = '1'/);
  assert.match(sql, /SUM\(NVL\(VAR.QTDATENDIDA, 0\)\)/);
  assert.match(sql, /FAT_ITEM.SEQUENCIAORIG = ITE.SEQUENCIA/);
  assert.match(sql, /PEND.QTDNEG, 0\) - NVL\(FAT_PEND.QTD_FATURADA, 0\) > 0.0001/);
  assert.match(sql, /NOTA.STATUSNOTA IN \('A', 'P', 'L'\)/);
  assert.match(sql, /WHEN CONF.STATUS = 'F' THEN 'CONFERIDO'/);
  assert.match(sql, /CAB.NUNOTA IN \(88\)/);
  assert.match(sql, /'AGUARDANDO FATURAMENTO'/);
  assert.match(sql, /'AGUARDANDO LIBERACAO'/);
  assert.doesNotMatch(sql, /WHERE[\s\S]*CAB.LIBCONF = 'S'/);
});

test('origens vinculadas a múltiplas notas não duplicam cartões nem quantidades', async () => {
  const ctx = contextoApi(async (sql) => {
    assert.match(sql, /SELECT DISTINCT VAR.NUNOTA, ORIG.NUNOTA AS NUNOTAORIG/);
    assert.match(sql, /VAR.NUNOTA IN \(200, 201\)/);
    return [ { NUNOTA: 200, NUNOTAORIG: 100 }, { NUNOTA: 200, NUNOTAORIG: 100 },
      { NUNOTA: 200, NUNOTAORIG: 101 }, { NUNOTA: 201, NUNOTAORIG: 100 } ];
  });
  const rows = await ctx.consultarOrigensAcompanhamento([
    { NUNOTA: 100, TIPMOV: 'P', QTD_FATURADA: 4, QTD_PENDENTE_FATURAMENTO: 6 },
    { NUNOTA: 200, TIPMOV: 'V', LIBCONF: 'N', QTD_TOTAL: 4 },
    { NUNOTA: 201, TIPMOV: 'V', LIBCONF: 'S', QTD_TOTAL: 6 },
    { NUNOTA: 88, TIPMOV: 'P', STATUS_CONFERENCIA: 'CONFERIDO' }
  ]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].FATURAMENTO_PARCIAL, true);
  assert.deepEqual(Array.from(rows[1].PEDIDOS_ORIGEM), [100, 101]);
  assert.equal(rows[1].PEDIDO_FATURADO, true);
  assert.equal(rows[1].LIBERADO_CONFERENCIA, false);
  assert.equal(rows[2].LIBERADO_CONFERENCIA, true);
  assert.equal(rows[1].QTD_TOTAL, 4);
  assert.equal(rows[3].STATUS_CONFERENCIA, 'CONFERIDO');
});

test('pedidos sem faturamento não fazem consulta de origem e grandes listas respeitam limite Oracle', async () => {
  let chamadas = 0;
  const ctx = contextoApi(async (sql) => {
    chamadas += 1;
    const numeros = sql.match(/IN \(([^)]+)\)/)[1].split(',');
    assert.ok(numeros.length <= 500);
    return [];
  });
  await ctx.consultarOrigensAcompanhamento([{ NUNOTA: 1, TIPMOV: 'P' }]);
  assert.equal(chamadas, 0);
  await ctx.consultarOrigensAcompanhamento(Array.from({ length: 1001 }, (_, i) => ({ NUNOTA: i + 1, TIPMOV: 'V' })));
  assert.equal(chamadas, 3);
});

function contextoCard() {
  const ctx = vm.createContext({ document: { createElement: () => ({}) },
    escaparAtributo: (v) => String(v ?? '').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    escaparHtml: (v) => String(v ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    formatarData: () => '22/10/2026', formatarDataHora: () => '22/10/2026 10:00',
    minutosDesdeInicio: () => 5, formatarTempoMinutos: (v) => `${v} min`, formatarQuantidade: String,
    formatarResumoItensUnidadesPainel: () => ({ itens: '2 itens', unidades: '10 un.' }),
    criarIndicadorStatusPedido: () => '' });
  vm.runInContext(frontend.slice(frontend.indexOf('function criarIndicadorFluxoPedido('), frontend.indexOf('function renderizarEstadoVazio(')), ctx);
  return ctx;
}

test('cartões distinguem pedido aprovado, faturamento parcial e nota faturada sem liberação', () => {
  const ctx = contextoCard();
  const pedido = ctx.criarCard({ NUNOTA: 100, TIPMOV: 'P', STATUS_CONFERENCIA: 'AGUARDANDO FATURAMENTO' });
  assert.match(pedido.innerHTML, /Pedido 100/);
  assert.match(pedido.innerHTML, /AGUARDANDO FATURAMENTO/);
  assert.doesNotMatch(pedido.innerHTML, /Nota 100/);
  const parcial = ctx.criarCard({ NUNOTA: 100, TIPMOV: 'P', FATURAMENTO_PARCIAL: true, QTD_PENDENTE_FATURAMENTO: 6, STATUS_CONFERENCIA: 'AGUARDANDO FATURAMENTO' });
  assert.match(parcial.innerHTML, /Saldo a faturar: 6/);
  const nota = ctx.criarCard({ NUNOTA: 200, TIPMOV: 'V', PEDIDOS_ORIGEM: [100], LIBERADO_CONFERENCIA: false, STATUS_CONFERENCIA: 'AGUARDANDO LIBERACAO' });
  assert.match(nota.innerHTML, /Pedido 100 faturado/);
  assert.match(nota.innerHTML, /Não liberado para conferência/);
  assert.match(nota.innerHTML, /Nota 200/);
  assert.doesNotMatch(nota.innerHTML, /class="acompanhamento-fluxo/);
  assert.match(nota.innerHTML, /data-lucide="receipt"/);
  assert.match(nota.innerHTML, /data-lucide="clipboard-check"/);
  assert.match(nota.innerHTML, /tabindex="0" title="Não liberado para conferência" aria-label="Não liberado para conferência"/);
  const liberada = ctx.criarCard({ NUNOTA: 201, TIPMOV: 'V', PEDIDOS_ORIGEM: [100], LIBERADO_CONFERENCIA: true, STATUS_CONFERENCIA: 'AGUARDANDO CONFERENCIA' });
  assert.match(liberada.innerHTML, /Liberado para conferência/);
  const historico = ctx.criarCard({ NUNOTA: 88, TIPMOV: 'P', STATUS_CONFERENCIA: 'CONFERIDO', TEMPO_TOTAL_CONFERENCIA_MIN: 20 });
  assert.match(historico.innerHTML, /Pedido 88/);
  assert.match(historico.innerHTML, /CONFERIDO/);
  assert.match(historico.innerHTML, /20 min/);
});

test('painel mantém todos os estágios e o histórico conferido sem inflar total faturado', async () => {
  const rows = [
    { NUNOTA: 100, STATUS_CONFERENCIA: 'AGUARDANDO FATURAMENTO' },
    { NUNOTA: 200, STATUS_CONFERENCIA: 'AGUARDANDO LIBERACAO' },
    { NUNOTA: 201, STATUS_CONFERENCIA: 'AGUARDANDO CONFERENCIA' },
    { NUNOTA: 202, STATUS_CONFERENCIA: 'EM ANDAMENTO' },
    { NUNOTA: 88, STATUS_CONFERENCIA: 'CONFERIDO', VLRNOTA: 100 },
    { NUNOTA: 203, STATUS_CONFERENCIA: 'CONFERIDO', VLRNOTA: 200 }
  ];
  const pools = { 'pool-pendentes': { itens: [], appendChild(item) { this.itens.push(item); } },
    'pool-conferidos': { itens: [], appendChild(item) { this.itens.push(item); } } };
  const ctx = vm.createContext({ URLSearchParams, console,
    periodoSelecionado: { dataInicial: '2026-10-20', dataFinal: '2026-10-22', empresa: 6 },
    fetch: async () => ({ json: async () => ({ itens: rows }) }),
    document: { getElementById: (id) => pools[id] }, criarCard: (item) => item,
    metricAndamento: {}, metricAguardando: {}, metricConferidos: {}, metricTotalFaturado: {}, countPendentes: {}, countConferidos: {},
    minutosDesdeInicio: () => 0, obterTimestamp: () => 0, ordenarPorDataDesc: () => 0, formatarMoeda: String, atualizarIcones() {} });
  vm.runInContext(frontend.slice(frontend.indexOf('async function carregarFila()'), frontend.indexOf('function iniciarAutoRefresh()')), ctx);
  await ctx.carregarFila();
  assert.deepEqual(pools['pool-pendentes'].itens.map((i) => i.NUNOTA), [202, 201, 200, 100]);
  assert.equal(pools['pool-conferidos'].itens.length, 2);
  assert.equal(ctx.metricAguardando.textContent, 3);
  assert.equal(ctx.metricTotalFaturado.textContent, '300');
});
