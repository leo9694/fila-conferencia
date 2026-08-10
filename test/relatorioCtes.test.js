const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CABECALHOS,
  consolidarLinhasCtes,
  dividirPeriodoMensal,
  gerarPlanilhaCtes,
  montarSqlRelatorioCtes,
  nomeArquivoRelatorio,
  validarPeriodo
} = require('../api/relatorioCtes');

test('consulta respeita os filtros obrigatorios e a data final inclusiva', () => {
  const sql = montarSqlRelatorioCtes('2026-01-01', '2026-06-30');
  assert.match(sql, /IX\.STATUS = 2/);
  assert.match(sql, /IX\.TIPO = 'C'/);
  assert.match(sql, /DHEMISS >= TRUNC\(TO_DATE\('2026-01-01'/);
  assert.match(sql, /DHEMISS < TRUNC\(TO_DATE\('2026-06-30'[\s\S]*\) \+ 1/);
  assert.match(sql, /XMLTABLE/);
  assert.match(sql, /L\.CHAVE_CTE/);
  assert.match(sql, /EMP\.NOMEFANTASIA EMPRESA/);
  assert.match(sql, /OUTER APPLY/);
  assert.match(sql, /INDEX\(N IDX_TGFNFE_CHAVENFE\)/);
  assert.match(sql, /DENSE_RANK LAST ORDER BY IX\.NUARQUIVO/);
  assert.match(sql, /NVL\(NULLIF\(CAB\.PESOBRUTO, 0\), NVL\(NULLIF\(CAB\.PESO, 0\), NVL\(XMLNF\.PESO, 0\)\)\) PESO/);
  assert.match(sql, /CIDCAB\.CODCID = CAB\.CODCID/);
  assert.match(sql, /UFSCAB\.CODUF = CIDCAB\.UF/);
  assert.match(sql, /CIDCAB\.NOMECID\)\) IN \('<SEM DESCRIÇÃO>', '<SEM DESCRICAO>'\)/);
  assert.match(sql, /CID\.NOMECID\)\) IN \('<SEM DESCRIÇÃO>', '<SEM DESCRICAO>'\)/);
  assert.match(sql, /NULLIF\(TRIM\(UFSCAB\.UF\), '0'\)/);
  assert.match(sql, /NULLIF\(TRIM\(UFS\.UF\), '0'\)/);
  assert.match(sql, /XMLNF\.CIDADE/);
  assert.match(sql, /'\/nfeProc\/NFe\/infNFe\/transp\/vol'/);
  assert.match(sql, /PESO_TEXTO VARCHAR2\(50\) PATH 'pesoB'/);
  assert.match(sql, /NLS_NUMERIC_CHARACTERS=''\.,''/);
  assert.doesNotMatch(sql, /NF_POR_CHAVE|CHAVES_NFE/);
  assert.doesNotMatch(sql, /DTBAIXA|BOLETO|VENCIMENTO/);
});

test('aceita periodo longo e rejeita somente intervalo invertido', () => {
  assert.deepEqual(validarPeriodo('2026-01-01', '2026-06-30'), {
    dataInicial: '2026-01-01',
    dataFinal: '2026-06-30'
  });
  assert.deepEqual(validarPeriodo('2025-01-01', '2026-12-31'), {
    dataInicial: '2025-01-01',
    dataFinal: '2026-12-31'
  });
  assert.throws(() => validarPeriodo('2026-02-02', '2026-02-01'), /igual ou posterior/i);
});

test('divide periodo longo em blocos mensais inclusivos sem sobreposicao', () => {
  assert.deepEqual(dividirPeriodoMensal('2026-02-15', '2026-05-02'), [
    { dataInicial: '2026-02-15', dataFinal: '2026-02-28' },
    { dataInicial: '2026-03-01', dataFinal: '2026-03-31' },
    { dataInicial: '2026-04-01', dataFinal: '2026-04-30' },
    { dataInicial: '2026-05-01', dataFinal: '2026-05-02' }
  ]);
});

test('gera XLSX com cabecalho, filtros, congelamento e tipos numericos', () => {
  const arquivo = gerarPlanilhaCtes([{
    NUM_CTE: 123,
    DATA_EMISSAO: '31072026 10:00:00',
    TRANSPORTADORA: 'Transportadora Teste',
    EMPRESA: 'Norte Sul',
    PARCEIRO: '=formula nao permitida',
    CIDADE: 'Campo Grande',
    ESTADO: 'Mato Grosso do Sul',
    NUM_NOTA: '82169',
    VALOR_PEDIDO: 1234.56,
    PESO: 12.345,
    VOLUMES: 4,
    VALOR_FRETE: 98.76
  }]);
  const conteudo = arquivo.toString('utf8');

  assert.equal(arquivo.subarray(0, 4).toString('hex'), '504b0304');
  CABECALHOS.forEach((cabecalho) => assert.match(conteudo, new RegExp(cabecalho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.match(conteudo, /<autoFilter ref="A1:L2"\/>/);
  assert.match(conteudo, /state="frozen"/);
  assert.match(conteudo, /formatCode="dd\/mm\/yyyy"/);
  assert.match(conteudo, /R\$&quot; #,##0\.00/);
  assert.match(conteudo, /<v>1234\.56<\/v>/);
  assert.doesNotMatch(conteudo, /<f>/);
  assert.doesNotMatch(conteudo, /mergeCells/);
});

test('consolida NF-es por CT-e sem repetir o frete', () => {
  const [cte] = consolidarLinhasCtes([
    { CHAVE_CTE: 'cte-1', NUM_CTE: 19986, NUM_NOTA: '100', VALOR_PEDIDO: 10, PESO: 3.6, VOLUMES: 3, VALOR_FRETE: 2079, PARCEIRO: 'Parceiro', CIDADE: 'Dourados', ESTADO: 'MS' },
    { CHAVE_CTE: 'cte-1', NUM_CTE: 19986, NUM_NOTA: '101', VALOR_PEDIDO: 20, PESO: 2183.738, VOLUMES: 1039, VALOR_FRETE: 2079, PARCEIRO: 'Parceiro', CIDADE: 'Dourados', ESTADO: 'MS' },
    { CHAVE_CTE: 'cte-1', NUM_CTE: 19986, NUM_NOTA: '102', VALOR_PEDIDO: 30, PESO: 0, VOLUMES: 2, VALOR_FRETE: 2079, PARCEIRO: 'Parceiro', CIDADE: 'Dourados', ESTADO: 'MS' }
  ]);

  assert.equal(cte.NUM_CTE, 19986);
  assert.equal(cte.NUM_NOTA, '100, 101, 102');
  assert.equal(cte.VALOR_PEDIDO, 60);
  assert.equal(cte.PESO, 2187.338);
  assert.equal(cte.VOLUMES, 1044);
  assert.equal(cte.VALOR_FRETE, 2079);
});

test('nome do arquivo segue o formato solicitado', () => {
  assert.match(
    nomeArquivoRelatorio(new Date('2026-07-31T15:25:00.000Z')),
    /^CT-es Importados por Periodo_\d{2}-\d{2}-\d{4}_\d{2}-\d{2}\.xlsx$/
  );
});
