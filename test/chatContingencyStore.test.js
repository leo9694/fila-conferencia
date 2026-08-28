const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarChatContingencyStore } = require('../api/chatContingencyStore');

test('valida contingência no servidor sem armazenar a senha do usuário', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-contingency-'));
  let agora = Date.parse('2026-08-28T10:00:00.000Z');
  const options = { baseDir, durationMs: 60_000, now: () => agora };
  const store = criarChatContingencyStore(options);
  store.salvar('zenaide', 'senha-segura', {
    codUsu: 81, nome: 'ZENAIDE', grupos: ['Financeiro'], gruposConfirmados: true
  });

  const conteudo = fs.readFileSync(store.filePath, 'utf8');
  assert.equal(conteudo.includes('senha-segura'), false);
  assert.equal(store.validar('ZENAIDE', 'senha-segura').codUsu, 81);
  assert.equal(store.validar('zenaide', 'senha-errada'), null);

  const recarregado = criarChatContingencyStore(options);
  assert.equal(recarregado.validar('zenaide', 'senha-segura').nome, 'ZENAIDE');
  agora += 60_001;
  assert.equal(recarregado.validar('zenaide', 'senha-segura'), null);
});

test('revoga a credencial persistida quando o usuário perde o acesso ao Chat', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-contingency-revoke-'));
  const store = criarChatContingencyStore({ baseDir });
  store.salvar('usuario', 'senha', { codUsu: 10, nome: 'USUARIO' });
  assert.equal(store.remover('USUARIO'), true);
  assert.equal(store.validar('usuario', 'senha'), null);
});
