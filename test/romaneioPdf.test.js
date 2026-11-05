const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { PDFDocument } = require('pdf-lib');
const { gerarRomaneioCargaPdf } = require('../api/romaneioPdf');

test('romaneio identifica no cabeçalho a transportadora da ordem e mantém o grupo da nota', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
  const inicio = fonte.indexOf("router.get('/fila-conferencia/romaneio/:ordemCarga/pdf'");
  const fim = fonte.indexOf('\nrouter.', inicio + 1);
  const nota = {
    NUNOTA: 100, NUMNOTA: 200, CODPARCTRANSP: 52, TRANSPORTADORA: 'Transportadora da nota',
    CODPARCTRANSP_CARGA: 78, TRANSPORTADORA_CARGA: 'Transportadora da carga', EMPRESA: 'Empresa',
    DATA_INICIO_CARGA: '05/11/2026'
  };
  let handler;
  vm.runInNewContext(fonte.slice(inicio, fim), {
    router: { get(_, callback) { handler = callback; } },
    obterFiltroEmpresa: Number,
    obterNumeroInteiro: Number,
    executeQuery: async (sql) => {
      assert.match(sql, /TRC\.CODPARC = ORD\.CODPARCTRANSP/);
      assert.match(sql, /TRP\.CODPARC = CAB\.CODPARCTRANSP/);
      return [nota];
    },
    gerarRomaneioCargaPdf,
    console
  });
  let pdf;
  await handler({ query: { empresa: '1' }, params: { ordemCarga: '5953' } }, {
    setHeader() {},
    send(buffer) { pdf = buffer; },
    status(codigo) { assert.fail(`Esperava um PDF, recebeu status ${codigo}`); }
  });
  const doc = await PDFDocument.load(pdf);
  const pagina = doc.getPage(0);
  const conteudo = zlib.inflateSync(pagina.node.Contents().getContents()).toString();
  const texto = [...conteudo.matchAll(/<([\da-f]+)>/gi)].map((trecho) => Buffer.from(trecho[1], 'hex').toString('latin1')).join('');
  assert.match(texto, /Transportadora da ordem: 78 - Transportadora da carga/);
  assert.match(texto, /Transportadora da nota: 52 - Transportadora da nota/);
});
