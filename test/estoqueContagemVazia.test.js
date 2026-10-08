const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { criarEstoqueContagemStore } = require('../api/estoqueContagemStore');
const { normalizarFiltrosCopiaEstoque, montarSqlFiltrosCopiaEstoque } = require('../api/estoqueContagemFiltros');
const routes = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function resposta() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; } };
}

test('lista marcas pelo cadastro mesmo sem posição ou saldo de estoque', async () => {
  let handler;
  const contexto = vm.createContext({
    router: { get(_url, callback) { handler = callback; } },
    obterNumeroInteiro: Number, textoSql: (valor) => valor.replace(/'/g, "''"),
    executeQuery: async (sql) => {
      if (sql.includes('AS MARCA')) {
        assert.match(sql, /FROM TGFPRO PRO/);
        assert.doesNotMatch(sql, /TGFEST|EST\.ESTOQUE|EST\.CODEMP/);
        return [{ MARCA: 'CIMO' }, { MARCA: 'FELTRIN' }];
      }
      assert.match(sql, /EST.CODEMP = 1/);
      return [];
    }
  });
  vm.runInContext(routes.slice(routes.indexOf("router.get('/estoque-contagem/filtros'"), routes.indexOf("router.post('/estoque-contagem/previa'")), contexto);
  const res = resposta();
  await handler({ query: { empresa: '1', local: '' } }, res);
  assert.deepEqual(Array.from(res.payload.marcas), ['CIMO', 'FELTRIN']);
});

test('rota cria contagem vazia mantendo filtros e permitindo adicionar produto manualmente', async (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contagem-vazia-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarEstoqueContagemStore({ baseDir });
  let handler;
  const contexto = vm.createContext({
    router: { post(_url, callback) { handler = callback; } },
    normalizarFiltrosCopiaEstoque, montarSqlFiltrosCopiaEstoque,
    estoqueContagemStore: store, serializarSessaoContagemEstoque: (sessao) => sessao,
    executeQuery: async (sql) => {
      if (sql.includes('FROM TGFEST')) {
        assert.match(sql, /CIMO/);
        assert.match(sql, /EST\.ESTOQUE, 0\) > 0.000001/);
        return [];
      }
      return [{ NOMEEMPRESA: 'Empresa 1' }];
    }
  });
  vm.runInContext(routes.slice(routes.indexOf("router.post('/estoque-contagem/sessoes',"), routes.indexOf("router.get('/estoque-contagem/sessoes/:id',")), contexto);
  const res = resposta();
  await handler({ body: { empresa: 1, marca: 'CIMO' }, usuario: { codUsu: 72 } }, res);
  assert.equal(res.statusCode, 201);
  const sessao = res.payload.sessao;
  assert.equal(sessao.itens.length, 0);
  assert.equal(sessao.filtros.marca, 'CIMO');
  assert.equal(sessao.status, 'EM_CONTAGEM');
  store.adicionarItem({ id: sessao.id, item: { codProd: 1401, codLocal: 1, descrProd: 'Canivete CIMO', tipContEst: 'N' }, quantidade: 10 });
  assert.equal(store.obter(sessao.id).itens.length, 1);
  assert.equal(store.obter(sessao.id).itens[0].estoqueFoto, 0);
});

test('prévia com zero linhas habilita iniciar contagem sem liberar erros de consulta', async () => {
  const contexto = vm.createContext({
    estoqueContagemEmpresa: { value: '1' }, estoqueContagemPreviaVersao: 0,
    estoquePreviaProdutos: {}, estoquePreviaLinhas: {}, estoquePreviaLocais: {}, estoquePreviaUnidades: {},
    botaoCriarContagemEstoque: {}, obterFiltrosCopiaEstoqueTela: () => ({ empresa: 1, marca: 'CIMO' }),
    formatarQuantidade: String, atualizarMensagemContagemEstoque() {},
    limparPreviaContagemEstoque() { contexto.botaoCriarContagemEstoque.disabled = true; },
    fetch: async () => ({ ok: true, json: async () => ({ previa: { produtos: 0, linhas: 0, locais: 0, unidades: 0 } }) })
  });
  vm.runInContext(frontend.slice(frontend.indexOf('async function atualizarPreviaContagemEstoque('), frontend.indexOf('function renderizarCardsContagemEstoque(')), contexto);
  await vm.runInContext('atualizarPreviaContagemEstoque()', contexto);
  assert.equal(contexto.botaoCriarContagemEstoque.disabled, false);
  assert.equal(contexto.estoquePreviaLinhas.textContent, 0);
  contexto.fetch = async () => ({ ok: false, json: async () => ({ erro: 'Falha na consulta' }) });
  await vm.runInContext('atualizarPreviaContagemEstoque()', contexto);
  assert.equal(contexto.botaoCriarContagemEstoque.disabled, true);
});
