const test = require('node:test');
const assert = require('node:assert/strict');
const sankhyaApi = require('../api/sankhyaApi');

test('executa a API REST Sankhya com autenticacao e payload JSON', async () => {
  const originalFetch = global.fetch;
  const originalEnv = salvarEnvSankhya();
  const chamadas = [];

  configurarEnvSankhya();
  sankhyaApi.clearAuthCache();
  global.fetch = async (url, options = {}) => {
    chamadas.push({ url: String(url), options });
    if (String(url).endsWith('/authenticate')) {
      return respostaJson({ access_token: 'token-teste' });
    }
    return respostaTexto({ codigoOrdemCarga: 939 }, 201);
  };

  try {
    const payload = await sankhyaApi.executeRest('POST', 'v1/logistica/ordens-carga', {
      body: { codigoOrdemCarga: 5293, codigoEmpresa: 1, codigoTransportadora: 649 }
    });

    assert.equal(payload.codigoOrdemCarga, 939);
    assert.equal(chamadas.length, 2);
    assert.equal(chamadas[1].url, 'https://api.sandbox.teste/v1/logistica/ordens-carga');
    assert.equal(chamadas[1].options.method, 'POST');
    assert.equal(chamadas[1].options.headers.Authorization, 'Bearer token-teste');
    assert.deepEqual(JSON.parse(chamadas[1].options.body), {
      codigoOrdemCarga: 5293,
      codigoEmpresa: 1,
      codigoTransportadora: 649
    });
  } finally {
    global.fetch = originalFetch;
    restaurarEnvSankhya(originalEnv);
    sankhyaApi.clearAuthCache();
  }
});

test('renova o token e repete uma chamada REST nao autorizada apenas uma vez', async () => {
  const originalFetch = global.fetch;
  const originalEnv = salvarEnvSankhya();
  let autenticacoes = 0;
  let requisicoesRest = 0;

  configurarEnvSankhya();
  sankhyaApi.clearAuthCache();
  global.fetch = async (url) => {
    if (String(url).endsWith('/authenticate')) {
      autenticacoes += 1;
      return respostaJson({ access_token: `token-${autenticacoes}` });
    }

    requisicoesRest += 1;
    return requisicoesRest === 1
      ? respostaTexto({ message: 'Token expirado' }, 401)
      : respostaTexto({ codigoOrdemCarga: 940 });
  };

  try {
    const payload = await sankhyaApi.executeRest('POST', 'v1/logistica/ordens-carga', { body: {} });
    assert.equal(payload.codigoOrdemCarga, 940);
    assert.equal(autenticacoes, 2);
    assert.equal(requisicoesRest, 2);
  } finally {
    global.fetch = originalFetch;
    restaurarEnvSankhya(originalEnv);
    sankhyaApi.clearAuthCache();
  }
});

function respostaJson(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function respostaTexto(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  };
}

function configurarEnvSankhya() {
  process.env.SANKHYA_API_BASE_URL = 'https://api.sandbox.teste';
  process.env.SANKHYA_INTEGRATION_TOKEN = 'integracao-teste';
  process.env.SANKHYA_CLIENT_ID = 'cliente-teste';
  process.env.SANKHYA_CLIENT_SECRET = 'segredo-teste';
  delete process.env.SANKHYA_ACCESS_USER;
  delete process.env.SANKHYA_ACCESS_PASSWORD;
}

function salvarEnvSankhya() {
  return Object.fromEntries([
    'SANKHYA_API_BASE_URL',
    'SANKHYA_INTEGRATION_TOKEN',
    'SANKHYA_CLIENT_ID',
    'SANKHYA_CLIENT_SECRET',
    'SANKHYA_ACCESS_USER',
    'SANKHYA_ACCESS_PASSWORD'
  ].map((nome) => [nome, process.env[nome]]));
}

function restaurarEnvSankhya(valores) {
  Object.entries(valores).forEach(([nome, valor]) => {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  });
}
