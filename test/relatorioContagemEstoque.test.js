const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dadosRelatorio,
  gerarRelatorioContagemEstoque,
  nomeArquivoRelatorioContagem
} = require('../api/relatorioContagemEstoque');

function sessaoBase() {
  return {
    id: 'contagem-1',
    empresa: 1,
    nomeEmpresa: 'NORTE SUL SEMENTES',
    nomeLocal: 'DEPOSITO LOJA',
    criadoEm: '2026-08-05T12:00:00.000Z',
    finalizadoEm: '2026-08-05T13:00:00.000Z',
    ajuste: { notas: [{ nunota: 123 }, { nunota: 124 }] },
    itens: [{
      codProd: 5040,
      descrProd: 'FORTH COTE PLUS',
      descrGrupoProd: 'FERTILIZANTES',
      descrLocal: 'DEPOSITO LOJA',
      controleFoto: 'ANTIGO',
      controle: 'NOVO',
      dtFabricacaoFoto: null,
      dtFabricacao: '05/05/2026',
      dtValFoto: '31/07/2027',
      dtVal: '31/07/2027',
      estoqueFoto: 10,
      estoqueSistema: 10,
      contagens: { 1: 12, 2: 11 },
      codVol: 'UN',
      atualizadoPor: 72,
      atualizadoEm: '2026-08-05T12:30:00.000Z'
    }]
  };
}

test('cruza foto, contagens e resultado final', () => {
  const [linha] = dadosRelatorio(sessaoBase());
  assert.equal(linha[9], 'ANTIGO');
  assert.equal(linha[10], 'NOVO');
  assert.equal(linha[15], 10);
  assert.equal(linha[16], 12);
  assert.equal(linha[17], 11);
  assert.equal(linha[18], 11);
  assert.equal(linha[19], 1);
  assert.equal(linha[21], 'DIVERGENTE DA 1a CONTAGEM - SOBRA');
  assert.equal(linha[24], '123, 124');
});

test('gera arquivo xlsx e nome identificavel', () => {
  const arquivo = gerarRelatorioContagemEstoque(sessaoBase());
  assert.ok(Buffer.isBuffer(arquivo));
  assert.equal(arquivo.subarray(0, 2).toString(), 'PK');
  assert.match(arquivo.toString('utf8'), /Auditoria da Contagem/);
  assert.match(
    nomeArquivoRelatorioContagem(sessaoBase(), new Date('2026-08-05T15:30:00Z')),
    /Relatorio Contagem Estoque_1_/
  );
});
