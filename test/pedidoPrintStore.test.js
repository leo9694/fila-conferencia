const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { criarPedidoPrintStore } = require('../api/pedidoPrintStore');

test('persiste o historico de impressao do pedido entre reinicios', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'pedido-print-'));
  const filePath = path.join(diretorio, 'impressoes.json');

  try {
    const store = criarPedidoPrintStore({ filePath, namespace: 'teste' });
    const registro = store.registrar(12345, 72);
    assert.equal(registro.impresso, true);
    assert.equal(registro.quantidade, 1);

    const recarregado = criarPedidoPrintStore({ filePath, namespace: 'teste' });
    assert.equal(recarregado.obter(12345).impresso, true);
    assert.equal(recarregado.obter(12345).codUsu, 72);
    assert.equal(recarregado.obter(12345).quantidade, 1);

    recarregado.registrar(12345, 72);
    assert.equal(recarregado.obter(12345).quantidade, 2);
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});
