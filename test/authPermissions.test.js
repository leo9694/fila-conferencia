const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enriquecerUsuarioComPermissoes,
  montarPermissoesGrupos
} = require('../api/auth');

test('diretoria recebe acesso a vendas gerais, transporte e relatorios', () => {
  assert.deepEqual(montarPermissoesGrupos([' Diretoria ']), {
    vendasGerais: true,
    transporte: true,
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
  assert.equal(usuario.permissoes.transporte, true);
});

test('gerente recebe acesso ao transporte sem receber acesso aos relatorios', () => {
  assert.deepEqual(montarPermissoesGrupos(['Gerente']), {
    vendasGerais: true,
    transporte: true,
    relatorios: false
  });
});
