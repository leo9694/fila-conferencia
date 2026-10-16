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
      gravado = { ...gravado, QTDNEG: dados.quantidade, VLRTOT: dados.vlrTot, VLRDESC: dados.vlrDesc, QTDCONFERIDA: dados.zerarCorte ? 0 : 10 };
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
  assert.equal(chamadas[0].zerarCorte, true);
});

test('repetir após falha parcial não reaplica corte nem reduz desconto novamente', async () => {
  const { params, obter } = ambiente(80);
  await aplicarCortesNotaSaidaTeste(params);
  params.itensPedido = [{ ...obter() }];
  await aplicarCortesNotaSaidaTeste(params);
  assert.equal(obter().QTDNEG, 80);
  assert.equal(obter().VLRDESC, 16);
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

test('requisição nativa envia quantidade reduzida e limpa campo de corte sem alterar lote', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
  let enviado;
  const ctx = vm.createContext({ campoApi: (valor) => ({ $: String(valor) }), numeroApiPreciso: String,
    executeService: async (servico, corpo) => { assert.equal(servico, 'CACSP.incluirAlterarItemNota'); enviado = corpo.nota.itens.item; }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('async function salvarQuantidadeLoteItemNotaApi('), fonte.indexOf('async function excluirItemNotaApi(')), ctx);
  ctx.item = { CODPROD: 1043, SEQUENCIA: 1, QTDNEG: 90, VLRUNIT: 2, CODVOL: 'UN', CODLOCALORIG: 1010101 };
  ctx.dados = { quantidade: 80, controle: 'LOTE-A', vlrTot: 160, vlrDesc: 16, zerarCorte: true };
  await vm.runInContext('salvarQuantidadeLoteItemNotaApi(123, item, dados)', ctx);
  assert.equal(enviado.QTDNEG.$, '80');
  assert.equal(enviado.VLRTOT.$, '160');
  assert.equal(enviado.QTDCONFERIDA.$, '0');
  assert.equal(enviado.CONTROLE.$, 'LOTE-A');
});
