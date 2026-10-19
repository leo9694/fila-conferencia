const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function contexto(fetch) {
  const ctx = vm.createContext({ fetch, URLSearchParams, ConsultaTabela: require('../frontend/consulta-tabela'), consultaProdutoAtual: null, consultaProdutosResultados: [],
    consultaProdutoFiltrosCarregados: false, consultaProdutoFiltrosCarregando: false,
    consultaProdutoFiltrosOpcoes: { grupo: [], marca: [] },
    consultaProdutoBuscaVersao: 0, consultaProdutoDetalheVersao: 0,
    formatarQuantidade: String, formatarData: () => '', formatarTipoEstoque: String, calcularDiasAte: () => 0,
    escaparHtml: (v) => String(v).replaceAll('<', '&lt;'), escaparAtributo: String });
  for (const nome of ['consultaProdutoCodigo', 'botaoConsultaProdutoBuscar', 'consultaProdutoTitulo', 'consultaProdutoLegenda',
    'consultaProdutoFoto', 'botaoConsultaProdutoEtiquetas', 'consultaProdutoResumo', 'consultaProdutoDetalhes', 'consultaProdutoStatus', 'consultaEstoqueStatus',
    'consultaProdutoGrupo', 'consultaProdutoMarca', 'consultaProdutoFiltros', 'consultaProdutoFiltrosStatus', 'botaoConsultaProdutoFiltros',
    'consultaProdutoGrupoBusca', 'consultaProdutoMarcaBusca', 'consultaProdutoGrupoResultados', 'consultaProdutoMarcaResultados',
    'botaoConsultaProdutoFecharFiltros', 'botaoConsultaProdutoAplicarFiltros']) {
    ctx[nome] = { textContent: '', innerHTML: '', value: 'semente', focus() {}, querySelectorAll: () => [],
      querySelector: () => ({ addEventListener() {} }), contains: () => true };
  }
  ctx.consultaProdutoGrupo.value = '';
  ctx.consultaProdutoMarca.value = '';
  ctx.consultaProdutoGrupoBusca.value = '';
  ctx.consultaProdutoMarcaBusca.value = '';
  for (const nome of ['consultaProdutoGrupoResultados', 'consultaProdutoMarcaResultados']) {
    const elemento = ctx[nome];
    Object.defineProperty(elemento, 'innerHTML', { get() { return this.html || ''; }, set(html) {
      this.html = html;
      this.botoes = Array.from(html.matchAll(/<button /g), () => ({
        addEventListener(_evento, fn) { this.click = fn; }, focus() { this.focado = true; }
      }));
    } });
    elemento.querySelectorAll = () => elemento.botoes || [];
  }
  ctx.consultaProdutoFiltros.hidden = true;
  ctx.botaoConsultaProdutoFiltros.dataset = {};
  ctx.botaoConsultaProdutoFiltros.setAttribute = function (chave, valor) { this[chave] = valor; };
  vm.runInContext(fonte.slice(fonte.indexOf('function renderizarConsultaVazia('), fonte.indexOf('function imprimirEtiquetaProdutoConsultado(')), ctx);
  vm.runInContext(fonte.slice(fonte.indexOf('function atualizarIndicadorFiltrosConsulta()'), fonte.indexOf('function abrirConsultaProdutos()')), ctx);
  return ctx;
}

test('vários resultados mantêm lista com estoque por empresa enquanto seleção carrega detalhes e etiquetas', async () => {
  const urls = [];
  const ctx = contexto(async (url) => {
    urls.push(url);
    return { ok: true, json: async () => url.includes('/pesquisa')
      ? { produtos: [{ CODPROD: 1, DESCRPROD: 'SEMENTE A', estoquePorEmpresa: [{ CODEMP: 1, DISPONIVEL: 10, ESTOQUE: 10 }] }, { CODPROD: 2, DESCRPROD: 'SEMENTE B' }], empresas: [{ CODEMP: 1, NOMEEMPRESA: 'Matriz' }] }
      : { produto: { CODPROD: 2, DESCRPROD: 'SEMENTE B' }, estoque: [{ CODEMP: 1, CONTROLE: 'LOTE-B', ESTOQUE: 5 }], estoquePorEmpresa: [] } };
  });
  await ctx.buscarConsultaProduto();
  assert.equal(urls.length, 1);
  assert.equal(ctx.consultaProdutoAtual, null);
  assert.match(ctx.consultaProdutoResumo.innerHTML, /SEMENTE A/);
  assert.match(ctx.consultaProdutoResumo.innerHTML, /Matriz/);
  const lista = ctx.consultaProdutoResumo.innerHTML;
  await ctx.selecionarConsultaProduto(2);
  assert.match(urls[1], /codProd=2/);
  assert.equal(ctx.consultaProdutoResumo.innerHTML, lista);
  assert.match(ctx.consultaProdutoDetalhes.innerHTML, /LOTE-B/);
  assert.equal(ctx.botaoConsultaProdutoEtiquetas.disabled, false);
});

test('abre e recolhe filtros acessíveis carrega opções uma vez e pesquisa somente por grupo e marca', async () => {
  const urls = [];
  const ctx = contexto(async (url) => {
    urls.push(url);
    return { ok: true, json: async () => url.endsWith('/filtros')
      ? { grupos: [{ CODGRUPOPROD: 12, DESCRGRUPOPROD: 'Sementes' }], marcas: ['CIMO'] }
      : { produtos: [] } };
  });
  await ctx.alternarFiltrosConsultaProdutos();
  assert.equal(ctx.consultaProdutoFiltros.hidden, false);
  assert.equal(ctx.botaoConsultaProdutoFiltros['aria-expanded'], 'true');
  assert.equal(ctx.consultaProdutoGrupoResultados.innerHTML, '');
  assert.equal(ctx.consultaProdutoMarcaResultados.innerHTML, '');
  assert.equal(ctx.consultaProdutoFiltrosOpcoes.grupo[0].nome, 'Sementes');
  assert.equal(ctx.consultaProdutoFiltrosOpcoes.marca[0].nome, 'CIMO');
  await ctx.alternarFiltrosConsultaProdutos();
  await ctx.alternarFiltrosConsultaProdutos();
  assert.equal(urls.length, 1);
  ctx.consultaProdutoCodigo.value = '';
  ctx.consultaProdutoGrupo.value = '12';
  ctx.consultaProdutoMarca.value = "D'ÁGUA";
  ctx.atualizarIndicadorFiltrosConsulta();
  assert.equal(ctx.botaoConsultaProdutoFiltros.dataset.ativo, 'true');
  await ctx.buscarConsultaProduto();
  const parametros = new URL(urls[1], 'http://localhost').searchParams;
  assert.equal(parametros.get('grupo'), '12');
  assert.equal(parametros.get('marca'), "D'ÁGUA");
});

test('falha ao carregar filtros permite nova tentativa sem bloquear a pesquisa', async () => {
  let chamadas = 0;
  const ctx = contexto(async () => ({ ok: ++chamadas > 1, json: async () => ({ erro: 'Indisponível', grupos: [], marcas: [] }) }));
  await ctx.alternarFiltrosConsultaProdutos();
  assert.match(ctx.consultaProdutoFiltrosStatus.textContent, /Indisponível/);
  assert.equal(ctx.consultaProdutoGrupoBusca.disabled, false);
  await ctx.alternarFiltrosConsultaProdutos();
  await ctx.alternarFiltrosConsultaProdutos();
  assert.equal(ctx.consultaProdutoFiltrosCarregados, true);
});

test('sugere grupo e marca por palavras sem acentos e seleciona o valor exato', () => {
  const ctx = contexto(() => assert.fail());
  ctx.consultaProdutoFiltrosOpcoes = {
    grupo: [{ valor: '12', nome: 'Sementes de Hortaliças' }, { valor: '20', nome: 'Flores' }],
    marca: [{ valor: 'CIMO', nome: 'CIMO' }, { valor: "D'ÁGUA", nome: "D'ÁGUA" }]
  };
  ctx.consultaProdutoGrupoBusca.value = 'hortalicas semente';
  ctx.pesquisarFiltroConsulta('grupo');
  assert.match(ctx.consultaProdutoGrupoResultados.innerHTML, /Sementes de Hortaliças/);
  assert.doesNotMatch(ctx.consultaProdutoGrupoResultados.innerHTML, /Flores/);
  ctx.consultaProdutoGrupoResultados.querySelectorAll()[0].click();
  assert.equal(ctx.consultaProdutoGrupo.value, '12');
  assert.equal(ctx.consultaProdutoGrupoBusca.value, 'Sementes de Hortaliças');
  assert.equal(ctx.consultaProdutoGrupoResultados.innerHTML, '');
  ctx.consultaProdutoMarcaBusca.value = "d'agua";
  ctx.pesquisarFiltroConsulta('marca');
  ctx.consultaProdutoMarcaResultados.querySelectorAll()[0].click();
  assert.equal(ctx.consultaProdutoMarca.value, "D'ÁGUA");
  ctx.consultaProdutoGrupoBusca.value = 'inexistente';
  ctx.pesquisarFiltroConsulta('grupo');
  assert.equal(ctx.consultaProdutoGrupo.value, '');
  assert.match(ctx.consultaProdutoGrupoResultados.innerHTML, /Nenhuma correspondência/);
  ctx.aplicarFiltrosConsultaProdutos();
  assert.match(ctx.consultaProdutoFiltrosStatus.textContent, /Selecione uma correspondência de grupo/);
  ctx.limparFiltrosConsultaProdutos();
  assert.equal(ctx.consultaProdutoMarca.value, '');
  assert.equal(ctx.consultaProdutoMarcaBusca.value, '');
  assert.equal(ctx.botaoConsultaProdutoFiltros.dataset.ativo, 'false');
});

test('limita sugestões e permite selecionar com Enter e fechar somente os filtros com Escape', () => {
  const ctx = contexto(() => assert.fail());
  ctx.consultaProdutoFiltrosOpcoes.grupo = Array.from({ length: 40 }, (_, i) => ({ valor: String(i), nome: `Grupo ${i}` }));
  ctx.consultaProdutoGrupoBusca.value = 'grupo';
  ctx.pesquisarFiltroConsulta('grupo');
  assert.equal(ctx.consultaProdutoGrupoResultados.querySelectorAll().length, 30);
  assert.match(ctx.consultaProdutoGrupoResultados.innerHTML, /refinar/);
  const evento = { key: 'Enter', target: ctx.consultaProdutoGrupoBusca, preventDefault() {}, stopPropagation() { this.parou = true; } };
  ctx.tecladoFiltrosConsultaProdutos(evento);
  assert.equal(ctx.consultaProdutoGrupo.value, '0');
  ctx.consultaProdutoFiltros.hidden = false;
  evento.key = 'Escape';
  ctx.tecladoFiltrosConsultaProdutos(evento);
  assert.equal(ctx.consultaProdutoFiltros.hidden, true);
  assert.equal(evento.parou, true);
});

test('resposta atrasada não sobrescreve produto selecionado depois', async () => {
  const pendentes = [];
  const ctx = contexto(() => new Promise((resolve) => pendentes.push(resolve)));
  const primeira = ctx.selecionarConsultaProduto(1);
  const segunda = ctx.selecionarConsultaProduto(2);
  const resposta = (id) => ({ ok: true, json: async () => ({ produto: { CODPROD: id, DESCRPROD: `PRODUTO ${id}` } }) });
  pendentes[1](resposta(2));
  await segunda;
  pendentes[0](resposta(1));
  await primeira;
  assert.equal(ctx.consultaProdutoAtual.produto.CODPROD, 2);
});

test('resultado único abre detalhes automaticamente e nova pesquisa limpa seleção anterior', async () => {
  let chamada = 0;
  const ctx = contexto(async () => ({ ok: true, json: async () => ++chamada === 1
    ? { produtos: [{ CODPROD: 3 }] } : { produto: { CODPROD: 3, DESCRPROD: 'SEMENTE' } } }));
  await ctx.buscarConsultaProduto();
  assert.equal(ctx.consultaProdutoAtual.produto.CODPROD, 3);
  assert.equal(chamada, 2);
  ctx.renderizarConsultaVazia();
  assert.equal(ctx.consultaProdutoAtual, null);
  assert.equal(ctx.botaoConsultaProdutoEtiquetas.disabled, true);
});
