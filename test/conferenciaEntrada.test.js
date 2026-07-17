const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consolidarLeiturasEntrada,
  planejarSincronizacaoDetalhesEntrada,
  validarDetalhesConferenciaEntrada,
  deveAplicarDivergenciaEntrada,
  documentosAuxiliaresConferencia,
  retornoPossuiDocumentosAuxiliares
} = require('../api/conferenciaEntrada');

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
    CODBARRA: '7667',
    CODPROD: 7667,
    CODVOL: 'DP',
    CONTROLE: '00162500800',
    QTDCONF: 18,
    QTDCONFVOLPAD: 18
  }]);
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
