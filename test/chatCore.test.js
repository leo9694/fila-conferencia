const test = require('node:test');
const assert = require('node:assert/strict');
const ChatCore = require('../frontend/chat-core');

test('exibe nome do contato e usa telefone como fallback', () => {
  assert.equal(ChatCore.contactName({ contact: { profileName: 'Maria' } }), 'Maria');
  assert.equal(ChatCore.contactName({ contact: { phone: '556599999999' } }), '556599999999');
  assert.equal(ChatCore.contactName({
    contact: { profileName: 'Nome do WhatsApp' },
    cadastroSankhya: { nomeContato: 'Maria Compras' }
  }), 'Maria Compras');
  assert.equal(ChatCore.contactName({
    displayName: 'Emilly Financeiro',
    cadastroSankhya: { nomeContato: 'Maria Compras' }
  }), 'Emilly Financeiro');
});

test('identifica a mesma conversa pelo telefone somente dentro do mesmo canal', () => {
  assert.deepEqual(ChatCore.conversationIdentityKeys({ id: 12, channel: { id: 2 }, contact: { phone: '+55 (66) 99999-0000' } }), [
    'id:12',
    'channel:id:2:phone:5566999990000'
  ]);
  assert.notEqual(
    ChatCore.conversationIdentityKeys({ id: 99, channel: { id: 1 }, contact: { waId: '5566999990000' } })[1],
    ChatCore.conversationIdentityKeys({ id: 100, channel: { id: 2 }, contact: { waId: '5566999990000' } })[1]
  );
});

test('gera prévias seguras para texto e mídias suportadas', () => {
  assert.equal(ChatCore.messagePreview({ type: 'text', text: ' Bom dia ' }), 'Bom dia');
  assert.match(ChatCore.messagePreview({ type: 'image' }), /Imagem/);
  assert.match(ChatCore.messagePreview({ type: 'audio' }), /Áudio/);
  assert.match(ChatCore.messagePreview({ type: 'document' }), /Documento/);
  assert.match(ChatCore.messagePreview({ type: 'unknown' }), /não suportada/);
  assert.match(ChatCore.messagePreview(null), /não suportada/);
});

test('não permite mensagem vazia nem envio duplicado', () => {
  assert.equal(ChatCore.canSendText('   '), false);
  assert.equal(ChatCore.canSendText('Olá', true), false);
  assert.equal(ChatCore.canSendText('Olá', false), true);
});

test('mescla message:new sem duplicar e mantém ordem cronológica', () => {
  const messages = ChatCore.mergeById(
    [{ id: 2, text: 'dois', messageTimestamp: '2026-08-13T10:02:00Z' }],
    [{ id: 1, text: 'um', messageTimestamp: '2026-08-13T10:01:00Z' }, { id: 2, status: 'READ' }]
  );
  assert.deepEqual(messages.map((item) => item.id), [1, 2]);
  assert.equal(messages[1].status, 'READ');
});

test('normaliza e intercala chamadas com mensagens pela data', () => {
  const calls = ChatCore.normalizeCalls({ data: { items: [
    { id: 'call-1', status: 'MISSED', createdAt: '2026-08-13T10:01:00Z' }
  ] } });
  const timeline = ChatCore.mergeTimeline([
    { id: 2, text: 'depois', messageTimestamp: '2026-08-13T10:02:00Z' }
  ], calls);
  assert.deepEqual(timeline.map((item) => item.kind), ['call', 'message']);
});

test('descreve chamadas não atendidas e concluídas', () => {
  assert.deepEqual(ChatCore.callTimelineInfo({ direction: 'INBOUND', status: 'MISSED' }), {
    direction: 'INBOUND',
    outbound: false,
    icon: 'phone-incoming',
    title: 'Ligação de voz',
    subtitle: 'Não atendida',
    statusClass: 'missed'
  });
  assert.equal(ChatCore.callTimelineInfo({ direction: 'OUTBOUND', status: 'ENDED', durationSeconds: 75 }).subtitle, 'Duração 01:15');
});

test('deduplica template pela wamid quando a atualização chega com outro id', () => {
  const messages = ChatCore.mergeById(
    [{ id: 1, wamid: 'wamid.template', type: 'template', status: 'SENT' }],
    [{ id: 2, wamid: 'wamid.template', type: 'template', status: 'DELIVERED' }]
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'DELIVERED');
});

test('substitui mensagem otimista pela confirmação sem duplicar no chat', () => {
  const pending = {
    id: 'pending-1', clientMessageId: 'pending-1', optimistic: true,
    direction: 'OUTBOUND', type: 'text', text: '*Leo:*\nOlá', status: 'PENDING'
  };
  const confirmed = {
    id: 91, wamid: 'wamid.91', direction: 'OUTBOUND', type: 'text',
    text: '*Leo:*\nOlá', status: 'SENT'
  };
  const messages = ChatCore.mergeOptimisticMessage([pending], confirmed);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 91);
  assert.equal(messages[0].status, 'SENT');
  assert.equal(messages[0].optimistic, false);
});

test('mantém mensagem visível e marca falha quando envio otimista não conclui', () => {
  const [message] = ChatCore.failOptimisticMessage([{
    id: 'pending-2', clientMessageId: 'pending-2', optimistic: true, status: 'PENDING'
  }], 'pending-2', 'Integração indisponível');
  assert.equal(message.status, 'FAILED');
  assert.equal(message.optimistic, false);
  assert.equal(ChatCore.messageFailureReason(message).text, 'Integração indisponível');
});

test('identifica visualmente mensagem que ainda está sendo enviada', () => {
  assert.deepEqual(ChatCore.statusSymbol('PENDING'), {
    symbol: '◷', label: 'Enviando', pending: true
  });
});

test('mostra o corpo do template como prévia da conversa', () => {
  assert.equal(ChatCore.messagePreview({ type: 'template', template: { body: 'Olá Maria' } }), 'Olá Maria');
});

test('mostra resposta de botão histórica salva como interactive', () => {
  const message = { type: 'interactive', text: JSON.stringify({ button_reply: { title: 'Sim!' } }) };
  assert.equal(ChatCore.interactiveReplyText(message), 'Sim!');
  assert.equal(ChatCore.messagePreview(message), 'Sim!');
});

test('reconhece reações da Meta sem exibir o JSON bruto', () => {
  const message = {
    type: 'text',
    text: JSON.stringify({ message_id: 'wamid.HBgM...', emoji: '👏' })
  };
  assert.deepEqual(ChatCore.reactionInfo(message), { emoji: '👏', messageId: 'wamid.HBgM...' });
  assert.equal(ChatCore.messagePreview(message), 'Reagiu com 👏');
});

test('localiza o identificador da Meta para reagir em mensagens novas', () => {
  assert.equal(ChatCore.reactionTarget({ wamid: 'wamid.HBgM.1' }), 'wamid.HBgM.1');
  assert.equal(ChatCore.reactionTarget({ message_id: 'wamid.HBgM.2' }), 'wamid.HBgM.2');
  assert.equal(ChatCore.reactionTarget({ meta: { messageId: 'wamid.HBgM.3' } }), 'wamid.HBgM.3');
  assert.equal(ChatCore.reactionTarget({ id: 'wamid.HBgM.4' }), 'wamid.HBgM.4');
  assert.equal(ChatCore.reactionTarget({ wamid: 'wamid.HBgM+abc/def==' }), 'wamid.HBgM+abc/def==');
  assert.equal(ChatCore.reactionTarget({ id: 42 }), '');
});

test('normaliza o contexto de uma mensagem respondida', () => {
  assert.deepEqual(ChatCore.replyContext({
    replyContext: {
      messageId: 'wamid.original',
      text: 'Mensagem original',
      senderName: 'Cliente',
      direction: 'INBOUND'
    }
  }), {
    messageId: 'wamid.original',
    text: 'Mensagem original',
    senderName: 'Cliente',
    direction: 'INBOUND'
  });
  assert.equal(ChatCore.replyContext({ replyContext: '{"messageId":"wamid.2","text":"Oi"}' }).text, 'Oi');
  assert.equal(ChatCore.replyContext({}), null);
});

test('extrai nome e telefone de um contato compartilhado pela Meta', () => {
  const message = {
    type: 'contacts',
    text: JSON.stringify({
      contacts: [{
        name: { formatted_name: 'Leonardo - TI - NORTE SUL' },
        phones: [{ phone: '+5565999999999' }]
      }]
    })
  };
  assert.deepEqual(ChatCore.sharedContact(message), {
    name: 'Leonardo - TI - NORTE SUL',
    phone: '+5565999999999'
  });
});

test('normaliza números para localizar uma conversa já existente', () => {
  assert.equal(ChatCore.normalizePhone('+55 (66) 9233-9094'), '556692339094');
});

test('atualiza status por id ou wamid', () => {
  const messages = [{ id: 1, wamid: 'wamid.1', status: 'SENT' }];
  assert.equal(ChatCore.updateMessageStatus(messages, { messageId: 1, status: 'DELIVERED' })[0].status, 'DELIVERED');
  assert.equal(ChatCore.updateMessageStatus(messages, { wamid: 'wamid.1', status: 'READ' })[0].status, 'READ');
  assert.equal(ChatCore.updateMessageStatus(messages, { messageId: 'wamid.1', status: 'read' })[0].status, 'read');
  assert.equal(ChatCore.updateMessageStatus([{ wamid: 'wamid.1', status: 'READ' }], { message_id: 'wamid.1', status: 'delivered' })[0].status, 'READ');
  assert.equal(ChatCore.statusSymbol('READ').read, true);
  assert.equal(ChatCore.statusSymbol('DELIVERED').delivered, true);
  assert.equal(ChatCore.statusSymbol('FAILED').failed, true);
});

test('explica a falha de entrega devolvida pela Meta', () => {
  assert.deepEqual(ChatCore.messageFailureReason({
    failureDetails: [{ code: 131026, title: 'Message undeliverable' }]
  }), {
    code: '131026',
    text: 'A mensagem não pôde ser entregue ao destinatário.'
  });
  assert.match(ChatCore.messageFailureReason({ status: 'FAILED' }).text, /não informou/i);
});

test('desembrulha respostas padronizadas da API', () => {
  assert.deepEqual(ChatCore.unwrap({ success: true, data: { id: 1 } }), { id: 1 });
  assert.deepEqual(ChatCore.unwrap({ data: [1] }), { data: [1] });
});

test('usa serviceWindow como fonte de verdade para o estado do atendimento', () => {
  assert.equal(ChatCore.serviceWindowState({ serviceWindow: { conversationInitiated: true, waitingForCustomerReply: true, initialTemplateStatus: 'DELIVERED' } }).key, 'awaiting-reply');
  assert.equal(ChatCore.serviceWindowState({ serviceWindow: { conversationInitiated: true, canSendFreeform: true } }).key, 'open');
  assert.equal(ChatCore.serviceWindowState({ serviceWindow: { conversationInitiated: true, waitingForCustomerReply: false, canSendFreeform: false } }).key, 'expired');
});

test('carrega histÃ³rico ao chegar ao topo ou quando o primeiro lote nÃ£o preenche a tela', () => {
  assert.equal(ChatCore.shouldLoadOlderMessages({ scrollTop: 60, scrollHeight: 1200, clientHeight: 600 }), true);
  assert.equal(ChatCore.shouldLoadOlderMessages(
    { scrollTop: 200, scrollHeight: 500, clientHeight: 600 },
    { fillViewport: true, fillRatio: 1.25 }
  ), true);
  assert.equal(ChatCore.shouldLoadOlderMessages({ scrollTop: 200, scrollHeight: 1200, clientHeight: 600 }), false);
});

test('carrega mais conversas ao chegar ao fim da lista ou quando o lote não preenche a área', () => {
  assert.equal(ChatCore.shouldLoadMoreConversations({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 }), true);
  assert.equal(ChatCore.shouldLoadMoreConversations({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 }), true);
  assert.equal(ChatCore.shouldLoadMoreConversations({ scrollTop: 100, scrollHeight: 1200, clientHeight: 400 }), false);
});

test('mescla páginas sem repetir telefone no mesmo canal e preserva outro canal', () => {
  const result = ChatCore.mergeConversationPages([
    { id: 10, channel: { id: 1 }, contact: { phone: '5566999990000', name: 'Cliente' }, lastMessageAt: '2026-08-20T10:00:00Z' }
  ], [
    { id: 11, channel: { id: 1 }, contact: { phone: '+55 (66) 99999-0000' }, lastMessageAt: '2026-08-19T10:00:00Z' },
    { id: 12, channel: { id: 2 }, contact: { phone: '5566999990000', name: 'Cliente' } }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 10);
  assert.deepEqual(result[0].relatedConversationIds, [10, 11]);
});

test('só reutiliza a conversa quando id ativo e objeto carregado pertencem ao mesmo chat', () => {
  assert.equal(ChatCore.isLoadedConversation(20, { id: 20 }, 20), true);
  assert.equal(ChatCore.isLoadedConversation(20, { id: 19 }, 20), false);
  assert.equal(ChatCore.isLoadedConversation(20, null, 20), false);
});

test('normaliza a lista de canais no formato real e no envelope padronizado', () => {
  const channels = [{ id: 1, displayName: 'Norte Sul Sementes' }];
  assert.deepEqual(ChatCore.normalizeChannels({ data: channels }), channels);
  assert.deepEqual(ChatCore.normalizeChannels({ success: true, data: channels }), channels);
});

test('distingue atualização direta de atualização de conversa relacionada', () => {
  assert.equal(ChatCore.conversationUpdateScope(20, { conversation: { id: 20 } }), 'DIRECT');
  assert.equal(ChatCore.conversationUpdateScope(20, {
    conversation: { id: 21, relatedConversationIds: [20] }
  }), 'RELATED');
  assert.equal(ChatCore.conversationUpdateScope(20, {
    conversation: { id: 21 }
  }, { id: 20, relatedConversationIds: [21] }), 'RELATED');
  assert.equal(ChatCore.conversationUpdateScope(20, {
    conversation: { id: 21, relatedConversationIds: [22] }
  }), 'NONE');
});

test('mescla resumo assíncrono sem apagar os detalhes já carregados da conversa', () => {
  const atual = {
    id: 20,
    contact: { name: 'Cliente completo', phone: '5566999990000', partnerCode: 8342 },
    assignment: { agentId: 72, agentName: 'LEONARDO' },
    serviceWindow: { canSendFreeform: true, expiresAt: '2026-08-26T12:00:00Z' },
    bitrix: { cards: [{ id: 11048 }] }
  };
  const merged = ChatCore.mergeConversationSnapshot(atual, {
    id: 20,
    contact: { name: 'Cliente atualizado' },
    assignment: undefined,
    unreadCount: 3
  });

  assert.equal(merged.contact.name, 'Cliente atualizado');
  assert.equal(merged.contact.phone, '5566999990000');
  assert.equal(merged.contact.partnerCode, 8342);
  assert.deepEqual(merged.assignment, atual.assignment);
  assert.equal(merged.serviceWindow.canSendFreeform, true);
  assert.equal(merged.bitrix.cards[0].id, 11048);
  assert.equal(merged.unreadCount, 3);
});

test('atualiza a lista assíncrona preservando dados completos de cada card', () => {
  const merged = ChatCore.mergeConversationList([
    { id: 20, contact: { name: 'Cliente', phone: '5566999990000' }, serviceWindow: { canSendFreeform: true } }
  ], [
    { id: 20, contact: { name: 'Cliente' }, unreadCount: 2 }
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].contact.phone, '5566999990000');
  assert.equal(merged[0].serviceWindow.canSendFreeform, true);
  assert.equal(merged[0].unreadCount, 2);
});

test('identifica status de mensagem por qualquer id aceito pela integração', () => {
  assert.equal(ChatCore.messageMatchesUpdate({ id: 12 }, { messageId: 12 }), true);
  assert.equal(ChatCore.messageMatchesUpdate({ wamid: 'wamid.12' }, { message_id: 'wamid.12' }), true);
  assert.equal(ChatCore.messageMatchesUpdate({ wamid: 'wamid.12' }, { messageId: 'wamid.99' }), false);
});
