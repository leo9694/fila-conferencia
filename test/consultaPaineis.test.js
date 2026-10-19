const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function preparar(altura = 600) {
  const eventos = {};
  const estilos = {};
  const atributos = {};
  const classes = new Set();
  const capturas = new Set();
  const paineis = { style: { setProperty(chave, valor) { estilos[chave] = valor; } },
    classList: { add: (v) => classes.add(v), remove: (v) => classes.delete(v) } };
  const divisor = { parentElement: paineis, focus() {}, setAttribute: (chave, valor) => { atributos[chave] = valor; },
    setPointerCapture: (id) => capturas.add(id), hasPointerCapture: (id) => capturas.has(id), releasePointerCapture: (id) => capturas.delete(id),
    addEventListener: (evento, fn) => { eventos[evento] = fn; } };
  const fracao = () => estilos['--consulta-resumo-altura'] ? parseFloat(estilos['--consulta-resumo-altura']) : .5;
  const elementos = {
    'consulta-paineis-divisor': divisor,
    'consulta-painel-resumo': { getBoundingClientRect: () => ({ height: altura * fracao() }) },
    'consulta-painel-detalhes': { getBoundingClientRect: () => ({ height: altura * (1 - fracao()) }) }
  };
  const ctx = vm.createContext({ document: { getElementById: (id) => elementos[id] }, ConsultaTabela: { fecharMenu() {} } });
  vm.runInContext(fonte.slice(fonte.indexOf('function inicializarDivisorConsultaEstoque()'), fonte.indexOf('function imprimirEtiquetaProdutoConsultado()')), ctx);
  ctx.inicializarDivisorConsultaEstoque();
  function disparar(tipo, valores = {}) {
    eventos[tipo]({ button: 0, pointerId: 1, clientY: 100, preventDefault() {}, ...valores });
  }
  return { disparar, estilos, atributos, classes, capturas };
}

test('arrastar divisória redistribui espaço entre lista e detalhes mantendo altura mínima', () => {
  const tela = preparar();
  tela.disparar('pointerdown');
  assert.ok(tela.capturas.has(1));
  assert.ok(tela.classes.has('is-redimensionando'));
  tela.disparar('pointermove', { clientY: 250 });
  assert.equal(tela.estilos['--consulta-resumo-altura'], '0.75fr');
  assert.equal(tela.estilos['--consulta-detalhes-altura'], '0.25fr');
  assert.match(tela.atributos['aria-valuetext'], /detalhes de estoque: 25%/);
  tela.disparar('pointermove', { clientY: -999 });
  assert.ok(parseFloat(tela.estilos['--consulta-resumo-altura']) * 600 >= 140);
  tela.disparar('pointermove', { clientY: 9999 });
  assert.ok(parseFloat(tela.estilos['--consulta-detalhes-altura']) * 600 >= 139.99);
});

test('soltar cancelar ou perder captura encerra arraste sem aceitar movimentos posteriores', () => {
  for (const evento of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const tela = preparar();
    tela.disparar('pointerdown');
    tela.disparar('pointermove', { pointerId: 2, clientY: 300 });
    assert.deepEqual(tela.estilos, {});
    tela.disparar(evento);
    assert.equal(tela.capturas.size, 0);
    assert.equal(tela.classes.size, 0);
    tela.disparar('pointermove', { clientY: 300 });
    assert.deepEqual(tela.estilos, {});
  }
});

test('setas e limites ajustam painéis e duplo clique restaura proporção original', () => {
  const tela = preparar();
  tela.disparar('keydown', { key: 'ArrowUp' });
  assert.equal(tela.atributos['aria-valuenow'], '45');
  tela.disparar('keydown', { key: 'ArrowDown' });
  assert.equal(tela.atributos['aria-valuenow'], '50');
  tela.disparar('keydown', { key: 'Home' });
  assert.equal(tela.atributos['aria-valuenow'], '23');
  tela.disparar('keydown', { key: 'End' });
  assert.equal(tela.atributos['aria-valuenow'], '77');
  tela.disparar('dblclick');
  assert.equal(tela.atributos['aria-valuenow'], '45');
});

test('ignora botão secundário e tela ainda oculta sem produzir tamanho inválido', () => {
  const tela = preparar(0);
  tela.disparar('pointerdown', { button: 2 });
  assert.equal(tela.capturas.size, 0);
  tela.disparar('keydown', { key: 'ArrowUp' });
  tela.disparar('dblclick');
  assert.deepEqual(tela.estilos, {});
});
