const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { confirmarNotaSaidaTeste, consultarNotaSaida, aplicarCortesNotaSaidaTeste, sqlHistoricoPedidosSaida } = require('../api/conferenciaSaidaNota');
const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function politica(teste) {
  const contexto = vm.createContext({ sqlHistoricoPedidosSaida, separacaoStore: { state: {}, obter: () => null }, ambienteSankhyaTeste: () => teste, TOPS_CONFERENCIA: { saida: [5, 6, 237], entrada: [13, 21, 90] } });
  vm.runInContext(fonte.slice(fonte.indexOf('function obterModoConferencia('), fonte.indexOf('function obterDataHoje(')), contexto);
  return contexto;
}

test('saída de produção e teste usa notas TOP 35 e 10 sem alterar entrada', () => {
  for (const teste of [false, true]) {
    const ctx = politica(teste);
    assert.equal(vm.runInContext("sqlTopsConferencia('entrada')", ctx), '13, 21, 90');
    assert.equal(vm.runInContext("tipoMovimentoConferencia('entrada')", ctx), 'C');
    assert.equal(vm.runInContext("sqlTopsConferencia('saida')", ctx), '35, 10');
    assert.equal(vm.runInContext("tipoMovimentoConferencia('saida')", ctx), 'V');
    assert.equal(vm.runInContext("condicaoStatusConferencia('saida')", ctx), "CAB.STATUSNOTA IN ('A', 'P', 'L')");
  }
});

test('saída sem separação abre aviso e só inicia se o usuário optar por continuar', async () => {
  const ctx = vm.createContext({ filaModoConferencia: 'saida', pedidoPreviewSelecionado: { NUNOTA: 123, SAIDA_POR_NOTA: true },
    avisos: 0, iniciadas: 0, continuar: false,
    botaoConfirmarPreviewPedido: { addEventListener(_evento, handler) { ctx.clicar = handler; } },
    confirmarAcaoApp: async (opcoes) => { ctx.avisos += 1; assert.equal(opcoes.textoConfirmar, 'Iniciar mesmo assim'); return ctx.continuar; },
    selecionarPedidoConferencia: async () => { ctx.iniciadas += 1; }
  });
  vm.runInContext(frontend.slice(frontend.indexOf('function pedidoPodeIniciarConferencia('), frontend.indexOf('function atualizarControlesConferencia(')), ctx);
  vm.runInContext(frontend.slice(frontend.indexOf("botaoConfirmarPreviewPedido.addEventListener('click'"), frontend.indexOf("pedidoPreview.addEventListener('click'")), ctx);
  await ctx.clicar();
  assert.equal(ctx.avisos, 1);
  assert.equal(ctx.iniciadas, 0);
  ctx.continuar = true;
  await ctx.clicar();
  assert.equal(ctx.iniciadas, 1);
  ctx.pedidoPreviewSelecionado.STATUS_SEPARACAO = 'SEPARADO';
  await ctx.clicar();
  assert.equal(ctx.avisos, 2);
  assert.equal(ctx.iniciadas, 2);
});

test('acompanhamento consulta notas TOP 35 e 10 mesmo sem liberação e preserva conferidos antigos', () => {
  const ctx = politica(false);
  ctx.sqlFiltroEmpresa = () => '';
  vm.runInContext(fonte.slice(fonte.indexOf('function montarSqlConferencias('), fonte.indexOf("router.get('/empresas'")), ctx);
  const sql = vm.runInContext("montarSqlConferencias({ inicio: '2026-10-15', fim: '2026-10-16' }, 1)", ctx);
  assert.match(sql, /CAB.CODTIPOPER IN \(35, 10\)/);
  assert.match(sql, /CAB.TIPMOV = 'V'/);
  assert.match(sql, /NVL\(CAB.LIBCONF, 'N'\) <> 'S'/);
  assert.match(sql, /OR CONF.STATUS = 'F'/);
  assert.match(sql, /IN \(5, 6, 237\)/, 'Preserva histórico das TOPs antigas');
});

test('separação na produção aceita TOP 35 e 10 somente com liberação para conferência', async () => {
  const ctx = politica(false);
  vm.runInContext(fonte.slice(fonte.indexOf('async function garantirPedidoNaoConferidoParaSeparacao('), fonte.indexOf("router.post('/fila-conferencia/separacao/:nunota/iniciar'")), ctx);
  for (const top of [35, 10]) {
    ctx.executeQuery = async () => [{ CODTIPOPER: top, TIPMOV: 'V', STATUSNOTA: 'A', LIBCONF: 'S' }];
    await vm.runInContext('garantirPedidoNaoConferidoParaSeparacao(123)', ctx);
  }
  for (const alteracoes of [{ LIBCONF: 'N' }, { CODTIPOPER: 5 }, { STATUSNOTA: 'L' }, { STATUS: 'F' }]) {
    ctx.executeQuery = async () => [{ CODTIPOPER: 35, TIPMOV: 'V', STATUSNOTA: 'A', LIBCONF: 'S', ...alteracoes }];
    await assert.rejects(vm.runInContext('garantirPedidoNaoConferidoParaSeparacao(123)', ctx));
  }
});

test('API não impõe separação obrigatória para iniciar, salvar progresso ou finalizar', async () => {
  const ctx = politica(true);
  const handlers = {};
  Object.assign(ctx, {
    router: { post(url, handler) { handlers[url] = handler; }, get() {} },
    obterNumeroInteiro: Number, obterCodigoUsuario: Number,
    separacaoStore: { obter: () => null }, executeQuery: async () => [],
    finalizacoesConferenciaEmAndamento: new Set(),
    validarVersaoLotesConferencia() {},
    console: { error() {} }
  });
  vm.runInContext(fonte.slice(fonte.indexOf("router.post('/fila-conferencia/iniciar',"), fonte.indexOf("router.get('/fila-conferencia/progresso/caixas'")), ctx);
  vm.runInContext(fonte.slice(fonte.indexOf("router.post('/fila-conferencia/confirmar',"), fonte.indexOf("router.get('/fila-conferencia/pedidos/:nunota/documentos'")), ctx);
  for (const rota of ['iniciar', 'progresso', 'confirmar']) {
    const res = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; } };
    await handlers[`/fila-conferencia/${rota}`]({ usuario: { codUsu: 72 }, body: { nunota: 123, modo: 'saida', volumes: 1, itens: [{}] } }, res);
    assert.equal(res.code, 404);
    assert.doesNotMatch(res.payload.erro, /Conclua a separação/);
  }
});

test('tela permite conferir sem separação mediante aviso e mantém frete oculto', async () => {
  const ctx = vm.createContext({ filaModoConferencia: 'saida', pedidoPreviewFreteEstimado: {},
    pedidoPreviewFreteValor: {}, pedidoPreviewFreteValorPedido: {}, pedidoPreviewFreteMeta: {},
    fetch: () => assert.fail('Não deve consultar frete da nota')
  });
  vm.runInContext(frontend.slice(frontend.indexOf('function pedidoPodeIniciarConferencia('), frontend.indexOf('function atualizarControlesConferencia(')), ctx);
  ctx.nota = { NUNOTA: 123, SAIDA_POR_NOTA: true, STATUS_SEPARACAO: 'EM_SEPARACAO' };
  assert.equal(vm.runInContext('pedidoPodeIniciarConferencia(nota)', ctx), true);
  assert.equal(vm.runInContext('pedidoExigeConfirmacaoSemSeparacao(nota)', ctx), true);
  ctx.nota.STATUS_SEPARACAO = 'SEPARADO';
  assert.equal(vm.runInContext('pedidoPodeIniciarConferencia(nota)', ctx), true);
  assert.equal(vm.runInContext('pedidoExigeConfirmacaoSemSeparacao(nota)', ctx), false);
  vm.runInContext(frontend.slice(frontend.indexOf('async function carregarEstimativaFretePedido('), frontend.indexOf('async function abrirPreviewPedido(')), ctx);
  await vm.runInContext('carregarEstimativaFretePedido(nota)', ctx);
  assert.equal(ctx.pedidoPreviewFreteEstimado.hidden, true);
});

test('confirma a mesma nota pelo serviço nativo e verifica status real sem faturar', async () => {
  for (const codTipOper of [35, 10]) {
    let confirmada = false;
    const chamadas = [];
    const retorno = await confirmarNotaSaidaTeste({ nunota: 123, ambienteTeste: false,
      executeQuery: async (sql) => {
        assert.match(sql, /CAB.NUNOTA = 123 AND CAB.CODTIPOPER IN \(35, 10\)/);
        return [{ NUNOTA: 123, CODTIPOPER: codTipOper, TIPMOV: 'V', STATUSNOTA: confirmada ? 'L' : 'A', LIBCONF: 'S', STATUS_CONF: 'F' }];
      },
      executeService: async (servico, corpo, options) => {
        chamadas.push(servico);
        assert.equal(corpo.nota.NUNOTA.$, '123');
        assert.deepEqual(corpo.nota.txProperties, { prop: [{ name: 'br.com.utiliza.dtneg.servidor', value: false }] });
        assert.deepEqual(corpo.clientEventList, { clientEvent: [{ $: 'br.com.utiliza.dtneg.servidor' }] });
        assert.equal(options.modulePath, 'mgecom');
        confirmada = true;
      }
    });
    assert.deepEqual(chamadas, ['CACSP.confirmarNota']);
    assert.equal(retorno.status, 'CONFIRMADA');
    assert.equal(retorno.nota.NUNOTA, 123);
  }
});

test('não confirma sem aprovação ou antes de conferir e não assume sucesso HTTP', async () => {
  const params = { nunota: 123, ambienteTeste: true, executeService: async () => {},
    executeQuery: async () => [{ CODTIPOPER: 35, TIPMOV: 'V', STATUSNOTA: 'A', STATUS_CONF: 'F', LIBCONF: 'S' }] };
  for (const alteracoes of [{ LIBCONF: 'N' }, { STATUS_CONF: 'A' }, { CODTIPOPER: 5 }, { TIPMOV: 'P' }]) {
    await assert.rejects(confirmarNotaSaidaTeste({ ...params,
      executeQuery: async () => [{ CODTIPOPER: 35, TIPMOV: 'V', STATUSNOTA: 'A', STATUS_CONF: 'F', LIBCONF: 'S', ...alteracoes }],
      executeService: () => assert.fail('Não deve confirmar')
    }));
  }
  await assert.rejects(confirmarNotaSaidaTeste(params), /ainda não confirmou/);
  await assert.rejects(consultarNotaSaida({ nunota: '1 OR 1=1', executeQuery: () => assert.fail() }), /Nota inválida/);
});

test('nova tentativa com nota já confirmada não repete confirmação', async () => {
  const retorno = await confirmarNotaSaidaTeste({ nunota: 123, ambienteTeste: true,
    executeQuery: async () => [{ NUNOTA: 123, CODTIPOPER: 35, TIPMOV: 'V', STATUSNOTA: 'L', STATUS_CONF: 'F' }],
    executeService: () => assert.fail('Não deve confirmar novamente')
  });
  assert.equal(retorno.nota.NUNOTA, 123);
});

test('documentos da saída em produção só ficam disponíveis após confirmar a própria nota', async () => {
  for (const confirmada of [false, true]) {
    const ctx = politica(false);
    Object.assign(ctx, {
      consultarNotaSaida: async () => ({ NUNOTA: 123, STATUSNOTA: confirmada ? 'L' : 'A', STATUS_CONF: 'F' }),
      consultarFaturamentoExistente: () => assert.fail('Não deve procurar uma nota gerada por faturamento'),
      normalizarNumero: Number,
      executeQuery: async (sql) => {
        assert.match(sql, /CAB.NUNOTA = 123/);
        return [{ NUNOTA: 123, NUMNOTA: 456, NFE_AUTORIZADA: 'S', QTD_TITULOS: 1 }];
      }
    });
    vm.runInContext(fonte.slice(fonte.indexOf('async function obterSituacaoDocumentosPedido('), fonte.indexOf('async function pedidoNecessitaGuiaFase(')), ctx);
    const documentos = await vm.runInContext('obterSituacaoDocumentosPedido(123)', ctx);
    assert.equal(documentos.faturado, confirmada);
    assert.equal(documentos.danfe.disponivel, confirmada);
    assert.equal(documentos.boleto.disponivel, confirmada);
    if (confirmada) assert.equal(documentos.nota.NUNOTA, 123);
  }
});

test('fila em produção encontra nota 3885419 TOP 35 liberada, sem filtros comerciais do pedido', async () => {
  const ctx = politica(false);
  let handler;
  let sqlFila;
  Object.assign(ctx, { router: { get(_url, fn) { handler = fn; } },
    obterIntervaloDatas: () => ({ inicio: '2026-10-01', fim: '2026-10-13' }),
    obterFiltroEmpresa: () => 1, obterNumeroInteiro: (v) => Number(v) || null, sqlFiltroEmpresa: () => '',
    normalizarDataSankhya: (v) => v, normalizarInicioConferencia: (v) => v, normalizarFimConferencia: (v) => v,
    normalizarNumero: Number, guiaFaseStore: { quantidade: () => 0 }, pedidoPrintStore: { obter: () => null },
    executeQuery: async (sql) => { sqlFila = sql; return [
      { NUNOTA: 3885419, TIPMOV: 'V', CODTIPOPER: 35, STATUSNOTA: 'A', STATUS_CONFERENCIA: 'AGUARDANDO CONFERENCIA' },
      { NUNOTA: 3885300, TIPMOV: 'P', CODTIPOPER: 5, STATUSNOTA: 'L', STATUS_CONF: 'F', STATUS_CONFERENCIA: 'CONFERIDO', FATURADO: 1 },
      { NUNOTA: 3885299, TIPMOV: 'P', CODTIPOPER: 6, STATUSNOTA: 'L', STATUS_CONFERENCIA: 'AGUARDANDO CONFERENCIA' }
    ]; }
  });
  ctx.separacaoStore = { state: { 3885299: { status: 'SEPARADO' } }, obter: (n) => n === 3885299 ? { status: 'SEPARADO' } : null };
  vm.runInContext(fonte.slice(fonte.indexOf("router.get('/fila-conferencia/pedidos',"), fonte.indexOf("router.get('/fila-conferencia/romaneio/transportadoras'")), ctx);
  let payload;
  await handler({ query: { modo: 'saida', pedido: 3885419 } }, { json(value) { payload = value; } });
  assert.equal(payload.saidaPorNota, true);
  assert.match(sqlFila, /CAB.CODTIPOPER IN \(35, 10\)/);
  assert.match(sqlFila, /CAB.TIPMOV = 'V'/);
  assert.match(sqlFila, /CAB.LIBCONF = 'S' AND CAB.STATUSNOTA IN \('A', 'P'\)/);
  assert.doesNotMatch(sqlFila, /AD_STATUSCOMERCIAL|AD_STATUSINTPED/);
  assert.match(sqlFila, /CAB.NUNOTA IN \(3885299\)/);
  assert.equal(payload.itens[0].SAIDA_POR_NOTA, true);
  assert.equal(payload.itens[1].HISTORICO_SAIDA, true);
  assert.equal(payload.itens[1].SAIDA_POR_NOTA, false);
  assert.equal(payload.itens[1].FATURADO, true);
  assert.equal(payload.itens[2].STATUS_SEPARACAO, 'SEPARADO');
  const ui = vm.createContext({});
  vm.runInContext(frontend.slice(frontend.indexOf('function pedidoPodeIniciarConferencia('), frontend.indexOf('function pedidoExigeConfirmacaoSemSeparacao(')), ui);
  assert.equal(ui.pedidoPodeIniciarConferencia(payload.itens[2]), false);
  assert.equal(ui.pedidoPodeIniciarConferencia(payload.itens[0]), true);
});

test('histórico mantém apenas pedidos antigos conferidos ou com separação registrada e valida IDs', () => {
  const sql = sqlHistoricoPedidosSaida({ 123: { status: 'SEPARADO' }, 124: { status: 'EM_SEPARACAO' },
    125: { status: 'NOVO' }, '1 OR 1=1': { status: 'SEPARADO' } });
  assert.match(sql, /CONF.STATUS = 'F'/);
  assert.match(sql, /CAB.TIPMOV = 'P' AND CAB.STATUSNOTA = 'L'/);
  assert.match(sql, /CAB.NUNOTA IN \(123, 124\)/);
  assert.doesNotMatch(sql, /125|1 OR 1=1/);
});

test('documentos de pedido histórico continuam apontando para a nota faturada original', async () => {
  const ctx = politica(false);
  Object.assign(ctx, {
    consultarNotaSaida: async () => null,
    consultarFaturamentoExistente: async (nunota) => { assert.equal(nunota, 123); return { NUNOTA: 456 }; },
    normalizarNumero: Number,
    executeQuery: async (sql) => {
      assert.match(sql, /CAB.NUNOTA = 456/);
      return [{ NUNOTA: 456, NFE_AUTORIZADA: 'S', QTD_TITULOS: 1 }];
    }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('async function obterSituacaoDocumentosPedido('), fonte.indexOf('async function pedidoNecessitaGuiaFase(')), ctx);
  const resultado = await ctx.obterSituacaoDocumentosPedido(123);
  assert.equal(resultado.nota.NUNOTA, 456);
  assert.equal(resultado.danfe.disponivel, true);
  assert.equal(resultado.boleto.disponivel, true);
});

test('finalização de saída em produção só confirma a nota e preserva progresso se nota falhar', async () => {
  for (const falhar of [false, true]) {
    const ctx = politica(false);
    let handler;
    const eventos = [];
    Object.assign(ctx, {
      router: { post(_url, fn) { handler = fn; } }, obterNumeroInteiro: Number, obterCodigoUsuario: Number,
      normalizarNumero: Number, formatarDataHoraSankhya: () => '13/10/2026 10:00:00',
      finalizacoesConferenciaEmAndamento: new Set(),
      validarVersaoLotesConferencia() {},
      executeQuery: async (sql) => {
        if (sql.includes('FROM TGFCAB CAB')) return [{ NUNOTA: 123, NUCONFATUAL: 9, QTDVOL: 1, LIBCONF: 'S', STATUSNOTA: 'A', QTD_ITENS: 1, STATUS: 'A' }];
        if (sql.includes('FROM TSIUSU')) return [{ CODUSU: 72 }];
        if (sql.includes('FROM TGFITE')) return [{ SEQUENCIA: 1, CODPROD: 1113, QTDNEG: 10 }];
        if (sql.includes('FROM TGFCON2')) return [{ NUCONF: 9, NUNOTAORIG: 123, STATUS: 'A' }];
        assert.fail(sql);
      },
      atualizarRegistroApi: async () => {}, aplicarCortesNoPedido: async () => [], salvarDetalhesConferenciaSankhya: async () => {},
      aplicarCortesNotaSaidaTeste: async () => [], salvarQuantidadeLoteItemNotaApi() {}, excluirItemNotaApi() {},
      garantirContaFaturamento: async () => {},
      executeService: () => assert.fail('Serviço deve ser chamado pelo helper validado'),
      finalizarConferenciaNativa: () => assert.fail('Não pode faturar a nota'),
      finalizarConferenciaOperacional: async () => { eventos.push('conferido'); },
      preservarConferenteFinalizacao: async () => {},
      confirmarNotaSaidaTeste: async () => { eventos.push('confirmar'); if (falhar) throw new Error('Pendência no Sankhya'); return { status: 'CONFIRMADA', nota: { NUNOTA: 123 } }; },
      conferenciaProgressStore: { remover() { eventos.push('remover'); } }, console: { error() {} },
      separacaoStore: { obter: () => null }
    });
    vm.runInContext(fonte.slice(fonte.indexOf("router.post('/fila-conferencia/confirmar',"), fonte.indexOf("router.get('/fila-conferencia/pedidos/:nunota/documentos'")), ctx);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.payload = value; } };
    await handler({ usuario: { codUsu: 72 }, body: { nunota: 123, modo: 'saida', volumes: 1, itens: [{ sequencia: 1, qtdConferida: 10, qtdCortada: 0 }] } }, res);
    assert.deepEqual(eventos, falhar ? ['conferido', 'confirmar'] : ['conferido', 'confirmar', 'remover']);
    assert.equal(res.code, falhar ? 500 : 200);
    if (!falhar) assert.equal(res.payload.confirmacaoNota, true);
  }
});
