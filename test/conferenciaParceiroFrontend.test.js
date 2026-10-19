const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

test('prévia mostra data e parceiro no formato código - nome', () => {
  const linha = fonte.match(/^  pedidoPreviewMeta.textContent = (.+);$/m)[1];
  const ctx = vm.createContext({ pedido: { DTNEG: '2026-10-19', CODIGO_PARCEIRO: 3923, EMPRESA: 'GUIMARAES AGROPECUARIA LTDA' }, formatarData: () => '19/10/2026' });
  assert.equal(vm.runInContext(linha, ctx), '19/10/2026 | 3923 - GUIMARAES AGROPECUARIA LTDA');
  ctx.pedido = {};
  assert.equal(vm.runInContext(linha, ctx), '19/10/2026 | - - -');
});

test('tela dos itens exibe código - nome e escapa o nome do parceiro', () => {
  const ctx = vm.createContext({
    pedidoSelecionado: { CODIGO_PARCEIRO: 3923, EMPRESA: 'CLIENTE <TESTE>' },
    filaModoConferencia: 'saida', pedidoEmConferenciaCard: {},
    formatarTituloPedidoConferencia: () => 'Nota de venda', formatarData: () => '',
    formatarMoeda: () => '', formatarQuantidade: () => '', atualizarIcones() {},
    escaparHtml: (v) => String(v).replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function renderizarPedidoEmConferencia()'), fonte.indexOf('function obterChaveStorageSeparacao()')), ctx);
  ctx.renderizarPedidoEmConferencia();
  assert.match(ctx.pedidoEmConferenciaCard.innerHTML, /pedido-side-cliente">3923 - CLIENTE &lt;TESTE&gt;/);
});
