const test = require('node:test');
const assert = require('node:assert/strict');
const {
  autenticarContingenciaRemota,
  normalizarBaseUrl
} = require('../api/chatContingencyRemote');

test('autentica no servidor central por HTTPS sem alterar a credencial', async () => {
  let requisicao;
  const usuario = { codUsu: 81, nome: 'ZENAIDE', grupos: ['Financeiro'] };
  const resultado = await autenticarContingenciaRemota('zenaide', 'senha', {
    baseUrl: 'https://logistica.exemplo.com/',
    fetchImpl: async (url, options) => {
      requisicao = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, chatPermitido: true, usuario })
      };
    }
  });

  assert.deepEqual(resultado, usuario);
  assert.equal(requisicao.url, 'https://logistica.exemplo.com/api/auth/login');
  assert.equal(requisicao.options.headers['X-Chat-Contingency-Hop'], '1');
  assert.deepEqual(JSON.parse(requisicao.options.body), { usuario: 'zenaide', senha: 'senha' });
});

test('rejeita servidor remoto sem HTTPS', () => {
  assert.throws(
    () => normalizarBaseUrl('http://logistica.exemplo.com'),
    /deve usar HTTPS/
  );
  assert.equal(normalizarBaseUrl('http://127.0.0.1:3099'), 'http://127.0.0.1:3099');
});

test('propaga recusa do servidor central sem expor detalhes internos', async () => {
  await assert.rejects(
    autenticarContingenciaRemota('usuario', 'incorreta', {
      baseUrl: 'https://logistica.exemplo.com',
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ erro: 'Usuário ou senha inválidos' })
      })
    }),
    (error) => error.status === 401 && error.message === 'Usuário ou senha inválidos'
  );
});

test('exige autorização explícita do Chat na resposta central', async () => {
  await assert.rejects(
    autenticarContingenciaRemota('usuario', 'senha', {
      baseUrl: 'https://logistica.exemplo.com',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ usuario: { codUsu: 10 }, chatPermitido: false })
      })
    }),
    (error) => error.status === 403
  );
});
