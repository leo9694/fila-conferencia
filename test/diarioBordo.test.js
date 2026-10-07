const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarDiarioBordo } = require('../api/diarioBordo');

function ambiente(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diario-bordo-teste-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'diario.json');
  return { store: criarDiarioBordo({ filePath }), filePath };
}
const dados = { placa: 'abc-1234', veiculo: 'Fiat Strada', motorista: 'João', origem: 'Empresa', destino: 'Cliente A', finalidade: 'Entrega', saida: '2026-01-01T08:00:00-04:00', distanciaIda: 25 };
const usuario = { codUsu: 7, nome: 'Operador' };

test('somente diretoria exclui uma viagem e mantém auditoria sem afetar outros registros', (t) => {
  const { store, filePath } = ambiente(t);
  const item = store.sair(dados, usuario);
  const outro = store.sair({ ...dados, placa: 'DEF1G23' }, usuario);
  store.devolver(item.id, { retorno: '2026-01-01T15:00:00Z' }, usuario);
  assert.throws(() => store.remover(item.id, usuario), { status: 403 });
  assert.equal(store.listar().length, 2);
  const diretor = { codUsu: 1, nome: 'Diretor', grupos: [' Diretoria '] };
  store.remover(item.id, diretor);
  assert.deepEqual(store.listar(), [outro]);
  const excluido = JSON.parse(fs.readFileSync(filePath, 'utf8')).find((registro) => registro.id === item.id);
  assert.ok(excluido.excluidoEm);
  assert.equal(excluido.excluidoPor.codUsu, 1);
  assert.equal(excluido.kmPrevisto, 50);
  assert.throws(() => store.remover(item.id, diretor), { status: 404 });
  assert.deepEqual(criarDiarioBordo({ filePath }).listar(), [outro]);
});

test('excluir saída em aberto libera o veículo sem perder auditoria nas próximas operações', (t) => {
  const { store, filePath } = ambiente(t);
  const item = store.sair(dados, usuario);
  store.remover(item.id, { grupos: ['DIRETORIA'] });
  assert.throws(() => store.devolver(item.id, { retorno: '2026-01-01T15:00:00Z' }, usuario), { status: 404 });
  const novo = store.sair(dados, usuario);
  store.devolver(novo.id, { retorno: '2026-01-01T15:00:00Z' }, usuario);
  assert.equal(store.listar().length, 1);
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).length, 2);
});

test('rota de exclusão bloqueia chamada direta de usuário fora da diretoria', async () => {
  const router = require('../api/diarioBordoRouter');
  const route = router.stack.find((layer) => layer.route?.path === '/diario-bordo/:id' && layer.route.methods.delete).route;
  let status;
  const res = { status(value) { status = value; return this; }, json(body) { assert.match(body.error, /Diretoria/); } };
  await route.stack[0].handle({ params: { id: 'teste-nao-producao' }, usuario }, res);
  assert.equal(status, 403);
});

test('registra saída e devolução com auditoria e persiste após reiniciar', (t) => {
  const { store, filePath } = ambiente(t);
  const registro = store.sair(dados, usuario);
  assert.equal(registro.placa, 'ABC1234');
  assert.equal(registro.criadoPor.codUsu, 7);
  const fim = store.devolver(registro.id, { retorno: '2026-01-01T10:00:00-04:00', kmFinal: 150, observacoesRetorno: 'Sem ocorrências' }, usuario);
  assert.equal(fim.kmPrevisto, 50);
  assert.equal(fim.origem, 'Norte Sul Sementes MT (Empresa 1)');
  assert.equal(fim.kmFinal, undefined);
  assert.equal(fim.devolvidoPor.nome, 'Operador');
  assert.deepEqual(criarDiarioBordo({ filePath }).listar(), [fim]);
});

test('normaliza a placa e permite veículos diferentes em uso', (t) => {
  const { store } = ambiente(t);
  store.sair(dados, usuario);
  assert.throws(() => store.sair({ ...dados, placa: 'ABC1234' }, usuario), /em andamento/);
  store.sair({ ...dados, placa: 'DEF1G23' }, usuario);
  assert.equal(store.listar().length, 2);
});

test('valida conflitos sem alterar o histórico e impede encerramento repetido', (t) => {
  const { store } = ambiente(t);
  const item = store.sair(dados, usuario);
  assert.throws(() => store.sair(dados, usuario), /em andamento/);
  assert.throws(() => store.devolver(item.id, { retorno: '2026-01-01T10:00:00Z' }, usuario), /posterior/);
  assert.equal(store.listar()[0].retorno, null);
  store.devolver(item.id, { retorno: '2026-01-01T15:00:00Z', kmFinal: 150 }, usuario);
  assert.throws(() => store.devolver(item.id, { retorno: '2026-01-01T16:00:00Z', kmFinal: 160 }, usuario), /encerrada/);
  assert.throws(() => store.sair({ ...dados, saida: '2026-01-01T14:00:00Z', kmInicial: 150 }, usuario), /última devolução/);
  store.sair({ ...dados, saida: '2026-01-02T08:00:00Z', kmInicial: 150 }, usuario);
  assert.equal(store.listar().length, 2);
});

test('rejeita campos inválidos, datas futuras e quilômetros negativos', (t) => {
  const { store } = ambiente(t);
  for (const invalido of [{ placa: 'x' }, { motorista: '' }, { saida: 'abc' }, { saida: '2099-01-01T08:00:00Z' }, { distanciaIda: '' }, { distanciaIda: 0 }, { distanciaIda: -1 }, { distanciaIda: 'abc' }, { destino: 'a'.repeat(1001) }]) {
    assert.throws(() => store.sair({ ...dados, ...invalido }, usuario));
  }
  assert.deepEqual(store.listar(), []);
  assert.throws(() => store.devolver('inexistente', {}, usuario), /não encontrado/);
});

test('devolve viagem antiga sem exigir odômetro e preserva seus dados anteriores', (t) => {
  const { store, filePath } = ambiente(t);
  fs.writeFileSync(filePath, JSON.stringify([{ id: 'antigo', placa: 'ABC1234', saida: '2026-01-01T12:00:00Z', kmInicial: 5, retorno: null }]));
  const fim = store.devolver('antigo', { retorno: '2026-01-01T13:00:00Z' }, usuario);
  assert.equal(fim.kmInicial, 5);
  assert.equal(fim.distanciaIda, undefined);
  assert.equal(fim.kmPrevisto, undefined);
});

test('não sobrescreve arquivo corrompido e lê mudanças feitas por outra instância', (t) => {
  const { store, filePath } = ambiente(t);
  const outra = criarDiarioBordo({ filePath });
  store.sair(dados, usuario);
  assert.equal(outra.listar().length, 1);
  fs.writeFileSync(filePath, '{inválido');
  assert.throws(() => store.sair({ ...dados, placa: 'DEF1G23' }, usuario));
  assert.equal(fs.readFileSync(filePath, 'utf8'), '{inválido');
});
