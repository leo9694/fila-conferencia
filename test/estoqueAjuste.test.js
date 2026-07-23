const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dividirEmLotes,
  extrairNunotaAjuste,
  montarPayloadNotaAjuste,
  planejarAjustesEstoque
} = require('../api/estoqueAjuste');

const sessao = {
  id: 'contagem-1',
  empresa: 1,
  rodadaAtual: 2,
  itens: [
    {
      chave: '10|1|L1',
      codProd: 10,
      descrProd: 'Produto entrada',
      codVol: 'UN',
      codLocal: 1,
      controle: 'L1',
      estoqueSistema: 5,
      contagens: { 1: 8 }
    },
    {
      chave: '20|1|L2',
      codProd: 20,
      descrProd: 'Produto saida',
      codVol: 'UN',
      codLocal: 1,
      controle: 'L2',
      estoqueSistema: 9,
      contagens: { 1: 7, 2: 6 }
    },
    {
      chave: '30|1|L3',
      codProd: 30,
      estoqueSistema: 4,
      contagens: {}
    }
  ]
};

test('planeja somente divergencias contadas e preserva lote e local', () => {
  const plano = planejarAjustesEstoque(sessao);

  assert.equal(plano.itens.length, 2);
  assert.deepEqual(plano.entrada.map((item) => item.quantidadeAjuste), [3]);
  assert.deepEqual(plano.saida.map((item) => item.quantidadeAjuste), [3]);
  assert.equal(plano.saida[0].controle, 'L2');
  assert.equal(plano.saida[0].codLocal, 1);
});

test('divide notas em lotes de no maximo vinte itens', () => {
  const lotes = dividirEmLotes(Array.from({ length: 41 }, (_, indice) => indice));
  assert.deepEqual(lotes.map((lote) => lote.length), [20, 20, 1]);
});

test('monta nota pendente com cabecalho configurado e custo de reposicao', () => {
  const plano = planejarAjustesEstoque(sessao);
  const payload = montarPayloadNotaAjuste({
    sessao,
    itens: plano.saida,
    template: {
      CODPARC: 649,
      CODTIPOPER: 157,
      CODTIPVENDA: 53,
      CODVEND: 0,
      TIPMOV: 'V',
      CODNAT: 0,
      CODCENCUS: 0
    },
    custos: new Map([[20, 2.95]]),
    dataNegociacao: '23/07/2026',
    observacao: 'Contagem app contagem-1 - SAIDA 1/1'
  });

  assert.equal(payload.nota.cabecalho.CODTIPOPER.$, '157');
  assert.equal(payload.nota.cabecalho.OBSERVACAO.$, 'Contagem app contagem-1 - SAIDA 1/1');
  assert.equal(payload.nota.itens.item[0].QTDNEG.$, '3');
  assert.equal(payload.nota.itens.item[0].CONTROLE.$, 'L2');
  assert.equal(payload.nota.itens.item[0].VLRUNIT.$, '2.95');
});

test('extrai nunota retornado pelo servico de inclusao', () => {
  assert.equal(extrairNunotaAjuste({
    responseBody: { pk: { NUNOTA: { $: '12345' } } }
  }), 12345);
});
