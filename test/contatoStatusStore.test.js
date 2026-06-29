const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { criarContatoStatusStore } = require('../api/contatoStatusStore');

test('isola o status de contato por ambiente Sankhya', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contato-status-'));
  const treinamento = criarContatoStatusStore({
    baseDir,
    namespace: 'https://api.sandbox.sankhya.com.br'
  });
  const producao = criarContatoStatusStore({
    baseDir,
    namespace: 'https://api.sankhya.com.br'
  });

  treinamento.salvar(7371, 'atualizado');

  assert.notEqual(treinamento.filePath, producao.filePath);
  assert.equal(treinamento.obter(7371)?.status, 'atualizado');
  assert.equal(producao.obter(7371), null);

  fs.rmSync(baseDir, { recursive: true, force: true });
});
