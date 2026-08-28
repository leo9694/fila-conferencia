const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DURATION_MS = Math.max(
  1,
  Number(process.env.CHAT_CONTINGENCY_DURATION_DAYS) || 7
) * 24 * 60 * 60 * 1000;

function normalizarLogin(valor) {
  return String(valor || '').trim().toLocaleUpperCase('pt-BR');
}

function usuarioSeguro(usuario = {}) {
  return {
    codUsu: Number(usuario.codUsu),
    nome: String(usuario.nome || '').trim(),
    grupos: Array.isArray(usuario.grupos) ? usuario.grupos.map(String) : [],
    gruposConfirmados: usuario.gruposConfirmados === true,
    chatAcessoCentral: usuario.chatAcessoCentral === true
  };
}

function criarChatContingencyStore(options = {}) {
  const filePath = options.filePath || path.join(options.baseDir || path.join(process.cwd(), 'data'), 'chat-contingency-users.json');
  const durationMs = Number(options.durationMs) > 0 ? Number(options.durationMs) : DEFAULT_DURATION_MS;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let state = { usuarios: {} };
  if (fs.existsSync(filePath)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (loaded?.usuarios && typeof loaded.usuarios === 'object') state = { usuarios: loaded.usuarios };
    } catch (error) {
      console.error('Falha ao carregar credenciais de contingência do Chat:', error.message);
    }
  }

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporario, filePath);
  }

  function salvar(loginInformado, senha, usuario) {
    const login = normalizarLogin(loginInformado);
    const segredo = String(senha || '');
    if (!login || !segredo || !Number.isInteger(Number(usuario?.codUsu))) {
      throw new TypeError('Credencial de contingência inválida.');
    }
    const salt = crypto.randomBytes(16).toString('base64url');
    state.usuarios[login] = {
      salt,
      senhaHash: crypto.scryptSync(segredo, salt, 32).toString('base64url'),
      usuario: usuarioSeguro(usuario),
      atualizadoEm: new Date(now()).toISOString(),
      exp: now() + durationMs
    };
    persistir();
    return usuarioSeguro(usuario);
  }

  function validar(loginInformado, senha) {
    const login = normalizarLogin(loginInformado);
    const registro = state.usuarios[login];
    if (!registro?.exp || now() > Number(registro.exp) || !registro.salt || !registro.senhaHash) return null;
    const esperado = Buffer.from(String(registro.senhaHash), 'base64url');
    const recebido = crypto.scryptSync(String(senha || ''), registro.salt, esperado.length);
    if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
    return usuarioSeguro(registro.usuario);
  }

  function remover(loginInformado) {
    const login = normalizarLogin(loginInformado);
    if (!login || !Object.prototype.hasOwnProperty.call(state.usuarios, login)) return false;
    delete state.usuarios[login];
    persistir();
    return true;
  }

  return { filePath, salvar, validar, remover };
}

module.exports = { criarChatContingencyStore, normalizarLogin, usuarioSeguro };
