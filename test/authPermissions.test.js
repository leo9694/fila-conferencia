const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enriquecerUsuarioComPermissoes,
  montarPermissoesGrupos
} = require('../api/auth');

test('diretoria recebe acesso a vendas gerais e relatorios', () => {
  assert.deepEqual(montarPermissoesGrupos([' Diretoria ']), {
    vendasGerais: true,
    relatorios: true
  });
});

test('grupos confirmados ficam incorporados ao usuario autenticado', async () => {
  const usuario = await enriquecerUsuarioComPermissoes(
    { codUsu: 72, nome: 'LEONARDO' },
    async () => [{ NOMEGRUPO: 'Diretoria' }]
  );

  assert.equal(usuario.gruposConfirmados, true);
  assert.deepEqual(usuario.grupos, ['Diretoria']);
  assert.equal(usuario.permissoes.vendasGerais, true);
});
