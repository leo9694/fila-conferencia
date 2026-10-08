const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
const codigo = '0173202900230025300420100004510010';
const controle = '0023002530042010';

function ambienteConfirmacao(entradaCodigo = null) {
  const elemento = () => ({ hidden: false, value: '', textContent: '', innerHTML: '', focus() {}, classList: { toggle() {} } });
  const contexto = vm.createContext({
    itemSeparacaoPendente: null, separacaoConcluida: false, pedidoPreviewSelecionado: { NUNOTA: 123 },
    itemSeparacaoProcessado: () => false, normalizarQuantidade: Number, quantidadeEsperadaSeparacao: () => 20,
    produtoSeparacaoFeltrin: () => true, limparCodigoSeparacao() {}, atualizarProdutoConfirmacaoSeparacao() {},
    obterUnidadeExibicaoItem: () => 'UN', formatarQuantidade: String, formatarData: String,
    escaparAtributo: String, escaparHtml: String, obterDescricaoEntradaCodigo: () => 'Caixa',
    focarLoteFeltrinSeparacao() {},
    fetch: async () => ({ ok: true, json: async () => ({ lotes: [
      { controle, estoque: 100, disponivel: 100 }, { controle: '0023002530059010', estoque: 100, disponivel: 100 }
    ] }) }),
    separacaoFeltrinField: elemento(), separacaoFeltrinCodigo: elemento(), separacaoLoteField: elemento(),
    separacaoLoteSelect: elemento(), separacaoLoteInfo: elemento(), botaoConfirmarSeparacao: elemento(),
    separacaoConfirmTitulo: elemento(), separacaoConfirmField: elemento(), separacaoAjustePainel: elemento(),
    separacaoAjusteQtd: elemento(), separacaoConfirmQtd: elemento(), separacaoConfirmStatus: elemento(), separacaoConfirmModal: elemento()
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function obterLoteSelecionadoConfirmacao('), fonte.indexOf('async function confirmarItemSeparacao(')), contexto);
  contexto.item = { codProd: 1113, qtdSeparada: 0, controle };
  contexto.entrada = entradaCodigo;
  vm.runInContext('abrirConfirmacaoSeparacao(item, entrada)', contexto);
  return contexto;
}

test('clicar sem bipar permite selecionar o lote e confirmar a quantidade restante sem campo de código', async () => {
  const contexto = ambienteConfirmacao();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(contexto.separacaoFeltrinField.hidden, true);
  assert.equal(contexto.separacaoLoteField.hidden, false);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, false);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 20);
  contexto.separacaoLoteSelect.value = '0023002530059010';
  assert.equal(vm.runInContext('obterLoteSelecionadoConfirmacao().controle', contexto), '0023002530059010');
  const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
  assert.doesNotMatch(html, /id="separacao-feltrin-produto-codigo"/);
});

test('bipar na tela principal mantém o multiplicador e exige leitura do lote na confirmação', async () => {
  const contexto = ambienteConfirmacao({ codigo: '7891234567890', multiplicador: 10 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(contexto.separacaoFeltrinField.hidden, false);
  assert.equal(contexto.separacaoLoteField.hidden, true);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, true);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 10);
  assert.equal(vm.runInContext('obterLoteSelecionadoConfirmacao()', contexto), null);
});

function ambiente(codProd = 1113, multiplicador = 1) {
  const item = { codProd: 1113, marca: 'FELTRIN', chaveSeparacao: 'seq:1', qtdSeparada: 0 };
  const pendente = { item, quantidade: multiplicador, entradaCodigo: { codigo: '7891234567890', multiplicador }, lotesCarregados: true, lotesDisponiveis: [{ controle, estoque: 10 }] };
  const gravacoes = [];
  const contexto = vm.createContext({
    itemSeparacaoPendente: pendente, pedidoPreviewSelecionado: { NUNOTA: 123 },
    window: { crypto: { randomUUID: () => 'leitura-teste-123' } },
    separacaoFeltrinCodigo: { value: codigo, select() {} }, botaoConfirmarSeparacao: {},
    separacaoConfirmStatus: {}, separacaoScreen: { hidden: false },
    itemSeparacaoProcessado: () => false, atualizarProdutoConfirmacaoSeparacao() {},
    fetch: async () => ({ ok: true, json: async () => ({ lote: { codProd, controle } }) }),
    requisitarSeparacao: async (route, options) => { gravacoes.push({ route, body: JSON.parse(options.body) }); return {}; },
    aplicarEstadoSeparacao() {}, fecharConfirmacaoSeparacao() { contexto.itemSeparacaoPendente = null; },
    renderizarItensSeparacao() {}, atualizarStatusSeparacao() {}, limparCodigoSeparacao() {},
    formatarQuantidade: String
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function produtoSeparacaoFeltrin('), fonte.indexOf('function capturarTeclaLeitorSeparacao(')), contexto);
  return { contexto, gravacoes };
}

test('bipar o lote salva uma única unidade mesmo com Enter e Tab consecutivos', async () => {
  const { contexto, gravacoes } = ambiente();
  await Promise.all([vm.runInContext('processarLoteFeltrinSeparacao()', contexto), vm.runInContext('processarLoteFeltrinSeparacao()', contexto)]);
  assert.equal(gravacoes.length, 1);
  assert.equal(gravacoes[0].route, '/leitura-feltrin');
  assert.deepEqual(gravacoes[0].body, { chave: 'seq:1', codigo, codigoProduto: '7891234567890', leituraId: 'leitura-teste-123' });
  assert.equal(contexto.itemSeparacaoPendente, null);
});

test('caixa de outro produto não registra quantidade na separação', async () => {
  const { contexto, gravacoes } = ambiente(2222);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.match(contexto.separacaoConfirmStatus.textContent, /outro produto/);
});

test('exibe somente o lote extraído e mantém o código completo para salvar e repetir após uma falha', async () => {
  const { contexto } = ambiente();
  const tentativas = [];
  contexto.requisitarSeparacao = async (_route, options) => {
    tentativas.push(JSON.parse(options.body));
    assert.equal(contexto.separacaoFeltrinCodigo.value, controle);
    if (tentativas.length === 1) throw new Error('Falha temporária');
    return {};
  };
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.separacaoFeltrinCodigo.value, controle);
  assert.equal(contexto.itemSeparacaoPendente.codigoCompletoFeltrin, codigo);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(tentativas.length, 2);
  assert.equal(tentativas[0].codigo, codigo);
  assert.deepEqual(tentativas[1], tentativas[0]);
});

test('a leitura do lote mantém o multiplicador da caixa em vez de trocar por uma unidade', async () => {
  const { contexto, gravacoes } = ambiente(1113, 12);
  const pendente = contexto.itemSeparacaoPendente;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(pendente.quantidade, 12);
  assert.equal(gravacoes[0].body.codigoProduto, '7891234567890');
});

test('ler somente o identificador do lote não inventa a quantidade da embalagem', async () => {
  const { contexto, gravacoes } = ambiente();
  contexto.itemSeparacaoPendente.entradaCodigo = null;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.match(contexto.separacaoConfirmStatus.textContent, /caixa ou da unidade/);
});

test('tabela exibe duas linhas do mesmo produto com suas quantidades e lotes separados', () => {
  const contexto = vm.createContext({
    itensSeparacao: [{ codProd: 1113 }], separacaoConcluida: false,
    separacaoProgresso: {}, botaoFinalizarSeparacao: {}, separacaoCodigo: {}, botaoLimparCodigoSeparacao: {}, separacaoItensLista: {},
    itemSeparacaoProcessado: () => true, itemSeparacaoCompleto: () => true, itemSeparacaoZerado: () => false, itemSeparacaoDivergente: () => false,
    quantidadeEsperadaSeparacao: () => 3, normalizarQuantidade: Number, formatarQuantidade: String,
    obterUnidadeExibicaoItem: () => 'UN', escaparHtml: String, escaparAtributo: String,
    obterLoteSeparacao: () => '2 lotes', obterValidadeSeparacao: () => '', formatarData: (value) => value,
    atualizarIcones() {}, agruparItensSeparacao: () => [{ codigo: '1', descricao: 'Sementes', itens: [{
      codProd: 1113, descrProd: 'Produto Feltrin', chaveSeparacao: 'seq:1', qtdSeparada: 3,
      lotesSeparados: [{ controle, qtdSeparada: 2 }, { controle: '0023002530059010', qtdSeparada: 1 }]
    }] }]
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function renderizarItensSeparacao('), fonte.indexOf('function fecharConfirmacaoSeparacao(')), contexto);
  vm.runInContext('renderizarItensSeparacao()', contexto);
  const html = contexto.separacaoItensLista.innerHTML;
  assert.equal((html.match(/data-separacao-item=/g) || []).length, 2);
  assert.match(html, /0023002530042010/);
  assert.match(html, /0023002530059010/);
  assert.match(html, /2 UN/);
  assert.match(html, /1 UN/);
});
