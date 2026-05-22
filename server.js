require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const routes = require('./routes');
const {
  cookieLogout,
  cookieSessao,
  exigirAutenticacao,
  lerSessao,
  serializarSessao,
  validarUsuarioSankhya
} = require('./api/auth');

const app = express();

app.use(express.json());

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

app.get('/api/auth/me', (req, res) => {
  const usuario = lerSessao(req);
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
