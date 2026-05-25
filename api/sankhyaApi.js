const DEFAULT_BASE_URL = 'https://api.sankhya.com.br';

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let accessSessionToken = null;

function clearAuthCache() {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
  accessSessionToken = null;
}

function getConfig() {
  return {
    baseUrl: process.env.SANKHYA_API_BASE_URL || DEFAULT_BASE_URL,
    integrationToken: process.env.SANKHYA_INTEGRATION_TOKEN,
    clientId: process.env.SANKHYA_CLIENT_ID,
    clientSecret: process.env.SANKHYA_CLIENT_SECRET,
    accessUser: process.env.SANKHYA_ACCESS_USER,
    accessPassword: process.env.SANKHYA_ACCESS_PASSWORD
  };
}

function assertConfig(config) {
  const missing = [];

  if (!config.integrationToken) missing.push('SANKHYA_INTEGRATION_TOKEN');
  if (!config.clientId) missing.push('SANKHYA_CLIENT_ID');
  if (!config.clientSecret) missing.push('SANKHYA_CLIENT_SECRET');

  if (missing.length > 0) {
    throw new Error(`Credenciais Sankhya ausentes: ${missing.join(', ')}`);
  }
}

function getJwtExpiration(accessToken) {
  const [, payload] = String(accessToken).split('.');
  if (!payload) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function extractAccessToken(payload) {
  return payload.access_token || payload.accessToken || payload.bearerToken || payload.token;
}

async function authenticate(options = {}) {
  const config = getConfig();
  assertConfig(config);

  if (!options.forceNew && cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret
  });

  const response = await fetch(`${config.baseUrl}/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Token': config.integrationToken
    },
    body: params
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Falha ao autenticar na Sankhya API: HTTP ${response.status}`);
  }

  const accessToken = extractAccessToken(payload);
  if (!accessToken) {
    throw new Error('Falha ao autenticar na Sankhya API: token de acesso nao retornado');
  }

  if (!options.skipCache) {
    cachedAccessToken = accessToken;
    cachedAccessTokenExpiresAt = getJwtExpiration(accessToken) || Date.now() + 25 * 60 * 1000;
  }

  return accessToken;
}

function campoApi(valor) {
  return { $: valor === null || valor === undefined ? '' : String(valor) };
}

async function ensureAccessSession(accessToken, config, options = {}) {
  if (!config.accessUser || !config.accessPassword) {
    if (options.required) {
      throw new Error('Usuario tecnico Sankhya nao configurado: informe SANKHYA_ACCESS_USER e SANKHYA_ACCESS_PASSWORD');
    }
    return;
  }

  if (!options.force && accessSessionToken === accessToken) {
    return;
  }

  const url = `${config.baseUrl}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceName: 'MobileLoginSP.login',
      requestBody: {
        NOMUSU: campoApi(config.accessUser),
        INTERNO: campoApi(config.accessPassword),
        KEEPCONNECTED: campoApi('N')
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === '0' || payload.status === '3') {
    const message = payload.statusMessage || `HTTP ${response.status}`;
    throw new Error(`Falha ao autenticar usuario tecnico Sankhya: ${message}`);
  }

  accessSessionToken = accessToken;
}

function normalizeFieldName(field, index) {
  if (typeof field === 'string') return field;
  return field?.name || field?.fieldName || field?.label || `COL_${index}`;
}

function normalizeQueryRows(payload) {
  const responseBody = payload.responseBody || payload;
  const rows = responseBody.rows || responseBody.resultSet || [];
  const fields = responseBody.fieldsMetadata || responseBody.metadata || responseBody.fields || [];
  const fieldNames = fields.map(normalizeFieldName);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    if (!Array.isArray(row)) {
      return row;
    }

    return Object.fromEntries(
      row.map((value, index) => [fieldNames[index] || `COL_${index}`, value])
    );
  });
}

async function executeQuery(sql) {
  const config = getConfig();
  const accessToken = await authenticate();
  await ensureAccessSession(accessToken, config);
  const url = `${config.baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === '0' || payload.status === '3') {
    const message = payload.statusMessage || `HTTP ${response.status}`;
    throw new Error(`Falha ao executar consulta na Sankhya API: ${message}`);
  }

  return normalizeQueryRows(payload);
}

async function executeService(serviceName, requestBody, options = {}) {
  const config = getConfig();
  const accessToken = await authenticate({
    forceNew: Boolean(options.isolatedSession),
    skipCache: Boolean(options.isolatedSession)
  });
  if (!options.skipAccessSession) {
    await ensureAccessSession(accessToken, config, {
      force: Boolean(options.forceAccessSession),
      required: Boolean(options.forceAccessSession)
    });
  }
  const modulePath = options.modulePath || 'mge';
  const url = `${config.baseUrl}/gateway/v1/${modulePath}/service.sbr?serviceName=${encodeURIComponent(serviceName)}&outputType=json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceName,
      requestBody
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.status === '0' || payload.status === '3') {
    const message = payload.statusMessage || `HTTP ${response.status}`;
    throw new Error(`Falha ao executar servico ${serviceName}: ${message}`);
  }

  return payload;
}

module.exports = {
  clearAuthCache,
  executeService,
  executeQuery,
  normalizeQueryRows
};
