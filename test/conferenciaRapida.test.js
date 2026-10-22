const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');

function contextoFrontend() {
  const ctx = vm.createContext({
    filaModoConferencia: 'saida', pedidoSelecionado: { NUNOTA: 123 },
    usuarioLogado: { grupos: ['Diretoria'] }, conferenciaRapidaEmAndamento: false,
    botaoConferenciaRapida: {}, botaoConfirmarConferencia: {},
    itensPendentesLista: {}, itensConferidosLista: {}, scanCodigo: {}, scanQtd: {}, botaoScanAdicionar: {}, scanStatus: {},
    itensPedidoSelecionado: [{ sequencia: 1, codProd: 10, qtdNeg: 5, qtdConferida: 2, qtdCortada: 1,
      controle: 'LOTE-A', codVol: 'UN', leituras: [{ quantidade: 2 }] },
    { sequencia: 2, codProd: 10, qtdNeg: 3.5, controle: 'LOTE-B', codVol: 'KG' }],
    normalizarQuantidade: Number, salvamentoProgressoPendente: Promise.resolve(),
    confirmarAcaoApp: async () => true, salvarProgressoConferencia: async () => ({ ok: true }),
    renderizarItensConferencia() {}, renderizarResumoConferencia() {}, atualizarControlesConferencia() {}
  });
  vm.runInContext(frontend.slice(frontend.indexOf('function podeConferirRapidamente('), frontend.indexOf('async function buscarProdutoExtraEntrada(')), ctx);
  return ctx;
}

test('conferência rápida preenche cada sequência e lote sem acumular leituras nem cortes', async () => {
  const ctx = contextoFrontend();
  const anteriores = ctx.itensPedidoSelecionado;
  ctx.salvarProgressoConferencia = async (opcoes) => {
    assert.equal(opcoes.conferenciaRapida, true);
    assert.equal(ctx.botaoScanAdicionar.disabled, true);
    return { ok: true };
  };
  await ctx.concluirConferenciaRapida();
  assert.deepEqual(Array.from(ctx.itensPedidoSelecionado, (i) => i.qtdConferida), [5, 3.5]);
  assert.deepEqual(Array.from(ctx.itensPedidoSelecionado, (i) => i.leituras[0].controle), ['LOTE-A', 'LOTE-B']);
  assert.equal(ctx.itensPedidoSelecionado[1].leituras[0].codVol, 'KG');
  assert.equal(ctx.itensPedidoSelecionado[0].qtdCortada, 0);
  assert.equal(ctx.itensPedidoSelecionado[0].leituras.length, 1);
  assert.equal(anteriores[0].qtdConferida, 2);
  assert.equal(ctx.itensPendentesLista.inert, false);
});

test('cancelar ou falhar ao salvar preserva as leituras anteriores', async () => {
  for (const cancelar of [true, false]) {
    const ctx = contextoFrontend();
    const anteriores = ctx.itensPedidoSelecionado;
    ctx.confirmarAcaoApp = async () => !cancelar;
    ctx.salvarProgressoConferencia = async () => null;
    await ctx.concluirConferenciaRapida();
    assert.equal(ctx.itensPedidoSelecionado, anteriores);
    assert.equal(ctx.conferenciaRapidaEmAndamento, false);
  }
});

test('botão rápido permite diretoria e Michele 100 somente na conferência de saída', () => {
  const ctx = contextoFrontend();
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.usuarioLogado.grupos = ['GERENTE'];
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.usuarioLogado.codUsu = '100';
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.filaModoConferencia = 'saida';
  ctx.usuarioLogado.codUsu = 101;
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.usuarioLogado.grupos = ['DIRETORIA'];
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.podeConferirRapidamente(), false);
});

test('servidor bloqueia conferência rápida sem diretoria antes de consultar ou gravar a nota', async () => {
  let handler;
  const ctx = vm.createContext({
    router: { post(_url, fn) { handler = fn; } },
    obterNumeroInteiro: Number, obterCodigoUsuario: Number, obterModoConferencia: (m) => m,
    autorizacaoGrupos: { pertenceAoGrupo: async (codUsu, grupo) => {
      assert.equal(codUsu, 72);
      assert.equal(grupo, 'Diretoria');
      return false;
    } },
    executeQuery: () => assert.fail('Não deve consultar a nota sem autorização')
  });
  vm.runInContext(routes.slice(routes.indexOf("router.post('/fila-conferencia/progresso',"), routes.indexOf("router.get('/fila-conferencia/progresso/caixas',")), ctx);
  const res = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; } };
  await handler({ usuario: { codUsu: 72 }, body: { nunota: 123, modo: 'saida', conferenciaRapida: true, itens: [] } }, res);
  assert.equal(res.code, 403);
});

test('servidor autoriza Michele pelo usuário autenticado e não pelo código enviado no corpo', async () => {
  let handler;
  let consultas = 0;
  const ctx = vm.createContext({
    router: { post(_url, fn) { handler = fn; } },
    obterNumeroInteiro: Number, obterCodigoUsuario: Number, obterModoConferencia: (m) => m,
    autorizacaoGrupos: { pertenceAoGrupo: async () => false },
    executeQuery: async () => { consultas += 1; return []; }
  });
  vm.runInContext(routes.slice(routes.indexOf("router.post('/fila-conferencia/progresso',"), routes.indexOf("router.get('/fila-conferencia/progresso/caixas',")), ctx);
  const res = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; } };
  const body = { nunota: 123, modo: 'saida', conferenciaRapida: true, codUsu: 100, itens: [] };
  await handler({ usuario: { codUsu: 101 }, body }, res);
  assert.equal(res.code, 403);
  assert.equal(consultas, 0);
  await handler({ usuario: { codUsu: 100 }, body }, res);
  assert.equal(res.code, 404);
  assert.equal(consultas, 1);
});
