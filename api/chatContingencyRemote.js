const DEFAULT_TIMEOUT_MS = 8000;

function normalizarBaseUrl(valor) {
  const informado = String(valor || '').trim();
  if (!informado) return '';
  const url = new URL(informado);
  const hostLocal = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(hostLocal && url.protocol === 'http:')) {
    throw new Error('O servidor central de contingência deve usar HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
}

async function autenticarContingenciaRemota(login, senha, options = {}) {
  const baseUrl = normalizarBaseUrl(options.baseUrl ?? process.env.CHAT_CONTINGENCY_SERVER_URL);
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = options.fetchImpl || fetch;
    const response = await fetchImpl(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Chat-Contingency-Hop': '1'
      },
      body: JSON.stringify({ usuario: login, senha }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.erro || 'Falha ao validar a credencial no servidor central.');
      error.status = response.status;
      throw error;
    }
    if (payload.chatPermitido !== true || !payload.usuario) {
      const error = new Error('Usuário sem acesso ao Chat no servidor central.');
      error.status = 403;
      throw error;
    }
    return payload.usuario;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { autenticarContingenciaRemota, normalizarBaseUrl };
