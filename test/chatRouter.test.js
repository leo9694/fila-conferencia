const test = require('node:test');
const assert = require('node:assert/strict');

const chatRouter = require('../api/chatRouter');

test('não transforma falha de autenticação do WhatsApp em sessão local expirada', () => {
  assert.equal(chatRouter._internals.responseStatus({ status: 401 }), 502);
  assert.equal(chatRouter._internals.responseStatus({ status: 403 }), 502);
});

test('preserva erros funcionais válidos da integração', () => {
  assert.equal(chatRouter._internals.responseStatus({ status: 400 }), 400);
  assert.equal(chatRouter._internals.responseStatus({ status: 429 }), 429);
  assert.equal(chatRouter._internals.responseStatus({ status: 503 }), 503);
});

test('identifica autenticação recusada pela Meta sem confundir com a chave interna', () => {
  assert.equal(chatRouter._internals.isMetaAuthError({
    status: 401,
    integrationCode: 'META_API_ERROR'
  }), true);
  assert.equal(chatRouter._internals.isMetaAuthError({
    status: 401,
    message: 'Não autorizado.'
  }), false);
});

test('omite da lista de atendentes usuários com limite de acesso expirado', () => {
  assert.equal(
    chatRouter._internals.filtroAcessoAtivo('USU'),
    '(USU.DTLIMACESSO IS NULL OR USU.DTLIMACESSO >= TRUNC(SYSDATE))'
  );
});

test('normaliza telefone brasileiro para o formato internacional do WhatsApp', () => {
  assert.equal(chatRouter._internals.normalizarTelefoneWhatsapp('(66) 99999-0000'), '5566999990000');
  assert.equal(chatRouter._internals.normalizarTelefoneWhatsapp('+55 66 99999-0000'), '5566999990000');
});

test('aceita WAMID e bloqueia reações inválidas antes de chamar a integração', () => {
  assert.equal(
    chatRouter._internals.idMensagemWhatsapp('wamid.HBgMNTUzMDEyMzQ1Njc4OQ=='),
    'wamid.HBgMNTUzMDEyMzQ1Njc4OQ=='
  );
  assert.equal(chatRouter._internals.idMensagemWhatsapp('id com espaço'), '');
  assert.equal(chatRouter._internals.reacaoValida('👏'), '👏');
  assert.equal(chatRouter._internals.reacaoValida('texto\nindevido'), '');
});

test('trata números móveis da Meta com e sem o nono dígito como o mesmo WhatsApp', () => {
  assert.equal(chatRouter._internals.identidadeTelefoneWhatsapp('5566999633482'), '556699633482');
  assert.equal(chatRouter._internals.identidadeTelefoneWhatsapp('556699633482'), '556699633482');
  assert.deepEqual(
    new Set(chatRouter._internals.variantesTelefoneWhatsapp('5566999633482')),
    new Set(['5566999633482', '556699633482'])
  );
});

test('gera variantes nacionais e internacionais para localizar o telefone no Sankhya', () => {
  assert.deepEqual(
    new Set(chatRouter._internals.variantesTelefoneSankhya('(66) 99963-3482')),
    new Set(['5566999633482', '556699633482', '66999633482', '6699633482'])
  );
});

test('resume os vínculos Sankhya encontrados sem duplicar o mesmo contato', () => {
  const cadastro = chatRouter._internals.cadastroSankhyaSelecionado([
    { codParc: 9151, nomeParc: 'ZENAIDE', codContato: 2, nomeContato: 'COMPRAS', origem: 'CONTATO', telefone: '5566999991234' },
    { codParc: 9151, nomeParc: 'ZENAIDE', codContato: 2, nomeContato: 'COMPRAS', origem: 'CONTATO', telefone: '5566999991234' }
  ]);
  assert.equal(cadastro.verificado, true);
  assert.equal(cadastro.codParc, 9151);
  assert.equal(cadastro.nomeContato, 'COMPRAS');
  assert.equal(cadastro.parceiros.length, 1);
});

test('consolida conversas duplicadas pelo telefone e preserva histórico e janela aberta', () => {
  const [conversation] = chatRouter._internals.consolidarConversas([
    {
      id: 34,
      contact: { name: 'Parceiro Sankhya', phone: '5566999633482' },
      lastMessage: { id: 1, text: 'Template' },
      lastMessageAt: '2026-08-17T17:15:00.000Z',
      serviceWindow: { canSendFreeform: false }
    },
    {
      id: 35,
      contact: { name: 'Perfil Meta', phone: '556699633482' },
      lastMessage: { id: 2, text: 'Olá' },
      lastMessageAt: '2026-08-17T17:24:00.000Z',
      serviceWindow: { canSendFreeform: true }
    }
  ]);
  assert.equal(conversation.id, 34);
  assert.equal(conversation.contact.name, 'Parceiro Sankhya');
  assert.equal(conversation.lastMessage.text, 'Olá');
  assert.equal(conversation.serviceWindow.canSendFreeform, true);
  assert.deepEqual(conversation.relatedConversationIds, [34, 35]);
});

test('gera identidades persistentes para todos os canais consolidados do contato', () => {
  assert.deepEqual(
    new Set(chatRouter._internals.chavesIdentidadeConversa({
      id: 19,
      relatedConversationIds: [19, 20],
      contact: { phone: '556692339094' }
    })),
    new Set(['id:19', 'id:20', 'phone:556692339094'])
  );
});

test('escapa texto usado nas buscas de parceiros', () => {
  assert.equal(chatRouter._internals.textoSql("D'ÁVILA"), "D''ÁVILA");
});

test('aceita o pipeline padrão do Bitrix com categoria zero', () => {
  assert.equal(chatRouter._internals.idPipelineBitrix(0), 0);
  assert.equal(chatRouter._internals.idPipelineBitrix('7'), 7);
  assert.equal(chatRouter._internals.idPipelineBitrix(''), null);
  assert.equal(chatRouter._internals.idPipelineBitrix(-1), null);
});

test('libera o responsável após 24 horas sem interação', () => {
  const agora = Date.UTC(2026, 7, 19, 15, 0, 0);
  assert.equal(chatRouter._internals.atribuicaoExpirada({
    userId: '72',
    assignedAt: new Date(agora - (24 * 60 * 60 * 1000)).toISOString(),
    lastInteractionAt: new Date(agora - (24 * 60 * 60 * 1000)).toISOString()
  }, {}, agora), true);
  assert.equal(chatRouter._internals.atribuicaoExpirada({
    userId: '72',
    assignedAt: new Date(agora - (23 * 60 * 60 * 1000)).toISOString(),
    lastInteractionAt: new Date(agora - (23 * 60 * 60 * 1000)).toISOString()
  }, {}, agora), false);
});

test('seleciona a primeira etapa aberta do pipeline', () => {
  const etapa = chatRouter._internals.primeiraEtapaAberta([
    { STATUS_ID: 'C4:WON', SEMANTICS: 'S', SORT: 10 },
    { STATUS_ID: 'C4:SECOND', SEMANTICS: '', SORT: 20 },
    { STATUS_ID: 'C4:FIRST', SEMANTICS: '', SORT: 5 }
  ]);
  assert.equal(etapa.STATUS_ID, 'C4:FIRST');
});

test('considera concluído o card que avançou após a etapa Em andamento', () => {
  const status = chatRouter._internals.statusCardConcluido(
    { stageId: 'C4:NEW' },
    { stages: [
      { id: 'C4:NEW', name: 'Novo', sort: 10 },
      { id: 'C4:PROGRESS', name: 'Em andamento', sort: 20 },
      { id: 'C4:REVIEW', name: 'Em revisão', sort: 30 }
    ] },
    { STAGE_ID: 'C4:REVIEW' }
  );
  assert.equal(status.concluido, true);
  assert.equal(status.stageName, 'Em revisão');
});

test('mantém ativo o card no estágio Em andamento', () => {
  const status = chatRouter._internals.statusCardConcluido(
    { stageId: 'C4:NEW' },
    { stages: [
      { id: 'C4:NEW', name: 'Novo', sort: 10 },
      { id: 'C4:PROGRESS', name: 'Em andamento', sort: 20 },
      { id: 'C4:REVIEW', name: 'Em revisão', sort: 30 }
    ] },
    { STAGE_ID: 'C4:PROGRESS' }
  );
  assert.equal(status.concluido, false);
});

test('arquiva os estágios finais específicos do pipeline de cobrança', () => {
  for (const stageName of ['Renegociado', 'Cliente bloqueou', 'Analisar falha', 'Pago']) {
    const status = chatRouter._internals.statusCardConcluido(
      {},
      { name: 'Cobrança Financeira', stages: [{ id: 'C6:END', name: stageName, sort: 10 }] },
      { STAGE_ID: 'C6:END' }
    );
    assert.equal(status.concluido, true, stageName);
  }
});

test('normaliza o nome antes de criar contato do WhatsApp no Sankhya', () => {
  assert.equal(
    chatRouter._internals.textoContatoChat('  Maria\n  da   Silva  ', 40),
    'Maria da Silva'
  );
  assert.equal(chatRouter._internals.textoContatoChat('A'.repeat(50), 15), 'A'.repeat(15));
});
