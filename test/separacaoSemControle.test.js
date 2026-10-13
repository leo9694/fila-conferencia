const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function ambiente(tipo = 'N') {
  const item = { codProd: 3572, tipContEst: tipo, controle: '', qtdSeparada: 0, descrProd: 'Produto sem lote' };
  let salvo = null;
  const ctx = vm.createContext({ item, itemSeparacaoPendente: { item, quantidade: 10, lotesDisponiveis: [] },
    separacaoLoteField: {}, separacaoLoteSelect: {}, separacaoLoteInfo: {}, botaoConfirmarSeparacao: {},
    separacaoConfirmStatus: {}, separacaoAjusteQtd: { value: '5' },
    itemSeparacaoProcessado: () => false, produtoSeparacaoFeltrin: () => false,
    quantidadeEsperadaSeparacao: () => 10, normalizarQuantidade: Number, formatarQuantidade: String,
    itemSeparacaoCompleto: (item) => item.qtdSeparada === 10,
    salvarProgressoSeparacao: async (item) => { salvo = { ...item }; },
    fecharConfirmacaoSeparacao() {}, renderizarItensSeparacao() {}, atualizarStatusSeparacao() {}, limparCodigoSeparacao() {},
    fetch: () => assert.fail('Produto sem controle não deve exigir consulta de lotes')
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function produtoSeparacaoSemControle('), fonte.indexOf('function abrirAjusteQuantidadeSeparacao(')), ctx);
  vm.runInContext(fonte.slice(fonte.indexOf('async function aplicarAjusteQuantidadeSeparacao('), fonte.indexOf('function localizarItemSeparacaoPorCodigo(')), ctx);
  return { ctx, obterSalvo: () => salvo };
}

test('produto 3572 sem controle confirma separação sem escolher lote', async () => {
  const { ctx, obterSalvo } = ambiente();
  await vm.runInContext('carregarLotesConfirmacaoSeparacao(item)', ctx);
  assert.equal(ctx.botaoConfirmarSeparacao.disabled, false);
  assert.equal(ctx.separacaoLoteField.hidden, true);
  await vm.runInContext('confirmarItemSeparacao()', ctx);
  assert.equal(obterSalvo().qtdSeparada, 10);
  assert.equal(obterSalvo().separacaoProcessada, true);
  assert.equal(obterSalvo().controleSeparado, null);
});

test('ajuste de produto sem controle também dispensa lote e não inventa validade', async () => {
  const { ctx, obterSalvo } = ambiente();
  await vm.runInContext('carregarLotesConfirmacaoSeparacao(item); aplicarAjusteQuantidadeSeparacao()', ctx);
  assert.equal(obterSalvo().qtdSeparada, 5);
  assert.equal(obterSalvo().dtValidadeSeparada, null);
});

test('somente cadastro explicitamente sem controle e sem lote no pedido recebe dispensa', () => {
  for (const tipo of ['L', '', undefined]) {
    const { ctx } = ambiente(tipo);
    if (tipo === undefined) ctx.item.tipContEst = undefined;
    assert.equal(vm.runInContext('produtoSeparacaoSemControle(item)', ctx), false);
  }
  const { ctx } = ambiente();
  ctx.item.controle = 'LOTE-A';
  assert.equal(vm.runInContext('produtoSeparacaoSemControle(item)', ctx), false);
});
