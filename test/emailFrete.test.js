const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodemailer = require('nodemailer');
const {
  obterConfiguracaoEmailFrete, salvarConfiguracaoEmailFrete, verificarConexaoEmailFrete,
  enviarEmailFrete, enviarTesteEmailFrete
} = require('../api/emailFrete');

function configurarEnv(t, valores = {}) {
  const anterior = process.env;
  const ambiente = { ...anterior };
  for (const chave of ['HOST', 'PORT', 'USER', 'PASSWORD']) delete ambiente[`FRETE_SMTP_${chave}`];
  process.env = { ...ambiente, ...valores };
  const pastaAnterior = process.cwd();
  const pastaTeste = fs.mkdtempSync(path.join(os.tmpdir(), 'email-frete-teste-'));
  const dados = path.join(pastaTeste, 'data');
  fs.mkdirSync(dados);
  process.chdir(pastaTeste);
  t.after(() => {
    process.env = anterior;
    process.chdir(pastaAnterior);
    for (const arquivo of fs.readdirSync(dados)) fs.unlinkSync(path.join(dados, arquivo));
    fs.rmdirSync(dados);
    fs.rmdirSync(pastaTeste);
  });
}

const caixa = {
  FRETE_SMTP_USER: 'frete@example.com',
  FRETE_SMTP_PASSWORD: 'senha-ficticia'
};

test('não inicia uma conexão SMTP sem credenciais ou com servidor não autorizado', async (t) => {
  configurarEnv(t);
  const criarTransporte = t.mock.method(nodemailer, 'createTransport');
  await assert.rejects(verificarConexaoEmailFrete(), { code: 'FRETE_SMTP_NAO_CONFIGURADO' });
  Object.assign(process.env, caixa, { FRETE_SMTP_HOST: 'smtp.example.com' });
  await assert.rejects(verificarConexaoEmailFrete(), { code: 'FRETE_SMTP_CONFIG_INVALIDA' });
  assert.equal(criarTransporte.mock.callCount(), 0);
});

test('verifica a autenticação da Hostinger com TLS na porta 465 sem enviar e-mail', async (t) => {
  configurarEnv(t, caixa);
  const verify = t.mock.fn(async () => true);
  const sendMail = t.mock.fn();
  const criarTransporte = t.mock.method(nodemailer, 'createTransport', () => ({ verify, sendMail }));
  await verificarConexaoEmailFrete();
  const [opcoes] = criarTransporte.mock.calls[0].arguments;
  assert.equal(opcoes.host, 'smtp.hostinger.com');
  assert.equal(opcoes.port, 465);
  assert.equal(opcoes.secure, true);
  assert.equal(opcoes.forceAuth, true);
  assert.deepEqual(opcoes.auth, { user: caixa.FRETE_SMTP_USER, pass: caixa.FRETE_SMTP_PASSWORD });
  assert.equal(verify.mock.callCount(), 1);
  assert.equal(sendMail.mock.callCount(), 0);
});

test('exige STARTTLS na porta 587 e usa a caixa autenticada como remetente no envio interno', async (t) => {
  configurarEnv(t, { ...caixa, FRETE_SMTP_HOST: 'smtp.titan.email', FRETE_SMTP_PORT: '587' });
  const sendMail = t.mock.fn(async () => ({ messageId: 'teste' }));
  const criarTransporte = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail }));
  const attachments = [{ filename: 'DANFE.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }];
  const mensagem = { to: 'destino@example.com', subject: 'Frete', text: 'Detalhes do frete', attachments };
  assert.deepEqual(await enviarEmailFrete({ ...mensagem, from: 'outro@example.com' }), { messageId: 'teste' });
  const [opcoes] = criarTransporte.mock.calls[0].arguments;
  assert.equal(opcoes.host, 'smtp.titan.email');
  assert.equal(opcoes.port, 587);
  assert.equal(opcoes.secure, false);
  assert.equal(opcoes.requireTLS, true);
  const [envio] = sendMail.mock.calls[0].arguments;
  assert.equal(envio.from, caixa.FRETE_SMTP_USER);
  assert.equal(envio.to, mensagem.to);
  assert.equal(envio.subject, mensagem.subject);
  assert.equal(envio.text, mensagem.text);
  assert.deepEqual(envio.attachments, attachments);
});

test('salva a caixa autenticada criptografada e preserva a configuração se a troca falhar', async (t) => {
  configurarEnv(t, { ...caixa, SESSION_SECRET: 'chave-ficticia-de-teste-com-mais-de-32-caracteres' });
  const verify = t.mock.fn(async () => true);
  const criarTransporte = t.mock.method(nodemailer, 'createTransport', () => ({ verify }));
  const config = { host: 'smtp.titan.email', port: 587, user: 'novo@example.com', pass: 'outra-senha-ficticia' };
  const esperado = { host: config.host, port: config.port, user: config.user, configurado: true };
  assert.deepEqual(await salvarConfiguracaoEmailFrete(config), esperado);
  assert.deepEqual(await obterConfiguracaoEmailFrete(), esperado);
  const [arquivo] = fs.readdirSync('data');
  const registro = fs.readFileSync(path.join('data', arquivo), 'utf8');
  assert.equal(registro.includes(config.pass), false);
  assert.equal(registro.includes(config.user), false);
  await verificarConexaoEmailFrete();
  assert.deepEqual(criarTransporte.mock.calls[1].arguments[0].auth, { user: config.user, pass: config.pass });
  verify.mock.mockImplementationOnce(async () => { throw Object.assign(new Error('Falha simulada'), { code: 'EAUTH' }); });
  await assert.rejects(salvarConfiguracaoEmailFrete({ ...config, user: 'outro@example.com' }), { code: 'EAUTH' });
  assert.deepEqual(await obterConfiguracaoEmailFrete(), esperado);
});

test('envia um teste de conteúdo fixo para um único endereço e limita envios repetidos', async (t) => {
  configurarEnv(t, caixa);
  const sendMail = t.mock.fn(async () => ({ accepted: ['destino@example.com'] }));
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail }));
  await assert.rejects(enviarTesteEmailFrete('destino@example.com, outro@example.com'), { code: 'FRETE_SMTP_DESTINATARIO_INVALIDO' });
  await assert.rejects(enviarTesteEmailFrete('destino@example.com\r\nBcc: outro@example.com'), { code: 'FRETE_SMTP_DESTINATARIO_INVALIDO' });
  await enviarTesteEmailFrete('destino@example.com');
  const [envio] = sendMail.mock.calls[0].arguments;
  assert.equal(envio.from, caixa.FRETE_SMTP_USER);
  assert.equal(envio.to, 'destino@example.com');
  assert.match(envio.subject, /Teste de conexão/);
  await assert.rejects(enviarTesteEmailFrete('destino@example.com'), { code: 'FRETE_SMTP_LIMITE_TESTE' });
  assert.equal(sendMail.mock.callCount(), 1);
});
