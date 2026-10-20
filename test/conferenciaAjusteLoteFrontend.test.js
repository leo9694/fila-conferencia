const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function ambiente(fetch, salvo = { ok: true }) {
  const item = { sequencia: 1, codProd: 1010, descrProd: 'SEMENTE', controle: 'A', qtdNeg: 10, qtdConferida: 6, qtdCortada: 0 };
  const ctx = vm.createContext({
    filaModoConferencia: 'saida', pedidoSelecionado: { NUNOTA: 123, SAIDA_POR_NOTA: true, versaoLotes: 0 },
    itensPedidoSelecionado: [item], itensPedidoPreview: [item], itemAjusteLoteSelecionado: null, ajusteLoteEmAndamento: false,
    ajusteLoteModal: { hidden: true }, ajusteLoteProduto: {}, ajusteLoteSelect: { innerHTML: '', value: '' }, ajusteLoteQtd: {},
    ajusteLoteStatus: {}, botaoConfirmarAjusteLote: {}, botaoCancelarAjusteLote: {}, scanStatus: {},
    quantidadePendenteItem: (registro) => registro.qtdNeg - registro.qtdConferida - registro.qtdCortada,
    escaparHtml: String, escaparAtributo: String, formatarQuantidade: String, formatarData: (data) => data || '',
    salvarProgressoConferencia: async () => salvo, renderizarItensConferencia() {}, salvarNavegacaoFila() {}, fetch
  });
  vm.runInContext(fonte.slice(fonte.indexOf('async function abrirModalAjusteLote('), fonte.indexOf('function abrirModalCorte(')), ctx);
  return ctx;
}

test('painel oferece somente outros lotes com estoque positivo', async () => {
  const ctx = ambiente(async () => ({ ok: true, json: async () => ({ lotes: [
    { controle: 'A', estoque: 10 }, { controle: 'B', estoque: 0 }, { controle: 'C', estoque: -2 }, { controle: 'D', estoque: 3 }
  ] }) }));
  await ctx.abrirModalAjusteLote(1);
  assert.doesNotMatch(ctx.ajusteLoteSelect.innerHTML, /value="B"/);
  assert.doesNotMatch(ctx.ajusteLoteSelect.innerHTML, /value="C"/);
  assert.match(ctx.ajusteLoteSelect.innerHTML, /value="D"/);
  assert.doesNotMatch(ctx.ajusteLoteSelect.innerHTML, /value="A"/);
  assert.equal(ctx.ajusteLoteQtd.value, '4');
  assert.equal(ctx.botaoConfirmarAjusteLote.disabled, false);
});

test('painel desabilita ajuste quando só existem lotes zerados ou negativos', async () => {
  const ctx = ambiente(async () => ({ ok: true, json: async () => ({ lotes: [
    { controle: 'B', estoque: 0 }, { controle: 'C', estoque: -2 }
  ] }) }));
  await ctx.abrirModalAjusteLote(1);
  assert.equal(ctx.botaoConfirmarAjusteLote.disabled, true);
  assert.match(ctx.ajusteLoteStatus.textContent, /Nenhum outro lote com estoque positivo/);
});

test('ajuste envia revisão e saldo pendente e recarrega os itens reais da nota', async () => {
  let corpo;
  const ctx = ambiente(async (url, options) => {
    if (url.endsWith('/lotes-ajuste')) return { ok: true, json: async () => ({ lotes: [{ controle: 'B', estoque: 5 }] }) };
    if (url.endsWith('/ajustar-lote')) {
      corpo = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true, versaoLotes: 1 }) };
    }
    assert.match(url, /\/itens$/);
    return { ok: true, json: async () => ({ versaoLotes: 1, itens: [
      { sequencia: 1, controle: 'A', qtdNeg: 6, qtdConferida: 6 },
      { sequencia: 2, controle: 'B', qtdNeg: 4, qtdConferida: 0 }
    ] }) };
  });
  await ctx.abrirModalAjusteLote(1);
  ctx.ajusteLoteSelect.value = 'B';
  await ctx.confirmarAjusteLote();
  assert.deepEqual(corpo, { controle: 'B', quantidade: 4, quantidadeOriginal: 10, controleOriginal: 'A', versaoLotes: 0 });
  assert.equal(ctx.pedidoSelecionado.versaoLotes, 1);
  assert.equal(ctx.itensPedidoSelecionado[1].qtdConferida, 0);
  assert.equal(ctx.ajusteLoteModal.hidden, true);
  assert.equal(ctx.itensPedidoPreview.length, 0);
});

test('não grava ajuste se o progresso falhar ou a quantidade exceder o pendente', async () => {
  let escritas = 0;
  const ctx = ambiente(async () => { escritas += 1; }, null);
  ctx.itemAjusteLoteSelecionado = ctx.itensPedidoSelecionado[0];
  ctx.ajusteLoteSelect.value = 'B';
  ctx.ajusteLoteQtd.value = '5';
  await ctx.confirmarAjusteLote();
  assert.equal(escritas, 0);
  ctx.ajusteLoteQtd.value = '4';
  await ctx.confirmarAjusteLote();
  assert.equal(escritas, 0);
  assert.match(ctx.ajusteLoteStatus.textContent, /salvar o progresso/);
});

test('ação ajustar lote fica junto da tesoura apenas na conferência de saída por nota', () => {
  const botoes = [];
  const criarElemento = () => ({ setAttribute() {}, addEventListener() {},
    firstElementChild: { appendChild(botao) { botoes.push(botao); } },
    querySelector: () => ({ addEventListener() {} }) });
  const ctx = vm.createContext({ document: { createElement: criarElemento }, filaModoConferencia: 'saida',
    pedidoSelecionado: { SAIDA_POR_NOTA: true }, escaparAtributo: String, escaparHtml: String,
    obterUnidadeExibicaoItem: () => 'UN', formatarQuantidade: String });
  vm.runInContext(fonte.slice(fonte.indexOf('function criarLinhaItemConferencia('), fonte.indexOf('function criarCabecalhoItens(')), ctx);
  ctx.criarLinhaItemConferencia({ controle: 'A', leituras: [] }, 4, '', '', { cortar: true, selecionavel: false });
  assert.equal(botoes.length, 1);
  assert.equal(botoes[0].title, 'Ajustar lote');
  ctx.filaModoConferencia = 'entrada';
  ctx.formatarData = () => '-';
  ctx.criarLinhaItemConferencia({ controle: 'A', leituras: [] }, 4, '', '', { cortar: true, selecionavel: false });
  assert.equal(botoes.length, 1);
});
