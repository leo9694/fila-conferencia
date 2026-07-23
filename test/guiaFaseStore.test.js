const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { criarGuiaFaseStore } = require('../api/guiaFaseStore');

test('armazena varias Guias FASE e permite excluir uma delas', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guia-fase-'));
  const store = criarGuiaFaseStore({ baseDir, namespace: 'teste' });

  const guias = store.adicionar({
    nunota: 123,
    codUsu: 7,
    arquivos: [
      {
        originalname: 'guia principal.pdf',
        mimetype: 'application/pdf',
        size: 4,
        buffer: Buffer.from('PDF1')
      },
      {
        originalname: 'guia complementar.png',
        mimetype: 'image/png',
        size: 4,
        buffer: Buffer.from('PNG1')
      }
    ]
  });

  assert.equal(guias.length, 2);
  assert.equal(store.quantidade(123), 2);
  assert.equal(store.obterArquivo(123, guias[0].id).nome, 'guia principal.pdf');
  assert.equal(store.excluir(123, guias[0].id), true);
  assert.equal(store.quantidade(123), 1);

  const recarregado = criarGuiaFaseStore({ baseDir, namespace: 'teste' });
  assert.deepEqual(recarregado.listar(123).map((guia) => guia.nome), ['guia complementar.png']);
});
