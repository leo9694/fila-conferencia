const express = require('express');
const { criarDiarioBordo, usuarioDiretoria } = require('./diarioBordo');
const { criarDiarioBordoCadastros } = require('./diarioBordoCadastros');
const router = express.Router();
const diario = criarDiarioBordo();
const cadastros = criarDiarioBordoCadastros();

async function executar(res, operacao) {
  try { res.json(await operacao()); } catch (error) {
    if (!error.status) console.error('Falha no diário de bordo:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível acessar o diário de bordo. Tente novamente.' });
  }
}
router.get('/diario-bordo', (req, res) => executar(res, () => diario.listar()));
router.get('/diario-bordo/permissoes', (req, res) => res.json({ podeExcluir: usuarioDiretoria(req.usuario) }));
router.delete('/diario-bordo/:id', (req, res) => executar(res, () => diario.remover(req.params.id, req.usuario)));
router.get('/diario-bordo/cadastros', (req, res) => executar(res, () => cadastros.listar()));
router.get('/diario-bordo/usuarios', (req, res) => executar(res, () => cadastros.consultarUsuarios(req.query.busca)));
router.post('/diario-bordo/cadastros/:tipo', (req, res) => executar(res, () => cadastros.adicionar(req.params.tipo, req.body || {}, req.usuario)));
router.delete('/diario-bordo/cadastros/:tipo/:id', (req, res) => executar(res, () => cadastros.remover(req.params.tipo, req.params.id, req.usuario)));
router.post('/diario-bordo', (req, res) => executar(res, () => diario.sair(cadastros.resolverSaida(req.body || {}), req.usuario)));
router.post('/diario-bordo/:id/devolucao', (req, res) => executar(res, () => diario.devolver(req.params.id, req.body || {}, req.usuario)));
module.exports = router;
