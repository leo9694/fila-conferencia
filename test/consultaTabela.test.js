const test = require('node:test');
const assert = require('node:assert/strict');
const { criar, obterLinhas, comparar } = require('../frontend/consulta-tabela');

test('posiciona aplicar filtro logo após a pesquisa antes dos checkboxes', () => {
  const fonte = require('node:fs').readFileSync(require('node:path').join(__dirname, '../frontend/consulta-tabela.js'), 'utf8');
  assert.match(fonte, /placeholder="Pesquisar valores"[^>]*>\s*<button type="button" data-aplicar>Aplicar filtro<\/button>\s*<label><input type="checkbox" data-todos>/);
});

const colunas = [
  { titulo: 'Produto', campo: 'DESCRPROD' },
  { titulo: 'Unidade', campo: 'CODVOL' },
  { titulo: 'Saldo', numero: true, render: (linha) => linha.saldo }
];
const linhas = [
  { CODPROD: 1, DESCRPROD: 'Cenoura', CODVOL: 'UN', saldo: '1.234,50' },
  { CODPROD: 2, DESCRPROD: 'Alface', CODVOL: 'CX', saldo: '20' },
  { CODPROD: 3, DESCRPROD: 'Tomate', CODVOL: 'UN', saldo: '3,50' }
];

test('ordena quantidades no padrão brasileiro sem alterar os dados originais', () => {
  const resultado = obterLinhas(colunas, linhas, {}, { coluna: 2, direcao: 'asc' });
  assert.deepEqual(resultado.map((linha) => linha.CODPROD), [3, 2, 1]);
  assert.deepEqual(linhas.map((linha) => linha.CODPROD), [1, 2, 3]);
  assert.deepEqual(obterLinhas(colunas, linhas, {}, { coluna: 2, direcao: 'desc' }).map((linha) => linha.CODPROD), [1, 2, 3]);
});

test('combina checkboxes de várias colunas preserva ordenação e permite desmarcar tudo', () => {
  const filtros = { 1: new Set(['UN']), 0: new Set(['Cenoura', 'Tomate']) };
  assert.deepEqual(obterLinhas(colunas, linhas, filtros, { coluna: 0, direcao: 'desc' }).map((linha) => linha.CODPROD), [3, 1]);
  filtros[0] = new Set();
  assert.equal(obterLinhas(colunas, linhas, filtros, null).length, 0);
  filtros[0] = null;
  assert.equal(obterLinhas(colunas, linhas, filtros, null).length, 2);
});

test('ordena datas brasileiras cronologicamente e códigos numericamente', () => {
  assert.ok(comparar({ campo: 'data' }, { data: '31/12/2025' }, { data: '01/01/2026' }) < 0);
  assert.ok(comparar({ campo: 'codigo' }, { codigo: '2' }, { codigo: '10' }) < 0);
  assert.equal(obterLinhas([{ campo: 'lote' }], [{ lote: null }, { lote: 'A' }], { 0: new Set(['-']) }, null).length, 1);
});

function containerTeste() {
  return {
    innerHTML: '', eventosLinhas: [],
    querySelectorAll(seletor) {
      if (seletor !== '[data-linha]') return [];
      this.eventosLinhas = [...this.innerHTML.matchAll(/data-linha="(\d+)"/g)].map((item) => ({
        dataset: { linha: item[1] }, classList: { toggle() {} },
        addEventListener(evento, fn) { this[evento] = fn; }
      }));
      return this.eventosLinhas;
    }
  };
}

test('seleciona o produto correto mesmo depois de ordenar filtrar e redesenhar', () => {
  const container = containerTeste();
  let selecionado;
  const tabela = criar(container, colunas, linhas, (linha) => { selecionado = linha.CODPROD; });
  tabela.ordenar(0, 'asc');
  container.eventosLinhas[0].click();
  assert.equal(selecionado, 2);
  tabela.filtrar(1, ['UN']);
  assert.deepEqual(tabela.obterVisiveis().map((linha) => linha.CODPROD), [1, 3]);
  container.eventosLinhas[1].click();
  assert.equal(selecionado, 3);
  tabela.ordenar(2, 'desc');
  assert.match(container.innerHTML, /is-selected[^>]+data-cod-prod="3"/);
  assert.match(container.innerHTML, /aria-sort="descending"/);
  tabela.filtrar(1, []);
  assert.match(container.innerHTML, /Nenhum resultado/);
  assert.match(container.innerHTML, /data-menu-coluna="1"/);
  tabela.filtrar(1, null);
  assert.equal(tabela.obterVisiveis().length, 3);
});

test('escapa nomes e valores ao montar cabeçalhos linhas e atributos', () => {
  const container = containerTeste();
  criar(container, [{ titulo: '<Grupo>', campo: 'nome' }], [{ CODPROD: '"1', nome: '<script>teste</script>' }], () => {});
  assert.doesNotMatch(container.innerHTML, /<script>|<Grupo>/);
  assert.match(container.innerHTML, /&lt;script&gt;/);
  assert.match(container.innerHTML, /data-cod-prod="&quot;1"/);
});
