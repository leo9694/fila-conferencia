(function exposeChatCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createChatCore() {
  const TYPE_LABELS = {
    image: '📷 Imagem',
    document: '📄 Documento',
    audio: '🎤 Áudio',
    video: '🎬 Vídeo',
    sticker: 'Sticker',
    location: 'Localização',
    contacts: 'Contato',
    reaction: 'Reação',
    template: 'Template'
  };

  function unwrap(payload) {
    return payload?.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')
      ? payload.data
      : payload;
  }

  function contact(conversation = {}) {
    return conversation.contact || conversation.Contact || {};
  }

  function contactName(conversation = {}) {
    const value = contact(conversation);
    const displayName = String(conversation.displayName || conversation.nomeExibicao || '').trim();
    const sankhyaName = String(conversation.cadastroSankhya?.nomeContato || '').trim();
    return displayName || sankhyaName || value.name || value.profileName || value.phone || value.waId || 'Contato sem nome';
  }

  function initials(value) {
    return String(value || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  }

  function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function channel(conversation = {}) {
    return conversation.channel || conversation.Channel || null;
  }

  function channelIdentity(conversation = {}) {
    const value = channel(conversation) || {};
    const id = String(value.id ?? conversation.channelId ?? '').trim();
    if (id) return `id:${id}`;
    const phoneNumberId = String(value.phoneNumberId ?? conversation.phoneNumberId ?? '').trim();
    return phoneNumberId ? `phone-number:${phoneNumberId}` : 'legacy';
  }

  function channelLabel(conversation = {}) {
    const value = channel(conversation);
    return String(value?.displayName || value?.name || 'Canal não identificado').trim();
  }

  function normalizeChannels(payload) {
    const value = unwrap(payload);
    if (Array.isArray(value)) return value;
    return Array.isArray(value?.data) ? value.data : [];
  }

  function conversationIdentityKeys(conversation = {}) {
    const value = contact(conversation);
    const id = String(conversation.id ?? conversation.conversationId ?? '').trim();
    const phone = normalizePhone(value.waId || value.phone || conversation.waId || conversation.phone);
    const channelKey = channelIdentity(conversation);
    return [id ? `id:${id}` : '', phone && channelKey !== 'legacy' ? `channel:${channelKey}:phone:${phone}` : ''].filter(Boolean);
  }

  function definedFields(value = {}) {
    return Object.fromEntries(Object.entries(value || {}).filter(([, field]) => field !== undefined));
  }

  function mergeConversationSnapshot(current = {}, incoming = {}) {
    const next = incoming?.conversation || incoming || {};
    const merged = { ...current, ...definedFields(next) };
    ['contact', 'assignment', 'serviceWindow', 'cadastroSankhya', 'bitrix'].forEach((field) => {
      if (next[field] === null) merged[field] = null;
      else if (next[field] && typeof next[field] === 'object' && !Array.isArray(next[field])) {
        merged[field] = { ...(current[field] || {}), ...definedFields(next[field]) };
      }
    });
    const relatedIds = [
      current.id,
      next.id,
      ...(current.relatedConversationIds || []),
      ...(next.relatedConversationIds || [])
    ].map(Number).filter(Number.isInteger);
    if (relatedIds.length) merged.relatedConversationIds = [...new Set(relatedIds)];
    return merged;
  }

  function mergeConversationList(current = [], incoming = []) {
    return incoming.map((conversation) => {
      const keys = new Set(conversationIdentityKeys(conversation));
      const existing = current.find((item) => conversationIdentityKeys(item).some((key) => keys.has(key)));
      return existing ? mergeConversationSnapshot(existing, conversation) : conversation;
    });
  }

  function messagePreview(message = {}) {
    message = message || {};
    const reaction = reactionInfo(message);
    if (reaction) return `Reagiu com ${reaction.emoji}`;
    const type = String(message.type || 'unknown').toLowerCase();
    if (type === 'text') return String(message.text || '').trim() || 'Mensagem';
    if (type === 'template') {
      return String(message.template?.body || message.text || message.templateName || 'Template enviado').trim();
    }
    if (type === 'interactive' || type === 'button') return interactiveReplyText(message) || 'Resposta do cliente';
    return TYPE_LABELS[type] || 'Mensagem não suportada';
  }

  function reactionInfo(message = {}) {
    const type = String(message.type || '').toLowerCase();
    let value = message.reaction || message.payload || (type === 'reaction' ? message.text : null);
    if (!value && type === 'text') value = message.text;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return null; }
    }
    if (!value || typeof value !== 'object') return null;
    const emoji = String(value.emoji || value.reaction?.emoji || '').trim();
    const messageId = String(value.message_id || value.messageId || value.reaction?.message_id || value.reaction?.messageId || '').trim();
    return emoji && (messageId || type === 'reaction') ? { emoji, messageId } : null;
  }

  function reactionTarget(message = {}) {
    const nested = message.meta || message.metadata || message.payload || {};
    const candidates = [
      message.wamid,
      message.messageId,
      message.message_id,
      message.metaMessageId,
      message.externalId,
      nested.wamid,
      nested.messageId,
      nested.message_id,
      typeof message.id === 'string' && !/^\d+$/.test(message.id) ? message.id : ''
    ];
    return candidates
      .map((value) => String(value || '').trim())
      .find((value) => /^[A-Za-z0-9._:+=/-]{3,512}$/.test(value)) || '';
  }

  function replyContext(message = {}) {
    let value = message.replyContext || message.reply || message.context || message.metadata?.replyContext || null;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return null; }
    }
    if (!value || typeof value !== 'object') return null;
    const messageId = String(value.messageId || value.message_id || value.wamid || '').trim();
    const text = String(value.text || value.body || value.preview || '').trim();
    if (!messageId && !text) return null;
    return {
      messageId,
      text: text || 'Mensagem',
      senderName: String(value.senderName || value.sender || value.author || '').trim(),
      direction: String(value.direction || '').toUpperCase()
    };
  }

  function interactiveReplyText(message = {}) {
    let value = message.interactive || message.button || message.text || null;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return value; }
    }
    const reply = value?.button_reply || value?.list_reply || value;
    return String(reply?.title || reply?.text || reply?.description || reply?.id || '').trim();
  }

  function sharedContact(message = {}) {
    let value = message.contacts || message.contact || message.text || null;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return { name: '', phone: '' }; }
    }
    const item = Array.isArray(value) ? value[0] : (value?.contacts?.[0] || value?.contact || value);
    if (!item || typeof item !== 'object') return { name: '', phone: '' };
    const name = String(item.name?.formatted_name || item.formatted_name || item.name || item.profileName || '').trim();
    const phoneEntry = Array.isArray(item.phones) ? item.phones[0] : item.phone;
    const phone = String(phoneEntry?.phone || phoneEntry?.wa_id || phoneEntry || item.wa_id || item.waId || '').trim();
    return { name, phone };
  }

  function mergeById(items = [], incoming = []) {
    const merged = [];
    [...items, ...incoming].filter(Boolean).forEach((item) => {
      const id = String(item.id ?? '');
      const wamid = String(item.wamid ?? '');
      const index = merged.findIndex((current) =>
        (id && String(current.id ?? '') === id) || (wamid && String(current.wamid ?? '') === wamid)
      );
      if (index >= 0) merged[index] = { ...merged[index], ...item };
      else merged.push(item);
    });
    return merged.sort((a, b) => {
      const left = new Date(a.messageTimestamp || a.createdAt || 0).getTime();
      const right = new Date(b.messageTimestamp || b.createdAt || 0).getTime();
      return left - right;
    });
  }

  function mergeOptimisticMessage(items = [], incoming = {}, clientMessageId = '') {
    const clientId = String(clientMessageId || incoming.clientMessageId || '').trim();
    const incomingText = String(incoming.text || '');
    const incomingDirection = String(incoming.direction || '').toUpperCase();
    const optimisticIndex = items.findIndex((message) => {
      if (message.optimistic !== true) return false;
      if (clientId && String(message.clientMessageId || message.id || '') === clientId) return true;
      return incomingDirection === 'OUTBOUND'
        && String(message.direction || '').toUpperCase() === 'OUTBOUND'
        && String(message.text || '') === incomingText;
    });
    if (optimisticIndex < 0) return mergeById(items, [incoming]);
    const optimistic = items[optimisticIndex];
    const remaining = items.filter((_message, index) => index !== optimisticIndex);
    return mergeById(remaining, [{
      ...optimistic,
      ...incoming,
      optimistic: false,
      clientMessageId: optimistic.clientMessageId || clientId
    }]);
  }

  function failOptimisticMessage(items = [], clientMessageId, reason = '') {
    const clientId = String(clientMessageId || '').trim();
    return items.map((message) => (
      message.optimistic === true && String(message.clientMessageId || message.id || '') === clientId
        ? {
          ...message,
          optimistic: false,
          status: 'FAILED',
          failureDetails: [{ message: String(reason || 'Não foi possível enviar a mensagem.') }]
        }
        : message
    ));
  }

  function normalizeCalls(payload) {
    if (Array.isArray(payload)) return payload;
    const direct = payload?.calls || payload?.items || payload?.data;
    if (Array.isArray(direct)) return direct;
    return direct?.calls || direct?.items || direct?.data || [];
  }

  function callTimestamp(call = {}) {
    return call.startedAt || call.createdAt || call.answeredAt || call.endedAt || call.updatedAt || '';
  }

  function formatCallDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function callTimelineInfo(call = {}) {
    const direction = String(call.direction || '').toUpperCase();
    const status = String(call.status || '').toUpperCase();
    const duration = Number(call.durationSeconds || 0);
    let subtitle = direction === 'OUTBOUND' ? 'Chamada realizada' : 'Chamada recebida';
    let statusClass = 'completed';
    if (['MISSED', 'NO_ANSWER', 'UNANSWERED'].includes(status)) {
      subtitle = 'Não atendida';
      statusClass = 'missed';
    } else if (status === 'REJECTED') {
      subtitle = 'Recusada';
      statusClass = 'rejected';
    } else if (status === 'FAILED') {
      subtitle = 'Falha na ligação';
      statusClass = 'failed';
    } else if (['RINGING', 'CONNECTING'].includes(status)) {
      subtitle = 'Chamando…';
      statusClass = 'active';
    } else if (status === 'ACTIVE') {
      subtitle = 'Em andamento';
      statusClass = 'active';
    } else if (duration > 0) {
      subtitle = `Duração ${formatCallDuration(duration)}`;
    } else if (['ENDED', 'COMPLETED', 'TERMINATED'].includes(status)) {
      subtitle = 'Encerrada';
    }
    return {
      direction,
      outbound: direction === 'OUTBOUND',
      icon: direction === 'OUTBOUND' ? 'phone-outgoing' : 'phone-incoming',
      title: 'Ligação de voz',
      subtitle,
      statusClass
    };
  }

  function mergeTimeline(messages = [], calls = []) {
    const timestamp = (entry) => {
      const value = entry.kind === 'call'
        ? callTimestamp(entry.value)
        : (entry.value?.messageTimestamp || entry.value?.createdAt || '');
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return [
      ...messages.map((value) => ({ kind: 'message', value })),
      ...calls.map((value) => ({ kind: 'call', value }))
    ].sort((left, right) => timestamp(left) - timestamp(right));
  }

  function serviceWindow(conversation = {}) {
    return conversation.serviceWindow || conversation.metaWindow || {};
  }

  function serviceWindowState(conversation = {}) {
    const window = serviceWindow(conversation);
    const initiated = window.conversationInitiated === true;
    const initialStatus = String(window.initialTemplateStatus || '').toUpperCase();
    if (window.canSendFreeform === true) {
      return { key: 'open', title: 'Atendimento iniciado', subtitle: 'Janela de mensagens livres aberta por 24 horas.', window };
    }
    if (initiated && window.waitingForCustomerReply === true) {
      if (initialStatus === 'READ') return { key: 'awaiting-reply', title: 'Conversa iniciada corretamente.', subtitle: 'Template lido. Aguardando resposta do cliente.', window };
      if (initialStatus === 'DELIVERED') return { key: 'awaiting-reply', title: 'Conversa iniciada corretamente.', subtitle: 'Template entregue. Aguardando resposta do cliente.', window };
      return { key: 'awaiting-delivery', title: 'Conversa iniciada com template aprovado.', subtitle: 'Template enviado. Aguardando entrega.', window };
    }
    if (initiated) {
      return { key: 'expired', title: 'Janela de atendimento encerrada.', subtitle: 'Use um template aprovado para retomar a conversa.', window };
    }
    return { key: 'template-required', title: 'Inicie a conversa com um template aprovado.', subtitle: 'Mensagens livres serão liberadas após a resposta do contato.', window };
  }

  function messageMatchesUpdate(message = {}, update = {}) {
    const updateKeys = new Set([update.id, update.messageId, update.message_id, update.wamid]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean));
    return [message.id, message.messageId, message.message_id, message.wamid]
      .map((value) => String(value ?? '').trim())
      .some((value) => value && updateKeys.has(value));
  }

  function updateMessageStatus(items = [], update = {}) {
    const status = update.status || update.messageStatus || update.deliveryStatus || '';
    const statusRank = { SENT: 1, DELIVERED: 2, READ: 3 };
    return items.map((message) => {
      if (messageMatchesUpdate(message, update)) {
        const atual = String(message.status || '').toUpperCase();
        const proximo = String(status || '').toUpperCase();
        if (statusRank[atual] && statusRank[proximo] && statusRank[proximo] < statusRank[atual]) return message;
        return {
          ...message,
          status: status || message.status,
          ...(update.failureDetails !== undefined ? { failureDetails: update.failureDetails } : {})
        };
      }
      return message;
    });
  }

  function canSendText(value, sending = false) {
    return !sending && Boolean(String(value || '').trim());
  }

  function shouldLoadOlderMessages({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}, options = {}) {
    const threshold = Number(options.threshold ?? 80);
    const fillRatio = Number(options.fillRatio ?? 1.25);
    const fillingViewport = options.fillViewport === true && scrollHeight < clientHeight * fillRatio;
    return fillingViewport || scrollTop <= threshold;
  }

  function shouldLoadMoreConversations({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}, options = {}) {
    const threshold = Number(options.threshold ?? 120);
    return scrollHeight <= clientHeight || scrollHeight - scrollTop - clientHeight <= threshold;
  }

  function mergeConversationPages(current = [], incoming = []) {
    const merged = [...current];
    incoming.forEach((conversation) => {
      const keys = new Set(conversationIdentityKeys(conversation));
      const index = merged.findIndex((item) => conversationIdentityKeys(item).some((key) => keys.has(key)));
      if (index < 0) {
        merged.push(conversation);
        return;
      }
      const existing = merged[index];
      const existingTime = new Date(existing.lastMessageAt || existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || 0).getTime();
      const recent = incomingTime > existingTime ? conversation : existing;
      merged[index] = mergeConversationSnapshot(existing, {
        ...conversation,
        ...(recent === existing ? {
          lastMessage: existing.lastMessage,
          lastMessageAt: existing.lastMessageAt,
          updatedAt: existing.updatedAt,
          unreadCount: existing.unreadCount
        } : {}),
        id: existing.id,
        relatedConversationIds: [
          existing.id,
          conversation.id,
          ...(existing.relatedConversationIds || []),
          ...(conversation.relatedConversationIds || [])
        ]
      });
    });
    return merged;
  }

  function isLoadedConversation(activeId, conversation, targetId) {
    const target = String(targetId ?? '');
    return Boolean(
      target
      && String(activeId ?? '') === target
      && String(conversation?.id ?? '') === target
    );
  }

  function conversationUpdateScope(activeId, payload = {}, activeConversation = {}) {
    const active = String(activeId ?? '');
    if (!active) return 'NONE';
    const incoming = payload.conversation || payload;
    const incomingId = String(incoming.id ?? payload.conversationId ?? '');
    if (incomingId === active) return 'DIRECT';
    const relatedIds = [
      ...(incoming.relatedConversationIds || []),
      ...(payload.relatedConversationIds || [])
    ].map(String);
    if (relatedIds.includes(active)) return 'RELATED';
    const activeRelatedIds = (activeConversation.relatedConversationIds || []).map(String);
    return incomingId && activeRelatedIds.includes(incomingId) ? 'RELATED' : 'NONE';
  }

  function statusSymbol(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING') return { symbol: '◷', label: 'Enviando', pending: true };
    if (normalized === 'FAILED') return { symbol: '!', label: 'Falha no envio', failed: true };
    if (normalized === 'READ') return { symbol: '✓✓', label: 'Lida', read: true };
    if (normalized === 'DELIVERED') return { symbol: '✓✓', label: 'Entregue', delivered: true };
    if (normalized === 'SENT') return { symbol: '✓', label: 'Enviada' };
    return { symbol: '', label: normalized || '' };
  }

  function messageFailureReason(message = {}) {
    const details = Array.isArray(message.failureDetails)
      ? message.failureDetails[0]
      : Array.isArray(message.errors) ? message.errors[0] : null;
    const code = details?.code ?? message.errorCode ?? message.error_code ?? '';
    const raw = details?.error_data?.details || details?.message || details?.title
      || message.errorMessage || message.error_message || '';
    const numericCode = String(code || '').trim();
    if (numericCode === '131026') {
      return { code: numericCode, text: 'A mensagem não pôde ser entregue ao destinatário.' };
    }
    const text = String(raw || '').trim();
    if (text) return { code: numericCode, text };
    return { code: numericCode, text: 'A integração não informou o motivo específico.' };
  }

  function debounce(callback, delay = 350) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  return {
    canSendText,
    contact,
    contactName,
    conversationIdentityKeys,
    debounce,
    initials,
    interactiveReplyText,
    isLoadedConversation,
    conversationUpdateScope,
    callTimelineInfo,
    callTimestamp,
    channel,
    channelIdentity,
    channelLabel,
    failOptimisticMessage,
    mergeById,
    mergeOptimisticMessage,
    mergeTimeline,
    mergeConversationList,
    mergeConversationPages,
    mergeConversationSnapshot,
    messageMatchesUpdate,
    messagePreview,
    normalizeCalls,
    normalizeChannels,
    normalizePhone,
    reactionInfo,
    reactionTarget,
    replyContext,
    sharedContact,
    serviceWindow,
    serviceWindowState,
    shouldLoadMoreConversations,
    shouldLoadOlderMessages,
    statusSymbol,
    messageFailureReason,
    unwrap,
    updateMessageStatus
  };
}));
