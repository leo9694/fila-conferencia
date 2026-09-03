const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarChatAtendenteStore } = require('../api/chatAtendenteStore');

test('persiste acesso e perfil do atendente sem guardar credenciais', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-atendentes-'));
  const filePath = path.join(dir, 'atendentes.json');
  const store = criarChatAtendenteStore({ filePath });
  store.salvar(72, {
    habilitado: true,
    nome: 'LEONARDO',
    nomeExibicao: 'Leonardo Gabriel',
    assinatura: 'Leonardo | Norte Sul',
    canaisPermitidos: ['101', '101', '202', 'invalido com espaço']
  }, 1);
  const recarregado = criarChatAtendenteStore({ filePath });
  assert.equal(recarregado.permitido(72), true);
  assert.equal(recarregado.obter(72).assinatura, 'Leonardo | Norte Sul');
  assert.deepEqual(recarregado.obter(72).canaisPermitidos, ['101', '202']);
  assert.deepEqual(recarregado.listarHabilitados().map((item) => item.codUsu), [72]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('mantém a atribuição do atendimento localmente, sem depender da API externa', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-atendimentos-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.atribuirConversa(123, {
    acao: 'CLAIM',
    ator: { id: '72', name: 'Leonardo' },
    destino: { id: '72', name: 'Leonardo' }
  });
  const recarregado = criarChatAtendenteStore({ filePath });
  assert.equal(recarregado.obterConversa(123).userName, 'Leonardo');
  assert.equal(recarregado.obterConversa(123).assignmentAction, 'CLAIM');
  recarregado.atribuirConversa(123, { acao: 'RELEASE', ator: { id: '72', name: 'Leonardo' } });
  assert.equal(recarregado.obterConversa(123).userId, null);
  assert.equal(recarregado.obterConversa(123).assignmentAction, null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('renova a interação sem trocar o responsável do atendimento', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-interacao-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.atribuirConversa(123, {
    acao: 'CLAIM',
    ator: { id: '72', name: 'Leonardo' },
    destino: { id: '72', name: 'Leonardo' }
  });
  const antes = store.obterConversa(123);
  const momento = '2026-08-19T15:00:00.000Z';
  const atualizado = store.registrarInteracao(123, momento);
  assert.equal(atualizado.userId, '72');
  assert.equal(atualizado.userName, 'Leonardo');
  assert.equal(atualizado.lastInteractionAt, momento);
  assert.equal(atualizado.assignedAt, antes.assignedAt);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('registra origem e horário informado nos eventos de atendimento', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-eventos-'));
  const store = criarChatAtendenteStore({ filePath: path.join(dir, 'atendimentos.json') });
  store.atribuirConversa(123, {
    acao: 'CLAIM', ator: { id: '72', name: 'Leonardo' }, destino: { id: '72', name: 'Leonardo' },
    em: '2026-09-01T14:30:00.000Z'
  });
  const transferida = store.atribuirConversa(123, {
    acao: 'TRANSFER', ator: { id: '72', name: 'Leonardo' }, destino: { id: '81', name: 'Nataly' },
    em: '2026-09-01T14:31:00.000Z'
  });
  const evento = transferida.historico.at(-1);
  assert.equal(evento.origemId, '72');
  assert.equal(evento.origemNome, 'Leonardo');
  assert.equal(evento.destinoId, '81');
  assert.equal(evento.em, '2026-09-01T14:31:00.000Z');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persiste o nome personalizado exibido na conversa', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-renomear-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.renomearConversa(123, 'Emilly Financeiro');
  const recarregado = criarChatAtendenteStore({ filePath });
  assert.equal(recarregado.obterConversa(123).nomeExibicao, 'Emilly Financeiro');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persiste contato avulso sem vínculo Sankhya e conversa sem pipeline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-avulso-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.marcarConversaAvulsa(123);
  store.marcarConversaSemPipeline(123);
  const recarregado = criarChatAtendenteStore({ filePath });
  const conversa = recarregado.obterConversa(123);
  assert.equal(conversa.contatoAvulso, true);
  assert.equal(conversa.bitrixWithoutPipeline, true);
  assert.equal(conversa.bitrixPending, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('mantém mais de um pipeline Bitrix vinculado ao mesmo chat', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-pipelines-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.atribuirConversa(123, {
    acao: 'CLAIM',
    ator: { id: '72', name: 'Leonardo' },
    destino: { id: '72', name: 'Leonardo' }
  });
  store.vincularPipeline(123, { categoryId: 4, categoryName: 'Comercial', dealId: 901, stageId: 'C4:NEW' });
  store.vincularPipeline(123, { categoryId: 7, categoryName: 'Financeiro', dealId: 902, stageId: 'C7:NEW' });
  const recarregado = criarChatAtendenteStore({ filePath });
  assert.deepEqual(recarregado.obterConversa(123).bitrixPipelines.map((item) => item.categoryId), [4, 7]);
  assert.equal(recarregado.obterConversa(123).bitrixPending, false);
  recarregado.atribuirConversa(123, {
    acao: 'TRANSFER',
    ator: { id: '72', name: 'Leonardo' },
    destino: { id: '80', name: 'Erick' }
  });
  assert.equal(recarregado.obterConversa(123).assignmentAction, 'TRANSFER');
  assert.deepEqual(recarregado.obterConversa(123).bitrixPipelines.map((item) => item.categoryId), [4, 7]);
  recarregado.marcarPipelinePendente(123, 'Assumido sem pipeline');
  assert.equal(recarregado.obterConversa(123).bitrixPending, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('arquiva card concluído e libera o mesmo pipeline para um novo card', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-pipeline-history-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  store.vincularPipeline(123, { categoryId: 4, categoryName: 'Comercial', dealId: 901, stageId: 'C4:NEW' });
  store.arquivarPipelinesConcluidos(123, {
    categoryId: 4,
    categoryName: 'Comercial',
    dealId: 901,
    stageId: 'C4:FINAL',
    stageName: 'Concluído'
  });
  const arquivado = store.obterConversa(123);
  assert.deepEqual(arquivado.bitrixPipelines, []);
  assert.equal(arquivado.bitrixPipelineHistory.length, 1);
  assert.equal(arquivado.bitrixPipelineHistory[0].stageName, 'Concluído');
  store.vincularPipeline(123, { categoryId: 4, categoryName: 'Comercial', dealId: 902, stageId: 'C4:NEW' });
  const novo = store.obterConversa(123);
  assert.equal(novo.bitrixPipelines[0].dealId, '902');
  assert.equal(novo.bitrixPipelineHistory[0].dealId, 901);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('persiste chats ocultos por usuário e permite revelá-los novamente', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-ocultos-'));
  const filePath = path.join(dir, 'atendimentos.json');
  const store = criarChatAtendenteStore({ filePath });
  const identidades = ['id:19', 'id:20', 'phone:556692339094'];
  store.ocultarConversa(72, identidades, { nome: 'Leonardo - TI', telefone: '556692339094' });
  const recarregado = criarChatAtendenteStore({ filePath });
  assert.ok(recarregado.obterOcultacao(72, ['phone:556692339094']));
  assert.equal(recarregado.obterOcultacao(116, identidades), null);
  assert.equal(recarregado.revelarConversa(72, identidades), true);
  assert.equal(recarregado.obterOcultacao(72, identidades), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('oculta uma conversa globalmente para todos os usuários e persiste a regra', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-store-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));

  const store = criarChatAtendenteStore({ baseDir });
  store.ocultarConversaGlobal(['id:19', 'phone:556692339094'], {
    nome: 'Leonardo - TI - NORTE SUL',
    telefone: '556692339094'
  });

  assert.equal(store.obterOcultacaoGlobal(['id:19']).nome, 'Leonardo - TI - NORTE SUL');
  assert.equal(store.obterOcultacaoGlobal(['phone:556692339094']).telefone, '556692339094');

  const recarregado = criarChatAtendenteStore({ baseDir });
  assert.ok(recarregado.obterOcultacaoGlobal(['id:19']));
  assert.equal(recarregado.obterOcultacaoGlobal(['id:38']), null);
});

test('revela globalmente todas as identidades do chat quando chega nova atividade', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-store-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));

  const store = criarChatAtendenteStore({ baseDir });
  store.ocultarConversaGlobal(['id:19', 'id:20', 'phone:556692339094']);

  assert.equal(store.revelarConversaGlobal(['id:20']), true);
  assert.equal(store.obterOcultacaoGlobal(['id:19']), null);
  assert.equal(store.obterOcultacaoGlobal(['phone:556692339094']), null);
});
