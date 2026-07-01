const test = require('node:test');
const assert = require('node:assert/strict');
const sankhyaApi = require('../api/sankhyaApi');

test('reconhece respostas de sessao direta expirada ou nao autorizada', () => {
  const { isDirectSessionError } = sankhyaApi._internals;

  assert.equal(isDirectSessionError('Sessao expirada'), true);
  assert.equal(isDirectSessionError('Não autorizado.'), true);
  assert.equal(isDirectSessionError('N�o autorizado.'), true);
  assert.equal(isDirectSessionError('Unauthorized'), true);
  assert.equal(isDirectSessionError('Sem permissao para alterar o pedido'), false);
  assert.equal(isDirectSessionError('', 401), true);
  assert.equal(isDirectSessionError('', 403), true);
});

test('renova a sessao direta e repete o servico uma vez quando nao autorizado', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    baseUrl: process.env.SANKHYA_OM_BASE_URL,
    user: process.env.SANKHYA_ACCESS_USER,
    password: process.env.SANKHYA_ACCESS_PASSWORD
  };
  let logins = 0;
  let services = 0;
  let logouts = 0;

  process.env.SANKHYA_OM_BASE_URL = 'http://sankhya.test/mge';
  process.env.SANKHYA_ACCESS_USER = 'tecnico';
  process.env.SANKHYA_ACCESS_PASSWORD = 'senha';
  sankhyaApi.clearAuthCache();

  global.fetch = async (url) => {
    const value = String(url);

    if (value.includes('MobileLoginSP.login')) {
      logins += 1;
      return responseJson({
        status: '1',
        responseBody: { jsessionid: { $: `sessao-${logins}` } }
      });
    }

    if (value.includes('MobileLoginSP.logout')) {
      logouts += 1;
      return responseJson({ status: '1' });
    }

    services += 1;
    return services === 1
      ? responseJson({ status: '0', statusMessage: 'N�o autorizado.' })
      : responseJson({ status: '1', responseBody: { ok: true } });
  };

  try {
    const result = await sankhyaApi.executeDirectService('BoletoSP.buildPreVisualizacao', {});
    assert.equal(result.responseBody.ok, true);
    assert.equal(logins, 2);
    assert.equal(services, 2);
    assert.equal(logouts, 1);
  } finally {
    global.fetch = originalFetch;
    restoreEnv('SANKHYA_OM_BASE_URL', originalEnv.baseUrl);
    restoreEnv('SANKHYA_ACCESS_USER', originalEnv.user);
    restoreEnv('SANKHYA_ACCESS_PASSWORD', originalEnv.password);
    sankhyaApi.clearAuthCache();
  }
});

function responseJson(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
