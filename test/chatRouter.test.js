const test = require('node:test');
const assert = require('node:assert/strict');

const chatRouter = require('../api/chatRouter');
const whatsappApi = require('../api/whatsappApi');

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

test('filtra conversas por atendente sem alterar os filtros existentes', () => {
  const conversa = { assignment: { userId: '72' } };
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente(conversa, { agentId: '72' }), true);
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente(conversa, { agentId: '81' }), false);
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente({}, { assignment: 'UNASSIGNED' }), true);
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente(conversa, {
    assignment: 'MINE', currentAgentId: '72'
  }), true);
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente({ unreadCount: 2 }, {
    assignment: 'ALL', unreadOnly: true
  }), true);
  assert.equal(chatRouter._internals.conversaCorrespondeFiltroAtendente({ unreadCount: 0 }, {
    assignment: 'ALL', unreadOnly: true
  }), false);
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

test('valida identificadores de chamada e monta somente a identidade pública do atendente', () => {
  assert.equal(chatRouter._internals.idChamadaWhatsapp('call_abc-123'), 'call_abc-123');
  assert.equal(chatRouter._internals.idChamadaWhatsapp('../ chamada'), '');
  assert.equal(chatRouter._internals.idClienteChamada('device-123', { id: 72 }), 'device-123');
  assert.equal(chatRouter._internals.idClienteChamada('curto', { id: 72 }), 'legacy:72');
  assert.equal(chatRouter._internals.atendenteChamada({ id: 72 }, 'device-123').clientId, 'device-123');
  assert.deepEqual(chatRouter._internals.agenteChamada({
    id: 72,
    name: 'Leonardo',
    director: true,
    token: 'nao-deve-sair'
  }), { id: '72', name: 'Leonardo', director: true });
});

test('garante posse exclusiva da chamada ao primeiro atendente', () => {
  const controle = chatRouter._internals.criarControleChamadas();
  const primeiroDispositivo = { id: 72, name: 'Leonardo', clientId: 'device-a' };
  const primeiro = controle.reivindicar('call-1', 12, primeiroDispositivo);
  assert.equal(primeiro.criado, true);
  assert.equal(controle.reivindicar('call-1', 12, primeiroDispositivo).criado, false);
  assert.throws(
    () => controle.reivindicar('call-1', 12, { id: 72, name: 'Leonardo', clientId: 'device-b' }),
    (error) => error.status === 409 && /Leonardo/i.test(error.message)
  );
  assert.throws(
    () => controle.reivindicar('call-1', 12, { id: 81, name: 'Outro', clientId: 'device-c' }),
    (error) => error.status === 409 && /Leonardo/i.test(error.message)
  );
  assert.throws(
    () => controle.exigir('call-1', { id: 81, name: 'Outro', director: true, clientId: 'device-c' }),
    (error) => error.status === 409
  );
  assert.equal(controle.liberar('call-1', { id: 72, clientId: 'device-b' }), false);
  assert.equal(controle.liberar('call-1', primeiroDispositivo), true);
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
      channel: { id: 1 },
      contact: { name: 'Parceiro Sankhya', phone: '5566999633482' },
      lastMessage: { id: 1, text: 'Template' },
      lastMessageAt: '2026-08-17T17:15:00.000Z',
      serviceWindow: { canSendFreeform: false }
    },
    {
      id: 35,
      channel: { id: 1 },
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

test('gera identidades persistentes somente para o canal consolidado do contato', () => {
  assert.deepEqual(
    new Set(chatRouter._internals.chavesIdentidadeConversa({
      id: 19,
      channel: { id: 2 },
      relatedConversationIds: [19, 20],
      contact: { phone: '556692339094' }
    })),
    new Set(['id:19', 'id:20', 'channel:id:2:phone:556692339094'])
  );
});

test('converte todos os eventos de atendimento em registros internos', () => {
  const { mensagemInternaAtribuicao } = chatRouter._internals;
  const message = mensagemInternaAtribuicao({
    acao: 'CLAIM',
    atorId: '72',
    atorNome: 'Leonardo',
    destinoId: '72',
    destinoNome: 'Leonardo',
    em: '2026-09-01T14:30:00.000Z'
  }, 15);
  assert.equal(message.type, 'internal');
  assert.equal(message.direction, 'INTERNAL');
  assert.equal(message.text, 'Atendente Leonardo assumiu o atendimento');
  assert.equal(message.messageTimestamp, '2026-09-01T14:30:00.000Z');
  assert.equal(mensagemInternaAtribuicao({
    acao: 'TRANSFER', atorNome: 'Leonardo', destinoNome: 'Nataly', destinoId: '81', em: '2026-09-01T14:31:00.000Z'
  }, 15).text, 'Atendente Leonardo transferiu o atendimento para Nataly');
  assert.equal(mensagemInternaAtribuicao({
    acao: 'CALL_TRANSFER', atorNome: 'Nataly', destinoNome: 'Michele', destinoId: '90', em: '2026-09-01T14:32:00.000Z'
  }, 15).text, 'Atendente Nataly transferiu a ligação para Michele');
  assert.equal(mensagemInternaAtribuicao({
    acao: 'RELEASE', atorNome: 'Michele', origemNome: 'Michele', em: '2026-09-01T14:33:00.000Z'
  }, 15).text, 'Atendente Michele liberou o atendimento');
  assert.equal(mensagemInternaAtribuicao({
    acao: 'EXPIRE', atorNome: 'Sistema', origemNome: 'Michele', em: '2026-09-02T14:33:00.000Z'
  }, 15).text, 'Atendimento de Michele ficou sem atendente após 24 horas sem interação');
});

test('remove eventos repetidos que não alteram o responsável', () => {
  const mensagens = chatRouter._internals.mensagensInternasDeEventos([
    { acao: 'CLAIM', destinoId: '72', destinoNome: 'Leonardo', em: '2026-09-01T14:30:00.000Z' },
    { acao: 'CLAIM', destinoId: '72', destinoNome: 'Leonardo', em: '2026-09-01T14:30:00.003Z' },
    { acao: 'TRANSFER', atorId: '72', atorNome: 'Leonardo', destinoId: '81', destinoNome: 'Nataly', em: '2026-09-01T14:31:00.000Z' },
    { acao: 'TRANSFER', atorId: '72', atorNome: 'Leonardo', destinoId: '81', destinoNome: 'Nataly', em: '2026-09-01T14:31:00.004Z' },
    { acao: 'EXPIRE', origemId: '81', origemNome: 'Nataly', em: '2026-09-02T14:31:00.000Z' }
  ], 15);
  assert.deepEqual(mensagens.map((item) => item.text), [
    'Atendente Leonardo assumiu o atendimento',
    'Atendente Leonardo transferiu o atendimento para Nataly',
    'Atendimento de Nataly ficou sem atendente após 24 horas sem interação'
  ]);
});

test('impede o atendente de assumir novamente o próprio atendimento', () => {
  assert.throws(
    () => chatRouter._internals.impedirReassumirAtendimento({ userId: '72' }, { id: '72' }),
    (error) => error.status === 409 && /já está atribuído a você/.test(error.message)
  );
  assert.doesNotThrow(() => chatRouter._internals.impedirReassumirAtendimento({ userId: '81' }, { id: '72' }));
});

test('preserva o next em middleware assíncrono de autorização', async () => {
  let nextCalled = false;
  const middleware = chatRouter._internals.asyncRoute(async (_req, _res, next) => next());
  await middleware({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('restringe os canais do chat ao perfil configurado do atendente', () => {
  const { atendentePodeAcessarCanal, atendentePodeAcessarConversa } = chatRouter._internals;
  const atendente = { director: false, channelIds: ['101'] };
  assert.equal(atendentePodeAcessarCanal(atendente, '101'), true);
  assert.equal(atendentePodeAcessarCanal(atendente, '202'), false);
  assert.equal(atendentePodeAcessarConversa(atendente, { channel: { id: '101' } }), true);
  assert.equal(atendentePodeAcessarConversa(atendente, { channelId: '202' }), false);
  assert.equal(atendentePodeAcessarCanal({ director: true, channelIds: [] }, '202'), true);
  assert.equal(atendentePodeAcessarCanal({ director: false, channelIds: null }, '202'), true);
});

test('reconhece somente o destinatário atual de uma transferência entre números', () => {
  const { atribuicaoTransferidaParaAtendente } = chatRouter._internals;
  const transferencia = {
    userId: '81',
    assignmentAction: 'TRANSFER',
    assignedAt: '2026-08-31T12:00:00.000Z'
  };
  assert.equal(atribuicaoTransferidaParaAtendente(transferencia, { id: '81' }), true);
  assert.equal(atribuicaoTransferidaParaAtendente(transferencia, { id: '72' }), false);
  assert.equal(atribuicaoTransferidaParaAtendente({ ...transferencia, assignmentAction: 'CLAIM' }, { id: '81' }), false);
  assert.equal(atribuicaoTransferidaParaAtendente({
    userId: '81',
    historico: [{ acao: 'CALL_TRANSFER' }]
  }, { id: '81' }), true);
});

test('faz chamada direta tocar somente para atendente liberado no número', () => {
  const { atendentePodeReceberEventoChamada } = chatRouter._internals;
  const zenaide = { id: '81', director: false, channelIds: ['101'] };
  assert.equal(atendentePodeReceberEventoChamada(zenaide, 'call:incoming', {
    callId: 'call-1', channel: { id: '101' }
  }), true);
  assert.equal(atendentePodeReceberEventoChamada(zenaide, 'call:incoming', {
    callId: 'call-2', channel: { id: '202' }
  }), false);
});

test('permite transferência de chamada mesmo quando o número não está liberado', () => {
  const { atendentePodeReceberEventoChamada } = chatRouter._internals;
  const zenaide = { id: '81', director: false, channelIds: ['101'] };
  assert.equal(atendentePodeReceberEventoChamada(zenaide, 'call:transfer:incoming', {
    callId: 'call-2', conversationId: 50, toAgent: { id: '81' }
  }), true);
  assert.equal(atendentePodeReceberEventoChamada(zenaide, 'call:active', {
    callId: 'call-2', channel: { id: '202' }, currentAgent: { id: '81' }
  }), true);
});

test('não consolida o mesmo cliente quando as conversas pertencem a canais diferentes', () => {
  const conversations = chatRouter._internals.consolidarConversas([
    { id: 41, channel: { id: 1 }, contact: { phone: '5566999990000' } },
    { id: 42, channel: { id: 2 }, contact: { phone: '5566999990000' } }
  ]);
  assert.deepEqual(conversations.map((item) => item.id), [41, 42]);
});

test('considera a liberação mais recente acima de uma atribuição antiga de ID relacionado', () => {
  const atribuicao = chatRouter._internals.obterAtribuicaoMaisRecente([
    {
      conversationId: 10,
      userId: '72',
      userName: 'Leonardo',
      assignedAt: '2026-08-25T12:00:00.000Z',
      historico: [{ acao: 'CLAIM', em: '2026-08-25T12:00:00.000Z' }]
    },
    {
      conversationId: 11,
      userId: null,
      userName: null,
      assignedAt: null,
      historico: [{ acao: 'RELEASE', em: '2026-08-25T12:05:00.000Z' }]
    }
  ]);

  assert.equal(atribuicao.conversationId, 11);
  assert.equal(atribuicao.userId, null);
});

test('resolve todos os ids relacionados de uma conversa consolidada', () => {
  const [conversation] = chatRouter._internals.consolidarConversas([
    { id: 71, channel: { id: 1 }, contact: { phone: '5566999990000' } },
    { id: 72, channel: { id: 1 }, contact: { phone: '5566999990000' } }
  ]);
  assert.deepEqual(new Set(chatRouter._internals.idsRelacionadosConversa(conversation)), new Set([71, 72]));
  assert.deepEqual(new Set(chatRouter._internals.idsRelacionadosConversa({ id: 72 })), new Set([71, 72]));
});

test('marca todos os registros relacionados da conversa como lidos', async () => {
  chatRouter._internals.consolidarConversas([
    { id: 171, channel: { id: 1 }, contact: { phone: '5566999990171' }, unreadCount: 4 },
    { id: 172, channel: { id: 1 }, contact: { phone: '5566999990171' }, unreadCount: 6 }
  ]);
  const original = whatsappApi.markConversationRead;
  const calls = [];
  whatsappApi.markConversationRead = async (conversationId) => {
    calls.push(conversationId);
    return { success: true };
  };
  try {
    await chatRouter._internals.marcarGrupoConversaComoLida(171);
  } finally {
    whatsappApi.markConversationRead = original;
  }
  assert.deepEqual(new Set(calls), new Set([171, 172]));
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
