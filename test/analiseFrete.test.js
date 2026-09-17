const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularFormulaFrete } = require('../api/formulaFrete');
const { filtrosAnalise, sqlPedidos, sqlSimulacoes, sqlFretesReais, simularTabelas, compararFrete, carregarAnaliseFrete } = require('../api/analiseFrete');

const formula = `IF((VLRNOTA*PERCENTUAL/100)>(PESO/1000*VALOR),
  IF((VLRNOTA*PERCENTUAL/100)>VLRMIN,(VLRNOTA*PERCENTUAL/100),VLRMIN),
  IF((PESO/1000*VALOR)>VLRMIN,(PESO/1000*VALOR),VLRMIN))
  +(VLRNOTA*1/100)+(IF((PESO/100)>TRUNC(PESO/100,0),TRUNC(PESO/100,0)+1,TRUNC(PESO/100,0))*2.05)`;
const rota = { NUNOTA: 10, NUCFR: 5, DESCRCALCFRET: 'CARVALIMA', REGIAO: 'R6', CODEVENTO: 2,
  FORMULA: formula, VALOR: 807.53, PERCENTUAL: 2, VLRMIN: 60.57, PESO: 10, VLRNOTA: 400 };

test('calcula fórmula cadastrada com mínimo, percentual e pedágio por fração', () => {
  assert.equal(simularTabelas([rota])[0].valor, 66.62);
  assert.equal(simularTabelas([{ ...rota, PESO: 1000 }])[0].valor, 832.03);
  assert.equal(simularTabelas([{ ...rota, PESO: 100, VLRNOTA: 10000 }])[0].valor, 302.05);
});

test('não executa código e não substitui fórmulas desconhecidas por estimativas', () => {
  for (const texto of ['process.exit()', '1;2', 'UNSUPPORTED(1)', '1/0', 'PESO+NAOEXISTE']) {
    assert.throws(() => calcularFormulaFrete(texto, { PESO: 10 }));
  }
  assert.equal(simularTabelas([{ ...rota, FORMULA: 'EVENTO(1)' }])[0].valor, null);
  assert.equal(simularTabelas([rota, rota])[0].valor, null);
});

test('mantém tabelas alternativas separadas e soma eventos de cada tabela', () => {
  const resultado = simularTabelas([rota, { ...rota, CODEVENTO: 3, FORMULA: '10' }, { ...rota, NUCFR: 6, FORMULA: '40' }]);
  assert.equal(resultado[0].valor, 76.62);
  assert.equal(resultado[1].valor, 40);
});

test('rejeita filtros e identificadores inválidos antes do SQL', () => {
  assert.throws(() => filtrosAnalise({ dataInicial: '2026-02-30', dataFinal: '2026-03-01' }));
  assert.throws(() => filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-02', transportadora: '1 OR 1=1' }));
  assert.throws(() => filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-02', cteEmitido: 'emitido' }));
  assert.throws(() => sqlSimulacoes(['1 OR 1=1']));
  assert.throws(() => sqlFretesReais([NaN]));
});

test('restringe sugestão pela transportadora, região da tabela e cidades da rota', () => {
  const sql = sqlSimulacoes([10]);
  assert.match(sql, /P.CODPARC=CAB.CODPARCTRANSP/);
  assert.match(sql, /F.NUCFR=R.NUCFR AND F.CODREG=R.CODREGDEST/);
  assert.match(sql, /CAB.PESOBRUTO PESO/);
  assert.match(sqlFretesReais([10]), /STATUS_IMPORTACAO/);
  assert.doesNotMatch(sqlFretesReais([10]), /CASE WHEN R\.STATUS_IMPORTACAO=2/);
  assert.match(sqlPedidos(filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' })), /PAR.CODPARC, PAR.NOMEPARC CLIENTE/);
  assert.match(sqlPedidos(filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' })), /NVL\(EMP.NOMEFANTASIA,EMP.RAZAOSOCIAL\) NOMEEMP/);
  assert.match(sqlPedidos(filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' })), /CAB.CODTIPOPER IN \(35,10\)/);
  assert.match(sqlPedidos(filtrosAnalise({ dataInicial: '2026-01-01', dataFinal: '2026-01-31', cteEmitido: 'com', statusCte: 'importado' })), /CASE WHEN IX.STATUS=2/);
});

test('deduplica CT-e, calcula diferença real menos sugerido e não confunde ausência com zero', () => {
  const cte = { CHAVEACESSO: 'chave', FRETE_REAL: 70, COMPARTILHADO: 0 };
  const resultado = compararFrete({}, [cte, cte], [{ valor: 66.62 }]);
  assert.equal(resultado.real, 70);
  assert.equal(resultado.simulacoes[0].diferenca, 3.38);
  assert.equal(compararFrete({}, [], [{ valor: 66.62 }]).simulacoes[0].diferenca, null);
  assert.equal(compararFrete({}, [{ ...cte, FRETE_REAL: null }], [{ valor: 10 }]).real, null);
  assert.equal(compararFrete({}, [{ ...cte, FRETE_REAL: 0 }], [{ valor: 10 }]).simulacoes[0].diferenca, -10);
});

test('usa somente a parcela por peso do CT-e compartilhado em cada pedido', () => {
  const resultado = compararFrete({}, [{ CHAVEACESSO: 'x', FRETE_CTE_TOTAL: 200, FRETE_REAL: 80, COMPARTILHADO: 1 }], [{ valor: 50 }]);
  assert.equal(resultado.real, 80);
  assert.equal(resultado.simulacoes[0].diferenca, 30);
  assert.equal(resultado.ctes[0].FRETE_CTE_TOTAL, 200);
});

test('carrega página com consultas em lote e sem acessar estimativa histórica', async () => {
  const respostas = [[{ NUNOTA: 10, CODPARCTRANSP: 644, TRANSPORTADORA: 'CARVALIMA' }], [rota]];
  let chamadas = 0;
  const resultado = await carregarAnaliseFrete({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' }, async (sql) => {
    assert.match(sql, /^SELECT|^WITH/);
    return respostas[chamadas++];
  });
  assert.equal(chamadas, 2);
  assert.equal(resultado.linhas[0].simulacoes[0].valor, 66.62);
  assert.equal(resultado.transportadoras.length, 1);
});

test('agrupa antes de paginar, pesquisa todo o conjunto e reutiliza páginas', async () => {
  const q = { dataInicial: '2026-01-01', dataFinal: '2026-01-31' };
  const notas = Array.from({ length: 25 }, (_, i) => ({ NUNOTA: i + 1, NUMNOTA: i + 100,
    CODPARC: 654, CLIENTE: 'João', CIDADE: 'Cuiabá', VLRNOTA: 10, PESO: .123,
    ...(i === 0 || i === 24 ? { CHAVEACESSO: 'cte', NUM_CTE: 999, STATUS_IMPORTACAO: 0,
      REFERENCIAS_TOTAL: 2, CHAVENFE: String(i), FRETE_CTE_TOTAL: 50 } : {}) }));
  let bases = 0;
  let consultas = 0;
  const executar = async (sql) => {
    consultas++;
    if (sql.startsWith('WITH NOTAS')) { bases++; return notas; }
    return [];
  };
  const primeira = await carregarAnaliseFrete(q, executar);
  assert.equal(primeira.total, 24);
  assert.equal(primeira.linhas[0].NUNOTA, '1 · 25');
  assert.equal(primeira.linhas[0].VLRNOTA, 20);
  assert.equal(primeira.linhas[0].PESO, .246);
  assert.deepEqual(primeira.linhas[0].notasDetalhes.map((n) => n.NUNOTA), [25, 1]);
  const segunda = await carregarAnaliseFrete({ ...q, pagina: 2, consultaId: primeira.consultaId }, executar);
  assert.equal(segunda.linhas.length, 10);
  const antes = consultas;
  await carregarAnaliseFrete({ ...q, consultaId: primeira.consultaId }, executar);
  assert.equal(consultas, antes);
  for (const busca of ['999', '124', 'joao', 'cuiaba', '654']) {
    const r = await carregarAnaliseFrete({ ...q, busca, consultaId: primeira.consultaId }, executar);
    assert.ok(r.total > 0);
    if (busca === '124') assert.equal(r.linhas[0].NUNOTA, '1 · 25');
  }
  assert.equal(bases, 1);
  await assert.rejects(carregarAnaliseFrete({ ...q, consultaId: 'expirada' }, executar), /expirada/);
});

test('simula uma única carga com os dados somados das notas e não soma sugestões individuais', () => {
  const { consolidar } = require('../api/analiseFreteConsulta');
  const g = { cte: { FRETE_CTE_TOTAL: 100, REFERENCIAS_TOTAL: 3 },
    notas: [{ NUNOTA: 1, CHAVENFE: 'a', VLRNOTA: 400, PESO: 10 },
      { NUNOTA: 2, CHAVENFE: 'b', VLRNOTA: 400, PESO: 10 }] };
  const dados = new Map([[1, [rota, { ...rota, NUCFR: 6 }]], [2, [rota, { ...rota, NUCFR: 6 }]]]);
  const r = consolidar(g, dados, simularTabelas);
  assert.equal(r.simulacoes.length, 2);
  assert.equal(r.simulacoes[0].valor, 70.62);
  assert.equal(r.simulacoes[0].diferenca, null);
});
