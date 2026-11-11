const test = require('node:test');
const assert = require('node:assert/strict');
const { filtrosDefinicaoFrete, consultarDefinicaoFrete } = require('../api/definicaoFrete');

const periodo = { dataInicial: '2026-11-04', dataFinal: '2026-11-05' };

test('valida empresa, parceiro e período em conjunto', () => {
  assert.throws(() => filtrosDefinicaoFrete({ cliente: '410' }), /data inicial/);
  assert.throws(() => filtrosDefinicaoFrete({ ...periodo, empresa: '1 OR 1=1' }), /empresa/);
  assert.throws(() => filtrosDefinicaoFrete({ ...periodo, cliente: '99999999999999999' }), /parceiro/);
  assert.equal(filtrosDefinicaoFrete({ ...periodo, cliente: ' 410 ' }).cliente, '410');
});

test('consulta tabelas de toda a seleção e calcula apenas as rotas aplicáveis às notas da página', async () => {
  const filtros = filtrosDefinicaoFrete({ ...periodo, empresa: '1', cliente: "D'Ávila_10%", pagina: '2' });
  const notas = Array.from({ length: 31 }, (_, i) => ({ NUNOTA: 100 + i, NUMNOTA: 10 + i }));
  notas[0].ORDEMCARGA = 5679;
  notas[1].ORDEMCARGA = null;
  const chamadas = [];
  const dados = await consultarDefinicaoFrete(filtros, async (sql) => {
    chamadas.push(sql);
    if (sql.startsWith('WITH NOTAS')) return notas;
    if (sql.startsWith('WITH DESTINOS')) return [
      { NUCFR: 3, DESCRCALCFRET: 'ALT MT 2026' },
      { NUCFR: 5, DESCRCALCFRET: 'Tabela aplicável em outra página' }
    ];
    return [{ NUNOTA: 100, NUCFR: 3, CODEVENTO: 1, FORMULA: 'VALOR', VALOR: 27.5, REGIAO: 'MT' }];
  });
  assert.match(chamadas[0], /CAB\.DTNEG >= TO_DATE\('2026-11-04'/);
  assert.match(chamadas[0], /CAB\.CODEMP=1/);
  assert.match(chamadas[0], /CAB\.ORDEMCARGA/);
  assert.match(chamadas[0], /N\.ORDEMCARGA/);
  assert.match(chamadas[0], /D''Ávila\\_10\\%/);
  assert.match(chamadas[0], /OFFSET 30 ROWS FETCH NEXT 31 ROWS ONLY/);
  assert.match(chamadas[1], /SELECT DISTINCT CAB\.CODEMP, CAB\.CODPARC/);
  assert.match(chamadas[2], /CAB\.NUNOTA IN \(100,.*129\)/);
  assert.ok(chamadas.every((sql) => !/TGFIXN|TGFCFP|CAB\.CODPARCTRANSP/.test(sql)));
  assert.deepEqual(dados.colunas.map((tabela) => tabela.codigo), [3, 5]);
  assert.equal(dados.linhas[0].ORDEMCARGA, 5679);
  assert.equal(dados.linhas[1].ORDEMCARGA, null);
  assert.deepEqual(dados.linhas[0].sugestoes, [{ codigo: 3, valor: 27.5, regiao: 'MT' }]);
  assert.deepEqual(dados.linhas[1].sugestoes, []);
  assert.equal(dados.linhas.length, 30);
  assert.equal(dados.temMais, true);
});
