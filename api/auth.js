const crypto = require('crypto');
const { executeQuery, executeService } = require('./sankhyaApi');

const SESSION_COOKIE = 'fila_conf_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
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

function serializarSessao(usuario) {
  const payload = Buffer.from(JSON.stringify({
    usuario,
    exp: Date.now() + SESSION_DURATION_MS
  })).toString('base64url');

  return `${payload}.${assinar(payload)}`;
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

  const [payload, assinatura] = String(cookie).split('.');
  if (!payload || !assinatura || assinatura !== assinar(payload)) return null;

  try {
    const sessao = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!sessao.exp || Date.now() > sessao.exp) return null;
    return sessao.usuario || null;
  } catch {
    return null;
  }
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

function cookieLogout() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function escaparSql(valor) {
  return String(valor || '').replace(/'/g, "''");
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

async function validarUsuarioSankhya(usuario, senha) {
  const nomeUsuario = String(usuario || '').trim();
  const senhaUsuario = String(senha || '');

  if (!nomeUsuario || !senhaUsuario) {
    throw new Error('Informe usuario e senha');
  }

  const loginPayload = await executeService('MobileLoginSP.login', {
    NOMUSU: campoApi(nomeUsuario.toUpperCase()),
    INTERNO: campoApi(senhaUsuario),
    KEEPCONNECTED: campoApi('N')
  });

  const codUsuLogin = extrairIdUsuarioLogin(loginPayload);
  const filtroUsuario = codUsuLogin !== null
    ? `CODUSU = ${codUsuLogin}`
    : `UPPER(NOMEUSU) = '${escaparSql(nomeUsuario.toUpperCase())}'`;

  const [usuarioRow] = await executeQuery(`
    SELECT CODUSU, NOMEUSU
    FROM TSIUSU
    WHERE ${filtroUsuario}
  `);

  if (!usuarioRow) {
    throw new Error('Usuario autenticado, mas cadastro nao foi localizado no Sankhya');
  }

  return {
    codUsu: Number(usuarioRow.CODUSU),
    nome: usuarioRow.NOMEUSU || nomeUsuario
  };
}

function exigirAutenticacao(req, res, next) {
  const usuario = lerSessao(req);
  if (!usuario) {
    res.status(401).json({ erro: 'Login necessario' });
    return;
  }

  req.usuario = usuario;
  next();
}

module.exports = {
  SESSION_COOKIE,
  cookieLogout,
  cookieSessao,
  exigirAutenticacao,
  lerSessao,
  serializarSessao,
  validarUsuarioSankhya
};
