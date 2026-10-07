const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarChatSetoresStore } = require('../api/chatSetoresStore');

function fixture(t) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-setores-test-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const filePath = path.join(pasta, 'setores.json');
  return { filePath, store: criarChatSetoresStore({ filePath }) };
}

test('permite vincular usuários do Sankhya sem habilitação no chat ou acesso ao número sem alterar suas permissões', (t) => {
  const { store } = fixture(t);
  const usuarios = [
    { codUsu: 1, habilitado: true, canaisPermitidos: ['mt'] },
    { codUsu: 2, habilitado: true, canaisPermitidos: ['ms'] },
    { codUsu: 3, habilitado: false, canaisPermitidos: ['mt'] },
    { codUsu: 4, habilitado: true, canaisPermitidos: null },
    { codUsu: 5, habilitado: true, diretor: true, canaisPermitidos: [] }
  ];
  const original = structuredClone(usuarios);
  const registro = store.salvar('mt', { setores: [{ nome: 'Financeiro', atendentes: [2, 3] }] }, usuarios, 1);
  assert.deepEqual(registro.setores[0].atendentes, ['2', '3']);
  assert.deepEqual(usuarios, original);
});

test('persiste vários setores do mesmo atendente e mantém os números separados', (t) => {
  const { store, filePath } = fixture(t);
  const usuarios = [{ codUsu: 72 }];
  const dados = store.salvar('mt', { setores: [
    { nome: 'Comercial', atendentes: [72, '72'] },
    { nome: 'Financeiro', atendentes: ['72'] }
  ] }, usuarios, 1);
  assert.equal(dados.setores.length, 2);
  assert.deepEqual(dados.setores[0].atendentes, ['72']);
  store.salvar('ms', { setores: [{ nome: 'Comercial', atendentes: [] }] }, usuarios, 1);
  assert.deepEqual(criarChatSetoresStore({ filePath }).listar('mt'), dados);
  assert.equal(store.listar('ms').setores.length, 1);
});

test('recusa usuário inexistente no Sankhya sem sobrescrever os setores anteriores', (t) => {
  const { store } = fixture(t);
  const dados = store.salvar('mt', { setores: [{ nome: 'Comercial', atendentes: ['72'] }] }, [{ codUsu: 72 }], 1);
  assert.throws(() => store.salvar('mt', { ...dados, setores: [{ ...dados.setores[0], atendentes: ['81'] }] }, [{ codUsu: 72 }], 1), /não foi encontrado no Sankhya/);
  assert.deepEqual(store.listar('mt'), dados);
});

test('edita e remove setores sem alterar configurações de outro número', (t) => {
  const { store } = fixture(t);
  const primeiro = store.salvar('mt', { setores: [{ nome: 'Comercial', atendentes: [] }] }, [], 1);
  const outro = store.salvar('ms', { setores: [{ nome: 'Financeiro', atendentes: [] }] }, [], 1);
  const editado = store.salvar('mt', { ...primeiro, setores: [{ ...primeiro.setores[0], nome: 'Vendas' }] }, [], 1);
  assert.equal(editado.setores[0].id, primeiro.setores[0].id);
  store.salvar('mt', { revisao: editado.revisao, setores: [] }, [], 1);
  assert.deepEqual(store.listar('ms'), outro);
  assert.deepEqual(store.listar('mt').setores, []);
});

test('impede sobrescrita de uma configuração modificada por outra sessão', (t) => {
  const { store, filePath } = fixture(t);
  const segundaSessao = criarChatSetoresStore({ filePath });
  store.salvar('mt', { setores: [] }, [], 1);
  assert.throws(() => segundaSessao.salvar('mt', { setores: [], revisao: null }, [], 2), { status: 409 });
});

test('valida nomes, identificadores e listas antes de gravar', (t) => {
  const { store } = fixture(t);
  for (const setores of [
    [{ nome: '', atendentes: [] }],
    [{ nome: ' Vendas ', atendentes: [] }, { nome: 'vendas', atendentes: [] }],
    [{ id: 'id-forjado', nome: 'Vendas', atendentes: [] }],
    [{ nome: 'Vendas', atendentes: null }],
    [null]
  ]) assert.throws(() => store.salvar('mt', { setores }, [], 1), { status: 400 });
  assert.throws(() => store.salvar('__proto__', { setores: [] }, [], 1), { status: 400 });
});

test('não substitui dados corrompidos por configuração vazia', (t) => {
  const { store, filePath } = fixture(t);
  fs.writeFileSync(filePath, 'arquivo inválido');
  assert.throws(() => store.salvar('mt', { setores: [] }, [], 1));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'arquivo inválido');
});
