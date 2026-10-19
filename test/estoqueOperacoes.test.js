const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { criarOperacoesDatasEstoque, montarFiltrosAjusteIndividual } = require('../api/estoqueOperacoes');
const { montarSqlFiltrosCopiaEstoque } = require('../api/estoqueContagemFiltros');
const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const contexto = vm.createContext({});
vm.runInContext(fonte.slice(fonte.indexOf('function normalizarDataIsoRastreabilidade('), fonte.indexOf('function chavePosicaoEstoque(')), contexto);
const normalizarData = contexto.normalizarDataIsoRastreabilidade;

test('ajuste individual restringe empresa local e produto sem excluir saldos zero ou negativos', () => {
  const filtros = montarFiltrosAjusteIndividual({ empresa: '1', local: '101', codProd: '3572', grupos: [9], marca: 'Outra' });
  const sql = montarSqlFiltrosCopiaEstoque(filtros);
  assert.match(sql, /EST.CODEMP = 1/);
  assert.match(sql, /EST.CODLOCAL = 101/);
  assert.match(sql, /PRO.CODPROD >= 3572/);
  assert.match(sql, /PRO.CODPROD <= 3572/);
  assert.doesNotMatch(sql, /ESTOQUE|MARCA|CODGRUPOPROD|PRO.ATIVO/);
  assert.equal(filtros.ajusteIndividual, true);
  for (const dado of [{ empresa: 1, local: '', codProd: 3 }, { empresa: 1, local: 1, codProd: '1 OR 1=1' }, { empresa: 'abc', local: 1, codProd: 3 }]) {
    assert.throws(() => montarFiltrosAjusteIndividual(dado), /válido/);
  }
});

const original = { CODEMP: 1, CODPROD: 3572, CODLOCAL: 101, CODPARC: 8, TIPO: 'T', CONTROLE: "L'1", ESTOQUE: 10,
  DTFABRICACAO: '2026-01-01', DTVAL: '2027-01-01' };
const pedido = { empresa: 1, codProd: 3572, codLocal: 101, codParc: 8, tipo: 'T', controle: "L'1",
  dtFabricacao: '2026-02-01', dtValidade: '2028-02-01', fabricacaoAnterior: original.DTFABRICACAO, validadeAnterior: original.DTVAL };

function preparar({ linhas = [original], confirma = true, erroGravacao = false } = {}) {
  let registros = linhas.map((item) => ({ ...item }));
  const sqls = [];
  const gravacoes = [];
  const operacoes = criarOperacoesDatasEstoque({
    normalizarData, formatarData: (valor) => valor,
    executeQuery: async (sql) => { sqls.push(sql); return registros; },
    atualizarRegistroApi: async (entidade, chave, campos) => {
      if (erroGravacao) throw new Error('Sankhya indisponível');
      gravacoes.push({ entidade, chave, campos });
      if (confirma) registros = registros.map((item) => ({ ...item, ...campos }));
    }
  });
  return { ...operacoes, sqls, gravacoes };
}

test('lista todos os estoques positivos da empresa e produto sem misturar terceiros ou locais na gravação', async () => {
  const api = preparar();
  await api.listar({ empresa: 1, codProd: 3572 });
  assert.match(api.sqls[0], /EST.CODEMP = 1 AND EST.CODPROD = 3572/);
  assert.match(api.sqls[0], /EST.ESTOQUE, 0\) > 0/);
  assert.doesNotMatch(api.sqls[0], /CODPARC, 0\) = 0|EST.TIPO, 'P'\) = 'P'/);
  await api.atualizar(pedido);
  assert.match(api.sqls[1], /CODLOCAL = 101/);
  assert.match(api.sqls[1], /CODPARC, 0\) = 8/);
  assert.match(api.sqls[1], /TIPO, 'P'\) = 'T'/);
  assert.match(api.sqls[1], /'L''1'/);
  assert.deepEqual(api.gravacoes[0], { entidade: 'Estoque', chave: {
    CODEMP: 1, CODPROD: 3572, CODLOCAL: 101, CODPARC: 8, CONTROLE: "L'1", TIPO: 'T'
  }, campos: { DTFABRICACAO: '2026-02-01', DTVAL: '2028-02-01' } });
  assert.equal(api.sqls.length, 3);
});

test('salva somente datas diferentes e nunca saldo reserva lote ou outras posições', async () => {
  const api = preparar();
  const retorno = await api.atualizar({ ...pedido, dtFabricacao: original.DTFABRICACAO });
  assert.deepEqual(api.gravacoes[0].campos, { DTVAL: pedido.dtValidade });
  assert.equal(retorno.ESTOQUE, 10);
  assert.equal(retorno.CONTROLE, original.CONTROLE);
  const semAlteracao = preparar();
  await semAlteracao.atualizar({ ...pedido, dtFabricacao: original.DTFABRICACAO, dtValidade: original.DTVAL });
  assert.equal(semAlteracao.gravacoes.length, 0);
});

test('bloqueia datas inválidas invertidas remoção de datas e entrada insegura antes de gravar', async () => {
  for (const dados of [
    { dtFabricacao: '2026-02-30' }, { dtValidade: '2025-01-01' }, { dtFabricacao: '' },
    { empresa: '1 OR 1=1' }, { codParc: -1 }, { tipo: "P'" }, { validadeAnterior: undefined }
  ]) {
    const api = preparar();
    await assert.rejects(api.atualizar({ ...pedido, ...dados }));
    assert.equal(api.gravacoes.length, 0);
  }
});

test('bloqueia conflito de datas posição ausente ou ambígua e detecta falha na releitura', async () => {
  for (const linhas of [[], [original, original], [{ ...original, DTVAL: '2030-01-01' }]]) {
    const api = preparar({ linhas });
    await assert.rejects(api.atualizar(pedido), /ausente|ambígua|outro usuário/);
    assert.equal(api.gravacoes.length, 0);
  }
  await assert.rejects(preparar({ confirma: false }).atualizar(pedido), /não confirmou/);
  await assert.rejects(preparar({ erroGravacao: true }).atualizar(pedido), /indisponível/);
});

test('rota do ajuste individual cria a sessão normal incluindo posições zeradas', async () => {
  let handler;
  let sessaoCriada;
  const ctx = vm.createContext({ console, montarFiltrosAjusteIndividual, montarSqlFiltrosCopiaEstoque,
    router: { post(_url, fn) { handler = fn; } },
    estoqueContagemStore: { criar(dados) { sessaoCriada = dados; return dados; } }, serializarSessaoContagemEstoque: (v) => v,
    executeQuery: async (sql) => sql.includes('FROM TGFEST') ? [{ CODPROD: 3572, CODLOCAL: 101, ESTOQUE: 0 }] : [{ NOMEEMPRESA: 'Empresa 1' }]
  });
  vm.runInContext(fonte.slice(fonte.indexOf("router.post('/estoque-contagem/sessoes',"), fonte.indexOf("router.get('/estoque-contagem/sessoes/:id',")), ctx);
  const res = { status(c) { this.codigo = c; return this; }, json(v) { this.dados = v; } };
  await handler({ body: { empresa: 1, local: 101, codProd: 3572, ajusteIndividual: true }, usuario: { codUsu: 72 } }, res);
  assert.equal(res.codigo, 201);
  assert.equal(sessaoCriada.itens[0].ESTOQUE, 0);
  assert.equal(sessaoCriada.filtros.codProd, 3572);
});

test('contagem individual não aceita adicionar produto diferente do escolhido', async () => {
  const ctx = vm.createContext({ localizarProdutoParaContagem: async () => ({ CODPROD: 99 }) });
  vm.runInContext(fonte.slice(fonte.indexOf('async function prepararNovoItemContagem('), fonte.indexOf("router.get('/estoque-contagem/produtos/localizar'")), ctx);
  await assert.rejects(ctx.prepararNovoItemContagem({ filtros: { ajusteIndividual: true, codProd: 3572 } }, { codigo: 99 }), /somente o produto selecionado/);
});

test('empresas e locais incluem posições zeradas somente quando solicitado pelas novas operações', async () => {
  for (const recurso of ['config', 'locais']) {
    const inicio = fonte.indexOf(`router.get('/estoque-contagem/${recurso}'`);
    const fim = fonte.indexOf('\nrouter.get(', inicio + 1);
    let handler;
    let sql;
    const ctx = vm.createContext({
      router: { get(_url, fn) { handler = fn; } }, console,
      obterNumeroInteiro: Number, ambienteSankhyaTeste: () => true,
      executeQuery: async (texto) => { sql = texto; return []; }
    });
    vm.runInContext(fonte.slice(inicio, fim), ctx);
    const res = { json() {}, status() { return this; } };
    await handler({ query: { empresa: 1 } }, res);
    assert.match(sql, /ABS\(NVL\(EST.ESTOQUE, 0\)\) > 0.000001/);
    await handler({ query: { empresa: 1, incluirZerados: '1' } }, res);
    assert.doesNotMatch(sql, /ABS\(NVL\(EST.ESTOQUE/);
    assert.match(sql, /NVL\(EST.ATIVO, 'S'\) = 'S'/);
  }
});
