const test = require('node:test');
const assert = require('node:assert/strict');
const { criarBitrixService, normalizarTelefoneBrasileiro } = require('../api/bitrixService');

test('normaliza telefone brasileiro e remove o nono digito adicional', () => {
  assert.equal(normalizarTelefoneBrasileiro('66 99657-8697'), '+556696578697');
  assert.equal(normalizarTelefoneBrasileiro('+55 66 9657-8697'), '+556696578697');
});

test('pagina consultas usando o proximo start retornado pelo Bitrix', async () => {
  const chamadas = [];
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    logger: { error() {} },
    httpClient: {
      async post(url, params) {
        chamadas.push({ url, params });
        return params.start === 0
          ? { data: { result: [{ ID: '1' }], next: 50 } }
          : { data: { result: [{ ID: '2' }] } };
      }
    }
  });

  const contatos = await service.consultarContatos({ select: ['ID'] });
  assert.deepEqual(contatos.map((contato) => contato.ID), ['1', '2']);
  assert.deepEqual(chamadas.map((chamada) => chamada.params.start), [0, 50]);
});

test('repete chamadas temporariamente indisponiveis sem registrar o webhook', async () => {
  let tentativas = 0;
  const logs = [];
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    sleep: async () => {},
    logger: { error(mensagem) { logs.push(mensagem); } },
    httpClient: {
      async post() {
        tentativas += 1;
        if (tentativas < 3) {
          const error = new Error('Request failed');
          error.response = { status: 503, data: {} };
          throw error;
        }
        return { data: { result: { ID: '1' } } };
      }
    }
  });

  const perfil = await service.testarConexao();
  assert.equal(perfil.result.ID, '1');
  assert.equal(tentativas, 3);
  assert.ok(logs.every((mensagem) => !mensagem.includes('/rest/1/token')));
});

test('nao cria contato quando o codigo Sankhya ja existe', async () => {
  const metodos = [];
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    logger: { error() {} },
    httpClient: {
      async post(url) {
        const metodo = url.match(/\/([^/]+)\.json$/)?.[1];
        metodos.push(metodo);
        return { data: { result: [{ ID: '99', NAME: '123 - CLIENTE EXISTENTE', ORIGIN_ID: 'SANKHYA:123' }] } };
      }
    }
  });

  const resultado = await service.criarContato({ codigo: 123, nome: 'CLIENTE EXISTENTE' });
  assert.equal(resultado.criado, false);
  assert.equal(resultado.contato.ID, '99');
  assert.deepEqual(metodos, ['crm.contact.list']);
});

test('cria negocio vinculado e registra o evento do CRM para automacoes', async () => {
  let requisicao;
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    logger: { error() {} },
    httpClient: {
      async post(url, params) {
        requisicao = { url, params };
        return { data: { result: '321' } };
      }
    }
  });

  await service.criarNegocio({
    contactId: '99',
    fields: { TITLE: '123 - CLIENTE', CATEGORY_ID: 12, STAGE_ID: 'C12:NEW', ASSIGNED_BY_ID: 44 }
  });
  assert.match(requisicao.url, /crm\.deal\.add\.json$/);
  assert.equal(requisicao.params.fields.CONTACT_ID, '99');
  assert.deepEqual(requisicao.params.fields.CONTACT_IDS, ['99']);
  assert.equal(requisicao.params.fields.CATEGORY_ID, 12);
  assert.equal(requisicao.params.fields.STAGE_ID, 'C12:NEW');
  assert.equal(requisicao.params.fields.ASSIGNED_BY_ID, 44);
  assert.equal(requisicao.params.params.REGISTER_SONET_EVENT, 'Y');
});

test('cruza o nome do usuario Sankhya com funcionario ativo do Bitrix', async () => {
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    logger: { error() {} },
    httpClient: {
      async post() {
        return { data: { result: [
          { ID: '44', NAME: 'Leonardo', LAST_NAME: 'Silva', ACTIVE: true },
          { ID: '55', NAME: 'Erick', LAST_NAME: 'Souza', ACTIVE: true }
        ] } };
      }
    }
  });

  const usuario = await service.buscarUsuarioPorNome('LEONARDO');
  assert.equal(usuario.ID, '44');
});

test('sincroniza telefone e celular nos multifields corretos do contato', async () => {
  let atualizacao;
  const service = criarBitrixService({
    webhookUrl: 'https://exemplo.bitrix24.com/rest/1/token',
    logger: { error() {} },
    httpClient: {
      async post(url, params) {
        if (url.includes('crm.contact.get')) {
          return { data: { result: {
            PHONE: [{ ID: '10', VALUE: '+556634616500', VALUE_TYPE: 'WORK' }],
            EMAIL: [{ ID: '20', VALUE: 'antigo@exemplo.com', VALUE_TYPE: 'WORK' }]
          } } };
        }
        atualizacao = params;
        return { data: { result: true } };
      }
    }
  });

  await service.sincronizarContato('99', {
    telefone: [
      { value: '66 3461-6500', valueType: 'WORK' },
      { value: '66 99971-2427', valueType: 'MOBILE' }
    ],
    email: ['cliente@exemplo.com']
  });
  assert.deepEqual(atualizacao.fields.PHONE, [
    { ID: '10', VALUE: '+556634616500', VALUE_TYPE: 'WORK' },
    { VALUE: '+556699712427', VALUE_TYPE: 'MOBILE' }
  ]);
  assert.deepEqual(atualizacao.fields.EMAIL, [
    { ID: '20', VALUE: 'cliente@exemplo.com', VALUE_TYPE: 'WORK' }
  ]);
});
