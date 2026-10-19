const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const routes = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

async function gerarEtiqueta(tipMov, origens, metodo = 'post', numero = '3885491') {
  const handlers = {};
  const gravacoes = [];
  const consultas = [];
  const contexto = vm.createContext({
    console,
    router: { post(_url, fn) { handlers.post = fn; }, get(_url, fn) { handlers.get = fn; } },
    obterNumeroInteiro: (valor) => /^\d+$/.test(String(valor)) ? Number(valor) : null,
    executeQuery: async (sql) => {
      consultas.push(sql);
      if (sql.includes('FROM TGFVAR VAR')) {
        assert.match(sql, /VAR.NUNOTA = 3885491/);
        assert.match(sql, /ORIG.NUNOTA = VAR.NUNOTAORIG/);
        assert.match(sql, /ORIG.TIPMOV = 'P'/);
        assert.match(sql, /SELECT DISTINCT ORIG.NUNOTA/);
        return origens.map((nunota) => ({ NUNOTA: nunota }));
      }
      assert.match(sql, /CAB.TIPMOV/);
      return tipMov ? [{ NUNOTA: 3885491, TIPMOV: tipMov, NUCONFATUAL: 9, CODPARC: 4080, QTDVOL: 2 }] : [];
    },
    atualizarRegistroApi: async (...args) => gravacoes.push(args)
  });
  vm.runInContext(routes.slice(routes.indexOf('async function consultarNumeroPedidoEtiqueta('), routes.indexOf('router._internals =')), contexto);
  const res = { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; } };
  await handlers[metodo]({ params: { nunota: numero }, body: { volumes: 2 } }, res);
  return { res, consultas, gravacoes };
}

test('etiqueta da nota usa pedido de origem e mantém volumes gravados na nota e conferência', async () => {
  const { res, gravacoes } = await gerarEtiqueta('V', [3885359]);
  assert.equal(res.dados.etiqueta.numeroPedido, '3885359');
  assert.equal(res.dados.etiqueta.nunota, 3885491);
  assert.equal(gravacoes[0][1].NUNOTA, 3885491);
  assert.equal(gravacoes[0][2].QTDVOL, 2);
  assert.equal(gravacoes[1][1].NUCONF, 9);
});

test('etiqueta não inventa pedido para nota sem vínculo e preserva todos os pedidos de origem', async () => {
  const semOrigem = await gerarEtiqueta('V', []);
  assert.equal(semOrigem.res.dados.etiqueta.numeroPedido, null);
  const variasOrigens = await gerarEtiqueta('V', [3885359, 3885360]);
  assert.equal(variasOrigens.res.dados.etiqueta.numeroPedido, '3885359 / 3885360');
});

test('etiqueta de pedido antigo mantém seu próprio número sem consultar faturamento', async () => {
  const { res, consultas } = await gerarEtiqueta('P', []);
  assert.equal(res.dados.etiqueta.numeroPedido, '3885491');
  assert.equal(consultas.length, 1);
});

test('consulta do modal retorna pedido de origem e volumes sem gravar na produção', async () => {
  const { res, gravacoes } = await gerarEtiqueta('V', [3885359], 'get');
  assert.equal(res.dados.numeroPedido, '3885359');
  assert.equal(res.dados.volumes, 2);
  assert.equal(gravacoes.length, 0);
  const invalido = await gerarEtiqueta('V', [], 'get', '1 OR 1=1');
  assert.equal(invalido.res.codigo, 400);
  assert.equal(invalido.consultas.length, 0);
  const ausente = await gerarEtiqueta(null, [], 'get');
  assert.equal(ausente.res.codigo, 404);
});

function prepararModal(fetch) {
  const contexto = vm.createContext({
    pedidoConcluido: null,
    posConferenciaModal: { hidden: true, classList: { remove() {} } },
    posConferenciaTitulo: {}, botaoVoltarListaPosConferencia: {},
    botaoImprimirEtiquetaVolume: {}, posConferenciaDocumentos: {}, posConferenciaTexto: {},
    atualizarIcones() {}, fetch
  });
  vm.runInContext(frontend.slice(frontend.indexOf('async function abrirModalEtiquetaPedido('), frontend.indexOf('function fecharModalPosConferenciaEVoltar(')), contexto);
  return contexto;
}

test('modal da etiqueta mostra pedido de origem e não o número da nota', async () => {
  const contexto = prepararModal(async (url, opcoes) => {
    assert.match(url, /3885491\/etiquetas-volume$/);
    assert.equal(opcoes.method, undefined);
    return { ok: true, json: async () => ({ numeroPedido: '3885359', volumes: 1 }) };
  });
  await contexto.abrirModalEtiquetaPedido({ NUNOTA: 3885491, QTDVOL: 5 });
  assert.equal(contexto.posConferenciaTexto.textContent, 'O pedido 3885359 possui 1 volume(s) registrado(s).');
  assert.equal(contexto.botaoImprimirEtiquetaVolume.disabled, false);
});

test('modal não inventa pedido sem vínculo e bloqueia geração se consulta falhar', async () => {
  const semOrigem = prepararModal(async () => ({ ok: true, json: async () => ({ numeroPedido: null, volumes: 1 }) }));
  await semOrigem.abrirModalEtiquetaPedido({ NUNOTA: 3885491 });
  assert.match(semOrigem.posConferenciaTexto.textContent, /nota sem pedido de origem/);
  assert.doesNotMatch(semOrigem.posConferenciaTexto.textContent, /3885491/);
  const falha = prepararModal(async () => { throw new Error('Falha na consulta'); });
  await falha.abrirModalEtiquetaPedido({ NUNOTA: 3885491 });
  assert.equal(falha.botaoImprimirEtiquetaVolume.disabled, true);
  assert.equal(falha.posConferenciaTexto.textContent, 'Falha na consulta');
});

test('resposta atrasada não sobrescreve modal de outro documento', async () => {
  let resolver;
  const contexto = prepararModal(() => new Promise((resolve) => { resolver = resolve; }));
  const consulta = contexto.abrirModalEtiquetaPedido({ NUNOTA: 3885491 });
  contexto.pedidoConcluido = { NUNOTA: 123 };
  contexto.posConferenciaTexto.textContent = 'Outro documento';
  resolver({ ok: true, json: async () => ({ numeroPedido: '3885359', volumes: 1 }) });
  await consulta;
  assert.equal(contexto.posConferenciaTexto.textContent, 'Outro documento');
});

test('impressão da etiqueta mantém título Pedido e exibe origem em vez da nota', () => {
  const contexto = vm.createContext({
    escaparHtml: String,
    escaparAtributo: String,
    window: { location: { origin: 'http://localhost' } }
  });
  vm.runInContext(frontend.slice(frontend.indexOf('function montarHtmlEtiquetas(etiqueta, volumes)'), frontend.indexOf('async function imprimirEtiquetaVolume()')), contexto);
  const html = contexto.montarHtmlEtiquetas({ nunota: 3885491, numeroPedido: '3885359' }, 2);
  assert.match(html, /section-label">Pedido</);
  assert.match(html, /pedido-numero fit-one-line" data-min-font="10">3885359</);
  assert.doesNotMatch(html, /3885491/);
  assert.equal((html.match(/<section class="label">/g) || []).length, 2);
  assert.match(contexto.montarHtmlEtiquetas({ nunota: 3885491 }, 1), /data-min-font="10">-</);
});
