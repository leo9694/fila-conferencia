require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const routes = require('./routes');
const {
  cookieLogout,
  cookieSessao,
  enriquecerUsuarioComPermissoes,
  exigirAutenticacao,
  lerSessao,
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

app.use(express.static(path.join(__dirname, 'frontend')));

app.post('/api/auth/login', async (req, res) => {
  try {
    const usuario = await validarUsuarioSankhya(req.body?.usuario, req.body?.senha);
    res.setHeader('Set-Cookie', cookieSessao(serializarSessao(usuario)));
    res.json({ ok: true, usuario });
  } catch (err) {
    res.status(401).json({ erro: err.message || 'Usuario ou senha invalidos' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookieLogout());
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

app.use('/api', exigirAutenticacao, routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
