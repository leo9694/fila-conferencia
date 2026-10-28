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
    itensPendentesLista: {}, itensConferidosLista: {}, scanCodigo: {}, scanControle: {}, scanFabricacao: {}, scanValidade: {}, scanQtd: {}, botaoScanAdicionar: {}, scanStatus: {},
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

test('botão rápido permite diretoria e Michele 100 na saída e na entrada', () => {
  const ctx = contextoFrontend();
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.usuarioLogado.grupos = ['GERENTE'];
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.usuarioLogado.codUsu = '100';
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.filaModoConferencia = 'saida';
  ctx.usuarioLogado.codUsu = 101;
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.usuarioLogado.grupos = ['DIRETORIA'];
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.pedidoSelecionado = null;
  assert.equal(ctx.podeConferirRapidamente(), false);
});

test('Compras 01 tem botão de conferência rápida somente na entrada', () => {
  const ctx = contextoFrontend();
  ctx.usuarioLogado = { codUsu: '152', nome: 'COMPRAS 01', grupos: [] };
  assert.equal(ctx.podeConferirRapidamente(), false);
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.podeConferirRapidamente(), true);
  ctx.usuarioLogado = { codUsu: 153, nome: 'COMPRAS 01', grupos: [] };
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
  await handler({ usuario: { codUsu: 100 }, body: { ...body, modo: 'entrada' } }, res);
  assert.equal(res.code, 404);
  assert.equal(consultas, 2);
  await handler({ usuario: { codUsu: 101 }, body: { ...body, modo: 'entrada' } }, res);
  assert.equal(res.code, 403);
  assert.equal(consultas, 2);
  await handler({ usuario: { codUsu: 152 }, body: { ...body, modo: 'entrada' } }, res);
  assert.equal(res.code, 404);
  assert.equal(consultas, 3);
  await handler({ usuario: { codUsu: 152 }, body }, res);
  assert.equal(res.code, 403);
  assert.equal(consultas, 3);
  await handler({ usuario: { codUsu: 153 }, body: { ...body, modo: 'entrada', codUsu: 152 } }, res);
  assert.equal(res.code, 403);
  assert.equal(consultas, 3);
});

test('entrada rápida mantém lotes, datas, unidade padrão e caixa atual e preserva produtos extras', async () => {
  const ctx = contextoFrontend();
  ctx.filaModoConferencia = 'entrada';
  ctx.obterCaixaEntradaAtual = () => ({ caixaId: 3 });
  ctx.formatarDataInput = (v) => v || '';
  Object.assign(ctx.itensPedidoSelecionado[0], { dtFabricacao: '2026-10-01', dtValidade: '2027-10-01', codVol: 'CX', codVolPadrao: 'UN' });
  const extra = { sequencia: -1, codProd: 11, extra: true, qtdNeg: 0, qtdConferida: 2, leituras: [{ quantidade: 2 }] };
  ctx.itensPedidoSelecionado.push(extra);
  await ctx.concluirConferenciaRapida();
  const item = ctx.itensPedidoSelecionado[0];
  assert.equal(item.qtdConferida, 5);
  assert.equal(item.leituras[0].codVol, 'UN');
  assert.equal(item.leituras[0].controle, 'LOTE-A');
  assert.equal(item.leituras[0].dtFabricacao, '2026-10-01');
  assert.equal(item.leituras[0].dtValidade, '2027-10-01');
  assert.equal(item.leituras[0].caixaId, 3);
  assert.equal(item.leituras[0].caixaFechada, false);
  assert.equal(item.leituras[0].multiplicador, 1);
  assert.equal(ctx.itensPedidoSelecionado[2], extra);
});

test('servidor salva entrada rápida e usa a sincronização nativa sem finalizar a nota', async () => {
  let handler;
  const eventos = [];
  const itens = [{ sequencia: 1, qtdConferida: 5, leituras: [{ controle: 'LOTE-A', quantidadeConvertida: 5 }] }];
  const ctx = vm.createContext({
    router: { post(_url, fn) { handler = fn; } },
    obterNumeroInteiro: Number, obterCodigoUsuario: Number, obterModoConferencia: (m) => m,
    autorizacaoGrupos: { pertenceAoGrupo: async () => true },
    TOPS_CONFERENCIA: { entrada: [13] }, conferenciaSaidaPorNota: () => false,
    erroProntidaoConferenciaEntrada: () => null,
    executeQuery: async () => [{ NUNOTA: 123, NUCONFATUAL: 9, CODTIPOPER: 13, TIPMOV: 'C', STATUSNOTA: 'A', LIBCONF: 'S', STATUS: 'A', QTD_ITENS: 1 }],
    normalizarItensExtrasConferenciaEntrada: async (valor) => valor,
    finalizacoesConferenciaEmAndamento: new Set(), validarVersaoLotesConferencia() {},
    conferenciaProgressStore: { salvar(dados) { eventos.push('salvar'); return dados; } },
    enfileirarSincronizacaoEntrada: async (_nunota, tarefa) => tarefa(),
    sincronizarDetalhesConferenciaEntrada: async (dados) => {
      assert.equal(dados.nuconf, 9);
      assert.equal(dados.itens, itens);
      eventos.push('sincronizar');
    }
  });
  vm.runInContext(routes.slice(routes.indexOf("router.post('/fila-conferencia/progresso',"), routes.indexOf("router.get('/fila-conferencia/progresso/caixas',")), ctx);
  const res = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; } };
  await handler({ usuario: { codUsu: 72 }, body: { nunota: 123, modo: 'entrada', conferenciaRapida: true, itens } }, res);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.sincronizadoSankhya, true);
  assert.deepEqual(eventos, ['salvar', 'sincronizar']);
});
