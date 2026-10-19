const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const routes = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

async function gerarEtiqueta(tipMov, origens) {
  let handler;
  const gravacoes = [];
  const consultas = [];
  const contexto = vm.createContext({
    console,
    router: { post(_url, fn) { handler = fn; } },
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
      return [{ NUNOTA: 3885491, TIPMOV: tipMov, NUCONFATUAL: 9, CODPARC: 4080 }];
    },
    atualizarRegistroApi: async (...args) => gravacoes.push(args)
  });
  vm.runInContext(routes.slice(routes.indexOf("router.post('/fila-conferencia/pedidos/:nunota/etiquetas-volume'"), routes.indexOf('router._internals =')), contexto);
  const res = { status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; } };
  await handler({ params: { nunota: '3885491' }, body: { volumes: 2 } }, res);
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
