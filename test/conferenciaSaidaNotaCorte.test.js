const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { aplicarCortesNotaSaidaTeste } = require('../api/conferenciaSaidaNota');

function ambiente(quantidade = 90) {
  const item = { SEQUENCIA: 1, CODPROD: 1043, QTDNEG: 90, VLRUNIT: 2, VLRTOT: 180, VLRDESC: 18, CONTROLE: 'LOTE-A', QTDCONFERIDA: 0 };
  let gravado = { ...item };
  const chamadas = [];
  const params = {
    nunota: 123, itensPedido: [item], conferidosPorSequencia: new Map([[1, quantidade]]), cortadosPorSequencia: new Map([[1, 90 - quantidade]]),
    salvarQuantidade: async (_nunota, origem, dados) => {
      chamadas.push(dados);
      assert.equal(origem.CONTROLE, 'LOTE-A');
      gravado = { ...gravado, QTDNEG: dados.quantidade, VLRTOT: dados.vlrTot, VLRDESC: dados.vlrDesc,
        QTDCONFERIDA: dados.zerarCorte ? 0 : dados.qtdCortada, AD_CORTE: dados.qtdCortada,
        ...(dados.baseIcms !== undefined ? { BASEICMS: dados.baseIcms, VLRICMS: dados.valorIcms } : {}) };
    },
    excluirItem: async () => { gravado = null; },
    executeQuery: async () => gravado ? [gravado] : []
  };
  return { item, params, chamadas, obter: () => gravado };
}

test('corte na nota reduz quantidade e valor e não desconta duas vezes na conferência', async () => {
  const { params, chamadas, obter } = ambiente(80);
  const cortes = await aplicarCortesNotaSaidaTeste(params);
  assert.equal(cortes[0].novaQuantidade, 80);
  assert.equal(obter().QTDNEG, 80);
  assert.equal(obter().VLRTOT, 160);
  assert.equal(obter().VLRDESC, 16);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 10);
  assert.equal(chamadas[0].qtdCortada, 10);
});

test('repetir após falha parcial não reaplica corte nem reduz desconto novamente', async () => {
  const { params, obter } = ambiente(80);
  await aplicarCortesNotaSaidaTeste(params);
  params.itensPedido = [{ ...obter() }];
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDNEG, 80);
  assert.equal(obter().VLRDESC, 16);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 10);
});

test('novo corte acumula o histórico sem reaplicar o corte anterior na quantidade ou no desconto', async () => {
  const { params, obter } = ambiente(80);
  await aplicarCortesNotaSaidaTeste(params);
  params.itensPedido = [{ ...obter() }];
  params.conferidosPorSequencia.set(1, 75);
  params.cortadosPorSequencia.set(1, 5);
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDNEG, 75);
  assert.equal(obter().VLRTOT, 150);
  assert.equal(obter().VLRDESC, 15);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 15);
});

test('retentativa de corte antigo preenche histórico sem reduzir novamente a nota', async () => {
  const { params, obter } = ambiente(80);
  params.itensPedido[0] = { ...params.itensPedido[0], QTDNEG: 80, VLRTOT: 160, VLRDESC: 16, AD_CORTE: null };
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDNEG, 80);
  assert.equal(obter().VLRDESC, 16);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 10);
});

test('histórico de corte ignorado pelo ERP bloqueia a confirmação mesmo com quantidade reduzida', async () => {
  const { params, obter } = ambiente(80);
  const salvar = params.salvarQuantidade;
  params.salvarQuantidade = async (...args) => { await salvar(...args); obter().AD_CORTE = null; };
  await assert.rejects(aplicarCortesNotaSaidaTeste(params), /não foi aplicado/);
});

test('corte integral exclui somente a linha cortada, mas nota totalmente cortada é bloqueada', async () => {
  const { params, obter } = ambiente(0);
  await assert.rejects(aplicarCortesNotaSaidaTeste(params), /todos os produtos cortados/);
  assert.ok(obter());
  params.itensPedido.push({ SEQUENCIA: 2, QTDNEG: 5, VLRUNIT: 1 });
  params.conferidosPorSequencia.set(2, 5);
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter(), null);
});

test('gravação ignorada pelo Sankhya interrompe fluxo antes de confirmar a nota', async () => {
  const { params } = ambiente(80);
  params.salvarQuantidade = async () => {};
  await assert.rejects(aplicarCortesNotaSaidaTeste(params), /não foi aplicado/);
});

test('sem corte mantém itens e fluxo existente sem gravar quantidade', async () => {
  const { params, chamadas } = ambiente();
  const resultado = await aplicarCortesNotaSaidaTeste(params);
  assert.deepEqual(resultado, []);
  assert.equal(chamadas.length, 0);
});

test('requisição nativa envia quantidade restante, histórico e ICMS e zera o corte nativo', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
  let enviado;
  const ctx = vm.createContext({ campoApi: (valor) => ({ $: String(valor) }), numeroApiPreciso: String,
    executeService: async (servico, corpo) => { assert.equal(servico, 'CACSP.incluirAlterarItemNota'); enviado = corpo.nota.itens.item; }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('async function salvarQuantidadeLoteItemNotaApi('), fonte.indexOf('async function excluirItemNotaApi(')), ctx);
  ctx.item = { CODPROD: 1043, SEQUENCIA: 1, QTDNEG: 90, VLRUNIT: 2, CODVOL: 'UN', CODLOCALORIG: 1010101 };
  ctx.dados = { quantidade: 80, controle: 'LOTE-A', vlrTot: 160, vlrDesc: 16, qtdCortada: 10, zerarCorte: true, baseIcms: 144, valorIcms: 24.48 };
  await vm.runInContext('salvarQuantidadeLoteItemNotaApi(123, item, dados)', ctx);
  assert.equal(enviado.QTDNEG.$, '80');
  assert.equal(enviado.VLRTOT.$, '160');
  assert.equal(enviado.QTDCONFERIDA.$, '0');
  assert.equal(enviado.AD_CORTE.$, '10');
  assert.equal(enviado.BASEICMS.$, '144');
  assert.equal(enviado.VLRICMS.$, '24.48');
  assert.equal(enviado.CONTROLE.$, 'LOTE-A');
});

test('corte 100 para 50 atualiza ICMS digitável preservando alíquota e não reduz novamente na retentativa', async () => {
  const { params, obter } = ambiente(50);
  params.itensPedido[0] = { ...params.itensPedido[0], QTDNEG: 100, VLRUNIT: 19.9, VLRTOT: 1990, VLRDESC: 0,
    BASEICMS: 1990, VLRICMS: 338.3, CALCICMS: 'D', ALIQICMS: 17 };
  params.cortadosPorSequencia.set(1, 50);
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().BASEICMS, 995);
  assert.equal(obter().VLRICMS, 169.15);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 50);
  params.itensPedido = [{ ...params.itensPedido[0], ...obter() }];
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().BASEICMS, 995);
  assert.equal(obter().VLRICMS, 169.15);
});

test('recupera a nota 3882129 com quantidade já reduzida e ICMS integral do fluxo antigo', async () => {
  const { params, obter } = ambiente(50);
  params.itensPedido[0] = { ...params.itensPedido[0], QTDNEG: 50, VLRUNIT: 19.9, VLRTOT: 995, VLRDESC: 0,
    BASEICMS: 1990, VLRICMS: 338.3, CALCICMS: 'D', ALIQICMS: 17, AD_CORTE: 50 };
  params.cortadosPorSequencia.set(1, 50);
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDNEG, 50);
  assert.equal(obter().BASEICMS, 995);
  assert.equal(obter().VLRICMS, 169.15);
});

test('imposto ignorado pelo ERP interrompe o fluxo antes da confirmação', async () => {
  const { params, obter } = ambiente(80);
  Object.assign(params.itensPedido[0], { BASEICMS: 180, VLRICMS: 30.6, CALCICMS: 'D' });
  const salvar = params.salvarQuantidade;
  params.salvarQuantidade = async (...args) => { await salvar(...args); obter().BASEICMS = 180; };
  await assert.rejects(aplicarCortesNotaSaidaTeste(params), /não foi aplicado/);
});

test('TOP de cálculo automático não recebe base ou valor de ICMS manualmente', async () => {
  const { params, chamadas } = ambiente(80);
  Object.assign(params.itensPedido[0], { BASEICMS: 180, VLRICMS: 30.6, CALCICMS: 'G' });
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(chamadas[0].baseIcms, undefined);
  assert.equal(chamadas[0].valorIcms, undefined);
});

test('recupera a nota 3882131 e grava detalhes respeitando o saldo validado pelo ERP', async () => {
  const { gravarDetalhesConferenciaSaida } = require('../api/conferenciaSaida');
  const { params, obter } = ambiente(50);
  Object.assign(params.itensPedido[0], { QTDNEG: 50, QTDCONFERIDA: 50, AD_CORTE: 50,
    VLRUNIT: 19.9, VLRTOT: 995, VLRDESC: 0, CALCICMS: 'D', BASEICMS: 995, VLRICMS: 169.15 });
  params.cortadosPorSequencia.set(1, 50);
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDCONFERIDA, 0);
  assert.equal(obter().AD_CORTE, 50);
  assert.equal(obter().BASEICMS, 995);
  assert.equal(obter().VLRICMS, 169.15);
  let gravados = [];
  await gravarDetalhesConferenciaSaida({ nuconf: 69629,
    itens: [{ SEQUENCIA: 1, CODPROD: 3590, CODVOL: 'UN', QTDNEG: obter().QTDNEG, QTDCORTE: obter().QTDCONFERIDA }],
    existentes: [], dhAlter: '23/10/2026 10:00:00',
    executeService: async (servico, body) => {
      assert.equal(servico, 'DatasetSP.save');
      gravados = body.records.map((r) => Object.fromEntries(Object.entries(r.values).map(([i, v]) => [body.fields[i], v])));
      for (const detalhe of gravados) assert.ok(detalhe.QTDCONF <= obter().QTDNEG - obter().QTDCONFERIDA,
        'Quantidade conferida não pode superar o saldo nativo do ERP');
    }, consultarGravados: async () => gravados
  });
  assert.equal(gravados[0].QTDCONF, 50);
});
