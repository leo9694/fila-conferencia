const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarDiarioBordoCadastros } = require('../api/diarioBordoCadastros');
const { criarDiarioBordo } = require('../api/diarioBordo');
const motoristaBase = { nome: 'Leonardo Gabriel', cnh: '01234567890', categoriaCnh: 'AB' };

function ambiente(t, executarConsulta = async () => []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diario-cadastros-teste-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'cadastros.json');
  return { store: criarDiarioBordoCadastros({ filePath, executarConsulta }), filePath, dir };
}

test('salva carros e rotas, normaliza placa e preserva cadastro ao reiniciar', async (t) => {
  const { store, filePath } = ambiente(t);
  const carro = await store.adicionar('carros', { placa: 'abc-1d23', veiculo: 'Strada', empresa: 'Norte Sul' }, { codUsu: 9, nome: 'Operador' });
  assert.equal(carro.placa, 'ABC1D23');
  assert.equal(carro.criadoPor.codUsu, 9);
  await store.adicionar('rotas', { nome: 'Entrega', origem: 'Empresa', destino: 'Cliente', distanciaIda: 25 });
  assert.deepEqual(criarDiarioBordoCadastros({ filePath }).listar(), store.listar());
  await assert.rejects(store.adicionar('carros', { placa: 'ABC1D23', veiculo: 'Outro' }), /já existe/);
  await assert.rejects(store.adicionar('rotas', { nome: 'entrega', origem: 'Outra', destino: 'Outro', distanciaIda: 25 }), /já existe/);
});

test('valida usuário no Sankhya e impede vínculo duplicado ou inexistente', async (t) => {
  const consultas = [];
  const { store } = ambiente(t, async (sql) => {
    consultas.push(sql);
    return sql.includes('CODUSU = 7') ? [{ CODUSU: 7, NOMEUSU: 'LEONARDO' }] : [];
  });
  const motorista = await store.adicionar('motoristas', { ...motoristaBase, codUsu: '7', nomeUsuario: 'Nome forjado' });
  assert.equal(motorista.codUsu, 7);
  assert.equal(motorista.nomeUsuario, 'LEONARDO');
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: 'Outro Motorista', cnh: '11234567890', codUsu: 7 }), /já está vinculado/);
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: 'Não existe', codUsu: 999 }), /não encontrado/);
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: 'Teste Injeção', codUsu: '7 OR 1=1' }), /inválido/);
  const semVinculo = await store.adicionar('motoristas', { ...motoristaBase, nome: 'Motorista externo', cnh: '21234567890' });
  assert.equal(semVinculo.codUsu, null);
  assert.equal(consultas.length, 3);
});

test('pesquisa usuários por nome ou código com limite e escape SQL', async (t) => {
  const consultas = [];
  const { store } = ambiente(t, async (sql) => { consultas.push(sql); return [{ CODUSU: 7, NOMEUSU: 'LEONARDO' }]; });
  assert.deepEqual(await store.consultarUsuarios('7'), [{ codUsu: 7, nome: 'LEONARDO' }]);
  assert.match(consultas[0], /OR CODUSU = 7/);
  assert.match(consultas[0], /ROWNUM <= 50/);
  await store.consultarUsuarios("D'ÁVILA%_");
  assert.ok(consultas[1].includes("D''ÁVILA\\%\\_"));
});

test('saída usa os dados cadastrados e guarda o vínculo no histórico sem alterar viagens anteriores', async (t) => {
  const { store, dir } = ambiente(t, async () => [{ CODUSU: 7, NOMEUSU: 'LEONARDO' }]);
  const carro = await store.adicionar('carros', { placa: 'ABC1234', veiculo: 'Strada' });
  const motorista = await store.adicionar('motoristas', { ...motoristaBase, codUsu: 7 });
  const rota = await store.adicionar('rotas', { nome: 'Entrega', origem: 'Empresa', destino: 'Cliente', distanciaIda: 25 });
  const dados = store.resolverSaida({ carroId: carro.id, motoristaId: motorista.id, rotaId: rota.id, motorista: 'Forjado', saida: '2026-01-01T12:00:00Z', kmInicial: 100, finalidade: 'Entrega' });
  const diario = criarDiarioBordo({ filePath: path.join(dir, 'viagens.json') });
  const viagem = diario.sair(dados);
  assert.equal(viagem.motorista, 'Leonardo Gabriel');
  assert.equal(viagem.codUsuMotorista, 7);
  assert.equal(viagem.nomeUsuarioMotorista, 'LEONARDO');
  assert.equal(viagem.placa, 'ABC1234');
  assert.equal(viagem.destino, 'Cliente');
  assert.equal(viagem.nomeRota, 'Entrega');
  assert.throws(() => store.resolverSaida({ carroId: 'inexistente' }), /não encontrado/);
  assert.throws(() => store.resolverSaida({ motorista: 'Externo', codUsuMotorista: 999 }), /Selecione um carro e um motorista/);
  assert.equal(diario.listar()[0].codUsuMotorista, 7);
});

test('exige destino com distância e calcula com o cadastro ignorando valores forjados', async (t) => {
  const { store } = ambiente(t);
  const carro = await store.adicionar('carros', { placa: 'ABC1234', veiculo: 'Strada', kmAtual: '45000' });
  const motorista = await store.adicionar('motoristas', motoristaBase);
  assert.equal(carro.kmAtual, undefined);
  assert.throws(() => store.resolverSaida({ carroId: carro.id, motoristaId: motorista.id }), /Selecione um destino/);
  assert.throws(() => store.resolverSaida({ carroId: carro.id, kmInicial: 45000 }), /Selecione um carro e um motorista/);
  const rota = await store.adicionar('rotas', { nome: 'Destino', destino: 'Cliente', distanciaIda: 12.5 });
  const dados = store.resolverSaida({ carroId: carro.id, motoristaId: motorista.id, rotaId: rota.id, distanciaIda: 999, origem: 'Outra empresa' });
  assert.equal(dados.veiculo, 'Strada');
  assert.equal(dados.motorista, 'Leonardo Gabriel');
  assert.equal(dados.distanciaIda, 12.5);
  assert.equal(dados.origem, 'Norte Sul Sementes MT (Empresa 1)');
  for (const distanciaIda of ['', 0, -1, 'abc', true, 10000000]) await assert.rejects(store.adicionar('rotas', { nome: 'Inválida', destino: 'Cliente', distanciaIda }), /distância/);
});

test('rejeita cadastro inválido sem apagar arquivos corrompidos', async (t) => {
  const { store, filePath } = ambiente(t);
  await assert.rejects(store.adicionar('outros', {}), /inválido/);
  await assert.rejects(store.adicionar('carros', { placa: 'x', veiculo: 'Strada' }), /inválida/);
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: '' }), /válido/);
  fs.writeFileSync(filePath, '{inválido');
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: 'Motorista Externo' }));
  assert.equal(fs.readFileSync(filePath, 'utf8'), '{inválido');
});

test('exige nome completo, CNH de 11 dígitos e categoria permitida sem duplicar CNH', async (t) => {
  const { store } = ambiente(t);
  for (const invalido of [{ nome: 'Leonardo' }, { cnh: '' }, { cnh: '123' }, { cnh: '0123456789X' }, { categoriaCnh: '' }, { categoriaCnh: 'ABC' }]) {
    await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, ...invalido }));
  }
  const item = await store.adicionar('motoristas', motoristaBase);
  assert.equal(item.cnh, '01234567890');
  assert.equal(item.categoriaCnh, 'AB');
  await assert.rejects(store.adicionar('motoristas', { ...motoristaBase, nome: 'Outro Motorista' }), /CNH já/);
});

test('exclui qualquer tipo de cadastro sem apagar viagens, mantendo auditoria e permitindo recadastro', async (t) => {
  const { store, dir, filePath } = ambiente(t);
  const carro = await store.adicionar('carros', { placa: 'ABC1234', veiculo: 'Strada' });
  const motorista = await store.adicionar('motoristas', motoristaBase);
  const rota = await store.adicionar('rotas', { nome: 'Entrega', origem: 'Empresa', destino: 'Cliente', distanciaIda: 25 });
  const diario = criarDiarioBordo({ filePath: path.join(dir, 'viagens.json') });
  const viagem = diario.sair(store.resolverSaida({ carroId: carro.id, motoristaId: motorista.id, rotaId: rota.id, saida: '2026-01-01T12:00:00Z', kmInicial: 100, finalidade: 'Entrega' }));
  for (const [tipo, item, campo] of [['carros', carro, 'carroId'], ['motoristas', motorista, 'motoristaId'], ['rotas', rota, 'rotaId']]) {
    store.remover(tipo, item.id, { codUsu: 9, nome: 'Operador' });
    assert.equal(store.listar()[tipo].length, 0);
    assert.throws(() => store.resolverSaida({ [campo]: item.id }), /não encontrado/);
    assert.throws(() => store.remover(tipo, item.id), /não encontrado/);
  }
  assert.deepEqual(diario.listar(), [viagem]);
  diario.devolver(viagem.id, { retorno: '2026-01-01T13:00:00Z', kmFinal: 110 });
  assert.equal(diario.listar()[0].motorista, 'Leonardo Gabriel');
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).motoristas[0].excluidoPor.codUsu, 9);
  await store.adicionar('motoristas', motoristaBase);
  assert.equal(store.listar().motoristas.length, 1);
  assert.throws(() => store.remover('outros', 'x'), /inválido/);
});
