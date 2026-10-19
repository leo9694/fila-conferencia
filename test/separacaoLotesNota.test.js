const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');

function preparar(lotes) {
  let handler;
  const sqls = [];
  const contexto = vm.createContext({ console, obterNumeroInteiro: (valor) => /^\d+$/.test(String(valor)) ? Number(valor) : null,
    router: { get(_url, fn) { handler = fn; } },
    executeQuery: async (sql) => { sqls.push(sql); return lotes; }
  });
  vm.runInContext(fonte.slice(fonte.indexOf("router.get('/fila-conferencia/separacao/:nunota/produtos/:codprod/lotes'"), fonte.indexOf('async function garantirPedidoNaoConferidoParaSeparacao(')), contexto);
  return { handler, sqls, res: { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; } } };
}

test('lotes e quantidades vêm da nota e não do saldo virtual ou reserva da empresa', async () => {
  const { handler, sqls, res } = preparar([{ CONTROLE: 'LOTE-A', QUANTIDADE_NOTA: 5, DTVALID: null, ESTOQUE: 0 }]);
  await handler({ params: { nunota: '123', codprod: '1022' } }, res);
  assert.equal(res.dados.origem, 'NOTA');
  assert.equal(res.dados.lotes[0].quantidadeNota, 5);
  assert.equal(res.dados.lotes[0].disponivel, 5);
  assert.equal(res.dados.lotes[0].dtValidade, null);
  assert.match(sqls[0], /CAB.NUNOTA = 123/);
  assert.match(sqls[0], /ITE.CODPROD = 1022/);
  assert.match(sqls[0], /SUM\(NVL\(ITE.QTDNEG, 0\)\) AS QUANTIDADE_NOTA/);
  assert.match(sqls[0], /LEFT JOIN \(/);
  assert.match(sqls[0], /EST.CODEMP = CAB.CODEMP/);
  assert.match(sqls[0], /EST.CODLOCAL = ITE.CODLOCALORIG/);
  assert.doesNotMatch(sqls[0], /EST\.ESTOQUE|EST\.RESERVADO|EST\.ATIVO/);
});

test('sem lote na nota retorna vazio sem buscar outros lotes do estoque', async () => {
  const { handler, sqls, res } = preparar([]);
  await handler({ params: { nunota: '123', codprod: '1022' } }, res);
  assert.equal(res.dados.lotes.length, 0);
  assert.equal(sqls.length, 1);
  assert.match(sqls[0], /TRIM\(ITE.CONTROLE\) IS NOT NULL/);
});

test('rejeita identificadores inválidos antes de consultar lotes da nota', async () => {
  const { handler, sqls, res } = preparar([]);
  await handler({ params: { nunota: '123', codprod: '1022 OR 1=1' } }, res);
  assert.equal(res.codigo, 400);
  assert.equal(sqls.length, 0);
});
