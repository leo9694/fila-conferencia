require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const routes = require('./routes');
const chatRouter = require('./api/chatRouter');
const {
  cookieContingencia,
  cookieLogout,
  cookieLogoutContingencia,
  cookieSessao,
  enriquecerUsuarioComPermissoes,
  exigirAcessoSankhya,
  exigirAutenticacao,
  lerCredencialContingencia,
  lerSessao,
  sankhyaIndisponivel,
  serializarCredencialContingencia,
  serializarSessao,
  validarUsuarioSankhya
} = require('./api/auth');

const app = express();

// Conferencias grandes enviam o progresso completo para manter leituras e lotes
// consistentes entre dispositivos. O limite padrao do Express (100 KB) descartava
// silenciosamente notas extensas antes de a rota conseguir persistir o progresso.
// Mantemos um limite finito para proteger a API de cargas indevidas.
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const origem = req.headers.origin;
  if (!origem) {
    next();
    return;
  }

  try {
    const origemUrl = new URL(origem);
    if (origemUrl.host !== req.headers.host) {
      res.status(403).json({ erro: 'Origem nao autorizada' });
      return;
    }
  } catch {
    res.status(403).json({ erro: 'Origem nao autorizada' });
    return;
  }

  next();
});

app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));
app.use(express.static(path.join(__dirname, 'frontend')));

app.post('/api/auth/login', async (req, res) => {
  try {
    const usuario = await validarUsuarioSankhya(req.body?.usuario, req.body?.senha);
    const cookies = [cookieSessao(serializarSessao(usuario))];
    if (chatRouter._internals?.acessoPermitido(usuario)) {
      cookies.push(cookieContingencia(serializarCredencialContingencia(
        usuario,
        req.body?.usuario,
        req.body?.senha
      )));
    } else {
      cookies.push(cookieLogoutContingencia());
    }
    res.setHeader('Set-Cookie', cookies);
    res.json({ ok: true, usuario });
  } catch (err) {
    if (sankhyaIndisponivel(err)) {
      const usuario = lerCredencialContingencia(req, req.body?.usuario, req.body?.senha);
      if (usuario && chatRouter._internals?.acessoPermitido(usuario)) {
        res.setHeader('Set-Cookie', cookieSessao(serializarSessao(usuario)));
        res.json({
          ok: true,
          contingencia: true,
          usuario,
          aviso: 'Sankhya indisponível. Acesso liberado somente ao Chat.'
        });
        return;
      }
      res.status(503).json({
        erro: 'O Sankhya está indisponível e este navegador não possui um acesso de contingência válido para o Chat.'
      });
      return;
    }
    res.status(401).json({ erro: err.message || 'Usuario ou senha invalidos' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', [cookieLogout(), cookieLogoutContingencia()]);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  let usuario = lerSessao(req);
  if (usuario && usuario.gruposConfirmados !== true) {
    try {
      usuario = await enriquecerUsuarioComPermissoes(usuario);
      res.setHeader('Set-Cookie', cookieSessao(serializarSessao(usuario)));
    } catch (error) {
      console.error('Nao foi possivel atualizar as permissoes da sessao existente:', error.message);
    }
  }
  res.json({ autenticado: Boolean(usuario), usuario });
});

app.use('/api/chat', exigirAutenticacao, chatRouter);
app.use('/api', exigirAutenticacao, exigirAcessoSankhya, routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});

// Mantém o processo ligado ao terminal durante o desenvolvimento. No Windows,
// isso também garante que o Ctrl+C seja entregue ao processo Node iniciado pelo npm.
if (process.stdin.isTTY) process.stdin.resume();

let encerrando = false;
function encerrar(signal) {
  if (encerrando) return;
  encerrando = true;
  console.log(`\n${signal} recebido. Encerrando a API...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGINT', () => encerrar('Ctrl+C'));
process.once('SIGTERM', () => encerrar('SIGTERM'));
