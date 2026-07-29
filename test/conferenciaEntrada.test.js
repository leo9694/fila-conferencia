const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidarLeiturasEntrada,
  distribuirQuantidadeProporcional,
  distribuirValorProporcional,
  planejarControlesItensEntrada,
  planejarDesmembramentoLotesEntrada,
  planejarSincronizacaoDetalhesEntrada,
  validarDetalhesConferenciaEntrada,
  deveAplicarDivergenciaEntrada,
  conferenciaEntradaPodeSerReaberta,
  analisarRecontagemEntrada,
  statusVisualConferencia,
  documentosAuxiliaresConferencia,
  retornoPossuiDocumentosAuxiliares
} = require('../api/conferenciaEntrada');

test('permite reabrir conferencia de entrada finalizada divergente', () => {
  assert.equal(conferenciaEntradaPodeSerReaberta('D'), true);
  assert.equal(conferenciaEntradaPodeSerReaberta('A'), true);
  assert.equal(conferenciaEntradaPodeSerReaberta('F'), false);
});

test('identifica recontagens pendentes antes do corte nativo da entrada', () => {
  assert.deepEqual(analisarRecontagemEntrada({
    status: 'D',
    existeConferenciaHaMenor: true,
    podeCortar: false,
    recontagensRealizadas: 0,
    recontagensMinimas: 2
  }), {
    necessaria: true,
    realizadas: 0,
    minimas: 2,
    restantes: 2
  });

  assert.equal(analisarRecontagemEntrada({
    status: 'D',
    existeConferenciaHaMenor: true,
    podeCortar: true,
    recontagensRealizadas: 2,
    recontagensMinimas: 2
  }).necessaria, false);
});

test('identifica o status visual finalizado divergente sem tratar como novo', () => {
  assert.equal(statusVisualConferencia('D'), 'FINALIZADO DIVERGENTE');
  assert.equal(statusVisualConferencia('A'), 'EM ANDAMENTO');
  assert.equal(statusVisualConferencia('F'), 'CONFERIDO');
  assert.equal(statusVisualConferencia(null, false), 'AGUARDANDO CONFERENCIA');
});

test('reserva correspondencias naturais antes de reaproveitar sequencias', () => {
  const existentes = [
    { SEQCONF: 1, CODPROD: 1008, CONTROLE: 'B', CODVOL: 'UN', CODBARRA: '1008' }
  ];
  const desejados = [
    { CODPROD: 1007, CONTROLE: 'A', CODVOL: 'UN', CODBARRA: '1007' },
    { CODPROD: 1008, CONTROLE: 'B', CODVOL: 'UN', CODBARRA: '1008' }
  ];

  const plano = planejarSincronizacaoDetalhesEntrada(existentes, desejados);

  assert.equal(plano.atribuicoes[1].seqConf, 1);
  assert.equal(plano.atribuicoes[0].seqConf, 2);
  assert.equal(new Set(plano.atribuicoes.map((item) => item.seqConf)).size, 2);
});

test('atribui sequencias exclusivas em conferencia maior que os detalhes existentes', () => {
  const existentes = Array.from({ length: 105 }, (_, indice) => ({
    SEQCONF: indice + 1,
    CODPROD: indice + 1,
    CONTROLE: ' ',
    CODVOL: 'UN',
    CODBARRA: String(indice + 1)
  }));
  const desejados = Array.from({ length: 137 }, (_, indice) => ({
    CODPROD: indice + 1000,
    CONTROLE: ' ',
    CODVOL: 'UN',
    CODBARRA: String(indice + 1000)
  }));

  const plano = planejarSincronizacaoDetalhesEntrada(existentes, desejados);

  assert.equal(plano.atribuicoes.length, 137);
  assert.equal(new Set(plano.atribuicoes.map((item) => item.seqConf)).size, 137);
  assert.deepEqual(plano.sequenciasObsoletas, []);
});

test('valida quantidades e linhas gravadas antes da finalizacao', () => {
  const desejados = [{
    CODPROD: 1010,
    CONTROLE: 'L1',
    CODVOL: 'UN',
    CODBARRA: '1010',
    QTDCONF: 50,
    QTDCONFVOLPAD: 50
  }];

  assert.equal(validarDetalhesConferenciaEntrada(desejados, [{
    ...desejados[0],
    SEQCONF: 1
  }]).valido, true);
  assert.equal(validarDetalhesConferenciaEntrada(desejados, [{
    ...desejados[0],
    SEQCONF: 1,
    QTDCONFVOLPAD: 0
  }]).valido, false);
});

test('ignora detalhe obsoleto zerado ao validar a conferencia de entrada', () => {
  const desejados = [{
    CODPROD: 1066,
    CONTROLE: '0017702530017070',
    CODVOL: 'UN',
    CODBARRA: '7896061734786',
    QTDCONF: 550,
    QTDCONFVOLPAD: 550
  }];
  const gravados = [{
    ...desejados[0],
    SEQCONF: 16
  }, {
    SEQCONF: 37,
    CODPROD: 1066,
    CONTROLE: '0017702530017070',
    CODVOL: 'PT',
    CODBARRA: '17896061734783',
    QTDCONF: 0,
    QTDCONFVOLPAD: 0
  }];

  const validacao = validarDetalhesConferenciaEntrada(desejados, gravados);

  assert.equal(validacao.valido, true);
  assert.deepEqual(validacao.erros, []);
});

const itemNota = {
  SEQUENCIA: 1,
  CODPROD: 2442,
  CODVOL: 'UN',
  CONTROLE: ' ',
  QTDNEG: 20,
  CODBARRA: '7899760502328'
};

test('reproduz o detalhe consolidado da conferencia nativa 67203', () => {
  const detalhes = consolidarLeiturasEntrada([itemNota], [{
    sequencia: 1,
    qtdConferida: 20,
    leituras: [{
      codigo: '2442',
      codVol: 'UN',
      quantidade: 20,
      quantidadeConvertida: 20
    }]
  }]);

  assert.deepEqual(detalhes, [{
    CODBARRA: '2442',
    CODPROD: 2442,
    CODVOL: 'UN',
    CONTROLE: ' ',
    QTDCONF: 20,
    QTDCONFVOLPAD: 20
  }]);
});

test('preserva embalagem e quantidade padrao na unidade alternativa', () => {
  const detalhes = consolidarLeiturasEntrada([{ ...itemNota, QTDNEG: 40, CODVOLPADRAO: 'UN' }], [{
    sequencia: 1,
    qtdConferida: 40,
    leituras: [{
      codigo: '17896061733755',
      tipo: 'UNIDADE_ALTERNATIVA',
      codVol: 'CX',
      quantidade: 4,
      quantidadeConvertida: 40
    }]
  }]);

  assert.equal(detalhes[0].CODVOL, 'CX');
  assert.equal(detalhes[0].QTDCONF, 4);
  assert.equal(detalhes[0].QTDCONFVOLPAD, 40);
});

test('normaliza leitura comum para a unidade padrao do produto', () => {
  const detalhes = consolidarLeiturasEntrada([{
    SEQUENCIA: 1,
    CODPROD: 7667,
    CODVOL: 'KG',
    CODVOLPADRAO: 'DP',
    CONTROLE: '00162500800',
    QTDNEG: 18,
    CODBARRA: '7896500410462'
  }], [{
    sequencia: 1,
    qtdConferida: 18,
    leituras: [{
      codigo: '7667',
      tipo: 'CODIGO_PRODUTO',
      codVol: 'KG',
      controle: '00162500800',
      quantidade: 18,
      quantidadeConvertida: 18
    }]
  }]);

  assert.deepEqual(detalhes, [{
    CODBARRA: '7896500410462',
    CODPROD: 7667,
    CODVOL: 'DP',
    CONTROLE: '00162500800',
    QTDCONF: 18,
    QTDCONFVOLPAD: 18
  }]);
});

test('normaliza referencia para o identificador nativo do item da NFe', () => {
  const detalhes = consolidarLeiturasEntrada([{
    SEQUENCIA: 6,
    CODPROD: 7789,
    CODVOL: 'CX',
    CODVOLPADRAO: 'UN',
    CONTROLE: ' ',
    QTDNEG: 10,
    CODBARRA: '37898026081134'
  }], [{
    sequencia: 6,
    qtdConferida: 10,
    leituras: [{
      codigo: '7898026081133',
      tipo: 'REFERENCIA',
      codVol: 'UN',
      controle: '003.26',
      quantidade: 10,
      quantidadeConvertida: 10
    }]
  }]);

  assert.equal(detalhes[0].CODBARRA, '37898026081134');
  assert.equal(detalhes[0].CODVOL, 'UN');
  assert.equal(detalhes[0].QTDCONF, 10);
  assert.equal(detalhes[0].QTDCONFVOLPAD, 10);
});

test('planeja a aplicacao do lote recebido no item da nota', () => {
  const alteracoes = planejarControlesItensEntrada([{
    SEQUENCIA: 1,
    CODPROD: 7452,
    CONTROLE: ' '
  }], [{
    sequencia: 1,
    leituras: [{ controle: '004.26' }]
  }]);

  assert.deepEqual(alteracoes, [{
    sequencia: 1,
    codProd: 7452,
    controleAnterior: '',
    controle: '004.26'
  }]);
});

test('impede finalizar um item com mais de um lote sem separar a nota', () => {
  assert.throws(() => planejarControlesItensEntrada([{
    SEQUENCIA: 1,
    CODPROD: 7452,
    CONTROLE: ' '
  }], [{
    sequencia: 1,
    leituras: [{ controle: '004.26' }, { controle: '005.26' }]
  }]), /mais de um lote/);
});

test('planeja uma linha da nota para cada lote conferido', () => {
  const planos = planejarDesmembramentoLotesEntrada([{
    SEQUENCIA: 62,
    CODPROD: 1087,
    CONTROLE: '0084802515000171',
    QTDNEG: 1180
  }], [{
    sequencia: 62,
    qtdConferida: 1180,
    leituras: [{
      controle: '0084802515000053',
      quantidade: 34,
      quantidadeConvertida: 340
    }, {
      controle: '0084802515000171',
      quantidade: 840,
      quantidadeConvertida: 840
    }]
  }]);

  assert.equal(planos.length, 1);
  assert.equal(planos[0].sequencia, 62);
  assert.equal(planos[0].grupos.length, 2);
  assert.equal(planos[0].grupos[0].controle, '0084802515000171');
  assert.equal(planos[0].grupos[0].quantidade, 840);
  assert.equal(planos[0].grupos[1].controle, '0084802515000053');
  assert.equal(planos[0].grupos[1].quantidade, 340);
});

test('nao desmembra lote quando a quantidade por controle diverge da nota', () => {
  assert.throws(() => planejarDesmembramentoLotesEntrada([{
    SEQUENCIA: 1,
    CODPROD: 1087,
    CONTROLE: 'A',
    QTDNEG: 100
  }], [{
    sequencia: 1,
    qtdConferida: 110,
    leituras: [
      { controle: 'A', quantidadeConvertida: 60 },
      { controle: 'B', quantidadeConvertida: 50 }
    ]
  }]), /quantidade divergente/);
});

test('distribui valores e preserva exatamente o total na ultima linha', () => {
  assert.deepEqual(distribuirValorProporcional(4425, [840, 340]), [3150, 1275]);
  assert.deepEqual(distribuirValorProporcional(1039.87, [840, 340]), [740.25, 299.62]);
});

test('distribui quantidade atendida sem perder residuos de conversao', () => {
  const partes = distribuirQuantidadeProporcional(18.0000036, [12, 6.0000036]);
  assert.equal(partes.reduce((total, parte) => total + parte, 0), 18.0000036);
});

test('elimina residuo tecnico da conversao para nao finalizar a menor', () => {
  const detalhes = consolidarLeiturasEntrada([{
    SEQUENCIA: 1,
    CODPROD: 7667,
    CODVOL: 'KG',
    CODVOLPADRAO: 'DP',
    CONTROLE: '0016-25-00800',
    QTDNEG: 18.0000036,
    CODBARRA: '7896500410462'
  }], [{
    sequencia: 1,
    qtdConferida: 18,
    leituras: [{
      codigo: '7667',
      tipo: 'CODIGO_PRODUTO',
      codVol: 'DP',
      controle: '0016-25-00800',
      quantidade: 18,
      quantidadeConvertida: 18
    }]
  }]);

  assert.equal(detalhes[0].CODBARRA, '7896500410462');
  assert.equal(detalhes[0].QTDCONF, 18.0000036);
  assert.equal(detalhes[0].QTDCONFVOLPAD, 18.0000036);
});

test('nao corrige uma divergencia real de quantidade', () => {
  const detalhes = consolidarLeiturasEntrada([{ ...itemNota, QTDNEG: 20 }], [{
    sequencia: 1,
    qtdConferida: 19,
    leituras: [{ codigo: '2442', codVol: 'UN', quantidade: 19, quantidadeConvertida: 19 }]
  }]);

  assert.equal(detalhes[0].QTDCONF, 19);
  assert.equal(detalhes[0].QTDCONFVOLPAD, 19);
});

test('preserva o controle informado na leitura da entrada', () => {
  const detalhes = consolidarLeiturasEntrada([{ ...itemNota, QTDNEG: 50, CONTROLE: ' ' }], [{
    sequencia: 1,
    qtdConferida: 10,
    leituras: [{
      codigo: '1010',
      codVol: 'UN',
      controle: '36871',
      quantidade: 10,
      quantidadeConvertida: 10
    }]
  }]);

  assert.equal(detalhes[0].CONTROLE, '36871');
  assert.equal(detalhes[0].QTDCONF, 10);
});

test('reproduz os detalhes da conferencia nativa 67214 com troca de controle', () => {
  const detalhes = consolidarLeiturasEntrada([
    { ...itemNota, SEQUENCIA: 1, CODPROD: 2442, QTDNEG: 20, CONTROLE: ' ' },
    { ...itemNota, SEQUENCIA: 2, CODPROD: 1010, QTDNEG: 50, CONTROLE: ' ' }
  ], [
    {
      sequencia: 1,
      qtdConferida: 18,
      leituras: [{ codigo: '2442', codVol: 'UN', quantidade: 18, quantidadeConvertida: 18 }]
    },
    {
      sequencia: 2,
      qtdConferida: 10,
      leituras: [{ codigo: '1010', codVol: 'UN', controle: '36871', quantidade: 10, quantidadeConvertida: 10 }]
    }
  ]);

  assert.deepEqual(detalhes, [
    { CODBARRA: '2442', CODPROD: 2442, CODVOL: 'UN', CONTROLE: ' ', QTDCONF: 18, QTDCONFVOLPAD: 18 },
    { CODBARRA: '1010', CODPROD: 1010, CODVOL: 'UN', CONTROLE: '36871', QTDCONF: 10, QTDCONFVOLPAD: 10 }
  ]);
});

test('permite quantidade maior para o Sankhya gerar pedido complementar', () => {
  const detalhes = consolidarLeiturasEntrada([{ ...itemNota, QTDNEG: 20 }], [{
    sequencia: 1,
    qtdConferida: 22,
    leituras: [{ codigo: '2442', codVol: 'UN', quantidade: 22, quantidadeConvertida: 22 }]
  }]);

  assert.equal(detalhes[0].QTDCONF, 22);
  assert.equal(detalhes[0].QTDCONFVOLPAD, 22);
});

test('rejeita leitura cuja conversao nao corresponde ao total conferido', () => {
  assert.throws(() => consolidarLeiturasEntrada([itemNota], [{
    sequencia: 1,
    qtdConferida: 20,
    leituras: [{ codigo: '2442', codVol: 'UN', quantidade: 10, quantidadeConvertida: 10 }]
  }]), /nao correspondem/);
});

test('identifica retorno nativo que permite aplicar divergencia de entrada', () => {
  assert.equal(deveAplicarDivergenciaEntrada({
    responseBody: { status: 'D', podeCortar: true }
  }), true);
  assert.equal(deveAplicarDivergenciaEntrada({
    responseBody: { status: 'D', podeCortar: false }
  }), false);
  assert.equal(deveAplicarDivergenciaEntrada({
    responseBody: { status: 'D', podeCortar: false }
  }, {
    possuiQuantidadeMaior: true,
    gerarPedidoComplementar: true
  }), true);
  assert.equal(deveAplicarDivergenciaEntrada({
    responseBody: { status: 'D', podeCortar: false }
  }, {
    possuiQuantidadeMaior: true,
    gerarPedidoComplementar: false
  }), false);
  assert.equal(deveAplicarDivergenciaEntrada({
    responseBody: { status: 'F', podeCortar: false }
  }, {
    possuiQuantidadeMaior: true,
    gerarPedidoComplementar: true
  }), false);
});

test('normaliza documentos auxiliares vinculados a conferencia', () => {
  assert.deepEqual(documentosAuxiliaresConferencia({
    NUPEDCOMP: 3874271,
    NUNOTADEV: 3874270
  }), {
    pedidoComplementar: 3874271,
    notaDevolucao: 3874270
  });
});

test('identifica documentos retornados pelo servico nativo de corte', () => {
  assert.equal(retornoPossuiDocumentosAuxiliares({
    responseBody: { notas: { nota: { nuNota: '3874272' } } }
  }), true);
  assert.equal(retornoPossuiDocumentosAuxiliares({ responseBody: {} }), false);
});
