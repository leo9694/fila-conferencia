const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
const inicio = fonte.indexOf('  function filtrarAtendentesSetor(');
const fim = fonte.indexOf('  async function openCallsSettingsDialog(', inicio);
const filtrar = vm.runInNewContext(`${fonte.slice(inicio, fim)}; filtrarAtendentesSetor;`);
const usuarios = [
  { codUsu: 40, nome: 'DIANE', nomeExibicao: 'Financeiro' },
  { codUsu: 72, nome: 'LEONARDO', nomeExibicao: 'Leo' },
  { codUsu: 150, nome: 'MARCOS HENRIQUE', nomeExibicao: 'Márcos' }
];

test('pesquisa pelo código e nome cadastrado no Sankhya e também pelo nome do chat', () => {
  assert.deepEqual(filtrar(usuarios, [], '72').map((item) => item.codUsu), [72]);
  assert.deepEqual(filtrar(usuarios, [], ' marcos ').map((item) => item.codUsu), [150]);
  assert.deepEqual(filtrar(usuarios, [], 'financeiro').map((item) => item.codUsu), [40]);
});

test('não oferece atendentes já adicionados ao setor nem altera a lista original', () => {
  const adicionados = ['40', 72];
  assert.deepEqual(filtrar(usuarios, adicionados, '').map((item) => item.codUsu), [150]);
  assert.deepEqual(adicionados, ['40', 72]);
  assert.equal(usuarios.length, 3);
});

test('permite o mesmo atendente em outros setores e retorna vazio para busca sem resultado', () => {
  assert.equal(filtrar(usuarios, ['72'], 'LEONARDO').length, 0);
  assert.equal(filtrar(usuarios, [], 'LEONARDO').length, 1);
  assert.equal(filtrar(usuarios, [], 'inexistente').length, 0);
});

test('cartões de setores preservam os controles de edição e vínculos dos atendentes', () => {
  const inicioRender = fonte.indexOf('    const render = () => {', fim);
  const fimRender = fonte.indexOf('    const openAttendantPicker', inicioRender);
  const sectorsList = {};
  const contexto = vm.createContext({ sectorsList,
    payload: { usuarios },
    setores: [{ id: 'setor-1', nome: 'Financeiro', atendentes: ['40', '72'] }, { nome: '', atendentes: [] }],
    escapeHtml: (valor) => String(valor ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    window: { lucide: { createIcons() {} } }
  });
  vm.runInContext(`${fonte.slice(inicioRender, fimRender)}; render();`, contexto);
  assert.equal((sectorsList.innerHTML.match(/<fieldset data-sector/g) || []).length, 2);
  assert.match(sectorsList.innerHTML, /value="Financeiro"/);
  assert.match(sectorsList.innerHTML, /data-user="40"/);
  assert.match(sectorsList.innerHTML, /data-user="72"/);
  assert.match(sectorsList.innerHTML, /chat-call-avatar/);
  assert.match(sectorsList.innerHTML, /data-add-attendant="0"/);
  assert.match(sectorsList.innerHTML, /data-remove="1"/);
});
