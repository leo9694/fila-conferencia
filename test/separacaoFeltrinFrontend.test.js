const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
const codigo = '0173202900230025300420100004510010';
const controle = '0023002530042010';

function ambienteConfirmacao(entradaCodigo = null) {
  const elemento = () => ({ hidden: false, value: '', textContent: '', innerHTML: '', dataset: {}, focus() {}, classList: { toggle() {} } });
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
    separacaoFeltrinField: elemento(), separacaoFeltrinCodigo: elemento(), separacaoFeltrinInfo: elemento(), separacaoLoteField: elemento(),
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

test('clicar sem bipar restringe a seleção ao lote original do pedido sem campo de código', async () => {
  const contexto = ambienteConfirmacao();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(contexto.separacaoFeltrinField.hidden, true);
  assert.equal(contexto.separacaoLoteField.hidden, true);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, false);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 20);
  contexto.separacaoLoteSelect.value = '0023002530059010';
  assert.equal(vm.runInContext('obterLoteSelecionadoConfirmacao().controle', contexto), controle);
  assert.equal(contexto.itemSeparacaoPendente.lotesDisponiveis.length, 1);
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
  const item = { codProd: 1113, marca: 'FELTRIN', chaveSeparacao: 'seq:1', controle, qtdSeparada: 0, qtdEsperada: 20 };
  const pendente = { item, quantidade: multiplicador, leituraFeltrinPorCodigo: true, entradaCodigo: { codigo: '7891234567890', multiplicador }, lotesCarregados: true, lotesDisponiveis: [{ controle, estoque: 10 }] };
  const gravacoes = [];
  const contexto = vm.createContext({
    itemSeparacaoPendente: pendente, pedidoPreviewSelecionado: { NUNOTA: 123 },
    itensSeparacao: [item], quantidadeEsperadaSeparacao: (item) => item.qtdEsperada, normalizarQuantidade: Number,
    separacaoConfirmQtd: {}, obterUnidadeExibicaoItem: () => 'UN',
    window: { crypto: { randomUUID: () => 'leitura-teste-123' } },
    separacaoFeltrinCodigo: { value: codigo, select() {}, focus() { this.focado = true; } }, separacaoFeltrinInfo: { dataset: {} }, botaoConfirmarSeparacao: {},
    separacaoConfirmStatus: {}, separacaoScreen: { hidden: false },
    itemSeparacaoProcessado: () => false, atualizarProdutoConfirmacaoSeparacao() {},
    fetch: async () => ({ ok: true, json: async () => ({ lote: { codProd, controle } }) }),
    requisitarSeparacao: async (route, options) => { gravacoes.push({ route, body: JSON.parse(options.body) }); return {}; },
    aplicarEstadoSeparacao() {}, fecharConfirmacaoSeparacao() { contexto.itemSeparacaoPendente = null; },
    renderizarItensSeparacao() {}, atualizarStatusSeparacao() {}, limparCodigoSeparacao() {},
    formatarQuantidade: String
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function produtoSeparacaoFeltrin('), fonte.indexOf('function capturarTeclaLeitorSeparacao(')), contexto);
  vm.runInContext(fonte.slice(fonte.indexOf('async function confirmarItemSeparacao('), fonte.indexOf('function abrirAjusteQuantidadeSeparacao(')), contexto);
  return { contexto, gravacoes };
}

test('Enter e Tab validam o lote sem contar ou fechar e somente o botão confirma uma vez', async () => {
  const { contexto, gravacoes } = ambiente();
  await Promise.all([vm.runInContext('processarLoteFeltrinSeparacao()', contexto), vm.runInContext('processarLoteFeltrinSeparacao()', contexto)]);
  assert.equal(gravacoes.length, 0);
  assert.ok(contexto.itemSeparacaoPendente);
  assert.equal(contexto.itemSeparacaoPendente.item.qtdSeparada, 0);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, false);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  await Promise.all([vm.runInContext('confirmarItemSeparacao()', contexto), vm.runInContext('confirmarItemSeparacao()', contexto)]);
  assert.equal(gravacoes.length, 1);
  assert.equal(gravacoes[0].route, '/leitura-feltrin');
  assert.deepEqual(gravacoes[0].body, { chave: 'seq:1', codigo, codigoProduto: '7891234567890', numeroLeituras: 1, leituraId: 'leitura-teste-123' });
  assert.equal(contexto.itemSeparacaoPendente, null);
});

test('caixa de outro produto não registra quantidade na separação', async () => {
  const { contexto, gravacoes } = ambiente(2222);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.match(contexto.separacaoConfirmStatus.textContent, /outro produto/);
});

test('primeira leitura que completa o lote confirma automaticamente sem duplicar com Enter consecutivo', async () => {
  const { contexto, gravacoes } = ambiente(1113, 20);
  await Promise.all([vm.runInContext('processarLoteFeltrinSeparacao()', contexto), vm.runInContext('processarLoteFeltrinSeparacao()', contexto)]);
  assert.equal(gravacoes.length, 1);
  assert.equal(gravacoes[0].body.numeroLeituras, 1);
  assert.equal(gravacoes[0].body.codigo, codigo);
  assert.equal(contexto.itemSeparacaoPendente, null);
});

test('confirma automaticamente quando a primeira caixa completa apenas o restante do lote', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  contexto.itemSeparacaoPendente.item.qtdSeparada = 10;
  vm.runInContext('enfileirarLoteFeltrinSeparacao(); enfileirarLoteFeltrinSeparacao();', contexto);
  const pendente = contexto.itemSeparacaoPendente;
  await pendente.filaLeiturasFeltrin;
  assert.equal(gravacoes.length, 1);
  assert.equal(contexto.itemSeparacaoPendente, null);
});

test('falha da confirmação automática mantém painel aberto para tentar novamente sem duplicar a leitura', async () => {
  const { contexto } = ambiente(1113, 20);
  const tentativas = [];
  contexto.requisitarSeparacao = async (_route, options) => {
    tentativas.push(JSON.parse(options.body));
    if (tentativas.length === 1) throw new Error('Falha temporária');
    return {};
  };
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.ok(contexto.itemSeparacaoPendente);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, false);
  assert.match(contexto.separacaoConfirmStatus.textContent, /Falha temporária/);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.deepEqual(tentativas[1], tentativas[0]);
  assert.equal(contexto.itemSeparacaoPendente, null);
});

test('caixa que excede o restante nunca confirma automaticamente', async () => {
  const { contexto, gravacoes } = ambiente(1113, 30);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.ok(contexto.itemSeparacaoPendente);
  assert.match(contexto.separacaoConfirmStatus.textContent, /excede/);
});

test('código comum do produto redireciona o painel para a linha original do lote bipado', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  const segundo = { codProd: 1113, marca: 'FELTRIN', chaveSeparacao: 'seq:2', controle: '0023002530059010', qtdSeparada: 0, qtdEsperada: 20 };
  contexto.itensSeparacao.push(segundo);
  contexto.itemSeparacaoPendente.lotesDisponiveis.push({ controle: segundo.controle, estoque: 100 });
  contexto.separacaoFeltrinCodigo.value = '0172952200230025300590100002200010';
  contexto.fetch = async () => ({ ok: true, json: async () => ({ lote: { codProd: 1113, controle: segundo.controle } }) });
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.itemSeparacaoPendente.item, segundo);
  assert.equal(contexto.itensSeparacao[0].controle, controle);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes[0].body.chave, 'seq:2');
});

test('não aceita lote diferente nem quando o produto tem somente uma linha no pedido', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  contexto.itemSeparacaoPendente.lotesDisponiveis.push({ controle: '0023002530059010', estoque: 100 });
  contexto.fetch = async () => ({ ok: true, json: async () => ({ lote: { codProd: 1113, controle: '0023002530059010' } }) });
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.match(contexto.separacaoConfirmStatus.textContent, /não corresponde/);
  assert.equal(gravacoes.length, 0);
  assert.equal(contexto.itemSeparacaoPendente.item.controle, controle);
});

test('limpa o campo quando falta lote e mantém o código completo para confirmar e repetir após falha', async () => {
  const { contexto } = ambiente();
  const tentativas = [];
  contexto.requisitarSeparacao = async (_route, options) => {
    tentativas.push(JSON.parse(options.body));
    assert.equal(contexto.separacaoFeltrinCodigo.value, '');
    if (tentativas.length === 1) throw new Error('Falha temporária');
    return {};
  };
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.separacaoFeltrinCodigo.value, '');
  assert.equal(contexto.separacaoFeltrinCodigo.focado, true);
  assert.equal(contexto.separacaoFeltrinInfo.textContent, 'Conferido 1/20');
  assert.equal(contexto.itemSeparacaoPendente.codigoCompletoFeltrin, codigo);
  assert.equal(tentativas.length, 0);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.ok(contexto.itemSeparacaoPendente);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(tentativas.length, 2);
  assert.equal(tentativas[0].codigo, codigo);
  assert.deepEqual(tentativas[1], tentativas[0]);
});

test('a leitura do lote mantém o multiplicador da caixa em vez de trocar por uma unidade', async () => {
  const { contexto, gravacoes } = ambiente(1113, 12);
  const pendente = contexto.itemSeparacaoPendente;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(pendente.quantidade, 12);
  assert.equal(gravacoes.length, 0);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes[0].body.codigoProduto, '7891234567890');
});

test('ler somente o identificador do lote não inventa a quantidade da embalagem', async () => {
  const { contexto, gravacoes } = ambiente();
  contexto.itemSeparacaoPendente.entradaCodigo = null;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.match(contexto.separacaoConfirmStatus.textContent, /caixa ou da unidade/);
});

test('não confirma antes de validar ou quando o código muda após a validação', async () => {
  const { contexto, gravacoes } = ambiente();
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  contexto.separacaoFeltrinCodigo.value = 'outro codigo';
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  assert.ok(contexto.itemSeparacaoPendente);
});

test('ignora resultado de validação quando o campo muda durante a consulta', async () => {
  const { contexto, gravacoes } = ambiente();
  let resolver;
  contexto.fetch = () => new Promise((resolve) => { resolver = resolve; });
  const validacao = vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  contexto.separacaoFeltrinCodigo.value = 'outro codigo';
  resolver({ ok: true, json: async () => ({ lote: { codProd: 1113, controle } }) });
  await validacao;
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, true);
  assert.equal(contexto.itemSeparacaoPendente.loteBipado, undefined);
  assert.equal(gravacoes.length, 0);
});

test('duas caixas de dez do mesmo lote acumulam vinte no painel e só gravam ao confirmar', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 10);
  assert.equal(contexto.separacaoFeltrinCodigo.value, '');
  assert.equal(contexto.separacaoFeltrinInfo.textContent, 'Conferido 10/20');
  assert.equal(contexto.separacaoFeltrinInfo.dataset.estado, 'pendente');
  contexto.separacaoFeltrinCodigo.value = codigo;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 20);
  assert.equal(contexto.separacaoConfirmQtd.textContent, '20 UN');
  assert.equal(contexto.separacaoFeltrinCodigo.value, controle);
  assert.equal(contexto.separacaoFeltrinInfo.textContent, 'Conferido 20/20');
  assert.equal(contexto.separacaoFeltrinInfo.dataset.estado, 'completo');
  assert.equal(gravacoes.length, 0);
  contexto.separacaoFeltrinCodigo.value = codigo;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.match(contexto.separacaoConfirmStatus.textContent, /excede/);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 20);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes[0].body.numeroLeituras, 2);
});

test('outro lote avisa e preserva o total e o lote previamente adicionado', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  contexto.separacaoFeltrinCodigo.value = '0172952200230025300590100002200010';
  contexto.fetch = async () => ({ ok: true, json: async () => ({ lote: { codProd: 1113, controle: '0023002530059010' } }) });
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.match(contexto.separacaoConfirmStatus.textContent, /Lote diferente/);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 10);
  assert.equal(contexto.separacaoFeltrinCodigo.value, controle);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes[0].body.codigo, codigo);
  assert.equal(gravacoes[0].body.numeroLeituras, 1);
});

test('aviso considera as unidades já registradas e somente a linha do lote bipado', async () => {
  const { contexto, gravacoes } = ambiente(1113, 5);
  contexto.itemSeparacaoPendente.item.qtdSeparada = 5;
  contexto.itensSeparacao.unshift({ codProd: 1113, controle: '0023002530059010', qtdSeparada: 0, qtdEsperada: 50 });
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.separacaoFeltrinInfo.textContent, 'Conferido 10/20');
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 5);
  assert.equal(contexto.separacaoFeltrinCodigo.value, '');
  assert.equal(gravacoes.length, 0);
});

test('leituras rápidas são processadas na ordem sem perder caixas', async () => {
  const { contexto, gravacoes } = ambiente(1113, 10);
  vm.runInContext('enfileirarLoteFeltrinSeparacao(); enfileirarLoteFeltrinSeparacao();', contexto);
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  assert.equal(gravacoes.length, 0);
  await contexto.itemSeparacaoPendente.filaLeiturasFeltrin;
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 20);
  assert.equal(contexto.botaoConfirmarSeparacao.disabled, false);
});

test('falha de confirmação não permite alterar o total pendente de tentativa', async () => {
  const { contexto } = ambiente(1113, 10);
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  contexto.requisitarSeparacao = async () => { throw new Error('Falha temporária'); };
  await vm.runInContext('confirmarItemSeparacao()', contexto);
  contexto.separacaoFeltrinCodigo.value = codigo;
  await vm.runInContext('processarLoteFeltrinSeparacao()', contexto);
  assert.equal(contexto.itemSeparacaoPendente.quantidade, 10);
  assert.match(contexto.separacaoConfirmStatus.textContent, /total anterior/);
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
