const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');

function contexto(format = 'IMAGE', examples = ['https://example.com/media.jpg']) {
  const input = { value: '' };
  const ctx = vm.createContext({ URL,
    escapeHtml: (v) => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    state: { selectedTemplate: { header: { format, examples } } },
    refs: { templateConfig: { querySelector: () => input } }
  });
  vm.runInContext(source.slice(source.indexOf('  function safeTemplateMediaLink('), source.indexOf('  function templatePlaceholders(')), ctx);
  return { ctx, input };
}

test('imagem cadastrada no modelo é incluída automaticamente no cabeçalho do envio', () => {
  const { ctx } = contexto();
  const header = ctx.selectedTemplateMediaComponent();
  assert.equal(header.type, 'header');
  assert.equal(header.parameters[0].type, 'image');
  assert.equal(header.parameters[0].image.link, 'https://example.com/media.jpg');
});

test('suporta vídeo e documento do modelo sem carregar vídeo automaticamente', () => {
  for (const format of ['VIDEO', 'DOCUMENT']) {
    const { ctx } = contexto(format);
    const media = ctx.templateMedia(ctx.state.selectedTemplate);
    assert.equal(ctx.selectedTemplateMediaComponent().parameters[0].type, format.toLowerCase());
    const html = ctx.renderTemplateHeaderMedia(media);
    if (format === 'VIDEO') assert.match(html, /preload="none"/);
    else assert.match(html, /rel="noopener noreferrer"/);
  }
});

test('link informado serve de alternativa quando a mídia da aprovação não está disponível', () => {
  const { ctx, input } = contexto('IMAGE', ['4:upload-handle']);
  assert.throws(() => ctx.selectedTemplateMediaComponent(), /exige mídia/);
  input.value = 'https://example.com/foto.png';
  assert.equal(ctx.selectedTemplateMediaComponent().parameters[0].image.link, input.value);
  input.value = 'javascript:alert(1)';
  assert.throws(() => ctx.selectedTemplateMediaComponent(), /exige mídia/);
});

test('texto continua sem cabeçalho de mídia e envio usa componentes com imagem', () => {
  const { ctx } = contexto('TEXT', []);
  assert.equal(ctx.selectedTemplateMediaComponent(), null);
  assert.match(source, /if \(header\) components.unshift\(header\)/);
  assert.match(source, /renderTemplateHeaderMedia\(template.headerMedia\)/);
});
