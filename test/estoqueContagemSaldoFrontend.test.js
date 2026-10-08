const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function ambienteModal(status = 'EM_CONTAGEM') {
  const elemento = () => ({ value: '', textContent: '', innerHTML: '', focus() {}, select() {} });
  const contexto = vm.createContext({
    estoqueContagemAtual: { status }, estoqueContagemItemSelecionado: null, estoqueContagemItemVersaoAberta: null,
    estoqueContagemConfirmTitulo: elemento(), estoqueContagemConfirmProduto: elemento(),
    estoqueContagemConfirmSaldos: elemento(), estoqueContagemQuantidadeLabel: elemento(),
    estoqueContagemLote: elemento(), estoqueContagemFabricacao: elemento(), estoqueContagemValidade: elemento(),
    estoqueContagemQuantidade: elemento(), estoqueContagemUnidade: elemento(),
    estoqueContagemConfirmMensagem: elemento(), estoqueContagemConfirmModal: elemento(),
    escaparHtml: String, formatarQuantidade: String, formatarDataInput: (valor) => valor || '',
    configurarCamposControleContagem() {}, atualizarMensagemContagemEstoque() {}, setTimeout() {}
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function abrirConfirmacaoContagemEstoque('), fonte.indexOf('async function abrirSessaoContagemEstoque(')), contexto);
  return contexto;
}

test('confirmação mostra saldo do lote sem preencher a quantidade física automaticamente', () => {
  const contexto = ambienteModal();
  contexto.item = { codProd: 1113, descrProd: 'Produto', podeContar: true, controle: 'LOTE-A', codVol: 'UN', estoqueSistema: 20, contagemAtual: null };
  vm.runInContext('abrirConfirmacaoContagemEstoque(item)', contexto);
  assert.match(contexto.estoqueContagemConfirmSaldos.innerHTML, /Estoque do lote.*20 UN/s);
  assert.doesNotMatch(contexto.estoqueContagemConfirmSaldos.innerHTML, /Primeira contagem/);
  assert.equal(contexto.estoqueContagemQuantidade.value, '');
  assert.equal(contexto.estoqueContagemQuantidadeLabel.textContent, 'Quantidade física encontrada');
});

test('recontagem mostra estoque e primeira contagem zero mantendo campo próprio em branco', () => {
  const contexto = ambienteModal('EM_RECONTAGEM');
  contexto.item = { codProd: 1113, podeContar: true, codVol: 'UN', estoqueSistema: 20, primeiraContagem: 0, contagemAtual: null };
  vm.runInContext('abrirConfirmacaoContagemEstoque(item)', contexto);
  assert.match(contexto.estoqueContagemConfirmSaldos.innerHTML, /Estoque do lote.*20 UN/s);
  assert.match(contexto.estoqueContagemConfirmSaldos.innerHTML, /Primeira contagem.*0 UN/s);
  assert.equal(contexto.estoqueContagemQuantidade.value, '');
  assert.equal(contexto.estoqueContagemQuantidadeLabel.textContent, 'Quantidade da recontagem');
  contexto.estoqueContagemAtual.status = 'EM_CONTAGEM';
  vm.runInContext('abrirConfirmacaoContagemEstoque(item)', contexto);
  assert.doesNotMatch(contexto.estoqueContagemConfirmSaldos.innerHTML, /Primeira contagem/);
});

test('lista mantém saldo independente por lote incluindo zero e valores negativos', () => {
  const itens = [
    { chave: 'A', codProd: 1113, controle: 'LOTE-A', estoqueSistema: 20, codVol: 'UN', contagemAtual: null },
    { chave: 'B', codProd: 1113, controle: 'LOTE-B', estoqueSistema: 0, codVol: 'UN', contagemAtual: 0 },
    { chave: 'C', codProd: 1113, controle: 'LOTE-C', estoqueSistema: -2, codVol: 'UN', contagemAtual: null }
  ];
  const contexto = vm.createContext({
    estoqueContagemItens: {}, agruparItensContagemEstoque: () => [{ codigo: 1, descricao: 'Grupo', itens }],
    escaparHtml: String, escaparAtributo: String, formatarQuantidade: String, formatarData: String,
    statusItemContagemEstoque: () => 'PENDENTE'
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function renderizarItensContagemEstoque('), fonte.indexOf('function renderizarContagemEstoque(')), contexto);
  vm.runInContext('renderizarItensContagemEstoque()', contexto);
  const html = contexto.estoqueContagemItens.innerHTML;
  assert.match(html, /colspan="8"/);
  for (const saldo of ['20 UN', '0 UN', '-2 UN']) assert.ok(html.includes(`data-label="Estoque">${saldo}</td>`));
  assert.match(html, /data-label="Contagem">—/);
});
