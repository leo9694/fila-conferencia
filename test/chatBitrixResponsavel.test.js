const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { criarBitrixService } = require('../api/bitrixService');

const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');

function criarContexto({ existente = false, usuario = { ID: '151' }, falha = false } = {}) {
  const eventos = [];
  const ctx = vm.createContext({
    id: Number, idPipelineBitrix: Number, vinculandoPipelines: new Map(),
    sincronizarPipelinesBitrix: async () => {},
    atendentes: {
      obterConversa: () => existente ? { bitrixPipelines: [{ categoryId: 1, dealId: 99 }] } : null,
      vincularPipeline: (_id, link) => ({ bitrixPipelines: [link] })
    },
    listarPipelinesBitrix: async () => [{ categoryId: 1, stageId: 'C1:NEW', name: 'Vendas' }],
    vincularCadastrosSankhya: async (v) => v,
    contatoBitrixDaConversa: async () => ({ contactId: 10, nome: 'Cliente' }),
    bitrixService: {
      consultarNegocios: async () => [],
      buscarUsuarioPorNome: async (nome) => {
        eventos.push(['usuario', nome]);
        if (falha) throw new Error('Usuário não identificado');
        return usuario;
      },
      criarNegocio: async (payload) => { eventos.push(['criar', payload]); return { result: 99 }; }
    }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('function vincularPipelineBitrix('), fonte.indexOf('function exigirAcessoChat(')), ctx);
  return { ctx, eventos };
}

test('card do chat usa ID Bitrix do atendente iniciador e preserva essa identidade na fila assíncrona', async () => {
  const { ctx, eventos } = criarContexto();
  await vm.runInContext("vincularPipelineBitrix({ id: 123 }, 1, 'EVELLIM')", ctx);
  assert.deepEqual(eventos[0], ['usuario', 'EVELLIM']);
  assert.equal(eventos[1][1].fields.ASSIGNED_BY_ID, 151);
  assert.equal(eventos[1][1].fields.CATEGORY_ID, 1);
  assert.equal(eventos[1][1].contactId, 10);
});

test('não cria card se a consulta de usuário falhar ou retornar ID inválido', async () => {
  for (const options of [{ falha: true }, { usuario: {} }, { usuario: { ID: '0' } }]) {
    const { ctx, eventos } = criarContexto(options);
    await assert.rejects(vm.runInContext("vincularPipelineBitrix({ id: 123 }, 1, 'EVELLIM')", ctx));
    assert.equal(eventos.some(([tipo]) => tipo === 'criar'), false);
    assert.equal(ctx.vinculandoPipelines.size, 0);
  }
});

test('Compras 01 sem correspondência cria card com Leonardo sem trocar o atendente do chat', async () => {
  let consultas = 0;
  const service = criarBitrixService({
    webhookUrl: 'https://example.com/rest/test',
    httpClient: { post: async () => {
      consultas += 1;
      return { data: { result: [{ ID: '44', NAME: 'Leonardo' }, { ID: '55', NAME: 'Raquel' }] } };
    } }
  });
  const { ctx, eventos } = criarContexto();
  ctx.bitrixService.buscarUsuarioPorNome = service.buscarUsuarioPorNome;
  await vm.runInContext("vincularPipelineBitrix({ id: 123 }, 1, 'COMPRAS 01')", ctx);
  assert.equal(consultas, 1);
  assert.equal(eventos[0][1].fields.ASSIGNED_BY_ID, 44);
  assert.equal((await service.buscarUsuarioPorNome('RAQUEL', { nomePadrao: 'LEONARDO' })).ID, '55');
});

test('responsável padrão ausente ou ambíguo não cria card com usuário arbitrário', async () => {
  for (const usuarios of [[], [{ ID: '44', NAME: 'Leonardo', LAST_NAME: 'Silva' }, { ID: '45', NAME: 'Leonardo', LAST_NAME: 'Souza' }]]) {
    const service = criarBitrixService({ webhookUrl: 'https://example.com/rest/test',
      httpClient: { post: async () => ({ data: { result: usuarios } }) } });
    const { ctx, eventos } = criarContexto();
    ctx.bitrixService.buscarUsuarioPorNome = service.buscarUsuarioPorNome;
    await assert.rejects(vm.runInContext("vincularPipelineBitrix({ id: 123 }, 1, 'COMPRAS 01')", ctx), /nao encontrado|Mais de um funcionario/);
    assert.equal(eventos.some(([tipo]) => tipo === 'criar'), false);
  }
});

test('reassumir card já vinculado não sobrescreve responsável original', async () => {
  const { ctx, eventos } = criarContexto({ existente: true });
  const result = await vm.runInContext("vincularPipelineBitrix({ id: 123 }, 1, 'OUTRO ATENDENTE')", ctx);
  assert.equal(result.reused, true);
  assert.deepEqual(eventos, []);
});

test('criação, assumir e vínculo adicional enviam identidade autenticada em vez do nome do cliente', () => {
  const chamadas = fonte.match(/(?:await )?vincularPipelineBitrix\(conversation, pipelineId, req\.usuario\?\.nome \|\| req\.atendente\.name\)/g);
  assert.equal(chamadas.length, 3);
});

test('identificação Bitrix não escolhe arbitrariamente entre nomes ambíguos', async () => {
  const service = criarBitrixService({
    webhookUrl: 'https://example.com/rest/test',
    httpClient: { post: async () => ({ data: { result: [
      { ID: '151', NAME: 'Evellim', LAST_NAME: 'Santos' },
      { ID: '152', NAME: 'Evellim', LAST_NAME: 'Silva' }
    ] } }) }
  });
  await assert.rejects(service.buscarUsuarioPorNome('EVELLIM'), /Mais de um funcionario/);
  assert.equal((await service.buscarUsuarioPorNome('EVELLIM SANTOS')).ID, '151');
  await assert.rejects(service.buscarUsuarioPorNome('INEXISTENTE'), /nao encontrado/);
});
