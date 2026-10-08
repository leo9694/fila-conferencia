const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

function ambiente(mobile = true) {
  const timers = [];
  const elemento = () => ({ value: '', disabled: false, atributos: {}, eventos: {},
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
    focus() { this.focado = true; },
    addEventListener(nome, handler) { this.eventos[nome] = handler; }
  });
  const contexto = vm.createContext({
    tecladoContagemEstoqueHabilitado: false, leituraContagemEstoqueMobile: '',
    estoqueContagemCodigo: elemento(), botaoTecladoContagemEstoque: elemento(),
    estoqueContagemItensView: { hidden: false }, estoqueContagemScan: { hidden: false },
    estoqueContagemConfirmModal: { hidden: true }, estoqueContagemNovoItemModal: { hidden: true },
    estoqueContagemChavesLocalizadas: null, renderizarItensContagemEstoque() {},
    separacaoEmMobile: () => mobile,
    navigator: { virtualKeyboard: { hide() { contexto.ocultacoes += 1; }, show() { contexto.aberturas += 1; } } },
    ocultacoes: 0, aberturas: 0, processamentos: 0,
    processarCodigoContagemEstoque() { contexto.processamentos += 1; },
    setTimeout(callback) { timers.push(callback); }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function configurarLeitorContagemEstoque('), fonte.indexOf('function aplicarLargurasGridItens(')), contexto);
  vm.runInContext(fonte.slice(fonte.indexOf('function capturarTeclaLeitorContagemEstoque('), fonte.indexOf('async function executarAcaoContagemEstoque(')), contexto);
  vm.runInContext(fonte.slice(fonte.indexOf("estoqueContagemCodigo.addEventListener('input'"), fonte.indexOf("document.addEventListener('keydown'", fonte.indexOf("estoqueContagemCodigo.addEventListener('input'"))), contexto);
  return { contexto, timers };
}

test('mobile inicia sem teclado virtual e preserva a captura do bipador', () => {
  const { contexto, timers } = ambiente();
  vm.runInContext('configurarLeitorContagemEstoque(); focarLeitorContagemEstoqueSemTeclado();', contexto);
  assert.equal(contexto.estoqueContagemCodigo.inputMode, 'none');
  assert.equal(contexto.botaoTecladoContagemEstoque.hidden, false);
  assert.equal(contexto.botaoTecladoContagemEstoque.atributos['aria-pressed'], 'false');
  timers.forEach((callback) => callback());
  assert.equal(contexto.estoqueContagemCodigo.readOnly, false);
  contexto.estoqueContagemCodigo.eventos.keydown({ key: '7', preventDefault() {} });
  contexto.estoqueContagemCodigo.eventos.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(contexto.estoqueContagemCodigo.value, '7');
  assert.equal(contexto.processamentos, 1);
});

test('botão alterna digitação e modo bipador sem apagar o código', () => {
  const { contexto } = ambiente();
  contexto.estoqueContagemCodigo.value = '123';
  contexto.botaoTecladoContagemEstoque.eventos.click();
  assert.equal(contexto.estoqueContagemCodigo.inputMode, 'numeric');
  assert.equal(contexto.estoqueContagemCodigo.readOnly, false);
  assert.equal(contexto.botaoTecladoContagemEstoque.atributos['aria-pressed'], 'true');
  assert.equal(contexto.aberturas, 1);
  const ocultacoes = contexto.ocultacoes;
  contexto.estoqueContagemCodigo.eventos.focus();
  assert.equal(contexto.ocultacoes, ocultacoes);
  contexto.estoqueContagemCodigo.eventos.pointerdown({ preventDefault() { assert.fail('Não deve bloquear o toque com teclado habilitado'); } });
  contexto.estoqueContagemCodigo.eventos.keydown({ key: 'Backspace', preventDefault() { assert.fail('Não deve bloquear edição'); } });
  contexto.estoqueContagemCodigo.eventos.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(contexto.processamentos, 1);
  contexto.botaoTecladoContagemEstoque.eventos.click();
  assert.equal(contexto.estoqueContagemCodigo.inputMode, 'none');
  assert.equal(contexto.estoqueContagemCodigo.atributos.virtualkeyboardpolicy, 'manual');
  assert.equal(contexto.estoqueContagemCodigo.value, '123');
  assert.equal(contexto.leituraContagemEstoqueMobile, '123');
});

test('timer antigo do bipador não fecha teclado recém habilitado', () => {
  const { contexto, timers } = ambiente();
  vm.runInContext('focarLeitorContagemEstoqueSemTeclado(); alternarTecladoContagemEstoque();', contexto);
  const ocultacoes = contexto.ocultacoes;
  timers.forEach((callback) => callback());
  assert.equal(contexto.ocultacoes, ocultacoes);
  assert.equal(contexto.estoqueContagemCodigo.inputMode, 'numeric');
});

test('desktop mantém digitação normal e não exibe o botão', () => {
  const { contexto } = ambiente(false);
  vm.runInContext('configurarLeitorContagemEstoque(); alternarTecladoContagemEstoque();', contexto);
  assert.equal(contexto.botaoTecladoContagemEstoque.hidden, true);
  assert.equal(contexto.estoqueContagemCodigo.inputMode, 'numeric');
  assert.equal(contexto.estoqueContagemCodigo.readOnly, false);
  assert.equal(contexto.tecladoContagemEstoqueHabilitado, false);
});
