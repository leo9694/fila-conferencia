(function createChatController() {
  'use strict';

  const Core = window.ChatCore;
  if (!Core) return;

  const MESSAGE_PAGE_SIZE = 20;
  const MESSAGE_SCROLL_THRESHOLD = 80;
  const MESSAGE_FILL_RATIO = 1.25;
  const HIDDEN_CONVERSATIONS_KEY = 'fila-conferencia.chat.hidden-conversations';
  const UI_CACHE_KEY = 'fila-conferencia.chat.ui-cache.v1';
  const UI_CACHE_TTL = 10 * 60 * 1000;
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const MORE_REACTIONS = ['👏', '🔥', '🎉', '✅', '😊', '😍', '🤔', '😅', '🤝', '👀', '💯', '🙌', '👎', '😡', '🤩', '🥳'];

  const byId = (id) => document.getElementById(id);
  const refs = {
    screen: byId('chat-screen'), workspace: byId('chat-workspace'), list: byId('chat-conversation-list'),
    count: byId('chat-conversation-count'), search: byId('chat-search-input'), filters: byId('chat-filters'),
    agentFilterToggle: byId('chat-agent-filter-toggle'), agentFilter: byId('chat-agent-filter'),
    agentFilterSelect: byId('chat-agent-filter-select'), agentFilterClear: byId('chat-agent-filter-clear'),
    refresh: byId('chat-refresh'), newContact: byId('chat-new-contact'), more: byId('chat-load-more'), empty: byId('chat-empty-state'),
    active: byId('chat-active-view'), messages: byId('chat-message-list'), input: byId('chat-message-input'),
    form: byId('chat-composer'), send: byId('chat-send'), feedback: byId('chat-composer-feedback'),
    composerReply: byId('chat-composer-reply'), composerReplyAuthor: byId('chat-composer-reply-author'),
    composerReplyText: byId('chat-composer-reply-text'), composerReplyCancel: byId('chat-composer-reply-cancel'),
    contactName: byId('chat-contact-name'), contactPhone: byId('chat-contact-phone'),
    contactAvatar: byId('chat-contact-avatar'), details: byId('chat-details-panel'),
    detailsToggle: byId('chat-details-toggle'), detailsClose: byId('chat-details-close'),
    detailsEmpty: byId('chat-details-empty'), detailsContent: byId('chat-details-content'),
    detailsAvatar: byId('chat-details-avatar'), detailsName: byId('chat-details-name'),
    detailsPhone: byId('chat-details-phone'), detailsWaid: byId('chat-details-waid'),
    sankhyaData: byId('chat-sankhya-data'),
    bitrixData: byId('chat-bitrix-data'),
    detailsLast: byId('chat-details-last'), detailsUnread: byId('chat-details-unread'),
    realtime: byId('chat-realtime-status'),
    profileOpen: byId('chat-profile-open'), settingsOpen: byId('chat-settings-open'),
    assignmentLabel: byId('chat-assignment-label'), detailsAgent: byId('chat-details-agent'),
    claim: byId('chat-claim'), transfer: byId('chat-transfer'), release: byId('chat-release'),
    newMessage: byId('chat-new-message-button'), mobileBack: byId('chat-mobile-back'),
    attachmentToggle: byId('chat-attachment-toggle'), attachmentMenu: byId('chat-attachment-menu'),
    emojiToggle: byId('chat-emoji-toggle'), emojiMenu: byId('chat-emoji-menu'),
    microphone: byId('chat-microphone'), recording: byId('chat-recording'),
    recordingTime: byId('chat-recording-time'), recordingCancel: byId('chat-recording-cancel'),
    recordingSend: byId('chat-recording-send'), templateOpen: byId('chat-template-open'),
    templateModal: byId('chat-template-modal'), templateClose: byId('chat-template-close'),
    templateSearch: byId('chat-template-search'), templateList: byId('chat-template-list'),
    templateConfig: byId('chat-template-config'), templateSend: byId('chat-template-send'),
    templateFeedback: byId('chat-template-feedback'), mediaModal: byId('chat-media-modal'),
    contactModal: byId('chat-contact-modal'), contactForm: byId('chat-contact-form'), contactClose: byId('chat-contact-close'),
    partnerSearch: byId('chat-partner-search'), partnerResults: byId('chat-partner-results'),
    selectedPartner: byId('chat-selected-partner'), selectedPartnerName: byId('chat-selected-partner-name'),
    selectedPartnerLabel: byId('chat-selected-partner-label'),
    changePartner: byId('chat-change-partner'), partnerContactField: byId('chat-partner-contact-field'),
    partnerContacts: byId('chat-partner-contacts'), partnerContact: byId('chat-partner-contact'),
    newSankhyaContact: byId('chat-new-sankhya-contact'), newSankhyaContactPanel: byId('chat-new-sankhya-contact-panel'),
    newSankhyaContactClose: byId('chat-new-sankhya-contact-close'), newSankhyaContactName: byId('chat-new-sankhya-contact-name'),
    newSankhyaContactPhone: byId('chat-new-sankhya-contact-phone'), newSankhyaContactRole: byId('chat-new-sankhya-contact-role'),
    newSankhyaContactFeedback: byId('chat-new-sankhya-contact-feedback'), newSankhyaContactSave: byId('chat-new-sankhya-contact-save'),
    newPipelineField: byId('chat-new-pipeline-field'), newPipeline: byId('chat-new-pipeline'),
    contactFeedback: byId('chat-contact-feedback'), contactSubmit: byId('chat-contact-submit'), contactCancel: byId('chat-contact-cancel'),
    linkPartnerModal: byId('chat-link-partner-modal'), linkPartnerForm: byId('chat-link-partner-form'),
    linkPartnerClose: byId('chat-link-partner-close'), linkPartnerPhone: byId('chat-link-partner-phone'),
    linkPartnerSearch: byId('chat-link-partner-search'), linkPartnerResults: byId('chat-link-partner-results'),
    linkSelectedPartner: byId('chat-link-selected-partner'), linkSelectedPartnerName: byId('chat-link-selected-partner-name'),
    linkChangePartner: byId('chat-link-change-partner'), linkPartnerFeedback: byId('chat-link-partner-feedback'),
    linkContactFields: byId('chat-link-contact-fields'), linkContactName: byId('chat-link-contact-name'),
    linkContactRole: byId('chat-link-contact-role'),
    linkPartnerSubmit: byId('chat-link-partner-submit'),
    mediaPreview: byId('chat-media-preview'), mediaClose: byId('chat-media-close'),
    mediaZoomControls: byId('chat-media-zoom-controls'), mediaZoomLabel: byId('chat-media-zoom-label'),
    uploadActions: byId('chat-upload-actions'), uploadCancel: byId('chat-upload-cancel'),
    uploadSend: byId('chat-upload-send')
  };

  const state = {
    conversations: [], conversation: null, conversationId: null, page: 1, totalPages: 1,
    status: '', search: '', messages: [], messagePage: 1, messageTotalPages: 1,
    loading: false, loadingOlder: false, sending: false, initialized: false, eventSource: null,
    mediaUrls: new Map(), templates: [], selectedTemplate: null,
    autoMediaQueue: Promise.resolve(), autoMediaDisabled: false,
    recorder: null, recordingStream: null, recordingChunks: [], recordingBlob: null,
    recordingStartedAt: 0, recordingTimer: null, pendingUpload: null, loadToken: 0, activeLoadToken: 0,
    totalConversations: 0, assignment: 'ALL', agentId: '', access: null, profile: null, agents: [],
    hiddenConversationIds: new Set(), selectedPartner: null, partnerSearchToken: 0,
    linkPartner: null, linkPartnerSearchToken: 0, pipelines: [], pipelinesPromise: null,
    mediaZoom: 1, replyingTo: null, conversationCache: new Map(),
    messagesRenderFrame: null, messagesRenderPreserveScroll: true,
    conversationsRenderFrame: null, uiCacheTimer: null
  };

  const CONVERSATION_CACHE_LIMIT = 6;
  const CACHED_MESSAGES_LIMIT = 80;

  let viewportSyncTimer = null;
  const imagePreviewObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        state.autoMediaQueue = state.autoMediaQueue.then(async () => {
          if (!state.autoMediaDisabled && entry.target.isConnected) await activateMedia(entry.target, false, true);
        });
      });
    }, { rootMargin: '180px 0px' })
    : null;

  function syncRestingViewportHeight(delay = 0) {
    clearTimeout(viewportSyncTimer);
    viewportSyncTimer = setTimeout(() => {
      if (document.activeElement === refs.input) return;
      const height = Math.round(window.visualViewport?.height || window.innerHeight);
      document.documentElement.style.setProperty('--chat-resting-height', `${height}px`);
    }, delay);
  }

  function assignedUser(item = {}) {
    const assignment = item.assignment || {};
    const id = assignment.userId ?? item.assignedUserId ?? null;
    return id ? { id: String(id), name: assignment.userName || item.assignedUserName || 'Atendente' } : null;
  }

  function ownsConversation(item = state.conversation) {
    const assigned = assignedUser(item);
    return Boolean(assigned && state.profile && assigned.id === String(state.profile.id));
  }

  function matchesAssignment(item = {}) {
    const assigned = assignedUser(item);
    if (state.agentId) return Boolean(assigned && assigned.id === String(state.agentId));
    if (state.assignment === 'ALL') return true;
    if (state.assignment === 'UNASSIGNED') return !assigned;
    return Boolean(assigned && assigned.id === String(state.profile?.id));
  }

  async function verificarAcesso() {
    const menu = byId('home-nav-chat');
    try {
      const payload = await api('/access');
      state.access = payload;
      state.profile = payload?.perfil || null;
      state.hiddenConversationIds = new Set(readHiddenConversationIds());
      if (menu) menu.hidden = payload?.permitido !== true;
      if (refs.settingsOpen) refs.settingsOpen.hidden = payload?.diretor !== true;
      if (refs.agentFilterToggle) refs.agentFilterToggle.hidden = payload?.diretor !== true;
      return payload?.permitido === true;
    } catch {
      state.access = null; state.profile = null;
      if (menu) menu.hidden = true;
      return false;
    }
  }

  function readHiddenConversationIds() {
    try {
      const ids = JSON.parse(localStorage.getItem(hiddenConversationsStorageKey()) || '[]');
      return Array.isArray(ids) ? ids.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveHiddenConversationIds() {
    try {
      localStorage.setItem(hiddenConversationsStorageKey(), JSON.stringify([...state.hiddenConversationIds]));
    } catch {}
  }

  function hiddenConversationsStorageKey() {
    return `${HIDDEN_CONVERSATIONS_KEY}.${String(state.profile?.id || 'anonymous')}`;
  }

  function isConversationHidden(conversation = {}) {
    const id = String(conversation.id ?? conversation.conversationId ?? '');
    return (id && state.hiddenConversationIds.has(id))
      || Core.conversationIdentityKeys(conversation).some((key) => state.hiddenConversationIds.has(key));
  }

  function hideConversationLocally(id) {
    const conversation = state.conversations.find((item) => String(item.id) === String(id))
      || (String(state.conversationId) === String(id) ? state.conversation : null)
      || { id };
    const keys = Core.conversationIdentityKeys(conversation);
    const phoneKey = keys.find((key) => key.startsWith('phone:'));
    state.hiddenConversationIds.add(phoneKey || keys[0] || String(id));
    saveHiddenConversationIds();
  }

  function restoreConversationLocally(conversation, phone = '') {
    const value = typeof conversation === 'object' && conversation !== null
      ? conversation
      : { id: conversation, contact: { phone } };
    const keys = [String(value.id ?? ''), ...Core.conversationIdentityKeys(value)].filter(Boolean);
    const changed = keys.reduce((removed, key) => state.hiddenConversationIds.delete(key) || removed, false);
    if (!changed) return false;
    saveHiddenConversationIds();
    return true;
  }

  function migrateHiddenConversationIds(conversations = []) {
    let changed = false;
    conversations.forEach((conversation) => {
      const rawId = String(conversation.id ?? '');
      if (!rawId || !state.hiddenConversationIds.has(rawId)) return;
      const phoneKey = Core.conversationIdentityKeys(conversation).find((key) => key.startsWith('phone:'));
      if (!phoneKey) return;
      state.hiddenConversationIds.delete(rawId);
      state.hiddenConversationIds.add(phoneKey);
      changed = true;
    });
    if (changed) saveHiddenConversationIds();
  }

  async function api(path, options = {}) {
    try {
      const response = await fetch(`/api/chat${path}`, { cache: 'no-store', ...options });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json().catch(() => null) : null;
      if (!response.ok) {
        const message = payload?.erro || payload?.error?.message;
        if (message) throw new Error(message);
        throw new Error(response.status >= 500
          ? 'Falha ao conectar com a API de atendimento.'
          : 'Não foi possível concluir esta solicitação no atendimento.');
      }
      return Core.unwrap(payload);
    } catch (error) {
      if (error instanceof TypeError || error?.name === 'AbortError') {
        throw new Error('Falha ao conectar com a API de atendimento.');
      }
      throw error;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function formatWhatsAppPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    const national = digits.startsWith('55') ? digits.slice(2) : digits;
    if (national.length === 11) return `+55 ${national.slice(0, 2)} ${national.slice(2, 7)}-${national.slice(7)}`;
    if (national.length === 10) return `+55 ${national.slice(0, 2)} ${national.slice(2, 6)}-${national.slice(6)}`;
    return digits ? `+${digits}` : 'Telefone não informado';
  }

  function formatDate(value, compact = false) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR', compact ? { day: '2-digit', month: '2-digit' } : undefined);
  }

  function conversationTimestamp(item) {
    return item.lastMessageAt || item.lastMessage?.messageTimestamp || item.updatedAt;
  }

  function sankhyaCadastro(item = {}) {
    return item.cadastroSankhya?.verificado ? item.cadastroSankhya : null;
  }

  function sankhyaVinculos(item = {}) {
    const cadastro = sankhyaCadastro(item);
    if (!cadastro) return [];
    const registros = Array.isArray(cadastro.parceiros) && cadastro.parceiros.length
      ? cadastro.parceiros
      : [cadastro];
    const porParceiro = new Map();
    registros.forEach((registro = {}) => {
      const key = String(registro.codParc || registro.nomeParc || 'parceiro');
      if (!porParceiro.has(key)) {
        porParceiro.set(key, {
          codParc: registro.codParc,
          nomeParc: registro.nomeParc,
          contatos: new Set()
        });
      }
      if (registro.nomeContato) porParceiro.get(key).contatos.add(String(registro.nomeContato).trim());
    });
    return [...porParceiro.values()];
  }

  function sankhyaBadge(item = {}, compact = true) {
    const cadastro = sankhyaCadastro(item);
    if (!cadastro) return '';
    const title = `Cadastro Sankhya verificado: ${cadastro.codParc || ''}${cadastro.nomeParc ? ` - ${cadastro.nomeParc}` : ''}`;
    return `<span class="chat-sankhya-badge${compact ? ' is-compact' : ''}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i data-lucide="badge-check" aria-hidden="true"></i></span>`;
  }

  function pipelineLinks(item = {}) {
    return Array.isArray(item.bitrix?.pipelines) ? item.bitrix.pipelines : [];
  }

  function pipelineHistory(item = {}) {
    return Array.isArray(item.bitrix?.history) ? item.bitrix.history : [];
  }

  function pipelineColorClass(pipeline = {}) {
    const value = String(pipeline.categoryId ?? pipeline.id ?? pipeline.categoryName ?? '0');
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) hash = ((hash * 31) + value.charCodeAt(index)) | 0;
    return `pipeline-color-${Math.abs(hash) % 8}`;
  }

  function pipelineBadges(item = {}) {
    const links = pipelineLinks(item);
    const badges = links.map((link) => {
      const name = link.categoryName || `Pipeline ${link.categoryId}`;
      const title = `Pipeline vinculado: ${name}`;
      return `<span class="chat-pipeline-badge is-linked ${pipelineColorClass(link)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i data-lucide="kanban" aria-hidden="true"></i></span>`;
    });
    if (item.bitrix?.pending === true) {
      const title = 'Pipeline pendente';
      badges.push(`<span class="chat-pipeline-badge is-pending" title="${title}" aria-label="${title}"><i data-lucide="circle-alert" aria-hidden="true"></i></span>`);
    }
    return badges.join('');
  }

  async function loadPipelines(force = false) {
    if (!force && state.pipelines.length) return state.pipelines;
    if (!force && state.pipelinesPromise) return state.pipelinesPromise;
    state.pipelinesPromise = api(`/bitrix/pipelines${force ? '?refresh=1' : ''}`)
      .then((payload) => {
        state.pipelines = Array.isArray(payload?.pipelines) ? payload.pipelines : [];
        return state.pipelines;
      })
      .finally(() => { state.pipelinesPromise = null; });
    return state.pipelinesPromise;
  }

  function fillPipelineSelect(select, selected = '') {
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um pipeline...</option>' + state.pipelines.map((pipeline) =>
      `<option value="${escapeHtml(pipeline.categoryId)}"${String(pipeline.categoryId) === String(selected) ? ' selected' : ''}>${escapeHtml(pipeline.name)}</option>`
    ).join('');
  }

  function updateNewContactSubmit() {
    refs.contactSubmit.disabled = !state.selectedPartner || !refs.partnerContact.value || refs.newPipeline?.value === '';
  }

  function renderConversationSkeleton() {
    refs.list.innerHTML = Array.from({ length: 7 }, () => '<div class="chat-conversation-skeleton"><i></i><span></span><b></b></div>').join('');
  }

  function persistUiCache() {
    clearTimeout(state.uiCacheTimer);
    state.uiCacheTimer = null;
    if (!state.profile?.id) return;
    const activeId = String(state.conversationId || '');
    const active = activeId && state.conversation
      ? {
          id: activeId,
          conversation: state.conversation,
          messages: state.messages.slice(-Math.min(CACHED_MESSAGES_LIMIT, 40)),
          messagePage: state.messagePage,
          messageTotalPages: state.messageTotalPages
        }
      : null;
    try {
      sessionStorage.setItem(UI_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        profileId: String(state.profile.id),
        conversations: state.conversations.slice(0, 40),
        totalConversations: state.totalConversations,
        totalPages: state.totalPages,
        active
      }));
    } catch {}
  }

  function scheduleUiCachePersist() {
    clearTimeout(state.uiCacheTimer);
    state.uiCacheTimer = setTimeout(persistUiCache, 180);
  }

  function restoreUiCache() {
    if (!state.profile?.id || state.conversations.length) return false;
    try {
      const cached = JSON.parse(sessionStorage.getItem(UI_CACHE_KEY) || 'null');
      if (!cached || String(cached.profileId) !== String(state.profile.id) || Date.now() - Number(cached.savedAt || 0) > UI_CACHE_TTL) {
        sessionStorage.removeItem(UI_CACHE_KEY);
        return false;
      }
      state.conversations = Array.isArray(cached.conversations) ? cached.conversations : [];
      state.totalConversations = Number(cached.totalConversations || state.conversations.length);
      state.totalPages = Number(cached.totalPages || 1);
      if (cached.active?.id && cached.active?.conversation) {
        state.conversationCache.set(String(cached.active.id), {
          conversation: cached.active.conversation,
          messages: Array.isArray(cached.active.messages) ? cached.active.messages : [],
          messagePage: Number(cached.active.messagePage || 1),
          messageTotalPages: Number(cached.active.messageTotalPages || 1)
        });
      }
      return state.conversations.length > 0;
    } catch {
      sessionStorage.removeItem(UI_CACHE_KEY);
      return false;
    }
  }

  function cacheActiveConversation() {
    const id = String(state.conversationId || '');
    if (!id || !state.conversation) return;
    state.conversationCache.delete(id);
    state.conversationCache.set(id, {
      conversation: state.conversation,
      messages: state.messages.slice(-CACHED_MESSAGES_LIMIT),
      messagePage: state.messagePage,
      messageTotalPages: state.messageTotalPages
    });
    while (state.conversationCache.size > CONVERSATION_CACHE_LIMIT) {
      state.conversationCache.delete(state.conversationCache.keys().next().value);
    }
    scheduleUiCachePersist();
  }

  function scheduleConversationsRender() {
    if (state.conversationsRenderFrame) return;
    state.conversationsRenderFrame = requestAnimationFrame(() => {
      state.conversationsRenderFrame = null;
      renderConversations();
      scheduleUiCachePersist();
    });
  }

  function scheduleMessagesRender({ preserveScroll = true } = {}) {
    state.messagesRenderPreserveScroll = state.messagesRenderFrame
      ? state.messagesRenderPreserveScroll && preserveScroll
      : preserveScroll;
    if (state.messagesRenderFrame) return;
    state.messagesRenderFrame = requestAnimationFrame(() => {
      const keepScroll = state.messagesRenderPreserveScroll;
      state.messagesRenderFrame = null;
      state.messagesRenderPreserveScroll = true;
      renderMessages({ preserveScroll: keepScroll });
      cacheActiveConversation();
    });
  }

  function cancelScheduledMessagesRender() {
    if (!state.messagesRenderFrame) return;
    cancelAnimationFrame(state.messagesRenderFrame);
    state.messagesRenderFrame = null;
    state.messagesRenderPreserveScroll = true;
  }

  function renderConversations() {
    refs.count.textContent = String(state.totalConversations || state.conversations.length);
    refs.more.hidden = state.page >= state.totalPages;
    if (!state.conversations.length) {
      refs.list.innerHTML = '<div class="chat-list-empty"><i data-lucide="message-circle-off"></i><strong>Nenhuma conversa encontrada</strong><span>Tente ajustar a busca ou o filtro.</span></div>';
      window.lucide?.createIcons();
      return;
    }
    refs.list.innerHTML = state.conversations.map((item) => {
      const name = Core.contactName(item);
      const unread = Number(item.unreadCount || 0);
      const active = String(item.id) === String(state.conversationId);
      const agent = assignedUser(item);
      return `<button class="chat-conversation${active ? ' is-active' : ''}${unread ? ' has-unread' : ''}" type="button" data-conversation-id="${escapeHtml(item.id)}">
        <span class="chat-list-avatar">${escapeHtml(Core.initials(name))}</span>
        <span class="chat-list-copy"><span class="chat-list-line"><span class="chat-list-name"><strong>${escapeHtml(name)}</strong>${sankhyaBadge(item)}${pipelineBadges(item)}</span><time>${escapeHtml(formatDate(conversationTimestamp(item), true))}</time></span>
        <span class="chat-list-line"><small>${escapeHtml(Core.messagePreview(item.lastMessage))}</small>${unread ? `<b>${unread > 99 ? '99+' : unread}</b>` : ''}</span>
        <span class="chat-list-agent${agent ? '' : ' is-unassigned'}">${escapeHtml(agent?.name || 'Sem atendente')}</span></span>
      </button>`;
    }).join('');
    refs.list.querySelectorAll('[data-conversation-id]').forEach(bindConversationItem);
    window.lucide?.createIcons();
  }

  function closeConversationMenu() {
    document.querySelector('.chat-conversation-context-menu')?.remove();
  }

  function showConversationMenu(button, clientX, clientY) {
    closeConversationMenu();
    const conversationId = button.dataset.conversationId;
    const conversation = state.conversations.find((item) => String(item.id) === String(conversationId));
    const canMarkRead = ownsConversation(conversation);
    const menu = document.createElement('div');
    menu.className = 'chat-conversation-context-menu';
    menu.innerHTML = `${canMarkRead ? '<button type="button" data-chat-menu-read><i data-lucide="check-check"></i>Marcar como lida</button>' : ''}<button type="button" class="is-danger" data-chat-menu-delete><i data-lucide="trash-2"></i>Excluir chat</button><button type="button" data-chat-menu-rename><i data-lucide="pencil"></i>Renomear</button>`;
    document.body.append(menu);
    const width = menu.offsetWidth || 190;
    const height = menu.offsetHeight || 84;
    menu.style.left = `${Math.max(8, Math.min(clientX, window.innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(clientY, window.innerHeight - height - 8))}px`;
    menu.querySelector('[data-chat-menu-read]')?.addEventListener('click', async () => {
      closeConversationMenu();
      await markRead(conversationId);
    });
    menu.querySelector('[data-chat-menu-delete]').addEventListener('click', async () => {
      closeConversationMenu();
      openDeleteConfirmation(conversationId);
    });
    menu.querySelector('[data-chat-menu-rename]').addEventListener('click', () => {
      closeConversationMenu();
      openRenameConversation(conversationId);
    });
    window.lucide?.createIcons();
  }

  function bindConversationItem(button) {
    let pressTimer = null;
    let contextOpenedAt = 0;
    const clearPress = () => { clearTimeout(pressTimer); pressTimer = null; };
    button.addEventListener('click', () => {
      if (Date.now() - contextOpenedAt < 700) return;
      openConversation(button.dataset.conversationId, { historyMode: 'push' });
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      contextOpenedAt = Date.now();
      showConversationMenu(button, event.clientX, event.clientY);
    });
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      clearPress();
      pressTimer = setTimeout(() => {
        contextOpenedAt = Date.now();
        showConversationMenu(button, event.clientX || window.innerWidth / 2, event.clientY || window.innerHeight / 2);
      }, 550);
    });
    ['pointerup', 'pointercancel', 'pointermove', 'pointerleave'].forEach((eventName) => button.addEventListener(eventName, clearPress));
  }

  async function loadConversations({ append = false } = {}) {
    if (append && state.loading) return;
    state.loading = true;
    const requestedPage = state.page;
    const token = ++state.loadToken;
    if (!append && !state.conversations.length) renderConversationSkeleton();
    else refs.list.classList.add('is-refreshing');
    try {
      const query = new URLSearchParams({ page: String(state.page), limit: '30' });
      if (state.search) query.set('search', state.search);
      if (state.status) query.set('status', state.status);
      query.set('assignment', state.assignment);
      if (state.access?.diretor === true && state.agentId) query.set('agentId', state.agentId);
      const payload = await api(`/conversations?${query}`);
      if (token !== state.loadToken) return;
      const received = Array.isArray(payload?.data) ? payload.data : [];
      migrateHiddenConversationIds(received);
      const incoming = received.filter((item) => !isConversationHidden(item));
      state.conversations = append ? Core.mergeConversationPages(state.conversations, incoming) : incoming;
      state.totalPages = Number(payload?.pagination?.totalPages || 1);
      state.totalConversations = Math.max(
        state.conversations.length,
        Number(payload?.pagination?.total || state.conversations.length) - state.hiddenConversationIds.size
      );
      renderConversations();
      scheduleUiCachePersist();
      requestAnimationFrame(loadMoreConversationsIfNeeded);
    } catch (error) {
      if (token !== state.loadToken) return;
      if (append) state.page = Math.max(1, requestedPage - 1);
      refs.list.innerHTML = `<div class="chat-list-error"><strong>Não foi possível carregar as conversas.</strong><span>${escapeHtml(error.message)}</span><button type="button">Tentar novamente</button></div>`;
      refs.list.querySelector('button')?.addEventListener('click', () => loadConversations());
    } finally {
      if (token === state.loadToken) {
        state.loading = false;
        refs.list.classList.remove('is-refreshing');
      }
    }
  }

  function loadMoreConversationsIfNeeded() {
    if (state.loading || state.page >= state.totalPages) return;
    if (!Core.shouldLoadMoreConversations(refs.list, { threshold: 140 })) return;
    state.page += 1;
    loadConversations({ append: true });
  }

  function nearBottom() {
    return refs.messages.scrollHeight - refs.messages.scrollTop - refs.messages.clientHeight < 110;
  }

  function scrollBottom(behavior = 'auto') {
    refs.messages.scrollTo({ top: refs.messages.scrollHeight, behavior });
    refs.newMessage.hidden = true;
  }

  function messageTime(message) {
    const value = message.messageTimestamp || message.createdAt;
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (date >= today) return time;
    if (date >= yesterday) return `Ontem, ${time}`;
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
  }

  function mediaId(message) {
    return message.media?.mediaId || message.mediaId || '';
  }

  function cachedMediaMarkup(type, id) {
    const url = state.mediaUrls.get(id);
    if (!url) return '';
    // Renova a posição para manter no cache as mídias usadas mais recentemente.
    state.mediaUrls.delete(id);
    state.mediaUrls.set(id, url);
    if (type === 'audio') return `<audio class="chat-audio" controls preload="metadata" src="${escapeHtml(url)}"></audio>`;
    if (type === 'video') return `<video class="chat-video" controls preload="metadata" src="${escapeHtml(url)}"></video>`;
    if (type === 'image') return `<button class="chat-image-preview" type="button" data-chat-media="image" data-media-id="${escapeHtml(id)}" aria-label="Abrir imagem"><img loading="lazy" decoding="async" src="${escapeHtml(url)}" alt="Imagem da conversa"></button>`;
    return '';
  }

  function renderMessageContent(message) {
    const reaction = Core.reactionInfo(message);
    if (reaction) return `<div class="chat-reaction" title="Reação a uma mensagem"><span>${escapeHtml(reaction.emoji)}</span><small>Reagiu a uma mensagem</small></div>`;
    const type = String(message.type || 'unknown').toLowerCase();
    if (type === 'text') return `<p>${escapeHtml(message.text || '').replace(/\n/g, '<br>')}</p>`;
    if (type === 'template') return renderTemplateMessage(message);
    if (type === 'interactive' || type === 'button') {
      const reply = Core.interactiveReplyText(message) || 'Resposta do cliente';
      return `<div class="chat-template-reply" title="Resposta ao template aprovado"><span><i data-lucide="reply"></i>Resposta ao template</span><strong>${escapeHtml(reply)}</strong></div>`;
    }
    if (type === 'location') return '<div class="chat-unsupported"><i data-lucide="map-pin"></i>Localização compartilhada</div>';
    if (type === 'contacts') return renderSharedContact(message);
    if (['image', 'audio', 'video', 'document', 'sticker'].includes(type) && mediaId(message)) {
      const rawId = String(mediaId(message));
      const id = escapeHtml(rawId);
      const caption = escapeHtml(message.caption || message.media?.caption || '');
      if (type === 'audio') return cachedMediaMarkup(type, rawId)
        || `<div class="chat-media-shell is-audio" data-chat-media="audio" data-media-id="${id}" aria-label="Preparando áudio"><i data-lucide="audio-lines"></i><span></span></div>`;
      if (type === 'video') return `${cachedMediaMarkup(type, rawId)
        || `<div class="chat-media-shell is-video" data-chat-media="video" data-media-id="${id}" aria-label="Preparando vídeo"><i data-lucide="play"></i><span></span></div>`}${caption ? `<p>${caption}</p>` : ''}`;
      if (type === 'document') return `<button class="chat-document" type="button" data-chat-media="document" data-media-id="${id}" data-filename="${escapeHtml(message.filename || message.media?.filename || 'documento')}"><i data-lucide="file-text"></i><span><strong>${escapeHtml(message.filename || message.media?.filename || 'Documento')}</strong><small>Abrir ou baixar</small></span></button>`;
      return `${cachedMediaMarkup('image', rawId) || `<button class="chat-image-placeholder" type="button" data-chat-media="image" data-media-id="${id}"><i data-lucide="image"></i><span>Preparando imagem...</span></button>`}${caption ? `<p>${caption}</p>` : ''}`;
    }
    return '<div class="chat-unsupported"><i data-lucide="circle-help"></i>Mensagem não suportada</div>';
  }

  function renderReplyContext(message) {
    const reply = Core.replyContext(message);
    if (!reply) return '';
    const author = reply.senderName || (reply.direction === 'OUTBOUND' ? 'Você' : Core.contactName(state.conversation || {}));
    return `<div class="chat-message-reply-quote"><strong>${escapeHtml(author)}</strong><span>${escapeHtml(reply.text)}</span></div>`;
  }

  function renderTemplateMessage(message) {
    const template = message.template || {};
    const header = template.header || '';
    const body = template.body || message.text || 'Template enviado';
    const footer = template.footer || '';
    const buttons = Array.isArray(template.buttons) ? template.buttons : [];
    return `<section class="chat-template-message">
      <div class="chat-template-body-content">
        ${header ? `<strong>${escapeHtml(header)}</strong>` : ''}
        <p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>
        ${footer ? `<small>${escapeHtml(footer)}</small>` : ''}
      </div>
      ${buttons.length ? `<div class="chat-template-buttons">${buttons.map((button) => `<span><i data-lucide="mouse-pointer-click"></i>${escapeHtml(button.text || button.title || button.type || 'Ação')}</span>`).join('')}</div>` : ''}
      ${template.name || message.templateName ? `<em title="${escapeHtml(template.name || message.templateName)}"><i data-lucide="badge-check"></i>Template aprovado</em>` : ''}
    </section>`;
  }

  function renderSharedContact(message) {
    const contact = Core.sharedContact(message);
    const name = contact.name || 'Contato compartilhado';
    const phone = contact.phone || 'Número não informado';
    return `<section class="chat-shared-contact">
      <div class="chat-shared-contact-main">
        <span class="chat-shared-contact-avatar">${escapeHtml(Core.initials(name))}</span>
        <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(phone)}</small></span>
      </div>
      <button class="chat-shared-contact-action" type="button" data-chat-start-contact data-contact-name="${escapeHtml(name)}" data-contact-phone="${escapeHtml(contact.phone)}" ${contact.phone ? '' : 'disabled'}><i data-lucide="message-circle"></i>Conversar</button>
    </section>`;
  }

  function messageReactionTarget(message = {}) {
    return Core.reactionTarget(message);
  }

  function renderReactionActions(message) {
    const target = messageReactionTarget(message);
    const serviceWindow = Core.serviceWindow(state.conversation || {});
    const reactionAvailable = target && serviceWindow.canSendFreeform === true;
    if (!reactionAvailable) return '';
    const owner = ownsConversation();
    const targetEscaped = escapeHtml(target);
    return `<div class="chat-message-actions">
      <button class="chat-message-action-toggle${owner ? '' : ' requires-assignment'}" type="button" data-chat-reaction-toggle aria-label="${owner ? 'Abrir ações da mensagem' : 'Assuma o atendimento para interagir'}" title="${owner ? 'Abrir ações da mensagem' : 'Assuma o atendimento para interagir'}" aria-expanded="false"><i data-lucide="ellipsis-vertical"></i></button>
      <div class="chat-message-reaction-menu" data-chat-reaction-menu hidden>
        <div class="chat-message-reaction-quick">
          ${QUICK_REACTIONS.map((emoji) => `<button type="button" data-chat-message-reaction data-message-id="${targetEscaped}" data-emoji="${emoji}" aria-label="Reagir com ${emoji}">${emoji}</button>`).join('')}
          <button class="chat-message-reaction-more-toggle" type="button" data-chat-reaction-more aria-label="Mais emojis" aria-expanded="false">+</button>
        </div>
        <div class="chat-message-reaction-more" data-chat-reaction-more-list hidden>
          ${MORE_REACTIONS.map((emoji) => `<button type="button" data-chat-message-reaction data-message-id="${targetEscaped}" data-emoji="${emoji}" aria-label="Reagir com ${emoji}">${emoji}</button>`).join('')}
        </div>
        <button class="chat-message-reply-action" type="button" data-chat-message-reply data-message-id="${targetEscaped}"><i data-lucide="reply"></i><span>Responder</span></button>
      </div>
    </div>`;
  }

  function renderMessages({ preserveScroll = false } = {}) {
    const oldHeight = refs.messages.scrollHeight;
    const oldTop = refs.messages.scrollTop;
    if (!state.messages.length) {
      refs.messages.innerHTML = `${renderMetaSessionNotice()}<div class="chat-message-empty">Nenhuma mensagem nesta conversa.</div>`;
      window.lucide?.createIcons();
      return;
    }
    const messageKeys = new Set(state.messages.flatMap((message) => [message.id, message.wamid, message.messageId, messageReactionTarget(message)]
      .map((value) => String(value || '').trim()).filter(Boolean)));
    const reactionsByMessage = new Map();
    state.messages.forEach((message) => {
      const reaction = Core.reactionInfo(message);
      if (!reaction || !messageKeys.has(reaction.messageId)) return;
      const reactions = reactionsByMessage.get(reaction.messageId) || [];
      reactions.push(reaction.emoji);
      reactionsByMessage.set(reaction.messageId, reactions);
    });
    const messages = state.messages.filter((message) => {
      const reaction = Core.reactionInfo(message);
      return !reaction || !messageKeys.has(reaction.messageId);
    });
    refs.messages.innerHTML = `${state.messagePage < state.messageTotalPages ? '<div class="chat-history-loader" aria-hidden="true"><span></span><span></span><span></span></div>' : ''}${renderMetaSessionNotice()}${messages.map((message) => {
      const outbound = String(message.direction).toUpperCase() === 'OUTBOUND';
      const status = Core.statusSymbol(message.status);
      const reactions = [...new Set([message.id, message.wamid, message.messageId, messageReactionTarget(message)]
        .map((value) => reactionsByMessage.get(String(value || '').trim()) || []).flat())];
      const reactionBadge = reactions.length
        ? `<span class="chat-reaction-badge" title="Reação recebida">${reactions.map((emoji) => escapeHtml(emoji)).join('')}</span>`
        : '';
      const statusClass = status.failed ? ' is-failed' : status.read ? ' is-read' : status.delivered ? ' is-delivered' : '';
      const failureReason = status.failed ? Core.messageFailureReason(message) : null;
      const failureAlert = outbound && status.failed
        ? `<div class="chat-message-failure" role="alert"><span aria-hidden="true">!</span><div><strong>Falha no envio</strong><small>${failureReason.code ? `Erro ${escapeHtml(failureReason.code)}: ` : ''}${escapeHtml(failureReason.text)}</small></div></div>`
        : '';
      return `<article class="chat-message ${outbound ? 'is-outbound' : 'is-inbound'}" data-message-id="${escapeHtml(message.id)}">
        <div class="chat-bubble${reactions.length ? ' has-reaction' : ''}">${renderReplyContext(message)}${renderMessageContent(message)}<footer><time>${escapeHtml(messageTime(message))}</time>${outbound && status.symbol ? `<span class="chat-message-status${statusClass}" title="${escapeHtml(status.label)}" aria-label="${escapeHtml(status.label)}">${status.symbol}</span>` : ''}</footer>${failureAlert}${reactionBadge}${renderReactionActions(message)}</div>
      </article>`;
    }).join('')}`;
    refs.messages.querySelectorAll('[data-chat-media]').forEach((element) => {
      element.addEventListener('click', () => activateMedia(element));
      const mediaKind = element.dataset.chatMedia;
      if (mediaKind === 'image' && element.classList.contains('chat-image-placeholder') && imagePreviewObserver) {
        imagePreviewObserver.observe(element);
      } else if (['audio', 'video'].includes(mediaKind) || (mediaKind === 'image' && element.classList.contains('chat-image-placeholder'))) {
        state.autoMediaQueue = state.autoMediaQueue.then(async () => {
          if (!state.autoMediaDisabled && element.isConnected) await activateMedia(element, false, true);
        });
      }
    });
    refs.messages.querySelectorAll('[data-chat-start-contact]').forEach((button) => {
      button.addEventListener('click', () => startChatFromSharedContact(button));
    });
    const closeReactionMenus = (except = null) => {
      refs.messages.querySelectorAll('.chat-message-actions').forEach((actions) => {
        if (actions === except) return;
        actions.classList.remove('is-open');
        const menu = actions.querySelector('[data-chat-reaction-menu]');
        const toggle = actions.querySelector('[data-chat-reaction-toggle]');
        const more = actions.querySelector('[data-chat-reaction-more]');
        const moreList = actions.querySelector('[data-chat-reaction-more-list]');
        if (menu) menu.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        if (more) more.setAttribute('aria-expanded', 'false');
        if (moreList) moreList.hidden = true;
      });
    };
    const setReactionMenuOpen = (actions, open) => {
      const menu = actions?.querySelector('[data-chat-reaction-menu]');
      const toggle = actions?.querySelector('[data-chat-reaction-toggle]');
      if (!menu) return;
      closeReactionMenus(open ? actions : null);
      actions.classList.toggle('is-open', open);
      menu.hidden = !open;
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    };
    refs.messages.querySelectorAll('[data-chat-reaction-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const actions = button.closest('.chat-message-actions');
        setReactionMenuOpen(actions, !actions?.classList.contains('is-open'));
      });
    });
    refs.messages.querySelectorAll('[data-chat-reaction-more]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const actions = button.closest('.chat-message-actions');
        const moreList = actions?.querySelector('[data-chat-reaction-more-list]');
        if (!moreList) return;
        const expanded = moreList.hidden;
        moreList.hidden = !expanded;
        button.setAttribute('aria-expanded', String(expanded));
      });
    });
    const mobileReactionGesture = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
    if (mobileReactionGesture) {
      refs.messages.querySelectorAll('.chat-message').forEach((article) => {
        const actions = article.querySelector('.chat-message-actions');
        if (!actions) return;
        let timer = null;
        let origin = null;
        const clearNativeSelection = () => window.getSelection?.()?.removeAllRanges();
        const cancel = () => {
          if (timer) clearTimeout(timer);
          timer = null;
          origin = null;
          if (actions.classList.contains('is-open')) {
            clearNativeSelection();
            requestAnimationFrame(clearNativeSelection);
          }
        };
        article.addEventListener('pointerdown', (event) => {
          if (event.button !== undefined && event.button !== 0) return;
          if (event.target.closest('button,a,input,textarea,audio,video')) return;
          origin = { x: event.clientX, y: event.clientY };
          timer = setTimeout(() => {
            timer = null;
            clearNativeSelection();
            setReactionMenuOpen(actions, true);
            navigator.vibrate?.(15);
          }, 480);
        });
        article.addEventListener('pointermove', (event) => {
          if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancel();
        });
        article.addEventListener('pointerup', cancel);
        article.addEventListener('pointercancel', cancel);
        article.addEventListener('selectstart', (event) => event.preventDefault());
        article.addEventListener('contextmenu', (event) => event.preventDefault());
      });
    }
    if (!refs.messages.dataset.reactionDismissBound) {
      refs.messages.dataset.reactionDismissBound = 'true';
      refs.messages.addEventListener('click', (event) => {
        if (!event.target.closest('.chat-message-actions')) {
          refs.messages.querySelectorAll('.chat-message-actions.is-open').forEach((actions) => {
            actions.classList.remove('is-open');
            const menu = actions.querySelector('[data-chat-reaction-menu]');
            const more = actions.querySelector('[data-chat-reaction-more]');
            const moreList = actions.querySelector('[data-chat-reaction-more-list]');
            if (menu) menu.hidden = true;
            if (more) more.setAttribute('aria-expanded', 'false');
            if (moreList) moreList.hidden = true;
          });
        }
      });
    }
    refs.messages.querySelectorAll('[data-chat-message-reaction]').forEach((button) => {
      button.addEventListener('click', () => sendReaction(button.dataset.messageId, button.dataset.emoji));
    });
    refs.messages.querySelectorAll('[data-chat-message-reply]').forEach((button) => {
      button.addEventListener('click', () => startReply(button.dataset.messageId));
    });
    window.lucide?.createIcons();
    if (preserveScroll) refs.messages.scrollTop = refs.messages.scrollHeight - oldHeight + oldTop;
    else requestAnimationFrame(() => {
      scrollBottom();
      fillMessageViewport();
    });
  }

  function formatMetaDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes} min`;
  }

  function renderMetaSessionNotice() {
    if (!state.conversation) return '';
    const windowState = Core.serviceWindowState(state.conversation);
    const expiresAt = windowState.window?.expiresAt
      ? ` Válida até ${new Date(windowState.window.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
      : '';
    const closed = ['expired', 'template-required'].includes(windowState.key);
    return `<article class="chat-system-notice ${closed ? 'is-closed' : 'is-open'}"><i data-lucide="${closed ? 'shield-alert' : 'circle-check'}" aria-hidden="true"></i><div><strong>${escapeHtml(windowState.title)}</strong><span>${escapeHtml(windowState.subtitle + (windowState.key === 'open' ? expiresAt : ''))}</span></div></article>`;
  }

  async function getMediaUrl(id) {
    if (state.mediaUrls.has(id)) {
      const cached = state.mediaUrls.get(id);
      state.mediaUrls.delete(id);
      state.mediaUrls.set(id, cached);
      return cached;
    }
    const response = await fetch(`/api/chat/media/${encodeURIComponent(id)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.erro || 'Não foi possível carregar a mídia.');
    }
    const url = URL.createObjectURL(await response.blob());
    state.mediaUrls.set(id, url);
    while (state.mediaUrls.size > 80) {
      const oldestId = state.mediaUrls.keys().next().value;
      URL.revokeObjectURL(state.mediaUrls.get(oldestId));
      state.mediaUrls.delete(oldestId);
    }
    return url;
  }

  async function activateMedia(element, openModal = true, automatic = false) {
    if (element.dataset.loading === 'true') return;
    element.dataset.loading = 'true';
    try {
      const url = await getMediaUrl(element.dataset.mediaId);
      const kind = element.dataset.chatMedia;
      if (kind === 'audio') element.outerHTML = `<audio class="chat-audio" controls preload="metadata" src="${url}"></audio>`;
      else if (kind === 'video' && !openModal) element.outerHTML = `<video class="chat-video" controls preload="metadata" src="${url}"></video>`;
      else if (kind === 'image' && !openModal) {
        element.className = 'chat-image-preview';
        element.setAttribute('aria-label', 'Abrir imagem');
        element.innerHTML = `<img loading="lazy" decoding="async" src="${url}" alt="Imagem da conversa">`;
      }
      else if (kind === 'document') {
        const link = document.createElement('a'); link.href = url; link.download = element.dataset.filename || 'documento'; link.click();
      } else {
        if (kind === 'image') openImageViewer(url);
        else refs.mediaPreview.innerHTML = `<video controls autoplay src="${url}"></video>`;
        refs.mediaModal.hidden = false;
      }
    } catch (error) {
      if (automatic) state.autoMediaDisabled = true;
      element.innerHTML = '<i data-lucide="circle-alert"></i> Mídia temporariamente indisponível';
      window.lucide?.createIcons();
      setFeedback(error.message, true);
    } finally {
      delete element.dataset.loading;
    }
  }

  function clearMediaUrls() {
    state.mediaUrls.forEach((url) => URL.revokeObjectURL(url));
    state.mediaUrls.clear();
    state.autoMediaQueue = Promise.resolve();
    state.autoMediaDisabled = false;
  }

  function renderConversationDetails() {
    const item = state.conversation || {};
    const contact = Core.contact(item);
    const name = Core.contactName(item);
    const phone = contact.phone || contact.waId || '-';
    const initials = Core.initials(name);
    refs.contactName.innerHTML = `${escapeHtml(name)}${sankhyaBadge(item, false)}`; refs.contactPhone.textContent = phone; refs.contactAvatar.textContent = initials;
    refs.detailsEmpty.hidden = true; refs.detailsContent.hidden = false;
    refs.detailsAvatar.textContent = initials; refs.detailsName.innerHTML = `${escapeHtml(name)}${sankhyaBadge(item, false)}`; refs.detailsPhone.textContent = phone;
    refs.detailsWaid.textContent = contact.waId || '-'; refs.detailsLast.textContent = formatDate(item.lastMessageAt || item.updatedAt) || '-';
    refs.detailsUnread.textContent = String(item.unreadCount || 0);
    const cadastro = sankhyaCadastro(item);
    if (refs.sankhyaData) {
      if (cadastro) {
        const vinculos = sankhyaVinculos(item);
        refs.sankhyaData.classList.add('is-verified');
        refs.sankhyaData.innerHTML = `<strong><i data-lucide="badge-check" aria-hidden="true"></i> Cadastro Sankhya verificado</strong><div class="chat-sankhya-links">${vinculos.map((vinculo) => {
          const contatos = [...vinculo.contatos];
          return `<p><b>${escapeHtml(vinculo.codParc || '-')} - ${escapeHtml(vinculo.nomeParc || 'Parceiro')}</b>${contatos.length ? `<br>Contato${contatos.length > 1 ? 's' : ''}: ${escapeHtml(contatos.join(', '))}` : ''}</p>`;
        }).join('')}</div>`;
      } else {
        refs.sankhyaData.classList.remove('is-verified');
        refs.sankhyaData.innerHTML = '<strong>Telefone não localizado no Sankhya</strong><p>Este número não está vinculado a um parceiro ou contato ativo.</p><button type="button" class="chat-link-partner-button" data-chat-link-partner><i data-lucide="link" aria-hidden="true"></i>Vincular parceiro</button>';
      }
    }
    if (refs.bitrixData) {
      const links = pipelineLinks(item);
      const history = pipelineHistory(item);
      const pending = item.bitrix?.pending === true;
      refs.bitrixData.classList.toggle('is-pending', pending);
      refs.bitrixData.innerHTML = `<strong class="chat-bitrix-heading"><button type="button" class="chat-bitrix-history-button" data-chat-bitrix-history title="Histórico de cards" aria-label="Histórico de cards"><i data-lucide="history" aria-hidden="true"></i></button><i data-lucide="kanban" aria-hidden="true"></i> Bitrix${history.length ? `<small>${history.length}</small>` : ''}</strong>
        ${links.length ? `<div class="chat-bitrix-pipeline-list">${links.map((link) => `<a class="${pipelineColorClass(link)}" href="#" data-bitrix-deal="${escapeHtml(link.dealId)}" title="Card ${escapeHtml(link.dealId)}"><b>${escapeHtml(link.categoryName || `Pipeline ${link.categoryId}`)}</b><small>Card #${escapeHtml(link.dealId)}</small></a>`).join('')}</div>` : '<p>Nenhum card em andamento.</p>'}
        ${pending ? `<em>Pipeline pendente${item.bitrix?.pendingReason ? `: ${escapeHtml(item.bitrix.pendingReason)}` : ''}</em>` : ''}
        <button type="button" class="chat-link-partner-button" data-chat-add-pipeline><i data-lucide="plus" aria-hidden="true"></i>${links.length ? 'Vincular outro pipeline' : 'Vincular pipeline'}</button>`;
    }
    const agent = assignedUser(item);
    const owner = ownsConversation(item);
    refs.assignmentLabel.textContent = agent?.name || 'Sem atendente';
    refs.detailsAgent.textContent = agent?.name || 'Sem atendente';
    refs.claim.hidden = Boolean(agent);
    refs.transfer.hidden = !owner;
    refs.release.hidden = !owner;
    const session = Core.serviceWindow(item);
    const requiresTemplate = session.canSendFreeform !== true;
    const notice = byId('chat-window-notice');
    const windowState = Core.serviceWindowState(item);
    notice.hidden = false;
    notice.textContent = windowState.key === 'open'
      ? 'Atendimento aberto para mensagens livres.'
      : windowState.key === 'awaiting-reply' || windowState.key === 'awaiting-delivery'
        ? 'Aguardando resposta do cliente.'
        : 'Janela encerrada. Envie um template aprovado.';
    refs.input.disabled = requiresTemplate || !owner;
    refs.microphone.disabled = requiresTemplate || !owner;
    refs.attachmentToggle.disabled = requiresTemplate || !owner;
    refs.templateOpen.disabled = !owner;
    refs.attachmentMenu.hidden = true;
    refs.attachmentToggle.setAttribute('aria-expanded', 'false');
    refs.templateOpen.title = !owner ? 'Assuma o atendimento para enviar mensagens' : requiresTemplate ? 'Envie um template para iniciar a conversa' : 'Templates';
    if (!agent) notice.textContent = 'Conversa sem atendente. Assuma para responder.';
    else if (!owner) notice.textContent = `Atendimento de ${agent.name}. Somente esse atendente pode responder.`;
    updateComposer();
    window.lucide?.createIcons();
  }

  function updateConversationHistory(id, mode = 'push') {
    if (mode === 'none') return;
    const payload = { tela: 'chat', conversationId: id };
    const hash = `#chat/${encodeURIComponent(id)}`;
    if (mode === 'replace') history.replaceState(payload, '', hash);
    else history.pushState(payload, '', hash);
  }

  function showConversationList({ replaceHistory = false } = {}) {
    setFeedback();
    cacheActiveConversation();
    cancelScheduledMessagesRender();
    state.activeLoadToken += 1;
    refs.workspace.classList.remove('has-conversation');
    state.conversationId = null;
    state.conversation = null;
    state.messages = [];
    refs.active.hidden = true;
    refs.empty.hidden = false;
    renderConversations();
    if (replaceHistory) history.replaceState({ tela: 'chat', conversationId: null }, '', '#chat');
  }

  async function openConversation(id, { historyMode = 'push' } = {}) {
    if (!id) return;
    const requestedId = String(id);
    setFeedback();
    if (Core.isLoadedConversation(state.conversationId, state.conversation, requestedId)) {
      refs.workspace.classList.add('has-conversation');
      refs.empty.hidden = true;
      refs.active.hidden = false;
      updateConversationHistory(id, historyMode);
      return;
    }
    const token = ++state.activeLoadToken;
    cacheActiveConversation();
    cancelScheduledMessagesRender();
    state.conversationId = requestedId;
    clearReply();
    const cached = state.conversationCache.get(requestedId);
    state.conversation = cached?.conversation || state.conversations.find((item) => String(item.id) === requestedId) || null;
    state.messages = cached?.messages || [];
    state.messagePage = cached
      ? Math.min(cached.messagePage || 1, Math.max(1, Math.ceil(cached.messages.length / MESSAGE_PAGE_SIZE)))
      : 1;
    state.messageTotalPages = cached?.messageTotalPages || 1;
    state.loadingOlder = false;
    renderConversations();
    if (state.conversation) renderConversationDetails();
    refs.workspace.classList.add('has-conversation'); refs.empty.hidden = true; refs.active.hidden = false;
    if (state.messages.length) renderMessages();
    else refs.messages.innerHTML = '<div class="chat-messages-loading"><span></span><span></span><span></span></div>';
    try {
      const [conversation, payload] = await Promise.all([
        api(`/conversations/${encodeURIComponent(requestedId)}`),
        api(`/conversations/${encodeURIComponent(requestedId)}/messages?page=1&limit=${MESSAGE_PAGE_SIZE}`)
      ]);
      if (token !== state.activeLoadToken || requestedId !== String(state.conversationId)) return;
      state.conversation = conversation;
      state.messages = Core.mergeById(Array.isArray(payload?.data) ? payload.data : [], state.messages);
      state.messageTotalPages = Number(payload?.pagination?.totalPages || 1);
      renderConversationDetails(); renderMessages();
      cacheActiveConversation();
      const listItem = state.conversations.find((item) => String(item.id) === requestedId);
      if (ownsConversation(conversation) && Number(listItem?.unreadCount || conversation?.unreadCount || 0) > 0) {
        markRead(requestedId);
      }
      updateConversationHistory(requestedId, historyMode);
    } catch (error) {
      if (token !== state.activeLoadToken || requestedId !== String(state.conversationId)) return;
      refs.messages.innerHTML = `<div class="chat-message-empty is-error">${escapeHtml(error.message)}</div>`;
    }
  }

  function fillMessageViewport() {
    if (!state.conversationId || state.loadingOlder || state.messagePage >= state.messageTotalPages) return;
    if (Core.shouldLoadOlderMessages(refs.messages, {
      fillViewport: true,
      threshold: MESSAGE_SCROLL_THRESHOLD,
      fillRatio: MESSAGE_FILL_RATIO
    })) loadOlderMessages();
  }

  async function loadOlderMessages() {
    if (state.loadingOlder || state.messagePage >= state.messageTotalPages) return;
    const conversationId = String(state.conversationId || '');
    if (!conversationId) return;
    const page = state.messagePage + 1;
    state.loadingOlder = true;
    refs.messages.classList.add('is-loading-history');
    try {
      const payload = await api(`/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&limit=${MESSAGE_PAGE_SIZE}`);
      if (conversationId !== String(state.conversationId)) return;
      state.messagePage = page;
      state.messageTotalPages = Number(payload?.pagination?.totalPages || state.messageTotalPages || 1);
      state.messages = Core.mergeById(payload?.data || [], state.messages);
      renderMessages({ preserveScroll: true });
    } catch (error) { setFeedback(error.message, true); }
    finally {
      state.loadingOlder = false;
      refs.messages.classList.remove('is-loading-history');
      if (conversationId === String(state.conversationId)) {
        requestAnimationFrame(fillMessageViewport);
      }
    }
  }

  async function markRead(id) {
    const item = state.conversations.find((conversation) => String(conversation.id) === String(id));
    if (item) item.unreadCount = 0;
    if (state.conversation) state.conversation.unreadCount = 0;
    renderConversations(); renderConversationDetails();
    try { await api(`/conversations/${encodeURIComponent(id)}/read`, { method: 'POST' }); } catch {}
  }

  function setFeedback(message = '', error = false) {
    refs.feedback.textContent = message;
    refs.feedback.classList.toggle('is-error', error);
  }

  function updateComposer() {
    refs.send.disabled = !ownsConversation() || !Core.canSendText(refs.input.value, state.sending);
    refs.input.style.height = 'auto'; refs.input.style.height = `${Math.min(refs.input.scrollHeight, 128)}px`;
  }

  function renderComposerReply() {
    if (!refs.composerReply) return;
    const reply = state.replyingTo;
    refs.composerReply.hidden = !reply;
    if (!reply) return;
    refs.composerReplyAuthor.textContent = reply.senderName || 'Respondendo';
    refs.composerReplyText.textContent = reply.text || 'Mensagem';
    window.lucide?.createIcons();
  }

  function clearReply() {
    state.replyingTo = null;
    renderComposerReply();
  }

  function startReply(messageId) {
    if (!ownsConversation()) {
      setFeedback('Assuma o atendimento para responder à mensagem.', true);
      return;
    }
    const message = state.messages.find((item) => messageReactionTarget(item) === String(messageId || ''));
    if (!message) return;
    const outbound = String(message.direction || '').toUpperCase() === 'OUTBOUND';
    state.replyingTo = {
      messageId,
      text: Core.messagePreview(message),
      senderName: outbound ? (message.senderUserName || state.profile?.signature || 'Você') : Core.contactName(state.conversation || {}),
      direction: outbound ? 'OUTBOUND' : 'INBOUND'
    };
    renderComposerReply();
    refs.messages.querySelectorAll('.chat-message-actions.is-open').forEach((actions) => {
      actions.classList.remove('is-open');
      const menu = actions.querySelector('[data-chat-reaction-menu]');
      const toggle = actions.querySelector('[data-chat-reaction-toggle]');
      if (menu) menu.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
    refs.input.focus();
  }

  async function sendText(event) {
    event.preventDefault();
    const text = refs.input.value.trim();
    if (!state.conversationId || !Core.canSendText(text, state.sending)) return;
    state.sending = true; updateComposer(); setFeedback('Enviando...');
    try {
      const message = await api(`/conversations/${encodeURIComponent(state.conversationId)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, replyToMessageId: state.replyingTo?.messageId || undefined })
      });
      state.messages = Core.mergeById(state.messages, [message]); refs.input.value = ''; clearReply(); renderMessages();
      setFeedback();
    } catch (error) { setFeedback('Não foi possível enviar a mensagem.', true); }
    finally { state.sending = false; updateComposer(); refs.input.focus(); }
  }

  async function sendReaction(messageId, emoji) {
    if (!state.conversationId || !messageId || !emoji || state.sending) return;
    if (!ownsConversation()) {
      setFeedback('Assuma o atendimento para reagir à mensagem.', true);
      return;
    }
    state.sending = true;
    updateComposer();
    try {
      const response = await api(`/conversations/${encodeURIComponent(state.conversationId)}/messages/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji })
      });
      const reaction = response?.message || response;
      if (reaction?.id || reaction?.wamid || reaction?.messageId) {
        state.messages = Core.mergeById(state.messages, [reaction]);
      }
      renderMessages({ preserveScroll: true });
      setFeedback();
    } catch (error) {
      setFeedback(error.message || 'Não foi possível enviar a reação.', true);
    } finally {
      state.sending = false;
      updateComposer();
    }
  }

  async function sendFile(kind, file, fields = {}) {
    if (!state.conversationId || !file || state.sending || state.conversation?.requiresTemplate) return;
    const form = new FormData(); form.append('file', file);
    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
    state.sending = true; updateComposer(); setFeedback('Enviando arquivo...');
    try {
      const payload = await api(`/conversations/${encodeURIComponent(state.conversationId)}/messages/${kind}`, { method: 'POST', body: form });
      state.messages = Core.mergeById(state.messages, [Core.unwrap(payload)]); renderMessages(); setFeedback();
    } catch (error) { setFeedback(kind === 'audio' ? 'Falha ao enviar áudio.' : 'Não foi possível enviar o arquivo.', true); }
    finally { state.sending = false; updateComposer(); }
  }

  function closeMediaModal() {
    if (state.pendingUpload?.previewUrl) URL.revokeObjectURL(state.pendingUpload.previewUrl);
    state.pendingUpload = null;
    refs.uploadActions.hidden = true;
    refs.mediaZoomControls.hidden = true;
    state.mediaZoom = 1;
    refs.mediaModal.hidden = true;
    refs.mediaPreview.innerHTML = '';
  }

  function applyImageZoom(nextZoom) {
    const image = refs.mediaPreview.querySelector('.chat-media-zoom-stage img');
    if (!image) return;
    state.mediaZoom = Math.min(4, Math.max(1, Math.round(nextZoom * 10) / 10));
    const fitWidth = Number(image.dataset.fitWidth);
    const fitHeight = Number(image.dataset.fitHeight);
    if (fitWidth > 0 && fitHeight > 0) {
      image.style.width = `${Math.round(fitWidth * state.mediaZoom)}px`;
      image.style.height = `${Math.round(fitHeight * state.mediaZoom)}px`;
    }
    image.classList.toggle('is-zoomed', state.mediaZoom > 1);
    refs.mediaZoomLabel.textContent = `${Math.round(state.mediaZoom * 100)}%`;
  }

  function fitImageViewer(image) {
    const stage = image?.closest('.chat-media-zoom-stage');
    if (!stage || !image.naturalWidth || !image.naturalHeight) return;
    const availableWidth = Math.max(1, stage.clientWidth);
    const availableHeight = Math.max(1, stage.clientHeight);
    const fitScale = Math.min(
      availableWidth / image.naturalWidth,
      availableHeight / image.naturalHeight,
      1
    );
    image.dataset.fitWidth = String(image.naturalWidth * fitScale);
    image.dataset.fitHeight = String(image.naturalHeight * fitScale);
    applyImageZoom(state.mediaZoom);
  }

  function openImageViewer(url) {
    state.mediaZoom = 1;
    refs.uploadActions.hidden = true;
    refs.mediaPreview.innerHTML = `<div class="chat-media-zoom-stage"><img src="${escapeHtml(url)}" alt="Imagem ampliada"></div>`;
    refs.mediaZoomControls.hidden = false;
    refs.mediaZoomLabel.textContent = '100%';
    refs.mediaModal.hidden = false;
    const image = refs.mediaPreview.querySelector('.chat-media-zoom-stage img');
    const fit = () => requestAnimationFrame(() => fitImageViewer(image));
    if (image.complete) fit();
    else image.addEventListener('load', fit, { once: true });
    window.lucide?.createIcons();
  }

  function prepareFile(kind, file) {
    if (!file || !state.conversationId || state.conversation?.requiresTemplate) return;
    const limits = { image: 5 * 1024 * 1024, document: 100 * 1024 * 1024, video: 16 * 1024 * 1024 };
    if (file.size > limits[kind]) {
      setFeedback(`O arquivo excede o limite de ${Math.round(limits[kind] / 1024 / 1024)} MB.`, true);
      return;
    }
    closeMediaModal();
    const previewUrl = URL.createObjectURL(file);
    state.pendingUpload = { kind, file, previewUrl };
    if (kind === 'image') refs.mediaPreview.innerHTML = `<img src="${previewUrl}" alt="Imagem selecionada para envio">`;
    else if (kind === 'video') refs.mediaPreview.innerHTML = `<video controls preload="metadata" src="${previewUrl}"></video>`;
    else refs.mediaPreview.innerHTML = `<div class="chat-document"><i data-lucide="file-text"></i><span><strong>${escapeHtml(file.name)}</strong><small>${Math.max(1, Math.round(file.size / 1024))} KB</small></span></div>`;
    refs.uploadActions.hidden = false;
    refs.mediaModal.hidden = false;
    window.lucide?.createIcons();
  }

  function pasteImage(event) {
    const item = [...(event.clipboardData?.items || [])]
      .find((clipboardItem) => clipboardItem.kind === 'file' && clipboardItem.type.startsWith('image/'));
    const source = item?.getAsFile();
    if (!source) return;
    event.preventDefault();
    const extension = source.type === 'image/jpeg' ? 'jpg' : (source.type.split('/')[1] || 'png');
    const file = new File([source], `imagem-colada-${Date.now()}.${extension}`, {
      type: source.type || 'image/png',
      lastModified: Date.now()
    });
    prepareFile('image', file);
  }

  async function submitPendingUpload() {
    const pending = state.pendingUpload;
    if (!pending) return;
    refs.uploadSend.disabled = true;
    state.pendingUpload = null;
    refs.uploadActions.hidden = true;
    refs.mediaModal.hidden = true;
    refs.mediaPreview.innerHTML = '';
    URL.revokeObjectURL(pending.previewUrl);
    try { await sendFile(pending.kind, pending.file); }
    finally { refs.uploadSend.disabled = false; }
  }

  function updateRealtime(payload) {
    const status = payload?.state || 'disconnected'; refs.realtime.dataset.state = status;
    refs.realtime.querySelector('strong').textContent = status === 'connected' ? 'Tempo real ativo'
      : status === 'connecting' ? 'Conectando...' : 'Reconectando...';
  }

  function upsertConversation(payload = {}) {
    const incoming = payload.conversation || payload;
    const id = String(incoming.id ?? payload.conversationId ?? '');
    if (!id) return;
    if (isConversationHidden(incoming)) return;
    const index = state.conversations.findIndex((item) => String(item.id) === id);
    const merged = index >= 0 ? { ...state.conversations[index], ...incoming, ...payload } : incoming;
    if (!matchesAssignment(merged)) {
      if (index >= 0) state.conversations.splice(index, 1);
      scheduleConversationsRender();
      return;
    }
    if (index >= 0) state.conversations[index] = merged;
    else if (incoming.id) state.conversations.unshift(incoming);
    state.conversations.sort((a, b) => new Date(conversationTimestamp(b) || 0) - new Date(conversationTimestamp(a) || 0));
    scheduleConversationsRender();
  }

  function applyConversationUpdate(payload = {}) {
    const incoming = payload.conversation || payload;
    const id = String(incoming.id ?? payload.conversationId ?? '');
    upsertConversation(payload);
    if (id && id === String(state.conversationId)) {
      state.conversation = { ...(state.conversation || {}), ...incoming, ...(payload.serviceWindow ? { serviceWindow: payload.serviceWindow } : {}) };
      renderConversationDetails();
      scheduleMessagesRender({ preserveScroll: true });
    }
  }

  async function refreshActiveConversation(id) {
    try {
      const conversation = await api(`/conversations/${encodeURIComponent(id)}`);
      if (String(id) !== String(state.conversationId)) return;
      state.conversation = conversation;
      upsertConversation(conversation);
      renderConversationDetails();
      scheduleMessagesRender({ preserveScroll: true });
    } catch {}
  }

  function handleRealtime(event, payload = {}) {
    if (event === 'message:new') {
      const id = String(payload.conversationId || payload.message?.conversationId || '');
      if (id === String(state.conversationId)) {
        const shouldScroll = nearBottom();
        state.messages = Core.mergeById(state.messages, [payload.message]); scheduleMessagesRender({ preserveScroll: !shouldScroll });
        if (shouldScroll) requestAnimationFrame(() => scrollBottom('smooth')); else refs.newMessage.hidden = false;
        if (ownsConversation() && String(payload.message?.direction).toUpperCase() === 'INBOUND') {
          markRead(id);
          refreshActiveConversation(id);
        }
      } else {
        const item = state.conversations.find((conversation) => String(conversation.id) === id);
        if (item) { item.lastMessage = payload.message; item.lastMessageAt = payload.message?.messageTimestamp || new Date().toISOString(); item.unreadCount = Number(item.unreadCount || 0) + 1; }
        else loadConversations();
        scheduleConversationsRender();
      }
    } else if (event === 'message:status') {
      const updates = Array.isArray(payload.statuses)
        ? payload.statuses
        : [payload.message || payload.statusUpdate || payload];
      updates.forEach((update) => {
        state.messages = Core.updateMessageStatus(state.messages, update);
      });
      scheduleMessagesRender({ preserveScroll: true });
      const id = String(payload.conversationId || payload.message?.conversationId || '');
      if (id === String(state.conversationId)) refreshActiveConversation(id);
    } else if (event === 'conversation:new' || event === 'conversation:updated') {
      const incoming = payload.conversation || payload;
      const id = String(incoming.id ?? payload.conversationId ?? '');
      applyConversationUpdate(payload);
    }
    else if (event === 'conversation:read' || event === 'conversation:status' || event === 'conversation:assignment') applyConversationUpdate(payload);
    else if (event === 'conversation:deleted') {
      const ids = new Set([payload.conversationId, ...(payload.relatedConversationIds || [])].map(String));
      state.conversations = state.conversations.filter((item) => !ids.has(String(item.id)));
      if (ids.has(String(state.conversationId))) showConversationList({ replaceHistory: true });
      scheduleConversationsRender();
    }
  }

  function connectRealtime() {
    state.eventSource?.close();
    const source = new EventSource('/api/chat/events'); state.eventSource = source;
    ['conversation:new', 'conversation:updated', 'message:new', 'message:status', 'conversation:read', 'conversation:status', 'conversation:assignment', 'conversation:deleted'].forEach((event) => {
      source.addEventListener(event, (message) => { try { handleRealtime(event, JSON.parse(message.data)); } catch {} });
    });
    source.addEventListener('connection', (message) => { try { updateRealtime(JSON.parse(message.data)); } catch {} });
    source.onerror = () => updateRealtime({ state: 'reconnecting' });
  }

  async function loadAgents() {
    const payload = await api('/agents');
    state.agents = Array.isArray(payload?.agentes) ? payload.agentes : [];
    return state.agents;
  }

  function renderAgentFilterOptions() {
    if (!refs.agentFilterSelect) return;
    refs.agentFilterSelect.innerHTML = '<option value="">Todos os atendentes</option>' + state.agents.map((agent) =>
      `<option value="${escapeHtml(agent.id)}"${String(agent.id) === String(state.agentId) ? ' selected' : ''}>${escapeHtml(agent.name)}</option>`
    ).join('');
  }

  async function toggleAgentFilter() {
    if (state.access?.diretor !== true || !refs.agentFilter) return;
    const opening = refs.agentFilter.hidden;
    refs.agentFilter.hidden = !opening;
    refs.agentFilterToggle.setAttribute('aria-expanded', String(opening));
    if (!opening) return;
    if (!state.agents.length) {
      refs.agentFilterSelect.disabled = true;
      refs.agentFilterSelect.innerHTML = '<option>Carregando atendentes...</option>';
      try {
        await loadAgents();
        renderAgentFilterOptions();
      } catch (error) {
        refs.agentFilterSelect.innerHTML = '<option>Não foi possível carregar</option>';
      } finally {
        refs.agentFilterSelect.disabled = false;
      }
    } else renderAgentFilterOptions();
  }

  function applyAgentFilter(agentId = '') {
    state.agentId = String(agentId || '');
    refs.agentFilterClear.hidden = !state.agentId;
    refs.agentFilterToggle.classList.toggle('is-active', Boolean(state.agentId));
    const selected = state.agents.find((agent) => String(agent.id) === state.agentId);
    refs.agentFilterToggle.title = selected ? `Atendente: ${selected.name}` : 'Filtrar por atendente';
    state.assignment = 'ALL';
    refs.filters.querySelectorAll('[data-chat-assignment]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.chatAssignment === 'ALL');
    });
    state.page = 1;
    loadConversations();
  }

  async function changeAssignment(action, target = null, extra = {}) {
    if (!state.conversationId) return null;
    const path = action === 'CLAIM' ? 'claim' : action === 'TRANSFER' ? 'transfer' : 'release';
    const body = { ...extra, ...(target ? { codUsu: target.codUsu ?? target.id } : {}) };
    const conversation = await api(`/conversations/${encodeURIComponent(state.conversationId)}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    state.conversation = { ...state.conversation, ...conversation };
    upsertConversation({ ...state.conversation, ...conversation });
    renderConversationDetails();
    return conversation;
  }

  function choosePipeline({ allowNone = false, title = 'Selecionar pipeline', description = '' } = {}) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'chat-agent-modal';
      modal.innerHTML = `<form class="chat-agent-dialog"><header><div><span>BITRIX</span><h2>${escapeHtml(title)}</h2></div><button type="button" data-close aria-label="Fechar">×</button></header>${description ? `<p>${escapeHtml(description)}</p>` : ''}<label>Pipeline<select required><option value="">Carregando pipelines...</option></select></label><p class="chat-agent-feedback"></p><footer><button type="button" data-close>Cancelar</button>${allowNone ? '<button type="button" class="is-light" data-without-pipeline>Assumir sem pipeline</button>' : ''}<button type="submit">Confirmar pipeline</button></footer></form>`;
      const select = modal.querySelector('select');
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; modal.remove(); resolve(value); };
      modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => finish(null)));
      modal.addEventListener('click', (event) => { if (event.target === modal) finish(null); });
      modal.querySelector('[data-without-pipeline]')?.addEventListener('click', () => finish({ withoutPipeline: true }));
      modal.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (select.value === '') return;
        finish({ pipelineId: Number(select.value) });
      });
      document.body.append(modal);
      loadPipelines().then(() => fillPipelineSelect(select)).catch((error) => {
        modal.querySelector('.chat-agent-feedback').textContent = error.message;
        select.innerHTML = '<option value="">Pipelines indisponíveis</option>';
      });
    });
  }

  async function claimConversation(id = state.conversationId, options = {}) {
    if (!id) return null;
    if (String(id) !== String(state.conversationId)) state.conversationId = String(id);
    const choice = options.prompt === false
      ? { pipelineId: options.pipelineId }
      : await choosePipeline({
        allowNone: true,
        title: 'Assumir atendimento',
        description: 'Selecione um pipeline para criar o card no Bitrix ou assuma sem pipeline para vincular depois.'
      });
    if (!choice) return null;
    try {
      const conversation = await changeAssignment('CLAIM', null, choice);
      if (conversation.readConfirmed) {
        const item = state.conversations.find((entry) => String(entry.id) === String(id));
        if (item) item.unreadCount = 0;
        if (state.conversation) state.conversation.unreadCount = 0;
      }
      renderConversations();
      setFeedback(conversation.bitrixError
        ? `Atendimento assumido. O pipeline ficou pendente: ${conversation.bitrixError}`
        : choice.withoutPipeline ? 'Atendimento assumido sem pipeline. Vincule-o depois nos dados do contato.' : 'Atendimento assumido e card do Bitrix vinculado.',
      Boolean(conversation.bitrixError));
      return conversation;
    } catch (error) {
      setFeedback(error.message, true);
      throw error;
    }
  }

  async function addPipelineToConversation() {
    if (!state.conversationId) return;
    const choice = await choosePipeline({
      title: pipelineLinks(state.conversation).length ? 'Vincular outro pipeline' : 'Vincular pipeline',
      description: 'Será criado um único card para esta conversa no pipeline selecionado.'
    });
    if (!choice?.pipelineId && choice?.pipelineId !== 0) return;
    try {
      const result = await api(`/conversations/${encodeURIComponent(state.conversationId)}/bitrix-pipelines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(choice)
      });
      state.conversation = { ...state.conversation, ...(result.conversation || {}) };
      upsertConversation(state.conversation);
      renderConversationDetails();
      setFeedback(result.link?.reused ? 'Este pipeline já estava vinculado ao chat.' : 'Card criado e pipeline vinculado ao chat.');
    } catch (error) {
      setFeedback(error.message, true);
    }
  }

  function formatBitrixHistoryDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  async function openBitrixHistory() {
    if (!state.conversationId) return;
    const modal = document.createElement('div');
    modal.className = 'chat-agent-modal';
    modal.innerHTML = '<section class="chat-agent-dialog chat-bitrix-history-dialog"><header><div><span>BITRIX</span><h2>Histórico de cards</h2></div><button type="button" data-close aria-label="Fechar">×</button></header><div class="chat-bitrix-history-loading">Carregando histórico...</div></section>';
    document.body.append(modal);
    const close = () => modal.remove();
    modal.addEventListener('click', (event) => { if (event.target === modal || event.target.closest('[data-close]')) close(); });
    try {
      const response = await api(`/conversations/${encodeURIComponent(state.conversationId)}/bitrix-history`);
      const history = Array.isArray(response?.history) ? response.history : [];
      const list = history.length
        ? `<div class="chat-bitrix-history-list">${history.map((link) => `<article class="${pipelineColorClass(link)}"><div><b>${escapeHtml(link.categoryName || `Pipeline ${link.categoryId}`)}</b><small>Card #${escapeHtml(link.dealId)}</small></div><span>${escapeHtml(link.stageName || 'Status não informado')}</span><time>Concluído em ${escapeHtml(formatBitrixHistoryDate(link.completedAt))}</time></article>`).join('')}</div>`
        : '<p class="chat-bitrix-history-empty">Nenhum card concluído foi registrado para esta conversa.</p>';
      modal.querySelector('.chat-bitrix-history-loading').outerHTML = list;
      window.lucide?.createIcons();
    } catch (error) {
      modal.querySelector('.chat-bitrix-history-loading').outerHTML = `<p class="chat-bitrix-history-empty is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function openTransferDialog() {
    if (!ownsConversation()) return;
    const modal = document.createElement('div');
    modal.className = 'chat-agent-modal';
    modal.innerHTML = `<form class="chat-agent-dialog"><header><div><span>ATENDIMENTO</span><h2>Transferir conversa</h2></div><button type="button" data-close aria-label="Fechar">×</button></header><label>Atendente<select required><option value="">Selecione...</option></select></label><p class="chat-agent-feedback"></p><footer><button type="button" data-close>Cancelar</button><button type="submit">Transferir</button></footer></form>`;
    const select = modal.querySelector('select');
    const fill = () => { select.innerHTML = '<option value="">Selecione...</option>' + state.agents.filter((agent) => String(agent.id) !== String(state.profile?.id)).map((agent) => `<option value="${escapeHtml(agent.codUsu)}">${escapeHtml(agent.name)}</option>`).join(''); };
    (state.agents.length ? Promise.resolve(state.agents) : loadAgents()).then(fill).catch((error) => { modal.querySelector('.chat-agent-feedback').textContent = error.message; });
    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const target = state.agents.find((agent) => String(agent.codUsu) === select.value);
      if (!target) return;
      try { await changeAssignment('TRANSFER', target); close(); showConversationList({ replaceHistory: true }); await loadConversations(); setFeedback(`Conversa transferida para ${target.name}.`); }
      catch (error) { modal.querySelector('.chat-agent-feedback').textContent = error.message; }
    });
    document.body.append(modal);
  }

  function openProfileDialog() {
    const modal = document.createElement('div');
    modal.className = 'chat-agent-modal';
    modal.innerHTML = `<form class="chat-agent-dialog"><header><div><span>MEU PERFIL</span><h2>Perfil do atendente</h2></div><button type="button" data-close aria-label="Fechar">×</button></header><label>Nome exibido<input name="nomeExibicao" maxlength="160" required value="${escapeHtml(state.profile?.name || '')}"></label><label>Assinatura das mensagens<input name="assinatura" maxlength="80" value="${escapeHtml(state.profile?.signature || '')}" placeholder="Ex.: Leonardo"></label><small>A assinatura será incluída automaticamente nas mensagens de texto.</small><p class="chat-agent-feedback"></p><footer><button type="button" data-close>Cancelar</button><button type="submit">Salvar perfil</button></footer></form>`;
    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        const payload = await api('/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
        state.profile = payload.perfil; close();
      } catch (error) { modal.querySelector('.chat-agent-feedback').textContent = error.message; }
    });
    document.body.append(modal);
  }

  async function openSettingsDialog() {
    if (!state.access?.diretor) return;
    const modal = document.createElement('div');
    modal.className = 'chat-agent-modal';
    modal.innerHTML = `<section class="chat-agent-dialog is-wide"><header><div><span>DIRETORIA</span><h2>Acesso ao Chat</h2></div><button type="button" data-close aria-label="Fechar">×</button></header><p>Carregando usuários...</p></section>`;
    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('[data-close]').addEventListener('click', close);
    try {
      const payload = await api('/settings/users');
      const users = payload.usuarios || [];
      const dialog = modal.querySelector('.chat-agent-dialog');
      dialog.querySelector('p').outerHTML = `<div class="chat-agent-users">${users.map((user) => `<form data-user="${user.codUsu}"><label class="chat-agent-enabled"><input type="checkbox" name="habilitado" ${user.habilitado ? 'checked' : ''}> <span><strong>${escapeHtml(user.nome)}</strong><small>${escapeHtml(user.grupo || 'Sem grupo')}</small></span></label><input name="nomeExibicao" maxlength="160" value="${escapeHtml(user.nomeExibicao)}" aria-label="Nome exibido"><input name="assinatura" maxlength="80" value="${escapeHtml(user.assinatura)}" placeholder="Assinatura"><button type="submit">Salvar</button><em></em></form>`).join('')}</div>`;
      dialog.querySelectorAll('[data-user]').forEach((form) => form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        data.habilitado = form.elements.habilitado.checked;
        const feedback = form.querySelector('em');
        try { await api(`/settings/users/${form.dataset.user}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); feedback.textContent = 'Salvo'; await loadAgents(); }
        catch (error) { feedback.textContent = error.message; }
      }));
    } catch (error) { modal.querySelector('.chat-agent-dialog>p').textContent = error.message; }
  }

  async function beginRecording() {
    if (state.conversation?.requiresTemplate) return setFeedback('Envie um template aprovado antes de gravar uma mensagem.', true);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setFeedback('Este navegador não oferece gravação de áudio.', true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
      state.recordingStream = stream; state.recordingChunks = []; state.recordingBlob = null;
      state.recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      state.recorder.ondataavailable = (event) => { if (event.data.size) state.recordingChunks.push(event.data); };
      state.recorder.onstop = () => {
        const recordedType = state.recorder.mimeType
          || state.recordingChunks.find((chunk) => chunk.type)?.type
          || 'audio/webm';
        state.recordingBlob = new Blob(state.recordingChunks, { type: recordedType });
      };
      state.recorder.start(); state.recordingStartedAt = Date.now(); refs.recording.hidden = false; refs.form.hidden = true;
      state.recordingTimer = setInterval(() => {
        const seconds = Math.floor((Date.now() - state.recordingStartedAt) / 1000);
        refs.recordingTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      }, 250);
    } catch { setFeedback('Permissão de microfone negada.', true); }
  }

  function stopRecording(cancel = false) {
    clearInterval(state.recordingTimer); state.recordingTimer = null;
    if (state.recorder?.state !== 'inactive') state.recorder.stop();
    state.recordingStream?.getTracks().forEach((track) => track.stop());
    refs.recording.hidden = true; refs.form.hidden = false;
    if (cancel) { state.recordingChunks = []; state.recordingBlob = null; }
  }

  async function submitRecording() {
    stopRecording();
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!state.recordingBlob?.size) return setFeedback('Falha ao preparar o áudio.', true);
    const extension = state.recordingBlob.type.includes('ogg') ? 'ogg' : 'webm';
    await sendFile('audio', new File([state.recordingBlob], `audio-${Date.now()}.${extension}`, { type: state.recordingBlob.type }), { voice: true });
    state.recordingBlob = null;
  }

  function templateBody(template) {
    return template?.body?.text || template?.components?.find((item) => item.type === 'BODY')?.text || '';
  }

  function templatePlaceholders(template) {
    const matches = templateBody(template).match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }

  function renderTemplates() {
    const term = refs.templateSearch.value.trim().toLocaleLowerCase('pt-BR');
    const templates = state.templates.filter((item) => !term || `${item.name} ${item.language} ${templateBody(item)}`.toLocaleLowerCase('pt-BR').includes(term));
    refs.templateList.innerHTML = templates.length ? templates.map((item) => `<button type="button" data-template-name="${escapeHtml(item.name)}" data-template-language="${escapeHtml(item.language)}"><strong>${escapeHtml(item.displayName || item.name)}</strong><span>${escapeHtml(item.language || '')} · ${escapeHtml(item.category || '')}</span><small>${escapeHtml(templateBody(item).slice(0, 120))}</small></button>`).join('') : '<p>Nenhum template encontrado.</p>';
    refs.templateList.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => selectTemplate(button.dataset.templateName, button.dataset.templateLanguage)));
  }

  async function openTemplates() {
    if (!state.conversationId) return;
    refs.templateModal.hidden = false; refs.templateList.innerHTML = '<p>Carregando templates...</p>';
    try {
      const payload = await api('/templates?status=APPROVED&limit=100');
      const templates = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      state.templates = templates.map((item) => item?.template || item).filter(Boolean);
      renderTemplates();
    } catch { refs.templateList.innerHTML = '<p>Template indisponível.</p>'; }
  }

  async function selectTemplate(name, language) {
    try {
      const payload = await api(`/templates/${encodeURIComponent(name)}?language=${encodeURIComponent(language || '')}`);
      state.selectedTemplate = payload.template || payload;
      const placeholders = templatePlaceholders(state.selectedTemplate);
      refs.templateConfig.innerHTML = `<strong>${escapeHtml(state.selectedTemplate.displayName || state.selectedTemplate.name)}</strong><div class="chat-template-preview">${escapeHtml(templateBody(state.selectedTemplate)).replace(/\n/g, '<br>')}</div>${placeholders.map((placeholder, index) => `<label>Variável ${placeholder}<input data-template-param="${index}" type="text" required></label>`).join('')}`;
      refs.templateSend.disabled = placeholders.length > 0;
      refs.templateConfig.querySelectorAll('[data-template-param]').forEach((input) => input.addEventListener('input', Core.debounce(previewSelectedTemplate, 250)));
      if (!placeholders.length) await previewSelectedTemplate();
    } catch { refs.templateConfig.innerHTML = '<p>Template indisponível.</p>'; refs.templateSend.disabled = true; }
  }

  async function previewSelectedTemplate() {
    if (!state.selectedTemplate) return;
    const values = [...refs.templateConfig.querySelectorAll('[data-template-param]')].map((input) => input.value.trim());
    if (values.some((value) => !value)) { refs.templateSend.disabled = true; return; }
    try {
      const preview = await api('/templates/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: state.selectedTemplate.name, language: state.selectedTemplate.language, parameters: { body: values } })
      });
      const previewElement = refs.templateConfig.querySelector('.chat-template-preview');
      if (previewElement) previewElement.innerHTML = escapeHtml(preview.body || templateBody(state.selectedTemplate)).replace(/\n/g, '<br>');
      refs.templateSend.disabled = preview.valid === false;
      refs.templateFeedback.textContent = preview.valid === false ? 'Preencha todos os parâmetros obrigatórios.' : '';
    } catch (error) {
      refs.templateSend.disabled = true;
      refs.templateFeedback.textContent = error.message || 'Template indisponível.';
    }
  }

  async function submitTemplate() {
    if (!state.selectedTemplate || !state.conversationId) return;
    const values = [...refs.templateConfig.querySelectorAll('[data-template-param]')].map((input) => input.value.trim());
    if (values.some((value) => !value)) { refs.templateFeedback.textContent = 'Preencha todas as variáveis.'; return; }
    const components = values.length ? [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) }] : [];
    refs.templateSend.disabled = true; refs.templateFeedback.textContent = 'Enviando...';
    try {
      const payload = await api(`/conversations/${encodeURIComponent(state.conversationId)}/messages/template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: state.selectedTemplate.name, language: state.selectedTemplate.language, components })
      });
      const message = payload?.message || payload;
      if (!message?.id && !message?.wamid) throw new Error('Não foi possível enviar o template.');
      state.messages = Core.mergeById(state.messages, [message]);
      renderMessages();
      refs.templateModal.hidden = true;
      setFeedback('Template enviado.');
      refreshActiveConversation(state.conversationId);
    } catch (error) { refs.templateFeedback.textContent = error.message || 'Não foi possível enviar o template.'; }
    finally { refs.templateSend.disabled = false; }
  }

  function resetPartnerSelection() {
    state.selectedPartner = null;
    refs.selectedPartner.hidden = true;
    refs.selectedPartnerLabel.hidden = true;
    refs.partnerContactField.hidden = true;
    refs.partnerContacts.innerHTML = '';
    refs.partnerContact.value = '';
    updateNewContactSubmit();
  }

  async function searchPartners() {
    const term = refs.partnerSearch.value.trim();
    const token = ++state.partnerSearchToken;
    resetPartnerSelection();
    if ((!/^\d+$/.test(term) && term.length < 2) || !term) {
      refs.partnerResults.hidden = true;
      refs.partnerResults.innerHTML = '';
      return;
    }
    refs.partnerResults.hidden = false;
    refs.partnerResults.innerHTML = '<span class="chat-partner-loading">Buscando parceiros...</span>';
    try {
      const payload = await api(`/partners?q=${encodeURIComponent(term)}`);
      if (token !== state.partnerSearchToken) return;
      const partners = Array.isArray(payload?.parceiros) ? payload.parceiros : [];
      refs.partnerResults.innerHTML = partners.length ? partners.map((partner) => `
        <button type="button" data-chat-partner="${escapeHtml(partner.codParc)}">
          <strong>${escapeHtml(partner.codParc)} - ${escapeHtml(partner.nome)}</strong>
          <span>${escapeHtml(partner.cnpjCpf || 'CNPJ/CPF não informado')}</span>
        </button>`).join('') : '<span class="chat-partner-loading">Nenhum parceiro ativo encontrado.</span>';
    } catch (error) {
      if (token === state.partnerSearchToken) refs.partnerResults.innerHTML = `<span class="chat-partner-loading is-error">${escapeHtml(error.message)}</span>`;
    }
  }

  async function selectPartner(codParc, preferredContactKey = '') {
    const token = ++state.partnerSearchToken;
    refs.contactFeedback.textContent = 'Carregando contatos do parceiro...';
    refs.partnerContact.value = '';
    updateNewContactSubmit();
    try {
      const payload = await api(`/partners/${encodeURIComponent(codParc)}/contacts`);
      if (token !== state.partnerSearchToken) return;
      state.selectedPartner = payload.parceiro;
      refs.selectedPartnerName.textContent = `${payload.parceiro.codParc} - ${payload.parceiro.nome}`;
      refs.selectedPartner.hidden = false;
      refs.selectedPartnerLabel.hidden = false;
      refs.partnerResults.hidden = true;
      refs.partnerSearch.hidden = true;
      refs.partnerSearch.closest('label').hidden = true;
      refs.partnerContactField.hidden = false;
      const contacts = Array.isArray(payload.contatos) ? payload.contatos : [];
      const preferredIndex = contacts.findIndex((contact) => contact.key === preferredContactKey);
      const selectedIndex = contacts.length ? Math.max(0, preferredIndex) : -1;
      refs.partnerContact.value = contacts[selectedIndex]?.key || '';
      refs.partnerContacts.innerHTML = contacts.map((contact, index) => {
        const type = String(contact.tipo || '').toLocaleLowerCase('pt-BR');
        const badgeClass = type.includes('principal') ? 'is-primary' : type.includes('financ') ? 'is-financial' : 'is-contact';
        const badge = contact.tipo || contact.nome || 'Contato';
        const selected = index === selectedIndex;
        return `<button class="chat-partner-contact-option${selected ? ' is-selected' : ''}" type="button" role="radio" aria-checked="${selected}" data-chat-contact="${escapeHtml(contact.key)}">
          <span class="chat-contact-radio" aria-hidden="true"></span>
          <i data-lucide="message-circle" aria-hidden="true"></i>
          <span class="chat-contact-option-copy">
            <strong>${escapeHtml(formatWhatsAppPhone(contact.telefone))}</strong>
            <small>${escapeHtml(contact.nome || 'Contato cadastrado')}</small>
          </span>
          <em class="${badgeClass}">${escapeHtml(badge)}</em>
        </button>`;
      }).join('');
      updateNewContactSubmit();
      refs.contactFeedback.textContent = contacts.length ? '' : 'Este parceiro não possui telefone ativo cadastrado no Sankhya.';
      window.lucide?.createIcons();
    } catch (error) {
      if (token !== state.partnerSearchToken) return;
      resetPartnerSelection();
      refs.contactFeedback.textContent = error.message;
    }
  }

  function changeSelectedPartner() {
    state.partnerSearchToken += 1;
    closeNewSankhyaContact();
    resetPartnerSelection();
    refs.partnerSearch.hidden = false;
    refs.partnerSearch.closest('label').hidden = false;
    refs.partnerResults.hidden = true;
    refs.contactFeedback.textContent = '';
    refs.partnerSearch.focus();
  }

  function closeNewSankhyaContact() {
    refs.newSankhyaContactPanel.hidden = true;
    refs.newSankhyaContactName.value = '';
    refs.newSankhyaContactPhone.value = '';
    refs.newSankhyaContactRole.value = '';
    refs.newSankhyaContactFeedback.textContent = '';
    refs.newSankhyaContactSave.disabled = false;
  }

  function openNewSankhyaContact() {
    if (!state.selectedPartner) return;
    refs.newSankhyaContactPanel.hidden = false;
    refs.newSankhyaContactFeedback.textContent = '';
    requestAnimationFrame(() => refs.newSankhyaContactName.focus());
  }

  async function saveNewSankhyaContact() {
    const codParc = Number(state.selectedPartner?.codParc);
    const nomeContato = refs.newSankhyaContactName.value.trim();
    const telefone = refs.newSankhyaContactPhone.value.trim();
    const cargo = refs.newSankhyaContactRole.value.trim();
    if (!nomeContato || !telefone) {
      refs.newSankhyaContactFeedback.textContent = 'Informe o nome e o telefone do contato.';
      (!nomeContato ? refs.newSankhyaContactName : refs.newSankhyaContactPhone).focus();
      return;
    }
    refs.newSankhyaContactSave.disabled = true;
    refs.newSankhyaContactFeedback.textContent = 'Salvando contato no Sankhya...';
    try {
      const result = await api(`/partners/${encodeURIComponent(codParc)}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeContato, telefone, cargo })
      });
      closeNewSankhyaContact();
      await selectPartner(codParc, result?.contato?.key || '');
      refs.contactFeedback.textContent = 'Contato salvo no Sankhya e selecionado.';
    } catch (error) {
      refs.newSankhyaContactFeedback.textContent = error.message || 'Não foi possível salvar o contato.';
      refs.newSankhyaContactSave.disabled = false;
    }
  }

  function openNewContact() {
    state.partnerSearchToken += 1;
    resetPartnerSelection();
    refs.partnerSearch.hidden = false;
    refs.partnerSearch.closest('label').hidden = false;
    refs.partnerResults.hidden = true;
    refs.partnerResults.innerHTML = '';
    refs.contactFeedback.textContent = '';
    if (refs.newPipeline) {
      refs.newPipeline.innerHTML = '<option value="">Carregando pipelines...</option>';
      loadPipelines().then(() => {
        fillPipelineSelect(refs.newPipeline);
        updateNewContactSubmit();
      }).catch((error) => {
        refs.newPipeline.innerHTML = '<option value="">Pipelines indisponíveis</option>';
        refs.contactFeedback.textContent = error.message;
        updateNewContactSubmit();
      });
    }
    refs.contactModal.hidden = false;
    requestAnimationFrame(() => refs.partnerSearch.focus());
  }

  function closeNewContact() {
    state.partnerSearchToken += 1;
    refs.contactModal.hidden = true;
    refs.contactForm.reset();
    closeNewSankhyaContact();
    resetPartnerSelection();
    refs.contactFeedback.textContent = '';
  }

  function resetLinkPartnerSelection() {
    state.linkPartner = null;
    refs.linkSelectedPartner.hidden = true;
    refs.linkContactFields.hidden = true;
    refs.linkContactName.value = '';
    refs.linkContactRole.value = '';
    refs.linkPartnerSubmit.disabled = true;
  }

  function openLinkPartner() {
    if (!state.conversationId || sankhyaCadastro(state.conversation)) return;
    state.linkPartnerSearchToken += 1;
    resetLinkPartnerSelection();
    refs.linkPartnerSearch.value = '';
    refs.linkPartnerResults.hidden = true;
    refs.linkPartnerResults.innerHTML = '';
    refs.linkPartnerFeedback.textContent = '';
    refs.linkPartnerPhone.textContent = formatWhatsAppPhone(Core.contact(state.conversation || {}).phone || Core.contact(state.conversation || {}).waId || '');
    refs.linkContactName.value = Core.contact(state.conversation || {}).name || '';
    refs.linkPartnerModal.hidden = false;
    requestAnimationFrame(() => refs.linkPartnerSearch.focus());
  }

  function closeLinkPartner() {
    state.linkPartnerSearchToken += 1;
    refs.linkPartnerModal.hidden = true;
    refs.linkPartnerForm.reset();
    resetLinkPartnerSelection();
    refs.linkPartnerFeedback.textContent = '';
  }

  async function searchLinkPartners() {
    const term = refs.linkPartnerSearch.value.trim();
    const token = ++state.linkPartnerSearchToken;
    resetLinkPartnerSelection();
    if ((!/^\d+$/.test(term) && term.length < 2) || !term) {
      refs.linkPartnerResults.hidden = true;
      refs.linkPartnerResults.innerHTML = '';
      return;
    }
    refs.linkPartnerResults.hidden = false;
    refs.linkPartnerResults.innerHTML = '<span class="chat-partner-loading">Buscando parceiros...</span>';
    try {
      const payload = await api(`/partners?q=${encodeURIComponent(term)}`);
      if (token !== state.linkPartnerSearchToken) return;
      const partners = Array.isArray(payload?.parceiros) ? payload.parceiros : [];
      refs.linkPartnerResults.innerHTML = partners.length ? partners.map((partner) => `
        <button type="button" data-chat-link-partner-select="${escapeHtml(partner.codParc)}" data-chat-link-partner-name="${escapeHtml(partner.nome)}">
          <strong>${escapeHtml(partner.codParc)} - ${escapeHtml(partner.nome)}</strong>
          <span>${escapeHtml(partner.cnpjCpf || 'CNPJ/CPF não informado')}</span>
        </button>`).join('') : '<span class="chat-partner-loading">Nenhum parceiro ativo encontrado.</span>';
    } catch (error) {
      if (token === state.linkPartnerSearchToken) refs.linkPartnerResults.innerHTML = `<span class="chat-partner-loading is-error">${escapeHtml(error.message)}</span>`;
    }
  }

  function selectLinkPartner(button) {
    const codParc = Number(button.dataset.chatLinkPartnerSelect);
    if (!Number.isInteger(codParc) || codParc <= 0) return;
    state.linkPartner = { codParc, nome: button.dataset.chatLinkPartnerName || 'Parceiro' };
    refs.linkSelectedPartnerName.textContent = `${codParc} - ${state.linkPartner.nome}`;
    refs.linkSelectedPartner.hidden = false;
    refs.linkContactFields.hidden = false;
    if (!refs.linkContactName.value.trim()) refs.linkContactName.value = Core.contact(state.conversation || {}).name || '';
    refs.linkPartnerSearch.hidden = true;
    refs.linkPartnerSearch.closest('label').hidden = true;
    refs.linkPartnerResults.hidden = true;
    refs.linkPartnerFeedback.textContent = '';
    refs.linkPartnerSubmit.disabled = false;
  }

  function changeLinkPartner() {
    state.linkPartnerSearchToken += 1;
    resetLinkPartnerSelection();
    refs.linkPartnerSearch.hidden = false;
    refs.linkPartnerSearch.closest('label').hidden = false;
    refs.linkPartnerResults.hidden = true;
    refs.linkPartnerResults.innerHTML = '';
    refs.linkPartnerFeedback.textContent = '';
    refs.linkPartnerSearch.focus();
  }

  async function submitLinkPartner(event) {
    event.preventDefault();
    const codParc = Number(state.linkPartner?.codParc);
    const conversationId = state.conversationId;
    if (!Number.isInteger(codParc) || !conversationId) return;
    const nomeContato = refs.linkContactName.value.trim();
    const cargo = refs.linkContactRole.value.trim();
    if (!nomeContato) {
      refs.linkPartnerFeedback.textContent = 'Informe o nome do contato.';
      refs.linkContactName.focus();
      return;
    }
    refs.linkPartnerSubmit.disabled = true;
    refs.linkPartnerFeedback.textContent = 'Vinculando telefone...';
    try {
      const result = await api(`/conversations/${encodeURIComponent(conversationId)}/sankhya-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codParc, nomeContato, cargo })
      });
      const conversation = result?.conversation;
      if (!conversation?.cadastroSankhya?.verificado) throw new Error('O Sankhya não confirmou o vínculo do telefone.');
      if (String(state.conversationId) === String(conversationId)) state.conversation = { ...state.conversation, ...conversation };
      const index = state.conversations.findIndex((item) => String(item.id) === String(conversationId));
      if (index >= 0) state.conversations[index] = { ...state.conversations[index], ...conversation };
      renderConversations();
      renderConversationDetails();
      closeLinkPartner();
      setFeedback(result.vinculo?.criado ? 'Telefone incluído e vinculado ao parceiro no Sankhya.' : 'Telefone já estava cadastrado e foi vinculado ao parceiro.');
    } catch (error) {
      refs.linkPartnerFeedback.textContent = error.message || 'Não foi possível vincular o telefone.';
      refs.linkPartnerSubmit.disabled = false;
    }
  }

  async function createNewContact(event) {
    event.preventDefault();
    const codParc = Number(state.selectedPartner?.codParc);
    const contactKey = refs.partnerContact.value;
    const pipelineValue = refs.newPipeline?.value ?? '';
    if (!Number.isInteger(codParc) || !contactKey || pipelineValue === '') return;
    const pipelineId = Number(pipelineValue);
    refs.contactSubmit.disabled = true;
    refs.contactFeedback.textContent = 'Criando contato...';
    try {
      const result = await api('/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codParc, contactKey, pipelineId })
      });
      const created = result?.conversation || result;
      if (!created?.id) throw new Error('Não foi possível criar a conversa.');
      const selected = result?.selectedContact || {};
      restoreConversationLocally({ ...created, contact: created.contact || { phone: selected.telefone, name: selected.nome } });
      const index = state.conversations.findIndex((item) => String(item.id) === String(created.id));
      if (index >= 0) state.conversations[index] = { ...state.conversations[index], ...created };
      else state.conversations.unshift(created);
      state.totalConversations = Math.max(state.totalConversations, state.conversations.length);
      renderConversations();
      closeNewContact();
      await openConversation(created.id, { historyMode: 'push' });
      // Versões anteriores do backend exigiam uma segunda chamada para assumir.
      // Mantém o fallback sem atrasar o fluxo normal, que já retorna atribuído.
      if (!assignedUser(state.conversation)) await claimConversation(created.id, { prompt: false, pipelineId });
      if (result.bitrixError) setFeedback(`Conversa criada, mas o card do Bitrix ficou pendente: ${result.bitrixError}`, true);
      if (ownsConversation()) openTemplates();
    } catch (error) {
      refs.contactFeedback.textContent = error.message || 'Não foi possível criar a conversa.';
    } finally {
      updateNewContactSubmit();
    }
  }

  async function startChatFromSharedContact(button) {
    const phone = String(button.dataset.contactPhone || '').trim();
    if (!phone) {
      setFeedback('O contato compartilhado não possui um telefone válido.', true);
      return;
    }
    const existing = await findConversationByPhone(phone);
    if (existing) {
      restoreConversationLocally(existing, phone);
      await openConversation(existing.id, { historyMode: 'push' });
      if (!assignedUser(state.conversation)) await claimConversation(existing.id);
      if (ownsConversation()) openTemplates();
      return;
    }
    setFeedback('Para iniciar uma nova conversa, busque o parceiro cadastrado no Sankhya pelo botão Adicionar contato.', true);
  }

  async function findConversationByPhone(phone) {
    const normalized = Core.normalizePhone(phone);
    const matchesPhone = (conversation) => {
      const contact = Core.contact(conversation);
      return [contact.phone, contact.waId].some((value) => Core.normalizePhone(value) === normalized);
    };
    const local = state.conversations.find(matchesPhone);
    if (local) return local;
    const query = new URLSearchParams({ page: '1', limit: '30', search: normalized, assignment: 'ALL' });
    const payload = await api(`/conversations?${query}`);
    const conversations = Array.isArray(payload?.data) ? payload.data : [];
    return conversations.find(matchesPhone) || null;
  }

  async function deleteConversation(conversationId) {
    await api(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
    hideConversationLocally(conversationId);
    state.conversations = state.conversations.filter((item) => !isConversationHidden(item));
    state.totalConversations = Math.max(0, state.totalConversations - 1);
    if (String(state.conversationId) === String(conversationId)) showConversationList({ replaceHistory: true });
    renderConversations();
  }

  function openDeleteConfirmation(conversationId) {
    document.querySelector('.chat-delete-modal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'chat-delete-modal';
    modal.innerHTML = `<section class="chat-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-delete-title">
      <div class="chat-delete-icon"><i data-lucide="trash-2"></i></div>
      <h2 id="chat-delete-title">Excluir chat?</h2>
      <p>Este chat será removido para todos os usuários do atendimento. O contato e as mensagens no WhatsApp não serão apagados.</p>
      <span class="chat-delete-feedback" aria-live="polite"></span>
      <footer><button type="button" data-chat-delete-cancel>Cancelar</button><button type="button" data-chat-delete-confirm>Excluir chat</button></footer>
    </section>`;
    const close = () => modal.remove();
    const feedback = modal.querySelector('.chat-delete-feedback');
    const confirm = modal.querySelector('[data-chat-delete-confirm]');
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('[data-chat-delete-cancel]').addEventListener('click', close);
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      feedback.textContent = 'Excluindo chat...';
      try {
        await deleteConversation(conversationId);
        close();
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível excluir o chat.';
        confirm.disabled = false;
      }
    });
    document.body.append(modal);
    window.lucide?.createIcons();
    requestAnimationFrame(() => confirm.focus());
  }

  function openRenameConversation(conversationId) {
    document.querySelector('.chat-delete-modal')?.remove();
    const conversation = state.conversations.find((item) => String(item.id) === String(conversationId)) || state.conversation || {};
    const modal = document.createElement('div');
    modal.className = 'chat-delete-modal';
    modal.innerHTML = `<section class="chat-delete-dialog chat-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-rename-title">
      <div class="chat-rename-icon"><i data-lucide="pencil"></i></div>
      <h2 id="chat-rename-title">Renomear cliente</h2>
      <p>Este nome será exibido apenas no atendimento. O cadastro do parceiro no Sankhya não será alterado.</p>
      <label>Nome exibido no chat<input type="text" maxlength="160" value="${escapeHtml(Core.contactName(conversation))}" data-chat-rename-input></label>
      <span class="chat-delete-feedback" aria-live="polite"></span>
      <footer><button type="button" data-chat-rename-cancel>Cancelar</button><button type="button" data-chat-rename-confirm>Salvar nome</button></footer>
    </section>`;
    const close = () => modal.remove();
    const input = modal.querySelector('[data-chat-rename-input]');
    const feedback = modal.querySelector('.chat-delete-feedback');
    const confirm = modal.querySelector('[data-chat-rename-confirm]');
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('[data-chat-rename-cancel]').addEventListener('click', close);
    confirm.addEventListener('click', async () => {
      const nomeExibicao = input.value.trim();
      if (!nomeExibicao) {
        feedback.textContent = 'Informe o nome do cliente.';
        input.focus();
        return;
      }
      confirm.disabled = true;
      feedback.textContent = 'Salvando nome...';
      try {
        const atualizado = await api(`/conversations/${encodeURIComponent(conversationId)}/display-name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeExibicao })
        });
        applyConversationUpdate({ conversation: atualizado });
        close();
      } catch (error) {
        feedback.textContent = error.message || 'Não foi possível renomear o cliente.';
        confirm.disabled = false;
      }
    });
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Enter' && event.target === input) confirm.click();
    });
    document.body.append(modal);
    window.lucide?.createIcons();
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function bindEvents() {
    syncRestingViewportHeight();
    window.visualViewport?.addEventListener('resize', () => syncRestingViewportHeight(180));
    window.addEventListener('resize', () => syncRestingViewportHeight(180));
    window.addEventListener('pagehide', persistUiCache);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistUiCache();
    });
    refs.form.addEventListener('submit', sendText); refs.input.addEventListener('input', updateComposer);
    refs.input.addEventListener('paste', pasteImage);
    refs.composerReplyCancel?.addEventListener('click', () => {
      clearReply();
      refs.input.focus();
    });
    refs.input.addEventListener('blur', () => syncRestingViewportHeight(280));
    refs.input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); refs.form.requestSubmit(); } });
    refs.refresh.addEventListener('click', () => { state.page = 1; loadConversations(); });
    refs.agentFilterToggle?.addEventListener('click', (event) => { event.stopPropagation(); toggleAgentFilter(); });
    refs.agentFilter?.addEventListener('click', (event) => event.stopPropagation());
    refs.agentFilterSelect?.addEventListener('change', () => applyAgentFilter(refs.agentFilterSelect.value));
    refs.agentFilterClear?.addEventListener('click', () => { refs.agentFilterSelect.value = ''; applyAgentFilter(''); });
    refs.newContact.addEventListener('click', openNewContact);
    refs.more.addEventListener('click', () => { state.page += 1; loadConversations({ append: true }); });
    refs.list.addEventListener('scroll', loadMoreConversationsIfNeeded, { passive: true });
    refs.search.addEventListener('input', Core.debounce(() => { state.search = refs.search.value.trim(); state.page = 1; loadConversations(); }, 350));
    refs.filters.addEventListener('click', (event) => { const button = event.target.closest('[data-chat-assignment]'); if (!button) return; refs.filters.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button)); state.assignment = button.dataset.chatAssignment; state.agentId = ''; if (refs.agentFilterSelect) refs.agentFilterSelect.value = ''; if (refs.agentFilterClear) refs.agentFilterClear.hidden = true; refs.agentFilterToggle?.classList.remove('is-active'); state.page = 1; loadConversations(); });
    refs.mobileBack.addEventListener('click', () => {
      if (history.state?.tela === 'chat' && history.state?.conversationId) history.back();
      else showConversationList({ replaceHistory: true });
    });
    refs.detailsToggle.addEventListener('click', () => { const hidden = refs.details.classList.toggle('is-collapsed'); refs.detailsToggle.setAttribute('aria-expanded', String(!hidden)); });
    refs.detailsClose.addEventListener('click', () => { refs.details.classList.add('is-collapsed'); refs.detailsToggle.setAttribute('aria-expanded', 'false'); });
    refs.newMessage.addEventListener('click', () => scrollBottom('smooth'));
    refs.mediaZoomControls.addEventListener('click', (event) => {
      const action = event.target.closest('[data-chat-zoom]')?.dataset.chatZoom;
      if (action === 'in') applyImageZoom(state.mediaZoom + 0.25);
      else if (action === 'out') applyImageZoom(state.mediaZoom - 0.25);
      else if (action === 'reset') applyImageZoom(1);
    });
    refs.mediaPreview.addEventListener('wheel', (event) => {
      if (refs.mediaZoomControls.hidden || !refs.mediaPreview.querySelector('img')) return;
      event.preventDefault();
      applyImageZoom(state.mediaZoom + (event.deltaY < 0 ? 0.2 : -0.2));
    }, { passive: false });
    refs.claim.addEventListener('click', () => claimConversation());
    refs.release.addEventListener('click', async () => { try { await changeAssignment('RELEASE'); showConversationList({ replaceHistory: true }); await loadConversations(); setFeedback('Conversa devolvida para a fila sem atendente.'); } catch (error) { setFeedback(error.message, true); } });
    refs.transfer.addEventListener('click', openTransferDialog);
    refs.profileOpen.addEventListener('click', openProfileDialog);
    refs.settingsOpen.addEventListener('click', openSettingsDialog);
    refs.messages.addEventListener('scroll', () => {
      if (state.loadingOlder || state.messagePage >= state.messageTotalPages) return;
      if (Core.shouldLoadOlderMessages(refs.messages, { threshold: MESSAGE_SCROLL_THRESHOLD })) loadOlderMessages();
    }, { passive: true });
    refs.attachmentToggle.addEventListener('click', () => { refs.attachmentMenu.hidden = !refs.attachmentMenu.hidden; refs.attachmentToggle.setAttribute('aria-expanded', String(!refs.attachmentMenu.hidden)); });
    refs.attachmentMenu.addEventListener('click', (event) => { const button = event.target.closest('[data-chat-file]'); if (!button) return; byId(`chat-file-${button.dataset.chatFile}`)?.click(); refs.attachmentMenu.hidden = true; });
    refs.emojiToggle.addEventListener('click', () => {
      refs.emojiMenu.hidden = !refs.emojiMenu.hidden;
      refs.emojiToggle.setAttribute('aria-expanded', String(!refs.emojiMenu.hidden));
      if (refs.emojiMenu.hidden) {
        refs.emojiMenu.classList.remove('is-expanded');
        const moreList = refs.emojiMenu.querySelector('[data-chat-emoji-more-list]');
        const moreButton = refs.emojiMenu.querySelector('[data-chat-emoji-more]');
        if (moreList) moreList.hidden = true;
        if (moreButton) moreButton.setAttribute('aria-expanded', 'false');
      }
      refs.attachmentMenu.hidden = true;
      refs.attachmentToggle.setAttribute('aria-expanded', 'false');
    });
    refs.emojiMenu.addEventListener('click', (event) => {
      const moreButton = event.target.closest('[data-chat-emoji-more]');
      if (moreButton) {
        const moreList = refs.emojiMenu.querySelector('[data-chat-emoji-more-list]');
        const expanded = Boolean(moreList?.hidden);
        if (moreList) moreList.hidden = !expanded;
        moreButton.setAttribute('aria-expanded', String(expanded));
        refs.emojiMenu.classList.toggle('is-expanded', expanded);
        return;
      }
      const button = event.target.closest('[data-chat-emoji]');
      if (!button || refs.input.disabled) return;
      const emoji = button.dataset.chatEmoji || '';
      const start = refs.input.selectionStart ?? refs.input.value.length;
      const end = refs.input.selectionEnd ?? refs.input.value.length;
      refs.input.value = `${refs.input.value.slice(0, start)}${emoji}${refs.input.value.slice(end)}`;
      refs.input.focus();
      refs.input.setSelectionRange(start + emoji.length, start + emoji.length);
      refs.emojiMenu.hidden = true;
      refs.emojiMenu.classList.remove('is-expanded');
      const moreList = refs.emojiMenu.querySelector('[data-chat-emoji-more-list]');
      const moreToggle = refs.emojiMenu.querySelector('[data-chat-emoji-more]');
      if (moreList) moreList.hidden = true;
      if (moreToggle) moreToggle.setAttribute('aria-expanded', 'false');
      refs.emojiToggle.setAttribute('aria-expanded', 'false');
      updateComposer();
    });
    ['image', 'document', 'video'].forEach((kind) => byId(`chat-file-${kind}`).addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) prepareFile(kind, file); event.target.value = ''; }));
    refs.microphone.addEventListener('click', beginRecording); refs.recordingCancel.addEventListener('click', () => stopRecording(true)); refs.recordingSend.addEventListener('click', submitRecording);
    refs.mediaClose.addEventListener('click', closeMediaModal); refs.uploadCancel.addEventListener('click', closeMediaModal); refs.uploadSend.addEventListener('click', submitPendingUpload);
    refs.templateOpen.addEventListener('click', openTemplates); refs.templateClose.addEventListener('click', () => { refs.templateModal.hidden = true; });
    refs.templateSearch.addEventListener('input', renderTemplates); refs.templateSend.addEventListener('click', submitTemplate);
    refs.contactClose.addEventListener('click', closeNewContact);
    refs.contactCancel.addEventListener('click', closeNewContact);
    refs.contactForm.addEventListener('submit', createNewContact);
    refs.partnerSearch.addEventListener('input', Core.debounce(searchPartners, 320));
    refs.partnerResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chat-partner]');
      if (button) selectPartner(button.dataset.chatPartner);
    });
    refs.changePartner.addEventListener('click', changeSelectedPartner);
    refs.newSankhyaContact.addEventListener('click', openNewSankhyaContact);
    refs.newSankhyaContactClose.addEventListener('click', closeNewSankhyaContact);
    refs.newSankhyaContactSave.addEventListener('click', saveNewSankhyaContact);
    refs.newPipeline?.addEventListener('change', updateNewContactSubmit);
    refs.partnerContacts.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chat-contact]');
      if (!button) return;
      refs.partnerContact.value = button.dataset.chatContact || '';
      refs.partnerContacts.querySelectorAll('[data-chat-contact]').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-checked', String(selected));
      });
      updateNewContactSubmit();
      refs.contactFeedback.textContent = '';
    });
    refs.linkPartnerClose.addEventListener('click', closeLinkPartner);
    refs.linkPartnerForm.addEventListener('submit', submitLinkPartner);
    refs.linkPartnerSearch.addEventListener('input', Core.debounce(searchLinkPartners, 320));
    refs.linkPartnerResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chat-link-partner-select]');
      if (button) selectLinkPartner(button);
    });
    refs.linkChangePartner.addEventListener('click', changeLinkPartner);
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-chat-link-partner]')) openLinkPartner();
      if (event.target.closest('[data-chat-add-pipeline]')) addPipelineToConversation();
      if (event.target.closest('[data-chat-bitrix-history]')) openBitrixHistory();
      if (event.target.closest('[data-bitrix-deal]')) event.preventDefault();
      if (!event.target.closest('.chat-conversation-context-menu')) closeConversationMenu();
      if (!event.target.closest('#chat-agent-filter') && !event.target.closest('#chat-agent-filter-toggle')) {
        refs.agentFilter.hidden = true;
        refs.agentFilterToggle?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function mountWorkspaceActions() {
    const actions = document.querySelector('.chat-heading-actions');
    if (!actions || !refs.workspace || actions.parentElement === refs.workspace) return;
    actions.classList.add('chat-workspace-actions');
    refs.workspace.prepend(actions);
  }

  async function preparar(conversationId) {
    if (!state.access?.permitido && !await verificarAcesso()) throw new Error('Seu usuário não possui acesso ao atendimento.');
    mountWorkspaceActions();
    if (!state.initialized) { bindEvents(); connectRealtime(); state.initialized = true; }
    else if (!state.eventSource) connectRealtime();
    restoreUiCache();
    const refresh = state.conversations.length ? loadConversations() : null;
    if (!refresh) await loadConversations();
    if (conversationId) await openConversation(conversationId, { historyMode: 'none' });
    else showConversationList();
    refresh?.catch(() => {});
    window.lucide?.createIcons();
  }

  function encerrar() {
    state.eventSource?.close(); state.eventSource = null; clearMediaUrls();
    if (state.recorder?.state === 'recording') stopRecording(true);
    closeMediaModal();
    state.conversations = [];
    state.conversation = null;
    state.conversationId = null;
    state.messages = [];
    state.conversationCache.clear();
    cancelScheduledMessagesRender();
    if (state.conversationsRenderFrame) cancelAnimationFrame(state.conversationsRenderFrame);
    state.conversationsRenderFrame = null;
    clearTimeout(state.uiCacheTimer);
    state.uiCacheTimer = null;
    try { sessionStorage.removeItem(UI_CACHE_KEY); } catch {}
    state.loadingOlder = false;
    state.page = 1;
    state.totalPages = 1;
    state.totalConversations = 0;
    state.agentId = '';
    state.access = null;
    state.profile = null;
    state.agents = [];
    const menu = byId('home-nav-chat');
    if (menu) menu.hidden = true;
    refs.workspace.classList.remove('has-conversation');
    refs.active.hidden = true;
    refs.empty.hidden = false;
    refs.list.innerHTML = '';
    refs.count.textContent = '0';
  }

  window.chatController = { preparar, encerrar, verificarAcesso, state, handleRealtime };
  Object.defineProperty(window.chatController, 'permitido', { get: () => state.access?.permitido === true });
}());
