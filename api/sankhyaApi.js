const DEFAULT_BASE_URL = 'https://api.sankhya.com.br';
const DEFAULT_DIRECT_SESSION_IDLE_MS = 20 * 60 * 1000;
const DEFAULT_AUTH_RETRY_LIMIT = 3;
const DEFAULT_AUTH_RETRY_BASE_MS = 1000;
const DEFAULT_AUTH_RETRY_MAX_MS = 10000;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedLoginAccessToken = null;
let cachedLoginAccessTokenExpiresAt = 0;
let accessTokenPromise = null;
let loginAccessTokenPromise = null;
let oauthAuthenticationQueue = Promise.resolve();
let accessSessionToken = null;
let accessSessionPromise = null;
let accessSessionPromiseToken = null;
let directSessionId = null;
let directSessionPromise = null;
let directSessionLastUsedAt = 0;
let gatewayUserLoginQueue = Promise.resolve();

function clearAuthCache() {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
  cachedLoginAccessToken = null;
  cachedLoginAccessTokenExpiresAt = 0;
  accessTokenPromise = null;
  loginAccessTokenPromise = null;
  oauthAuthenticationQueue = Promise.resolve();
  accessSessionToken = null;
  accessSessionPromise = null;
  accessSessionPromiseToken = null;
  directSessionId = null;
  directSessionPromise = null;
  directSessionLastUsedAt = 0;
  gatewayUserLoginQueue = Promise.resolve();
}

function getConfig() {
  return {
    baseUrl: process.env.SANKHYA_API_BASE_URL || DEFAULT_BASE_URL,
    integrationToken: process.env.SANKHYA_INTEGRATION_TOKEN,
    clientId: process.env.SANKHYA_CLIENT_ID,
    clientSecret: process.env.SANKHYA_CLIENT_SECRET,
    accessUser: process.env.SANKHYA_ACCESS_USER,
    accessPassword: process.env.SANKHYA_ACCESS_PASSWORD,
    omBaseUrl: process.env.SANKHYA_OM_BASE_URL
  };
}

function getDirectBaseUrl(config = getConfig()) {
  const value = String(config.omBaseUrl || '').trim().replace(/\/+$/, '');
  if (!value) return null;
  return value.endsWith('/mge') ? value : `${value}/mge`;
}

function extractDirectSessionId(payload) {
  return payload?.responseBody?.jsessionid?.$
    || payload?.responseBody?.jsessionid
    || payload?.jsessionid?.$
    || payload?.jsessionid
    || null;
}

function pontuarTextoCorrompido(texto) {
  const valor = String(texto || '');
  return (valor.match(/\uFFFD/g) || []).length * 20
    + (valor.match(/(?:Ã.|Â.|â[\u0080-\u00BF]|ï¿½)/g) || []).length * 6
    + (valor.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length * 10;
}

async function lerRespostaJsonCompat(response) {
  if (typeof response?.arrayBuffer !== 'function') {
    return typeof response?.json === 'function' ? response.json().catch(() => ({})) : {};
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) return {};
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  const charsetDeclarado = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/)?.[1] || '';
  const codificacoes = charsetDeclarado && !/utf-?8/i.test(charsetDeclarado)
    ? [charsetDeclarado, 'utf-8', 'windows-1252']
    : ['utf-8', 'windows-1252'];
  const candidatos = [];

  for (const codificacao of [...new Set(codificacoes)]) {
    try {
      const texto = new TextDecoder(codificacao).decode(bytes);
      candidatos.push({ texto, pontuacao: pontuarTextoCorrompido(texto) });
    } catch {
      // Alguns aliases de charset informados pelo servidor podem não existir no Node.
    }
  }

  candidatos.sort((a, b) => a.pontuacao - b.pontuacao);
  for (const candidato of candidatos) {
    try {
      return JSON.parse(candidato.texto.replace(/^\uFEFF/, ''));
    } catch {
      // Tenta a próxima codificação disponível.
    }
  }
  return {};
}

function isDirectSessionError(message, statusCode) {
  if (statusCode === 401 || statusCode === 403) return true;

  const normalized = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return /sess[a-z\ufffd]*o|session|login|autentic|expirad|inativ|n.o autorizado|nao autorizado|unauthoriz/.test(normalized);
}

function getDirectSessionIdleMs() {
  const configured = Number(process.env.SANKHYA_DIRECT_SESSION_IDLE_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_DIRECT_SESSION_IDLE_MS;
}

function directSessionIsFresh() {
  return Boolean(
    directSessionId
    && directSessionLastUsedAt
    && Date.now() - directSessionLastUsedAt < getDirectSessionIdleMs()
  );
}

async function logoutDirectSession(sessionId, config = getConfig()) {
  if (!sessionId) return;

  const baseUrl = getDirectBaseUrl(config);
  if (!baseUrl) return;

  const query = new URLSearchParams({
    serviceName: 'MobileLoginSP.logout',
    outputType: 'json',
    mgeSession: sessionId
  });

  await fetch(`${baseUrl}/service.sbr?${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `JSESSIONID=${sessionId}`
    },
    body: JSON.stringify({
      serviceName: 'MobileLoginSP.logout',
      status: '1',
      pendingPrinting: 'false',
      requestBody: {}
    })
  }).catch(() => {});
}

async function executeDirectUserLogin(requestBody, config = getConfig()) {
  const baseUrl = getDirectBaseUrl(config);
  if (!baseUrl) return null;

  const url = `${baseUrl}/service.sbr?serviceName=MobileLoginSP.login&outputType=json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceName: 'MobileLoginSP.login',
      requestBody
    })
  });
  const payload = await lerRespostaJsonCompat(response);
  const sessionId = extractDirectSessionId(payload);

  if (!response.ok || payload.status === '0' || payload.status === '3' || !sessionId) {
    const message = payload.statusMessage || `HTTP ${response.status}`;
    throw new Error(`Falha ao autenticar no Sankhya: ${message}`);
  }

  try {
    return payload;
  } finally {
    await logoutDirectSession(sessionId, config);
  }
}

async function executeUserLogin(requestBody) {
  const config = getConfig();
  const directPayload = await executeDirectUserLogin(requestBody, config);
  if (directPayload) return directPayload;

  const executarGateway = () => executeService('MobileLoginSP.login', requestBody, {
    authScope: 'login',
    skipAccessSession: true,
    logoutAfterService: true
  });
  const loginAtual = gatewayUserLoginQueue.then(executarGateway, executarGateway);
  gatewayUserLoginQueue = loginAtual.catch(() => {});
  return loginAtual;
}

async function invalidateDirectSession(sessionId, options = {}) {
  if (!sessionId || directSessionId === sessionId) {
    directSessionId = null;
    directSessionLastUsedAt = 0;
  }

  if (options.logout) {
    await logoutDirectSession(sessionId);
  }
}

async function loginDirectSession(options = {}) {
  const config = getConfig();
  const baseUrl = getDirectBaseUrl(config);
  if (!baseUrl) {
    throw new Error('Endereco direto do Sankhya nao configurado: informe SANKHYA_OM_BASE_URL');
  }
  if (!config.accessUser || !config.accessPassword) {
    throw new Error('Usuario tecnico Sankhya nao configurado para gerar documentos');
  }
  if (!options.forceNew && directSessionIsFresh()) return directSessionId;
  if (directSessionPromise) return directSessionPromise;

  const expiredSessionId = directSessionId;
  if (expiredSessionId) {
    directSessionId = null;
    directSessionLastUsedAt = 0;
    await logoutDirectSession(expiredSessionId, config);
  }

  directSessionPromise = (async () => {
    const url = `${baseUrl}/service.sbr?serviceName=MobileLoginSP.login&outputType=json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceName: 'MobileLoginSP.login',
        requestBody: {
          NOMUSU: campoApi(config.accessUser),
          INTERNO: campoApi(config.accessPassword),
          KEEPCONNECTED: campoApi('N')
        }
      })
    });
    const payload = await lerRespostaJsonCompat(response);
    const sessionId = extractDirectSessionId(payload);
    if (!response.ok || payload.status === '0' || payload.status === '3' || !sessionId) {
      const message = payload.statusMessage || `HTTP ${response.status}`;
      throw new Error(`Falha ao abrir sessao direta no Sankhya: ${message}`);
    }
    directSessionId = sessionId;
    directSessionLastUsedAt = Date.now();
    return sessionId;
  })();

  try {
    return await directSessionPromise;
  } finally {
    directSessionPromise = null;
  }
}

async function executeDirectService(serviceName, requestBody, options = {}) {
  const config = getConfig();
  const baseUrl = getDirectBaseUrl(config);
  const sessionId = await loginDirectSession({ forceNew: Boolean(options.forceNewSession) });
  const modulePath = options.modulePath || 'mge';
  const moduleBase = modulePath === 'mge' ? baseUrl : baseUrl.replace(/\/mge$/, `/${modulePath}`);
  const query = new URLSearchParams({ serviceName, outputType: 'json', mgeSession: sessionId });
  const response = await fetch(`${moduleBase}/service.sbr?${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `JSESSIONID=${sessionId}`
    },
    body: JSON.stringify({ serviceName, requestBody })
  });
  const payload = await lerRespostaJsonCompat(response);
  if (!response.ok || payload.status === '0' || payload.status === '3') {
    const message = payload.statusMessage || `HTTP ${response.status}`;
    if (!options.__retried && isDirectSessionError(message, response.status)) {
      await invalidateDirectSession(sessionId, { logout: true });
      return executeDirectService(serviceName, requestBody, {
        ...options,
        __retried: true
      });
    }
    throw new Error(`Falha ao executar servico ${serviceName}: ${message}`);
  }
  if (directSessionId === sessionId) {
    directSessionLastUsedAt = Date.now();
  }
  return payload;
}

async function downloadDirectFile(modulePath, resourcePath, params = {}) {
  const config = getConfig();
  const baseUrl = getDirectBaseUrl(config);
  const sessionId = await loginDirectSession();
  const moduleBase = modulePath === 'mge' ? baseUrl : baseUrl.replace(/\/mge$/, `/${modulePath}`);
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')),
    mgeSession: sessionId
  });
  const response = await fetch(`${moduleBase}/${resourcePath}?${query}`, {
    headers: { Cookie: `JSESSIONID=${sessionId}` }
  });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')).slice(0, 500);
    if (response.status === 401 || response.status === 403) directSessionId = null;
    throw new Error(`Falha ao baixar arquivo direto do Sankhya: ${message || `HTTP ${response.status}`}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/pdf'
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

function numeroConfigurado(nome, fallback) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor >= 0 ? valor : fallback;
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tempoEsperaRateLimit(response, tentativa) {
  const retryAfter = response?.headers?.get?.('retry-after');
  const segundos = Number(retryAfter);
  if (retryAfter !== null && retryAfter !== undefined && retryAfter !== '' && Number.isFinite(segundos) && segundos >= 0) {
    return Math.min(segundos * 1000, numeroConfigurado('SANKHYA_AUTH_RETRY_MAX_MS', DEFAULT_AUTH_RETRY_MAX_MS));
  }

  const base = numeroConfigurado('SANKHYA_AUTH_RETRY_BASE_MS', DEFAULT_AUTH_RETRY_BASE_MS);
  const maximo = numeroConfigurado('SANKHYA_AUTH_RETRY_MAX_MS', DEFAULT_AUTH_RETRY_MAX_MS);
  return Math.min(base * (2 ** tentativa), maximo);
}

function enfileirarAutenticacaoOAuth(tarefa) {
  const execucao = oauthAuthenticationQueue.then(tarefa, tarefa);
  oauthAuthenticationQueue = execucao.catch(() => {});
  return execucao;
}

async function solicitarAccessToken(config) {
  const limiteTentativas = numeroConfigurado('SANKHYA_AUTH_RETRY_LIMIT', DEFAULT_AUTH_RETRY_LIMIT);

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret
  });

  for (let tentativa = 0; tentativa <= limiteTentativas; tentativa += 1) {
    const response = await fetch(`${config.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': config.integrationToken
      },
      body: params
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const accessToken = extractAccessToken(payload);
      if (!accessToken) {
        throw new Error('Falha ao autenticar na Sankhya API: token de acesso nao retornado');
      }
      return accessToken;
    }

    if (response.status !== 429 || tentativa >= limiteTentativas) {
      if (response.status === 429) {
        throw new Error('A Sankhya limitou temporariamente as autenticacoes. Aguarde alguns instantes e tente novamente.');
      }
      throw new Error(`Falha ao autenticar na Sankhya API: HTTP ${response.status}`);
    }

    await aguardar(tempoEsperaRateLimit(response, tentativa));
  }
  throw new Error('Falha ao autenticar na Sankhya API.');
}

async function authenticate(options = {}) {
  const config = getConfig();
  assertConfig(config);
  const escopoLogin = options.scope === 'login';
  const tokenAtual = escopoLogin ? cachedLoginAccessToken : cachedAccessToken;
  const expiraEm = escopoLogin ? cachedLoginAccessTokenExpiresAt : cachedAccessTokenExpiresAt;

  if (!options.forceNew && tokenAtual && Date.now() < expiraEm - 60000) {
    return tokenAtual;
  }

  const promessaAtual = escopoLogin ? loginAccessTokenPromise : accessTokenPromise;
  if (!options.forceNew && promessaAtual) return promessaAtual;

  const autenticacao = enfileirarAutenticacaoOAuth(() => solicitarAccessToken(config));
  if (escopoLogin) loginAccessTokenPromise = autenticacao;
  else accessTokenPromise = autenticacao;

  try {
    const accessToken = await autenticacao;
    const expiresAt = getJwtExpiration(accessToken) || Date.now() + 25 * 60 * 1000;

    if (!options.skipCache) {
      if (escopoLogin) {
        cachedLoginAccessToken = accessToken;
        cachedLoginAccessTokenExpiresAt = expiresAt;
      } else {
        const previousAccessToken = cachedAccessToken;
        cachedAccessToken = accessToken;
        cachedAccessTokenExpiresAt = expiresAt;

        if (previousAccessToken && previousAccessToken !== accessToken) {
          await logoutAccessSession(previousAccessToken, config);
        }
      }
    }
    return accessToken;
  } finally {
    if (escopoLogin && loginAccessTokenPromise === autenticacao) loginAccessTokenPromise = null;
    if (!escopoLogin && accessTokenPromise === autenticacao) accessTokenPromise = null;
  }
}

function mensagemErroRest(payload, fallback) {
  return payload?.error?.details
    || payload?.error?.message
    || payload?.message
    || payload?.mensagem
    || fallback;
}

async function executeRest(method, resourcePath, options = {}) {
  const config = getConfig();
  const accessToken = await authenticate({ forceNew: Boolean(options.__retryAuth) });
  const path = String(resourcePath || '').replace(/^\/+/, '');
  const url = `${config.baseUrl}/${path}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
  };
  const response = await fetch(url, {
    method: String(method || 'GET').toUpperCase(),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { mensagem: raw.slice(0, 1000) };
    }
  }

  if (!response.ok) {
    if (!options.__retryAuth && (response.status === 401 || response.status === 403)) {
      cachedAccessToken = null;
      cachedAccessTokenExpiresAt = 0;
      return executeRest(method, resourcePath, { ...options, __retryAuth: true });
    }

    const message = mensagemErroRest(payload, `HTTP ${response.status}`);
    const error = new Error(`Falha na API REST Sankhya: ${message}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
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

  if (accessSessionToken === accessToken) {
    return;
  }

  if (accessSessionPromise && accessSessionPromiseToken === accessToken) {
    await accessSessionPromise;
    return;
  }

  accessSessionPromiseToken = accessToken;
  accessSessionPromise = loginAccessSession(accessToken, config, options);

  try {
    await accessSessionPromise;
  } finally {
    accessSessionPromise = null;
    accessSessionPromiseToken = null;
  }
}

async function logoutAccessSession(accessToken, config) {
  if (!accessToken) return;

  const url = `${config.baseUrl}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout&outputType=json`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'appkey': config.clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceName: 'MobileLoginSP.logout',
      status: '1',
      pendingPrinting: 'false',
      requestBody: {}
    })
  }).catch(() => {});
}

async function loginAccessSession(accessToken, config, options = {}) {
  const previousSessionToken = accessSessionToken;

  if (previousSessionToken && previousSessionToken !== accessToken) {
    await logoutAccessSession(previousSessionToken, config);
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

function isSessionError(message) {
  return /sess[aã]o|session|login|autentic|expirad|inativ/i.test(String(message || ''));
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

  // O DbExplorer tambem esta disponivel no OM. Preferir a sessao tecnica
  // direta evita solicitar tokens OAuth apenas para carregar telas e
  // permissoes, o que pode bloquear todos os usuarios quando o gateway
  // aplica rate limit (HTTP 429).
  if (getDirectBaseUrl(config)) {
    const payload = await executeDirectService('DbExplorerSP.executeQuery', { sql });
    return normalizeQueryRows(payload);
  }

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
    scope: options.authScope,
    forceNew: Boolean(options.isolatedSession),
    skipCache: Boolean(options.isolatedSession)
  });
  if (!options.skipAccessSession) {
    await ensureAccessSession(accessToken, config, {
      required: Boolean(options.forceAccessSession)
    });
  }
  const modulePath = options.modulePath || 'mge';
  const url = `${config.baseUrl}/gateway/v1/${modulePath}/service.sbr?serviceName=${encodeURIComponent(serviceName)}&outputType=json`;

  try {
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
      if (!options.__retriedAccessSession && !options.skipAccessSession && isSessionError(message)) {
        accessSessionToken = null;
        await ensureAccessSession(accessToken, config, {
          force: true,
          required: Boolean(options.forceAccessSession)
        });
        return executeService(serviceName, requestBody, {
          ...options,
          __retriedAccessSession: true
        });
      }
      throw new Error(`Falha ao executar servico ${serviceName}: ${message}`);
    }

    return payload;
  } finally {
    if (options.logoutAfterService) {
      await logoutAccessSession(accessToken, config);
    }
  }
}

async function downloadGatewayFile(modulePath, resourcePath, params = {}) {
  const config = getConfig();
  const accessToken = await authenticate();
  await ensureAccessSession(accessToken, config, { required: true });
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
  const url = `${config.baseUrl}/gateway/v1/${modulePath}/${resourcePath}?${query.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const message = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`Falha ao baixar arquivo Sankhya: ${message || `HTTP ${response.status}`}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/pdf'
  };
}

module.exports = {
  clearAuthCache,
  downloadDirectFile,
  downloadGatewayFile,
  executeDirectService,
  executeRest,
  executeService,
  executeUserLogin,
  executeQuery,
  normalizeQueryRows,
  _internals: {
    isDirectSessionError,
    lerRespostaJsonCompat,
    pontuarTextoCorrompido
  }
};
