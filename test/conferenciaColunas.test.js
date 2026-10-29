const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function preparar(entrada, coluna) {
  const propriedades = new Map();
  const eventos = new Map();
  const classes = new Set();
  const resizer = {
    dataset: { colIndex: String(coluna) },
    addEventListener(nome, callback) { this[nome] = callback; }
  };
  const contexto = vm.createContext({
    document: {
      documentElement: { style: { setProperty: (nome, valor) => propriedades.set(nome, valor) } },
      body: { classList: { add: (nome) => classes.add(nome), remove: (nome) => classes.delete(nome) } },
      addEventListener: (nome, callback) => eventos.set(nome, callback),
      removeEventListener: (nome) => eventos.delete(nome)
    }
  });
  vm.runInContext(frontend.slice(frontend.indexOf('const itensGridMinimos ='), frontend.indexOf('const STORAGE_NAVEGACAO_FILA ='))
    + frontend.slice(frontend.indexOf('function aplicarLargurasGridItens()'), frontend.indexOf('function fecharMenusOrdenacaoItens()')), contexto);
  contexto.configurarRedimensionamentoColunas({
    classList: { contains: (nome) => entrada && nome === 'entrada-datas' },
    querySelectorAll: () => [resizer]
  });
  resizer.mousedown({ clientX: 100, preventDefault() {}, stopPropagation() {} });
  return { propriedades, eventos, classes };
}

test('arrastar coluna de saída altera a largura nos dois painéis e mantém a entrada', () => {
  const { propriedades, eventos, classes } = preparar(false, 2);
  eventos.get('mousemove')({ clientX: 160 });
  assert.equal(propriedades.get('--itens-grid-columns'), '68px 92px 300px 142px 170px 132px');
  assert.equal(propriedades.get('--itens-grid-entrada-columns'), '34px 84px 220px 132px 148px 112px 112px 126px');
  assert.equal(classes.has('resizing-columns'), true);
  eventos.get('mouseup')();
  assert.equal(classes.size, 0);
  assert.equal(eventos.size, 0);
});

test('entrada permite redimensionar fabricação, validade e código de barras sem larguras inválidas', () => {
  for (const coluna of [5, 6, 7]) {
    const { propriedades, eventos } = preparar(true, coluna);
    eventos.get('mousemove')({ clientX: 150 });
    const larguras = propriedades.get('--itens-grid-entrada-columns').split(' ');
    assert.equal(larguras[coluna], `${(coluna === 7 ? 126 : 112) + 50}px`);
    assert.equal(propriedades.get('--itens-grid-columns'), '68px 92px 240px 142px 170px 132px');
    assert.equal(larguras.includes('NaNpx'), false);
  }
});

test('reduzir uma coluna respeita o tamanho mínimo de cada modo', () => {
  for (const entrada of [false, true]) {
    const { propriedades, eventos } = preparar(entrada, 2);
    eventos.get('mousemove')({ clientX: -1000 });
    const propriedade = entrada ? '--itens-grid-entrada-columns' : '--itens-grid-columns';
    assert.equal(propriedades.get(propriedade).split(' ')[2], '210px');
  }
});

test('resumo no topo não abre a antiga gaveta nem bloqueia a rolagem no celular', () => {
  const estados = new Map();
  const contexto = vm.createContext({
    mobileSidebarToggle: { setAttribute: (nome, valor) => estados.set(nome, valor) },
    mobileSidebarBackdrop: { hidden: false },
    pedidoSidebar: { classList: { contains: () => true } },
    filaScreen: { classList: { toggle: (nome, valor) => estados.set(nome, valor) } },
    document: { body: { classList: { toggle: (nome, valor) => estados.set(nome, valor) } } },
    atualizarIcones() {}
  });
  vm.runInContext(frontend.slice(frontend.indexOf('function alternarSidebarMobileConferencia('), frontend.indexOf('function mostrarEtapaPedidosFila(')), contexto);
  contexto.alternarSidebarMobileConferencia(true);
  assert.equal(estados.get('mobile-sidebar-open'), false);
  assert.equal(estados.get('mobile-sidebar-lock'), false);
  assert.equal(estados.get('aria-expanded'), 'false');
  assert.equal(contexto.mobileSidebarBackdrop.hidden, true);
});
