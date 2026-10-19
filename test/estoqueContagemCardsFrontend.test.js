const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function renderizar(sessao) {
  const contexto = vm.createContext({
    enriquecerNomeEmpresaContagem: (item) => item,
    tituloCardContagemEstoque: () => '1 - Empresa',
    classeStatusCardContagemEstoque: () => 'ajuste',
    escopoCardContagemEstoque: () => ({ grupo: 'Todos os grupos', detalhes: 'Local 1' }),
    rotuloStatusCardContagemEstoque: () => 'Ajuste gerado',
    escaparHtml: String, escaparAtributo: String, formatarDataHora: () => '', estoqueContagemAtual: null
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function renderizarCardsContagemEstoque('), fonte.indexOf('function renderizarListaContagensEstoque(')), contexto);
  return contexto.renderizarCardsContagemEstoque([sessao]);
}

test('identifica ajuste individual nos cards sem substituir o status da contagem', () => {
  for (const status of ['AJUSTE_GERADO', 'EM_CONTAGEM', 'CONCLUIDA']) {
    const html = renderizar({ id: '1', status, filtros: { ajusteIndividual: true } });
    assert.match(html, /estoque-sessao-status individual">Ajuste individual/);
    if (status === 'AJUSTE_GERADO') assert.match(html, />Ajuste gerado<\/span>/);
  }
});

test('contagens normais e antigas não recebem a etiqueta de ajuste individual', () => {
  for (const filtros of [undefined, {}, { ajusteIndividual: false }]) {
    assert.doesNotMatch(renderizar({ id: '2', status: 'AJUSTE_GERADO', filtros }), /Ajuste individual/);
  }
});
