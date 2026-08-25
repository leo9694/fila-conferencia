(function createWhatsAppCallController() {
  'use strict';

  const Core = window.WhatsAppCallCore;
  if (!Core) return;

  const byId = (id) => document.getElementById(id);
  const refs = {
    overlay: byId('whatsapp-call-overlay'), panel: byId('whatsapp-call-panel'), title: byId('whatsapp-call-title'),
    contact: byId('whatsapp-call-contact'), phone: byId('whatsapp-call-phone'), status: byId('whatsapp-call-status'),
    duration: byId('whatsapp-call-duration'), accept: byId('whatsapp-call-accept'), reject: byId('whatsapp-call-reject'),
    mute: byId('whatsapp-call-mute'), end: byId('whatsapp-call-end'), permission: byId('whatsapp-call-permission'),
    close: byId('whatsapp-call-close'), remoteAudio: byId('whatsapp-call-remote-audio'),
    history: byId('chat-call-history'), start: byId('chat-call-start'),
    historyOpen: byId('chat-call-history-open'), historyModal: byId('whatsapp-call-history-modal'),
    historyClose: byId('whatsapp-call-history-close'), historyGlobal: byId('whatsapp-call-history-global')
  };

  function createCallClientId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  const state = {
    status: 'IDLE', call: null, conversation: null, profile: null, source: null, client: null,
    signal: null, timer: null, startedAt: 0, ringtone: null, reconnecting: false,
    clientId: createCallClientId()
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api/chat${path}`, {
      cache: 'no-store',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.erro || payload?.error?.message || 'Não foi possível concluir a chamada.');
      error.status = response.status;
      throw error;
    }
    return payload?.data ?? payload;
  }

  function callId(payload = {}) {
    return String(payload.callId || payload.call?.id || payload.id || '').trim();
  }

  function conversationId(payload = {}) {
    return Number(payload.conversationId || payload.call?.conversationId || payload.conversation?.id || 0) || null;
  }

  function contact(payload = {}) {
    const call = payload.call || payload;
    const item = call.contact || payload.contact || payload.conversation?.contact || {};
    return {
      name: item.name || call.contactName || payload.contactName || 'Contato do WhatsApp',
      phone: item.phone || item.waId || call.phone || call.waId || payload.phone || ''
    };
  }

  function signal(payload = {}) {
    return payload.session || payload.signal?.session || payload.signal || payload.call?.session || null;
  }

  function jsonBody(payload) {
    return { method: 'POST', body: JSON.stringify(payload) };
  }

  function callBody(payload = {}) {
    return jsonBody({ ...payload, clientId: state.clientId });
  }

  function clientApi() {
    return {
      claim: (id, payload) => api(`/calls/${encodeURIComponent(id)}/claim`, callBody(payload)),
      preAccept: (id, payload) => api(`/calls/${encodeURIComponent(id)}/pre-accept`, callBody(payload)),
      accept: (id, payload) => api(`/calls/${encodeURIComponent(id)}/accept`, callBody(payload)),
      create: (id, payload) => api(`/conversations/${encodeURIComponent(id)}/calls`, jsonBody(payload))
    };
  }

  function makeClient() {
    return new Core.WhatsAppCallClient({
      api: clientApi(),
      mediaDevices: navigator.mediaDevices,
      PeerConnection: window.RTCPeerConnection || window.webkitRTCPeerConnection,
      remoteAudio: refs.remoteAudio
    });
  }

  function setStatus(status, text) {
    state.status = status;
    refs.panel.dataset.status = status;
    refs.status.textContent = state.reconnecting ? 'Reconectando ao servidor...' : text;
    refs.accept.hidden = status !== 'RINGING';
    refs.reject.hidden = status !== 'RINGING';
    refs.mute.hidden = !['CONNECTING', 'ACTIVE'].includes(status);
    refs.end.hidden = !['CONNECTING', 'ACTIVE'].includes(status);
    refs.permission.hidden = status !== 'PERMISSION';
    refs.close.hidden = !['PERMISSION', 'FAILED', 'ENDED'].includes(status);
  }

  function openOverlay(payload, status = 'RINGING') {
    const person = contact(payload);
    refs.contact.textContent = person.name;
    refs.phone.textContent = person.phone;
    refs.overlay.hidden = false;
    setStatus(status, status === 'RINGING' ? 'Chamada recebida pelo WhatsApp' : 'Preparando chamada...');
    window.lucide?.createIcons();
  }

  function closeOverlay() {
    refs.overlay.hidden = true;
  }

  function startRingtone() {
    stopRingtone();
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      const context = new Context();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      gain.gain.value = 0.035;
      oscillator.frequency.value = 520;
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
      const pulse = setInterval(() => { gain.gain.value = gain.gain.value ? 0 : 0.035; }, 450);
      state.ringtone = { context, oscillator, pulse };
    } catch {}
  }

  function stopRingtone() {
    if (!state.ringtone) return;
    clearInterval(state.ringtone.pulse);
    try { state.ringtone.oscillator.stop(); state.ringtone.context.close(); } catch {}
    state.ringtone = null;
  }

  function startTimer(startedAt = Date.now()) {
    clearInterval(state.timer);
    state.startedAt = new Date(startedAt).getTime() || Date.now();
    const update = () => { refs.duration.textContent = Core.formatDuration((Date.now() - state.startedAt) / 1000); };
    update();
    state.timer = setInterval(update, 1000);
  }

  function cleanup({ close = true } = {}) {
    stopRingtone();
    clearInterval(state.timer); state.timer = null;
    state.client?.cleanup(); state.client = null;
    state.signal = null;
    state.startedAt = 0;
    refs.duration.textContent = '00:00';
    refs.mute.classList.remove('is-active');
    refs.mute.innerHTML = '<i data-lucide="mic" aria-hidden="true"></i><span>Silenciar</span>';
    state.call = null;
    state.status = 'IDLE';
    if (close) closeOverlay();
    window.lucide?.createIcons();
  }

  function toast(message) {
    const item = document.createElement('div');
    item.className = 'whatsapp-call-toast';
    item.textContent = message;
    document.body.append(item);
    setTimeout(() => item.remove(), 4200);
  }

  async function waitForIncomingSignal(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const current = state.signal || signal(state.call);
      if (current?.sdp) return current;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('A oferta de áudio ainda não chegou. Tente novamente em um instante.');
  }

  async function acceptIncoming() {
    if (!state.call || state.status !== 'RINGING') return;
    stopRingtone();
    setStatus('CONNECTING', 'Conectando áudio...');
    try {
      const currentSignal = await waitForIncomingSignal();
      state.client = makeClient();
      await state.client.acceptIncoming({
        callId: callId(state.call), conversationId: conversationId(state.call), offer: currentSignal
      });
      setStatus('CONNECTING', 'Aguardando conexão...');
    } catch (error) {
      if (error?.status === 409) {
        cleanup();
        toast(error.message || 'Esta chamada já foi atendida por outro atendente.');
        return;
      }
      const denied = error?.name === 'NotAllowedError' || /permission|permiss|microfone/i.test(error.message);
      setStatus('FAILED', denied
        ? 'É necessário permitir acesso ao microfone para atender a chamada.'
        : (error.message || 'Não foi possível atender a chamada.'));
    }
  }

  async function updateCall(action) {
    if (!state.call) return;
    const id = callId(state.call);
    await api(`/calls/${encodeURIComponent(id)}/${action}`, callBody({ conversationId: conversationId(state.call) }));
  }

  async function rejectIncoming() {
    try { await updateCall('reject'); } catch (error) { toast(error.message); }
    cleanup();
  }

  async function endCall() {
    if (state.status === 'ENDING') return;
    setStatus('ENDING', 'Encerrando chamada...');
    try { await updateCall('terminate'); } catch (error) { toast(error.message); }
    cleanup();
    if (state.conversation) loadHistory(state.conversation).catch(() => {});
  }

  function toggleMute() {
    if (!state.client) return;
    const muted = state.client.toggleMute();
    refs.mute.classList.toggle('is-active', muted);
    refs.mute.innerHTML = `<i data-lucide="${muted ? 'mic-off' : 'mic'}" aria-hidden="true"></i><span>${muted ? 'Ativar microfone' : 'Silenciar'}</span>`;
    window.lucide?.createIcons();
  }

  function permissionAllowed(payload = {}) {
    return payload.allowed === true || payload.canCall === true || payload.canStart === true
      || payload.startCall?.canPerformAction === true || payload.start_call?.can_perform_action === true
      || payload.permission?.start_call?.can_perform_action === true;
  }

  async function startOutbound(conversation) {
    if (!conversation?.id || state.status !== 'IDLE') {
      if (state.status !== 'IDLE') toast('Já existe uma chamada em andamento.');
      return;
    }
    state.conversation = conversation;
    try {
      const permission = await api(`/conversations/${encodeURIComponent(conversation.id)}/calls/permission`);
      if (!permissionAllowed(permission)) {
        openOverlay(conversation, 'PERMISSION');
        refs.title.textContent = 'Permissão para ligar';
        refs.status.textContent = 'Para ligar, solicite primeiro a autorização do cliente pelo WhatsApp.';
        return;
      }
      await beginOutbound(conversation);
    } catch (error) {
      toast(error.message || 'Não foi possível consultar a permissão de chamada.');
    }
  }

  async function requestPermission() {
    if (!state.conversation?.id) return;
    refs.permission.disabled = true;
    try {
      await api(`/conversations/${encodeURIComponent(state.conversation.id)}/calls/permission`, jsonBody({
        body: 'Podemos ligar para ajudar no seu atendimento?'
      }));
      refs.status.textContent = 'Solicitação enviada. Aguarde a autorização do cliente.';
    } catch (error) {
      refs.status.textContent = error.message || 'Não foi possível solicitar permissão para ligar.';
    } finally {
      refs.permission.disabled = false;
    }
  }

  async function beginOutbound(conversation) {
    state.call = { conversationId: conversation.id, direction: 'OUTBOUND', contact: conversation.contact };
    openOverlay(conversation, 'CONNECTING');
    refs.title.textContent = 'Ligação pelo WhatsApp';
    try {
      state.client = makeClient();
      const created = await state.client.startOutgoing({ conversationId: conversation.id });
      state.call = { ...state.call, ...(created?.call || created || {}) };
      setStatus('CONNECTING', 'Chamando...');
    } catch (error) {
      setStatus('FAILED', error?.name === 'NotAllowedError'
        ? 'É necessário permitir acesso ao microfone para iniciar a chamada.'
        : (error.message || 'Não foi possível iniciar a chamada.'));
    }
  }

  function handleEvent(event, payload = {}) {
    const incomingId = callId(payload);
    if (event === 'call:incoming') {
      if (state.status !== 'IDLE' && incomingId !== callId(state.call)) {
        toast('Outra chamada está chegando.');
        return;
      }
      state.call = payload;
      state.signal = signal(payload);
      refs.title.textContent = 'Chamada pelo WhatsApp';
      openOverlay(payload, 'RINGING');
      startRingtone();
      return;
    }
    if (event === 'call:claimed') {
      if (!state.call || incomingId !== callId(state.call)) return;
      const ownerId = String(payload.attendant?.id || '');
      const currentId = String(state.profile?.id || state.profile?.codUsu || '');
      const ownerClientId = String(payload.clientId || '');
      if (ownerId && ownerId === currentId && ownerClientId === state.clientId) {
        stopRingtone();
        state.call = { ...state.call, attendant: payload.attendant, claimedAt: payload.claimedAt };
        if (state.status === 'RINGING') setStatus('CONNECTING', 'Conectando áudio...');
        return;
      }
      const ownerName = payload.attendant?.name || 'outro atendente';
      cleanup();
      toast(`Chamada atendida por ${ownerName}.`);
      return;
    }
    if (incomingId && state.call && incomingId !== callId(state.call)) return;
    if (event === 'call:signal') {
      state.signal = signal(payload) || state.signal;
      if (state.client?.peer && state.signal?.sdp && (state.signal.sdpType || state.signal.type) !== 'offer') {
        state.client.applySignal(state.signal).catch(() => setStatus('FAILED', 'Falha ao estabelecer áudio.'));
      }
      return;
    }
    if (event === 'call:updated') {
      if (!state.call) return;
      state.call = { ...state.call, ...(payload.call || payload) };
      const updatedStatus = String(payload.call?.status || payload.status || '').toUpperCase();
      if (Core.TERMINAL_STATES.has(updatedStatus)) {
        cleanup();
        toast(updatedStatus === 'MISSED' ? 'Chamada perdida.' : 'A ligação foi encerrada.');
        if (state.conversation) loadHistory(state.conversation).catch(() => {});
      }
      return;
    }
    if (!state.call) return;
    const eventStatus = Core.eventUiStatus(event, state.status, Boolean(state.client));
    if (eventStatus === 'RINGING') setStatus('RINGING', 'Chamada recebida pelo WhatsApp');
    else if (eventStatus === 'CONNECTING') setStatus('CONNECTING', event === 'call:ringing' ? 'Chamando...' : 'Conectando áudio...');
    else if (event === 'call:active') {
      stopRingtone(); setStatus('ACTIVE', 'Chamada em andamento'); startTimer(payload.call?.answeredAt || payload.answeredAt);
    } else if (['call:ended', 'call:rejected', 'call:failed'].includes(event)) {
      const wasRinging = state.status === 'RINGING';
      const message = event === 'call:rejected' ? 'O cliente recusou a chamada.'
        : event === 'call:failed' ? 'Falha ao estabelecer áudio.' : 'A ligação foi encerrada.';
      cleanup();
      toast(wasRinging ? `Chamada perdida de ${contact(payload).name}` : message);
      if (state.conversation) loadHistory(state.conversation).catch(() => {});
    }
  }

  function connectRealtime() {
    state.source?.close();
    const source = new EventSource('/api/chat/events');
    state.source = source;
    ['call:incoming', 'call:claimed', 'call:ringing', 'call:connecting', 'call:active', 'call:ended', 'call:failed', 'call:rejected', 'call:updated', 'call:signal']
      .forEach((event) => source.addEventListener(event, (message) => {
        try { handleEvent(event, JSON.parse(message.data)); } catch {}
      }));
    source.addEventListener('connection', () => {
      state.reconnecting = false;
      if (state.status !== 'IDLE') setStatus(state.status, state.status === 'ACTIVE' ? 'Chamada em andamento' : 'Conectando áudio...');
    });
    source.onerror = () => {
      state.reconnecting = true;
      if (state.status !== 'IDLE') refs.status.textContent = 'Reconectando ao servidor...';
    };
  }

  function start(profile) {
    state.profile = profile || null;
    if (!state.source) connectRealtime();
  }

  function stop() {
    state.source?.close(); state.source = null;
    state.profile = null;
    cleanup();
    refs.start.hidden = true;
    if (refs.history) refs.history.innerHTML = '';
  }

  function normalizeCalls(payload) {
    if (Array.isArray(payload)) return payload;
    const direct = payload?.calls || payload?.items || payload?.data;
    if (Array.isArray(direct)) return direct;
    return direct?.calls || direct?.items || direct?.data || [];
  }

  function callLabel(item = {}) {
    const direction = String(item.direction || '').toUpperCase();
    const status = String(item.status || '').toUpperCase();
    if (status === 'MISSED') return 'Chamada perdida';
    if (status === 'REJECTED') return 'Chamada recusada';
    if (status === 'FAILED') return 'Falha na chamada';
    return direction === 'OUTBOUND' ? 'Chamada realizada' : 'Chamada recebida';
  }

  function callHistoryItem(item = {}, { global = false } = {}) {
    const time = item.startedAt || item.createdAt || item.updatedAt;
    const person = contact(item);
    const direction = String(item.direction || '').toUpperCase();
    const status = String(item.status || '').toLowerCase();
    const details = [item.durationSeconds ? Core.formatDuration(item.durationSeconds) : '', time ? new Date(time).toLocaleString('pt-BR') : '']
      .filter(Boolean).join(' · ');
    return `<article class="is-${escapeHtml(status)}"><i data-lucide="${direction === 'OUTBOUND' ? 'phone-outgoing' : 'phone-incoming'}" aria-hidden="true"></i><span>${global ? `<strong>${escapeHtml(person.name)}</strong>` : ''}<b>${escapeHtml(callLabel(item))}</b><small>${escapeHtml(details)}</small></span></article>`;
  }

  async function loadHistory(conversation) {
    if (!refs.history || !conversation?.id) return;
    refs.history.innerHTML = '<p>Carregando chamadas...</p>';
    try {
      const payload = await api(`/conversations/${encodeURIComponent(conversation.id)}/calls?page=1&limit=30`);
      const calls = normalizeCalls(payload);
      refs.history.innerHTML = `<strong><i data-lucide="phone" aria-hidden="true"></i> Chamadas</strong>${calls.length
        ? `<div class="chat-call-history-list">${calls.map((item) => callHistoryItem(item)).join('')}</div>` : '<p>Nenhuma chamada registrada.</p>'}`;
      window.lucide?.createIcons();
    } catch {
      refs.history.innerHTML = '<strong>Chamadas</strong><p>Histórico temporariamente indisponível.</p>';
    }
  }

  async function openGlobalHistory() {
    if (!refs.historyModal || !refs.historyGlobal) return;
    refs.historyModal.hidden = false;
    refs.historyGlobal.innerHTML = '<p>Carregando ligações...</p>';
    window.lucide?.createIcons();
    try {
      const payload = await api('/calls?page=1&limit=100');
      const calls = normalizeCalls(payload);
      refs.historyGlobal.innerHTML = calls.length
        ? `<div class="chat-call-history-list">${calls.map((item) => callHistoryItem(item, { global: true })).join('')}</div>`
        : '<div class="whatsapp-call-history-empty"><i data-lucide="phone-off" aria-hidden="true"></i><p>Nenhuma ligação registrada.</p></div>';
      window.lucide?.createIcons();
    } catch (error) {
      refs.historyGlobal.innerHTML = `<div class="whatsapp-call-history-empty"><p>${escapeHtml(error.message || 'Histórico temporariamente indisponível.')}</p></div>`;
    }
  }

  function closeGlobalHistory() {
    if (refs.historyModal) refs.historyModal.hidden = true;
  }

  async function setConversation(conversation) {
    state.conversation = conversation || null;
    refs.start.hidden = true;
    if (!conversation?.id) return;
    loadHistory(conversation).catch(() => {});
    try {
      const permission = await api(`/conversations/${encodeURIComponent(conversation.id)}/calls/permission`);
      refs.start.hidden = false;
      refs.start.disabled = state.status !== 'IDLE';
      refs.start.title = permissionAllowed(permission) ? 'Ligar pelo WhatsApp' : 'Solicitar permissão para ligar';
    } catch {
      refs.start.hidden = true;
    }
  }

  refs.accept?.addEventListener('click', acceptIncoming);
  refs.reject?.addEventListener('click', rejectIncoming);
  refs.end?.addEventListener('click', endCall);
  refs.mute?.addEventListener('click', toggleMute);
  refs.permission?.addEventListener('click', requestPermission);
  refs.close?.addEventListener('click', () => cleanup());
  refs.start?.addEventListener('click', () => startOutbound(state.conversation));
  refs.historyOpen?.addEventListener('click', openGlobalHistory);
  refs.historyClose?.addEventListener('click', closeGlobalHistory);
  refs.historyModal?.addEventListener('click', (event) => { if (event.target === refs.historyModal) closeGlobalHistory(); });

  window.whatsappCallController = { start, stop, setConversation, startOutbound, handleEvent, state };
}());
