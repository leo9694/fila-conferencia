const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('prévia da conferência não exibe nem solicita estimativa de frete', () => {
  const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
  assert.doesNotMatch(html, /id="pedido-preview-frete-estimado"|<h3>Frete aproximado<\/h3>/);
  assert.doesNotMatch(js, /carregarEstimativaFretePedido\(pedido\);/);
  assert.match(html, /id="pedido-preview-documentos"/);
  assert.match(html, /id="pedido-preview-itens-lista"/);
});
