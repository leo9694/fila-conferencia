const crypto = require('crypto');
const { executeQuery, executeUserLogin } = require('./sankhyaApi');

const SESSION_COOKIE = 'fila_conf_session';
const CONTINGENCY_COOKIE = 'fila_conf_chat_contingency';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const CONTINGENCY_DURATION_MS = Math.max(
  1,
  Number(process.env.CHAT_CONTINGENCY_DURATION_DAYS) || 7
) * 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || [
  process.env.SANKHYA_INTEGRATION_TOKEN,
  process.env.SANKHYA_CLIENT_ID,
  'fila-conferencia-session'
].filter(Boolean).join(':');

function campoApi(valor) {
  return { $: valor === null || valor === undefined ? '' : String(valor) };
}

function assinar(valor) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(valor).digest('base64url');
}

function assinaturaValida(payload, assinatura) {
  const esperada = Buffer.from(assinar(payload));
  const recebida = Buffer.from(String(assinatura || ''));
  return esperada.length === recebida.length && crypto.timingSafeEqual(esperada, recebida);
}

function serializarPayloadAssinado(dados) {
  const payload = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}

function lerPayloadAssinado(valor) {
  const [payload, assinatura] = String(valor || '').split('.');
  if (!payload || !assinatura || !assinaturaValida(payload, assinatura)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function serializarSessao(usuario) {
  return serializarPayloadAssinado({
    usuario,
    exp: Date.now() + SESSION_DURATION_MS
  });
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        const index = parte.indexOf('=');
        if (index === -1) return [parte, ''];
        return [parte.slice(0, index), decodeURIComponent(parte.slice(index + 1))];
      })
  );
}

function lerSessao(req) {
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!cookie) return null;
  const sessao = lerPayloadAssinado(cookie);
  if (!sessao?.exp || Date.now() > sessao.exp) return null;
  return sessao.usuario || null;
}

function usuarioParaContingencia(usuario = {}) {
  return {
    codUsu: Number(usuario.codUsu),
    nome: String(usuario.nome || '').trim(),
    grupos: Array.isArray(usuario.grupos) ? usuario.grupos : [],
    gruposConfirmados: usuario.gruposConfirmados === true,
    permissoes: {
      vendasGerais: false,
      transporte: false,
      relatorios: false
    }
  };
}

function serializarCredencialContingencia(usuario, nomeUsuario, senha) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const senhaHash = crypto.scryptSync(String(senha || ''), salt, 32).toString('base64url');
  return serializarPayloadAssinado({
    tipo: 'CHAT_CONTINGENCY',
    login: String(nomeUsuario || '').trim().toLocaleUpperCase('pt-BR'),
    senhaHash,
    salt,
    usuario: usuarioParaContingencia(usuario),
    exp: Date.now() + CONTINGENCY_DURATION_MS
  });
}

function validarCredencialContingencia(valor, nomeUsuario, senha, agora = Date.now()) {
  const credencial = lerPayloadAssinado(valor);
  if (credencial?.tipo !== 'CHAT_CONTINGENCY' || !credencial.exp || agora > credencial.exp) return null;
  const login = String(nomeUsuario || '').trim().toLocaleUpperCase('pt-BR');
  if (!login || login !== credencial.login || !credencial.salt || !credencial.senhaHash) return null;

  const esperado = Buffer.from(String(credencial.senhaHash), 'base64url');
  const recebido = crypto.scryptSync(String(senha || ''), credencial.salt, esperado.length);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  return {
    ...usuarioParaContingencia(credencial.usuario),
    modoContingencia: true,
    escopo: 'CHAT'
  };
}

function lerCredencialContingencia(req, nomeUsuario, senha) {
  const cookie = parseCookies(req.headers.cookie)[CONTINGENCY_COOKIE];
  return cookie ? validarCredencialContingencia(cookie, nomeUsuario, senha) : null;
}

function cookieSessao(valor) {
  const partes = [
    `${SESSION_COOKIE}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`
  ];

  if (process.env.NODE_ENV === 'production') {
    partes.push('Secure');
  }

  return partes.join('; ');
}

function cookieContingencia(valor) {
  const partes = [
    `${CONTINGENCY_COOKIE}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(CONTINGENCY_DURATION_MS / 1000)}`
  ];
  if (process.env.NODE_ENV === 'production') partes.push('Secure');
  return partes.join('; ');
}

function cookieLogout() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}


function cookieLogoutContingencia() {
  return `${CONTINGENCY_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sankhyaIndisponivel(error = {}) {
  const status = Number(error.status || error.statusCode || error.response?.status) || 0;
  if (status === 401 || status === 403) return false;
  if (status === 408 || status === 429 || status >= 500) return true;
  const codigo = String(error.code || error.cause?.code || '').toUpperCase();
  if (/^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT)$/.test(codigo)) return true;
  const mensagem = String(error.message || '').toLocaleLowerCase('pt-BR');
  return /fetch failed|tempo.*esgotado|timeout|timed out|socket hang up|network|connection refused|service unavailable|bad gateway|gateway timeout|indispon.vel|http 429|http 5\d\d/.test(mensagem);
}

function extrairIdUsuarioLogin(payload) {
  const idBase64 = payload?.responseBody?.idusu?.$ || payload?.responseBody?.idUsu?.$;
  if (!idBase64) return null;

  try {
    const texto = Buffer.from(String(idBase64).trim(), 'base64').toString('utf8').trim();
    const numero = Number(texto);
    return Number.isInteger(numero) && numero >= 0 ? numero : null;
  } catch {
    return null;
  }
}

function lerCampoResposta(payload, nomes) {
  const responseBody = payload?.responseBody || {};

  for (const nome of nomes) {
    const valor = responseBody[nome]?.$ ?? responseBody[nome];
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
      return String(valor).trim();
    }
  }

  return null;
}

function montarPermissoesGrupos(grupos = []) {
  const normalizados = new Set(
    grupos.map((grupo) => String(grupo || '').trim().toLocaleUpperCase('pt-BR')).filter(Boolean)
  );
  return {
    vendasGerais: normalizados.has('GERENTE') || normalizados.has('DIRETORIA'),
    transporte: normalizados.has('GERENTE') || normalizados.has('DIRETORIA'),
    relatorios: normalizados.has('DIRETORIA')
  };
}

async function enriquecerUsuarioComPermissoes(usuario, executarConsulta = executeQuery) {
  const codUsu = Number(usuario?.codUsu);
  if (!Number.isInteger(codUsu) || codUsu < 0) return usuario;

  const rows = await executarConsulta(`
    SELECT DISTINCT TRIM(GRU.NOMEGRUPO) AS NOMEGRUPO
    FROM TSIUSU USU
    INNER JOIN TSIGRU GRU ON GRU.CODGRUPO = USU.CODGRUPO
    WHERE USU.CODUSU = ${codUsu}
      AND GRU.NOMEGRUPO IS NOT NULL
  `);
  const grupos = rows.map((row) => String(row.NOMEGRUPO || '').trim()).filter(Boolean);
  return {
    ...usuario,
    grupos,
    gruposConfirmados: true,
    permissoes: montarPermissoesGrupos(grupos)
  };
}

async function validarUsuarioSankhya(usuario, senha) {
  const nomeUsuario = String(usuario || '').trim();
  const senhaUsuario = String(senha || '');

  if (!nomeUsuario || !senhaUsuario) {
    throw new Error('Informe usuario e senha');
  }

  const loginPayload = await executeUserLogin({
    NOMUSU: campoApi(nomeUsuario.toUpperCase()),
    INTERNO: campoApi(senhaUsuario),
    KEEPCONNECTED: campoApi('N')
  });

  const codUsuLogin = extrairIdUsuarioLogin(loginPayload);

  if (codUsuLogin === null) {
    throw new Error('Usuario autenticado, mas o Sankhya nao retornou o codigo do usuario');
  }

  const nomeRetornado = lerCampoResposta(loginPayload, [
    'nomeusu',
    'NOMEUSU',
    'nomusu',
    'NOMUSU',
    'nomeUsuario',
    'NOMEUSUARIO'
  ]);

  const usuarioAutenticado = {
    codUsu: codUsuLogin,
    nome: nomeRetornado || nomeUsuario.toUpperCase()
  };
  try {
    return await enriquecerUsuarioComPermissoes(usuarioAutenticado);
  } catch (error) {
    console.error('Usuario autenticado, mas nao foi possivel carregar os grupos do Sankhya:', error.message);
    return { ...usuarioAutenticado, gruposConfirmados: false };
  }
}

function exigirAutenticacao(req, res, next) {
  const usuario = lerSessao(req);
  if (!usuario) {
    res.setHeader('X-App-Auth-Required', '1');
    res.status(401).json({ erro: 'Login necessario' });
    return;
  }

  req.usuario = usuario;
  next();
}

function exigirAcessoSankhya(req, res, next) {
  if (req.usuario?.modoContingencia === true || req.usuario?.escopo === 'CHAT') {
    res.status(503).json({
      erro: 'Sankhya indisponível. No modo de contingência, somente o Chat permanece acessível.'
    });
    return;
  }
  next();
}

module.exports = {
  SESSION_COOKIE,
  CONTINGENCY_COOKIE,
  cookieContingencia,
  cookieLogout,
  cookieLogoutContingencia,
  cookieSessao,
  exigirAcessoSankhya,
  exigirAutenticacao,
  enriquecerUsuarioComPermissoes,
  lerSessao,
  lerCredencialContingencia,
  montarPermissoesGrupos,
  sankhyaIndisponivel,
  serializarCredencialContingencia,
  serializarSessao,
  validarCredencialContingencia,
  validarUsuarioSankhya
};
