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

test('compartilha uma unica autenticacao entre requisicoes concorrentes', async () => {
  const originalFetch = global.fetch;
  const originalEnv = salvarEnvSankhya();
  let autenticacoes = 0;
  let requisicoesRest = 0;

  configurarEnvSankhya();
  sankhyaApi.clearAuthCache();
  global.fetch = async (url) => {
    if (String(url).endsWith('/authenticate')) {
      autenticacoes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return respostaJson({ access_token: 'token-compartilhado' });
    }
    requisicoesRest += 1;
    return respostaTexto({ ok: true });
  };

  try {
    await Promise.all([
      sankhyaApi.executeRest('GET', 'v1/teste/a'),
      sankhyaApi.executeRest('GET', 'v1/teste/b'),
      sankhyaApi.executeRest('GET', 'v1/teste/c')
    ]);
    assert.equal(autenticacoes, 1);
    assert.equal(requisicoesRest, 3);
  } finally {
    global.fetch = originalFetch;
    restaurarEnvSankhya(originalEnv);
    sankhyaApi.clearAuthCache();
  }
});

test('reutiliza token dedicado nas validacoes de login sem misturar a sessao operacional', async () => {
  const originalFetch = global.fetch;
  const originalEnv = salvarEnvSankhya();
  let autenticacoes = 0;
  let logins = 0;
  let logouts = 0;

  configurarEnvSankhya();
  sankhyaApi.clearAuthCache();
  global.fetch = async (url) => {
    const endereco = String(url);
    if (endereco.endsWith('/authenticate')) {
      autenticacoes += 1;
      return respostaJson({ access_token: 'token-exclusivo-login' });
    }
    if (endereco.includes('MobileLoginSP.logout')) {
      logouts += 1;
      return respostaJson({ status: '1' });
    }
    logins += 1;
    return respostaJson({ status: '1', responseBody: { idusu: { $: 'NzI=' } } });
  };

  const opcoes = { authScope: 'login', skipAccessSession: true, logoutAfterService: true };
  try {
    await sankhyaApi.executeService('MobileLoginSP.login', {}, opcoes);
    await sankhyaApi.executeService('MobileLoginSP.login', {}, opcoes);
    assert.equal(autenticacoes, 1);
    assert.equal(logins, 2);
    assert.equal(logouts, 2);
  } finally {
    global.fetch = originalFetch;
    restaurarEnvSankhya(originalEnv);
    sankhyaApi.clearAuthCache();
  }
});

test('aguarda e repete autenticacao limitada por HTTP 429', async () => {
  const originalFetch = global.fetch;
  const originalEnv = salvarEnvSankhya();
  let autenticacoes = 0;

  configurarEnvSankhya();
  process.env.SANKHYA_AUTH_RETRY_LIMIT = '2';
  process.env.SANKHYA_AUTH_RETRY_BASE_MS = '0';
  process.env.SANKHYA_AUTH_RETRY_MAX_MS = '0';
  sankhyaApi.clearAuthCache();
  global.fetch = async (url) => {
    if (String(url).endsWith('/authenticate')) {
      autenticacoes += 1;
      if (autenticacoes === 1) {
        return respostaJson({ message: 'Too Many Requests' }, 429, { 'retry-after': '0' });
      }
      return respostaJson({ access_token: 'token-apos-rate-limit' });
    }
    return respostaTexto({ ok: true });
  };

  try {
    const payload = await sankhyaApi.executeRest('GET', 'v1/teste');
    assert.equal(payload.ok, true);
    assert.equal(autenticacoes, 2);
  } finally {
    global.fetch = originalFetch;
    restaurarEnvSankhya(originalEnv);
    sankhyaApi.clearAuthCache();
  }
});

function respostaJson(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    headers: { get: (nome) => headers[String(nome).toLowerCase()] ?? null }
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
    'SANKHYA_ACCESS_PASSWORD',
    'SANKHYA_AUTH_RETRY_LIMIT',
    'SANKHYA_AUTH_RETRY_BASE_MS',
    'SANKHYA_AUTH_RETRY_MAX_MS'
  ].map((nome) => [nome, process.env[nome]]));
}

function restaurarEnvSankhya(valores) {
  Object.entries(valores).forEach(([nome, valor]) => {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  });
}
