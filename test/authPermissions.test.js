const test = require('node:test');
const assert = require('node:assert/strict');
const {
  exigirAcessoSankhya,
  enriquecerUsuarioComPermissoes,
  montarPermissoesGrupos,
  sankhyaIndisponivel,
  serializarCredencialContingencia,
  validarCredencialContingencia
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

test('credencial de contingência exige o mesmo usuário e senha e limita a sessão ao chat', () => {
  const credencial = serializarCredencialContingencia({
    codUsu: 72,
    nome: 'LEONARDO',
    grupos: ['Diretoria'],
    gruposConfirmados: true,
    permissoes: { vendasGerais: true, transporte: true, relatorios: true }
  }, 'leonardo', 'senha-segura');

  const usuario = validarCredencialContingencia(credencial, 'LEONARDO', 'senha-segura');
  assert.equal(usuario.modoContingencia, true);
  assert.equal(usuario.escopo, 'CHAT');
  assert.deepEqual(usuario.permissoes, {
    vendasGerais: false,
    transporte: false,
    relatorios: false
  });
  assert.equal(validarCredencialContingencia(credencial, 'outro', 'senha-segura'), null);
  assert.equal(validarCredencialContingencia(credencial, 'leonardo', 'senha-errada'), null);
  assert.equal(validarCredencialContingencia(`${credencial}alterada`, 'leonardo', 'senha-segura'), null);
});

test('só classifica indisponibilidade técnica como contingência', () => {
  assert.equal(sankhyaIndisponivel(new Error('fetch failed')), true);
  assert.equal(sankhyaIndisponivel({ status: 503 }), true);
  assert.equal(sankhyaIndisponivel({ status: 429 }), true);
  assert.equal(sankhyaIndisponivel({ status: 401 }), false);
  assert.equal(sankhyaIndisponivel(new Error('Usuário ou senha inválidos')), false);
});

test('sessão de contingência não acessa as rotas operacionais do Sankhya', () => {
  let status = 0;
  let payload = null;
  exigirAcessoSankhya(
    { usuario: { modoContingencia: true, escopo: 'CHAT' } },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        payload = value;
      }
    },
    () => assert.fail('não deveria liberar a rota')
  );
  assert.equal(status, 503);
  assert.match(payload.erro, /somente o Chat/i);
});
