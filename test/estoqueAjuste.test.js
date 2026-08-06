const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DATA_FABRICACAO_TECNICA,
  DATA_VALIDADE_TECNICA,
  agruparItensEmNotaUnica,
  extrairNunotaAjuste,
  localizarBloqueiosEstoqueComprometido,
  montarPayloadNotaAjuste,
  planejarAjustesEstoque,
  reconciliarAjustesComEstoqueAtual
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
      dtFabricacao: '2026-04-21',
      dtVal: '2027-07-31',
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
      dtFabricacao: '2026-05-10',
      dtVal: '2028-05-10',
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
  assert.equal(plano.saida[0].dtFabricacao, '2026-05-10');
  assert.equal(plano.saida[0].dtValidade, '2028-05-10');
  assert.equal(plano.saida[0].codLocal, 1);
});

test('ajusta somente a diferenca mesmo quando o lote informado muda', () => {
  const plano = planejarAjustesEstoque({
    empresa: 1,
    rodadaAtual: 1,
    itens: [{
      chave: '5040|1010101|SEM_CONTROLE',
      codProd: 5040,
      descrProd: 'Produto com novo lote',
      codVol: 'UN',
      codLocal: 1010101,
      controle: '1010',
      dtFabricacao: '2025-11-05',
      dtVal: '2027-07-31',
      estoqueSistema: 1,
      contagens: { 1: 30 }
    }]
  });

  assert.equal(plano.saida.length, 0);
  assert.equal(plano.entrada.length, 1);
  assert.equal(plano.entrada[0].controle, '1010');
  assert.equal(plano.entrada[0].quantidadeAjuste, 29);
});

test('gera ajuste de entrada para produto e lote adicionados fora da foto', () => {
  const plano = planejarAjustesEstoque({
    empresa: 1,
    rodadaAtual: 1,
    itens: [{
      chave: '30|1|LOTE-NOVO',
      codProd: 30,
      descrProd: 'Produto novo',
      codVol: 'UN',
      codLocal: 1,
      controle: 'LOTE-NOVO',
      dtFabricacao: '2026-08-05',
      dtVal: '2028-08-05',
      estoqueSistema: 0,
      adicionadoManualmente: true,
      contagens: { 1: 12 }
    }]
  });

  assert.equal(plano.entrada.length, 1);
  assert.equal(plano.saida.length, 0);
  assert.equal(plano.entrada[0].quantidadeAjuste, 12);
  assert.equal(plano.entrada[0].adicionadoManualmente, true);
  assert.equal(plano.entrada[0].controle, 'LOTE-NOVO');
  assert.equal(plano.entrada[0].dtFabricacao, '2026-08-05');
  assert.equal(plano.entrada[0].dtValidade, '2028-08-05');
});

test('preenche datas tecnicas somente quando o lote sera zerado', () => {
  const plano = planejarAjustesEstoque({
    empresa: 1,
    rodadaAtual: 1,
    itens: [{
      chave: '5070|1|049515',
      codProd: 5070,
      descrProd: 'Produto zerado sem datas',
      codVol: 'UN',
      codLocal: 1,
      controle: '049515',
      estoqueSistema: 10,
      contagens: { 1: 0 }
    }]
  });

  assert.equal(plano.saida[0].contagem, 0);
  assert.equal(plano.saida[0].dtFabricacao, DATA_FABRICACAO_TECNICA);
  assert.equal(plano.saida[0].dtValidade, DATA_VALIDADE_TECNICA);
  assert.equal(plano.saida[0].datasTecnicasAjuste, true);

  const payload = montarPayloadNotaAjuste({
    sessao: { empresa: 1 },
    itens: plano.saida,
    template: {
      CODPARC: 649,
      CODTIPOPER: 157,
      CODTIPVENDA: 53,
      TIPMOV: 'V'
    },
    custos: new Map([[5070, 1]]),
    dataNegociacao: '06/08/2026',
    observacao: 'Zerar lote sem datas'
  });
  assert.equal(payload.nota.itens.item[0].CONTROLE.$, '049515');
});

test('completa somente a data ausente de lote zerado sem inverter o periodo', () => {
  const somenteValidade = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '1|1|L1', codProd: 1, codLocal: 1, controle: 'L1',
      dtVal: '2027-05-10', estoqueSistema: 5, contagens: { 1: 0 }
    }]
  }).saida[0];
  const somenteFabricacao = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '2|1|L2', codProd: 2, codLocal: 1, controle: 'L2',
      dtFabricacao: '2026-05-10', estoqueSistema: 5, contagens: { 1: 0 }
    }]
  }).saida[0];

  assert.equal(somenteValidade.dtFabricacao, '2027-05-10');
  assert.equal(somenteValidade.dtValidade, '2027-05-10');
  assert.equal(somenteFabricacao.dtFabricacao, '2026-05-10');
  assert.equal(somenteFabricacao.dtValidade, '2026-05-10');
});

test('nao inventa datas para lote que continuara com saldo', () => {
  const parcial = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '3|1|L3', codProd: 3, codLocal: 1, controle: 'L3',
      estoqueSistema: 5, contagens: { 1: 2 }
    }]
  }).saida[0];

  assert.equal(parcial.dtFabricacao, '');
  assert.equal(parcial.dtValidade, '');
  assert.equal(parcial.datasTecnicasAjuste, false);
});

test('recalcula a baixa pelo saldo atual em vez da foto congelada', () => {
  const planoFoto = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '5040|1010101|1010',
      codProd: 5040,
      codLocal: 1010101,
      codVol: 'UN',
      controle: '1010',
      estoqueSistema: 50,
      contagens: { 1: 0 }
    }]
  });
  const planoAtual = reconciliarAjustesComEstoqueAtual(planoFoto.itens, [{
    codProd: 5040,
    codLocal: 1010101,
    controle: '1010',
    estoqueAtual: 12,
    reservadoAtual: 2
  }]);

  assert.equal(planoAtual.saida.length, 1);
  assert.equal(planoAtual.saida[0].estoqueFoto, 50);
  assert.equal(planoAtual.saida[0].estoqueAtualAplicacao, 12);
  assert.equal(planoAtual.saida[0].reservadoAtualAplicacao, 2);
  assert.equal(planoAtual.saida[0].quantidadeAjuste, 12);
  assert.equal(planoAtual.saida[0].dtFabricacao, DATA_FABRICACAO_TECNICA);
  assert.equal(planoAtual.saida[0].dtValidade, DATA_VALIDADE_TECNICA);
});

test('nao gera nota quando o saldo atual ja corresponde a contagem', () => {
  const planoFoto = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '5040|1010101|1010',
      codProd: 5040,
      codLocal: 1010101,
      controle: '1010',
      estoqueSistema: 50,
      contagens: { 1: 0 }
    }]
  });
  const planoAtual = reconciliarAjustesComEstoqueAtual(planoFoto.itens, [{
    codProd: 5040,
    codLocal: 1010101,
    controle: '1010',
    estoqueAtual: 0
  }]);

  assert.equal(planoAtual.itens.length, 0);
  assert.equal(planoAtual.entrada.length, 0);
  assert.equal(planoAtual.saida.length, 0);
});

test('inverte o tipo de ajuste quando o saldo atual cruzou a contagem', () => {
  const planoFoto = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '10|1|L1', codProd: 10, codLocal: 1, codVol: 'UN', controle: 'L1',
      dtFabricacao: '2026-01-01', dtVal: '2028-01-01',
      estoqueSistema: 20, contagens: { 1: 10 }
    }]
  });
  const planoAtual = reconciliarAjustesComEstoqueAtual(planoFoto.itens, [{
    codProd: 10, codLocal: 1, controle: 'L1', estoqueAtual: 7
  }]);

  assert.equal(planoAtual.saida.length, 0);
  assert.equal(planoAtual.entrada.length, 1);
  assert.equal(planoAtual.entrada[0].quantidadeAjuste, 3);
});

test('bloqueia baixa que deixaria saldo menor que pedidos comprometidos', () => {
  const planoFoto = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '5040|1010101|SEM_CONTROLE',
      codProd: 5040,
      codLocal: 1010101,
      codVol: 'UN',
      controle: '',
      estoqueSistema: 1,
      contagens: { 1: 0 }
    }]
  });
  const planoAtual = reconciliarAjustesComEstoqueAtual(planoFoto.itens, [{
    codProd: 5040,
    codLocal: 1010101,
    controle: '',
    estoqueAtual: 1,
    comprometidoAtual: 1,
    pedidosComprometidos: [{ nunota: 3855780, numeroNota: 91735, quantidade: 1 }]
  }]);

  const bloqueios = localizarBloqueiosEstoqueComprometido(planoAtual);
  assert.equal(bloqueios.length, 1);
  assert.equal(bloqueios[0].codProd, 5040);
  assert.equal(bloqueios[0].pedidosComprometidos[0].numeroNota, 91735);
});

test('permite baixa que preserva a quantidade comprometida', () => {
  const planoFoto = planejarAjustesEstoque({
    rodadaAtual: 1,
    itens: [{
      chave: '10|1|SEM_CONTROLE', codProd: 10, codLocal: 1, codVol: 'UN',
      estoqueSistema: 10, contagens: { 1: 3 }
    }]
  });
  const planoAtual = reconciliarAjustesComEstoqueAtual(planoFoto.itens, [{
    codProd: 10, codLocal: 1, controle: '', estoqueAtual: 10, comprometidoAtual: 3
  }]);

  assert.equal(localizarBloqueiosEstoqueComprometido(planoAtual).length, 0);
  assert.equal(planoAtual.saida[0].quantidadeAjuste, 7);
});

test('mantem todos os itens do mesmo tipo em uma unica nota', () => {
  const lotes = agruparItensEmNotaUnica(Array.from({ length: 48 }, (_, indice) => indice));
  assert.deepEqual(lotes.map((lote) => lote.length), [48]);
  assert.deepEqual(agruparItensEmNotaUnica([]), []);
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

test('bloqueia nota com lote sem fabricacao ou validade', () => {
  assert.throws(() => montarPayloadNotaAjuste({
    sessao,
    itens: [{ ...planejarAjustesEstoque(sessao).entrada[0], dtValidade: '' }],
    template: {
      CODPARC: 649,
      CODTIPOPER: 156,
      CODTIPVENDA: 53,
      TIPMOV: 'E'
    },
    custos: new Map([[10, 2.5]]),
    dataNegociacao: '04/08/2026',
    observacao: 'Contagem sem validade'
  }), /informe fabricacao e validade/);
});
