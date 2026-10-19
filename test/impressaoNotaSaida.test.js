const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PDFDocument } = require('pdf-lib');
const { gerarPedidoVendaPdf } = require('../api/pedidoVendaPdf');
const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

test('impressão aceita notas TOP 35 e 10 e usa linhas, lotes e quantidades da nota sem sobrescrever com separação', async () => {
  for (const top of [35, 10]) {
    let handler;
    let dadosPdf;
    const impressoes = [];
    const itens = [
      { SEQUENCIA: 1, CODPROD: 1113, DESCRPROD: 'SEMENTE', CODVOL: 'UN', QTDNEG: 10, CONTROLE: '0023002530042010', CODGRUPOPROD: 1 },
      { SEQUENCIA: 2, CODPROD: 1113, DESCRPROD: 'SEMENTE', CODVOL: 'UN', QTDNEG: 20, CONTROLE: '0023002530059010', CODGRUPOPROD: 1 }
    ];
    const ctx = vm.createContext({ path, __dirname: path.join(__dirname, '..'),
      router: { get(_url, fn) { handler = fn; } }, obterNumeroInteiro: Number,
      executeQuery: async (sql) => {
        if (sql.includes('FROM TGFCAB CAB')) {
          assert.match(sql, /CAB.TIPMOV = 'V' AND CAB.CODTIPOPER IN \(35, 10\)/);
          assert.match(sql, /CAB.NUNOTA = 3885454/);
          return [{ NUNOTA: 3885454, CODTIPOPER: top, TIPMOV: 'V', NOME_EMPRESA: 'Norte Sul Sementes' }];
        }
        assert.match(sql, /ITE.CONTROLE/);
        assert.match(sql, /ITE.NUNOTA = 3885454/);
        return itens;
      },
      separacaoStore: { obter: () => assert.fail('Impressão da nota não deve usar dados antigos da separação') },
      gerarPedidoVendaPdf: async (dados) => { dadosPdf = dados; return gerarPedidoVendaPdf(dados); },
      pedidoPrintStore: { registrar: (...args) => impressoes.push(args) }, console
    });
    vm.runInContext(fonte.slice(fonte.indexOf("router.get('/fila-conferencia/pedidos/:nunota/pdf'"), fonte.indexOf("router.get('/fila-conferencia/notas/:nunota/documentos/:tipo'")), ctx);
    const res = { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; }, json(v) { this.payload = v; }, send(pdf) { this.pdf = pdf; } };
    await handler({ params: { nunota: '3885454' }, usuario: { codUsu: 72 } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal((await PDFDocument.load(res.pdf)).getPageCount(), 1);
    assert.deepEqual(dadosPdf.itens.map((item) => item.CONTROLE), itens.map((item) => item.CONTROLE));
    assert.deepEqual(dadosPdf.itens.map((item) => item.QTDNEG), [10, 20]);
    assert.ok(dadosPdf.itens.every((item) => !item.SEPARACAO_CONCLUIDA));
    assert.deepEqual(impressoes, [[3885454, 72]]);
  }
});

test('lista e cabeçalho identificam TOP 10 como nota de bonificação e preservam histórico e entrada', () => {
  const ctx = vm.createContext({ filaModoConferencia: 'saida' });
  vm.runInContext(frontend.slice(frontend.indexOf('function rotuloDocumentoConferencia('), frontend.indexOf('function obterEstadoOperacionalPedido(')), ctx);
  assert.equal(ctx.rotuloDocumentoConferencia({ SAIDA_POR_NOTA: true, CODTIPOPER: 10 }), 'Nota de bonificação');
  assert.equal(ctx.rotuloDocumentoConferencia({ SAIDA_POR_NOTA: true, CODTIPOPER: 35 }), 'Nota de venda');
  assert.equal(ctx.rotuloDocumentoConferencia({ TIPMOV: 'P', CODTIPOPER: 6 }), 'Pedido');
  assert.match(ctx.formatarTituloPedidoConferencia({ SAIDA_POR_NOTA: true, CODTIPOPER: 10, NUNOTA: 3885454 }), /^Nota de bonificação 3885454/);
  ctx.filaModoConferencia = 'entrada';
  assert.equal(ctx.rotuloDocumentoConferencia({ CODTIPOPER: 21 }), 'Nota');
  assert.match(frontend, /class="pedido-numero">\$\{rotuloDocumentoConferencia\(pedido\)\}/);
});
