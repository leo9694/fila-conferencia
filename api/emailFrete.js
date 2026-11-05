const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const hostPadrao = 'smtp.hostinger.com';
const hosts = [hostPadrao, 'smtp.titan.email'];
let envioTesteEmAndamento = false;
let proximoEnvioTeste = 0;

function falha(code) {
  return Object.assign(new Error(code), { code });
}

function enderecoValido(valor) {
  return typeof valor === 'string' && valor.length <= 254 && valor === valor.trim() &&
    /^[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(valor);
}

function namespaceEmailFrete() {
  const base = [process.env.SANKHYA_API_BASE_URL, process.env.SANKHYA_OM_BASE_URL, process.env.SANKHYA_CLIENT_ID];
  return crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex').slice(0, 16);
}

function arquivoConfiguracao() {
  return path.join(process.cwd(), 'data', `email-frete-${namespaceEmailFrete()}.json`);
}

function chaveConfiguracao() {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32 || segredo === 'troque-por-uma-chave-grande-e-aleatoria') {
    throw falha('FRETE_SMTP_CHAVE_AUSENTE');
  }
  return crypto.createHmac('sha256', segredo).update('fila-conferencia/email-frete/v1').digest();
}

async function lerConfiguracao() {
  const arquivo = arquivoConfiguracao();
  const texto = await fs.readFile(arquivo, 'utf8').catch((erro) => {
    if (erro.code === 'ENOENT') return null;
    throw erro;
  });
  if (texto !== null) {
    const chave = chaveConfiguracao();
    try {
      const { iv, tag, dados } = JSON.parse(texto);
      const decifrador = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64'));
      decifrador.setAuthTag(Buffer.from(tag, 'base64'));
      return JSON.parse(Buffer.concat([decifrador.update(Buffer.from(dados, 'base64')), decifrador.final()]));
    } catch {
      throw falha('FRETE_SMTP_CONFIG_ILEGIVEL');
    }
  }
  return {
    host: (process.env.FRETE_SMTP_HOST || hostPadrao).trim().toLowerCase(),
    port: Number(process.env.FRETE_SMTP_PORT || 465),
    user: process.env.FRETE_SMTP_USER?.trim() || '',
    pass: process.env.FRETE_SMTP_PASSWORD || ''
  };
}

function resumoConfiguracao({ host, port, user, pass }) {
  return { host, port, user, configurado: Boolean(user && pass) };
}

async function obterConfiguracaoEmailFrete() {
  return resumoConfiguracao(await lerConfiguracao());
}

function criarTransporte({ host, port, user, pass }) {
  if (!user || !pass) {
    throw falha('FRETE_SMTP_NAO_CONFIGURADO');
  }
  if (!hosts.includes(host) || ![465, 587].includes(port) || !enderecoValido(user) ||
      typeof pass !== 'string' || pass.length > 512) {
    throw falha('FRETE_SMTP_CONFIG_INVALIDA');
  }

  const transporte = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    forceAuth: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
    disableFileAccess: true,
    disableUrlAccess: true
  });
  return transporte;
}

async function verificarConexaoEmailFrete() {
  await criarTransporte(await lerConfiguracao()).verify();
}

async function salvarConfiguracaoEmailFrete({ host, port, user, pass }) {
  if (!hosts.includes(host) || ![465, 587].includes(port) || !enderecoValido(user) ||
      typeof pass !== 'string' || !pass || pass.length > 512) {
    throw falha('FRETE_SMTP_CONFIG_INVALIDA');
  }
  const chave = chaveConfiguracao();
  const config = { host, port, user, pass };
  await criarTransporte(config).verify();

  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([cifrador.update(JSON.stringify(config), 'utf8'), cifrador.final()]);
  const registro = { iv: iv.toString('base64'), tag: cifrador.getAuthTag().toString('base64'), dados: dados.toString('base64') };
  const arquivo = arquivoConfiguracao();
  const temporario = `${arquivo}.${crypto.randomUUID()}.json`;
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  try {
    await fs.writeFile(temporario, JSON.stringify(registro), { mode: 0o600, flag: 'wx' });
    await fs.rename(temporario, arquivo);
  } finally {
    await fs.rm(temporario, { force: true });
  }
  return resumoConfiguracao(config);
}

async function enviarEmailFrete({ to, subject, text, html, messageId, attachments }) {
  const config = await lerConfiguracao();
  return criarTransporte(config).sendMail({ from: config.user, to, subject, text, html, messageId, attachments });
}

async function enviarTesteEmailFrete(to) {
  if (!enderecoValido(to)) throw falha('FRETE_SMTP_DESTINATARIO_INVALIDO');
  if (envioTesteEmAndamento || Date.now() < proximoEnvioTeste) throw falha('FRETE_SMTP_LIMITE_TESTE');
  envioTesteEmAndamento = true;
  try {
    const resultado = await enviarEmailFrete({
      to,
      subject: 'Teste de conexão | Email frete',
      text: 'Esta é uma mensagem de teste da aba Email frete da Fila de Conferência.'
    });
    if (!resultado.accepted?.length) throw falha('FRETE_SMTP_DESTINATARIO_RECUSADO');
    proximoEnvioTeste = Date.now() + 10000;
  } finally {
    envioTesteEmAndamento = false;
  }
}

module.exports = {
  enderecoValido, namespaceEmailFrete, obterConfiguracaoEmailFrete, salvarConfiguracaoEmailFrete,
  verificarConexaoEmailFrete, enviarEmailFrete, enviarTesteEmailFrete
};
