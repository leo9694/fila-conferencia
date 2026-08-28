(function createWhatsAppCallController() {
  'use strict';

  const Core = window.WhatsAppCallCore;
  if (!Core) return;

  const byId = (id) => document.getElementById(id);
  const refs = {
    overlay: byId('whatsapp-call-overlay'), panel: byId('whatsapp-call-panel'), title: byId('whatsapp-call-title'),
    contact: byId('whatsapp-call-contact'), phone: byId('whatsapp-call-phone'), channel: byId('whatsapp-call-channel'), status: byId('whatsapp-call-status'),
    duration: byId('whatsapp-call-duration'), accept: byId('whatsapp-call-accept'), reject: byId('whatsapp-call-reject'),
    mute: byId('whatsapp-call-mute'), end: byId('whatsapp-call-end'), permission: byId('whatsapp-call-permission'),
    transfer: byId('whatsapp-call-transfer'), transferPicker: byId('whatsapp-call-transfer-picker'),
    transferAgent: byId('whatsapp-call-transfer-agent'), transferSend: byId('whatsapp-call-transfer-send'),
    transferCancel: byId('whatsapp-call-transfer-cancel'),
    close: byId('whatsapp-call-close'), remoteAudio: byId('whatsapp-call-remote-audio'),
    history: byId('chat-call-history'), start: byId('chat-call-start'),
    historyOpen: byId('chat-call-history-open'), historyModal: byId('whatsapp-call-history-modal'),
    historyClose: byId('whatsapp-call-history-close'), historyGlobal: byId('whatsapp-call-history-global'),
    historyTitle: byId('whatsapp-call-history-title')
  };

  function createCallClientId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  const state = {
    status: 'IDLE', call: null, conversation: null, profile: null, source: null, client: null,
    signal: null, timer: null, startedAt: 0, ringtone: null, reconnecting: false,
    transfer: null, outgoingTransfer: null, permission: null, conversationLoadToken: 0,
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
      error.code = payload?.code || payload?.codigo || payload?.publicCode || payload?.integrationCode
        || payload?.error?.code || payload?.details?.code || '';
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
      create: (id, payload) => api(`/conversations/${encodeURIComponent(id)}/calls`, jsonBody(payload)),
      createOutboundMedia: (id, payload) => api(`/conversations/${encodeURIComponent(id)}/calls/media`, jsonBody(payload)),
      joinMedia: (id, payload) => api(`/calls/${encodeURIComponent(id)}/media`, jsonBody(payload)),
      mediaReady: (id, payload) => api(`/calls/${encodeURIComponent(id)}/media-ready`, jsonBody(payload))
    };
  }

  function makeClient() {
    return new Core.WhatsAppCallClient({
      api: clientApi(),
      mediaDevices: navigator.mediaDevices,
      PeerConnection: window.RTCPeerConnection || window.webkitRTCPeerConnection,
      AudioContext: window.AudioContext || window.webkitAudioContext,
      remoteAudio: refs.remoteAudio,
      onMediaError: () => {
        refs.status.textContent = 'Áudio conectado, mas a saída de som foi bloqueada pelo navegador.';
        toast('Clique novamente no painel da chamada para liberar o som.');
      },
      onRemoteMedia: () => {
        if (String(state.call?.direction || '').toUpperCase() !== 'OUTBOUND'
          || !['INITIATING', 'RINGING', 'CONNECTING'].includes(state.status)) return;
        stopRingtone();
        setStatus('ACTIVE', 'Chamada em andamento');
        startTimer(state.call?.answeredAt || Date.now());
      }
    });
  }

  function channel(payload = {}) {
    return payload.channel || payload.call?.channel || payload.conversation?.channel || null;
  }

  function setStatus(status, text) {
    state.status = status;
    refs.panel.dataset.status = status;
    refs.status.textContent = state.reconnecting ? 'Reconectando ao servidor...' : text;
    const controls = Core.callControls(status, { direction: String(state.call?.direction || '').toUpperCase() });
    refs.accept.hidden = !controls.accept;
    refs.reject.hidden = !controls.reject;
    refs.mute.hidden = !controls.mute;
    refs.transfer.hidden = !controls.transfer;
    refs.end.hidden = !controls.end;
    refs.permission.hidden = status !== 'PERMISSION';
    refs.close.hidden = !['PERMISSION', 'FAILED', 'BUSY', 'REJECTED', 'ENDED'].includes(status);
    const direction = String(state.call?.direction || '').toUpperCase();
    if (Core.shouldPlayOutboundRingback(status, direction)) startRingback();
    else if (state.ringtone?.kind === 'outbound') stopRingtone();
  }

  function openOverlay(payload, status = 'RINGING') {
    const person = contact(payload);
    refs.contact.textContent = person.name;
    refs.phone.textContent = person.phone;
    const source = channel(payload) || channel(state.call);
    refs.channel.hidden = !source;
    refs.channel.textContent = source
      ? `${String(state.call?.direction || '').toUpperCase() === 'OUTBOUND' ? 'Via' : 'Recebida em'}: ${source.displayName || source.name || 'Canal não identificado'}${source.displayPhoneNumber ? ` · ${source.displayPhoneNumber}` : ''}`
      : '';
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
      state.ringtone = { kind: 'incoming', context, oscillator, pulse };
    } catch {}
  }

  function startRingback() {
    if (state.ringtone?.kind === 'outbound') return;
    stopRingtone();
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      const context = new Context();
      const gain = context.createGain();
      const oscillators = [440, 480].map((frequency) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start();
        return oscillator;
      });
      gain.connect(context.destination);
      gain.gain.value = 0;
      state.ringtone = { kind: 'outbound', context, gain, oscillators, timer: null, stopped: false };
      const playCycle = () => {
        const tone = state.ringtone;
        if (!tone || tone.kind !== 'outbound' || tone.stopped) return;
        tone.gain.gain.setValueAtTime(0.025, tone.context.currentTime);
        tone.timer = setTimeout(() => {
          if (!state.ringtone || state.ringtone !== tone || tone.stopped) return;
          tone.gain.gain.setValueAtTime(0, tone.context.currentTime);
          tone.timer = setTimeout(playCycle, 2500);
        }, 1100);
      };
      context.resume?.().catch(() => {});
      playCycle();
    } catch {}
  }

  function stopRingtone() {
    if (!state.ringtone) return;
    const tone = state.ringtone;
    tone.stopped = true;
    clearInterval(tone.pulse);
    clearTimeout(tone.timer);
    try {
      (tone.oscillators || [tone.oscillator]).filter(Boolean).forEach((oscillator) => oscillator.stop());
      tone.context.close();
    } catch {}
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
    state.transfer = null;
    state.outgoingTransfer = null;
    refs.transferPicker.hidden = true;
    refs.transfer.innerHTML = '<i data-lucide="phone-forwarded" aria-hidden="true"></i><span>Transferir</span>';
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
      state.client = makeClient();
      state.client.unlockRemoteAudio();
      if (state.transfer) {
        setStatus('TRANSFER_CONNECTING', 'Aceitando transferência...');
        await state.client.prepareLocalMedia();
        await api(`/calls/${encodeURIComponent(callId(state.call))}/transfer/${encodeURIComponent(state.transfer.transferId)}/accept`, jsonBody({}));
        await state.client.connectGateway({ callId: callId(state.call), transferId: state.transfer.transferId });
        if (state.status === 'TRANSFER_CONNECTING') {
          refs.status.textContent = 'Áudio conectado. Finalizando transferência...';
        }
      } else {
        await state.client.acceptIncoming({ callId: callId(state.call), conversationId: conversationId(state.call) });
        if (state.status === 'CONNECTING') {
          setStatus('ACTIVE', 'Chamada em andamento');
          startTimer(state.call?.answeredAt || Date.now());
        }
      }
    } catch (error) {
      if (state.transfer) {
        const failedTransfer = state.transfer;
        try {
          await api(`/calls/${encodeURIComponent(callId(state.call))}/transfer/${encodeURIComponent(failedTransfer.transferId)}/reject`, jsonBody({}));
        } catch {}
        cleanup();
        toast(error.message || 'Não foi possível conectar o áudio da transferência.');
        return;
      }
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
    try {
      if (state.transfer) {
        await api(`/calls/${encodeURIComponent(callId(state.call))}/transfer/${encodeURIComponent(state.transfer.transferId)}/reject`, jsonBody({}));
      } else await updateCall('reject');
    } catch (error) { toast(error.message); }
    cleanup();
  }

  async function openTransferPicker() {
    if (!state.call || !['ACTIVE', 'TRANSFER_PENDING'].includes(state.status)) return;
    if (state.outgoingTransfer) {
      try {
        await api(`/calls/${encodeURIComponent(callId(state.call))}/transfer/${encodeURIComponent(state.outgoingTransfer.transferId)}/cancel`, jsonBody({}));
        refs.status.textContent = 'Cancelando transferência...';
      } catch (error) { toast(error.message); }
      return;
    }
    refs.transferPicker.hidden = false;
    refs.transferAgent.innerHTML = '<option value="">Carregando atendentes...</option>';
    try {
      const payload = await api('/call-agents');
      const agents = Core.normalizeAgentList(payload)
        .filter((item) => String(item.id) !== String(state.profile?.id || state.profile?.codUsu || ''));
      refs.transferAgent.innerHTML = agents.length
        ? agents.map((item) => {
          const availability = Core.agentAvailability(item);
          return `<option value="${escapeHtml(item.id)}"${availability.available ? '' : ' disabled'}>${escapeHtml(item.name)} · ${escapeHtml(availability.label)}</option>`;
        }).join('')
        : '<option value="">Nenhum atendente disponível</option>';
      const firstAvailable = agents.find((item) => Core.agentAvailability(item).available);
      refs.transferAgent.value = firstAvailable ? String(firstAvailable.id) : '';
      refs.transferSend.disabled = !firstAvailable;
    } catch (error) {
      refs.transferAgent.innerHTML = '<option value="">Falha ao carregar</option>';
      refs.transferSend.disabled = true;
      toast(error.message);
    }
  }

  async function sendTransfer() {
    const targetAgentId = refs.transferAgent.value;
    if (!targetAgentId || !state.call) return;
    refs.transferSend.disabled = true;
    try {
      state.outgoingTransfer = await api(`/calls/${encodeURIComponent(callId(state.call))}/transfer`, jsonBody({ targetAgentId }));
      refs.transferPicker.hidden = true;
      refs.transfer.innerHTML = '<i data-lucide="x" aria-hidden="true"></i><span>Cancelar transferência</span>';
      setStatus('TRANSFER_PENDING', `Aguardando ${state.outgoingTransfer.toAgent?.name || 'atendente'} aceitar...`);
      window.lucide?.createIcons();
    } catch (error) {
      refs.transferSend.disabled = false;
      toast(error.message);
    }
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

  function applyPermission(payload = {}, { notify = false } = {}) {
    if (!state.conversation?.id) return;
    if (payload.conversationId && Number(payload.conversationId) !== Number(state.conversation.id)) return;
    const previous = Core.normalizeCallPermission(state.permission || {});
    const permission = Core.normalizeCallPermission(payload);
    const view = Core.callPermissionView(permission);
    state.permission = permission;
    refs.start.hidden = false;
    delete refs.start.dataset.loading;
    refs.start.removeAttribute('aria-busy');
    refs.start.disabled = state.status !== 'IDLE' && state.status !== 'PERMISSION';
    refs.start.title = view.action === 'CALL' ? 'Ligar pelo WhatsApp' : view.label;
    if (state.status === 'PERMISSION') {
      refs.status.textContent = view.message;
      refs.permission.dataset.action = view.action;
      refs.permission.disabled = view.disabled;
      refs.permission.querySelector('span').textContent = view.label;
      refs.permission.querySelector('i')?.setAttribute('data-lucide', view.action === 'CALL' ? 'phone' : 'message-circle');
      window.lucide?.createIcons();
    }
    if (permission.status === 'PENDING') refs.start.disabled = false;
    if (notify && previous.status !== permission.status) {
      if (permission.status === 'GRANTED' && permission.canCall) toast('✓ Cliente autorizou ligações.');
      else if (['DENIED', 'EXPIRED', 'REVOKED'].includes(permission.status)) toast(view.message);
    }
  }

  function openPermission(conversation, permission) {
    openOverlay(conversation, 'PERMISSION');
    refs.title.textContent = 'Permissão para ligar';
    applyPermission(permission);
  }

  async function startOutbound(conversation) {
    if (!conversation?.id || state.status !== 'IDLE') {
      if (state.status !== 'IDLE') toast('Já existe uma chamada em andamento.');
      return;
    }
    state.conversation = conversation;
    try {
      const permission = await api(`/conversations/${encodeURIComponent(conversation.id)}/call-permission`);
      applyPermission(permission);
      if (!Core.normalizeCallPermission(permission).canCall) {
        openPermission(conversation, permission);
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
      const permission = await api(`/conversations/${encodeURIComponent(state.conversation.id)}/calls/permission`, jsonBody({
        body: 'Podemos ligar para ajudar no seu atendimento?'
      }));
      applyPermission(permission);
    } catch (error) {
      refs.status.textContent = Core.friendlyCallError(error);
      refs.permission.disabled = false;
    }
  }

  async function permissionAction() {
    const view = Core.callPermissionView(state.permission || {});
    if (view.action === 'CALL' && state.conversation) await beginOutbound(state.conversation);
    else if (view.action === 'REQUEST') await requestPermission();
  }

  async function beginOutbound(conversation) {
    state.call = { conversationId: conversation.id, direction: 'OUTBOUND', contact: conversation.contact, channel: conversation.channel };
    openOverlay(conversation, 'INITIATING');
    refs.title.textContent = 'Ligação pelo WhatsApp';
    refs.status.textContent = `Ligando para ${contact(conversation).name}...`;
    try {
      state.client ||= makeClient();
      state.client.unlockRemoteAudio();
      const created = await state.client.startOutgoing({ conversationId: conversation.id });
      state.call = { ...state.call, ...(created?.call || created || {}) };
      setStatus('RINGING', 'Chamando...');
    } catch (error) {
      const errorStatus = error.code === 'AGENT_BUSY' || error.code === 'CALL_ALREADY_ACTIVE' ? 'BUSY'
        : error.code === 'CALL_PERMISSION_REQUIRED' || error.code === 'CALL_PERMISSION_EXPIRED' ? 'REJECTED' : 'FAILED';
      setStatus(errorStatus, error?.name === 'NotAllowedError'
        ? 'É necessário permitir acesso ao microfone para iniciar a chamada.'
        : Core.friendlyCallError(error));
    }
  }

  function handleEvent(event, payload = {}) {
    const incomingId = callId(payload);
    if (event === 'call:permission:updated') {
      applyPermission(payload, { notify: true });
      return;
    }
    if (event === 'call:outgoing') {
      if (conversationId(payload) !== Number(state.conversation?.id) || state.call) return;
      state.call = payload.call || payload;
      openOverlay(state.call, 'INITIATING');
      refs.title.textContent = 'Ligação pelo WhatsApp';
      refs.status.textContent = `Ligando para ${contact(state.call).name}...`;
      return;
    }
    if (event === 'call:transfer:incoming') {
      if (state.status !== 'IDLE') {
        toast('Uma transferência chegou, mas você já está em outra chamada.');
        return;
      }
      state.transfer = payload;
      state.call = payload;
      refs.title.textContent = 'Transferência de chamada';
      openOverlay(payload, 'RINGING');
      refs.status.textContent = `${payload.fromAgent?.name || 'Outro atendente'} quer transferir esta chamada`;
      startRingtone();
      return;
    }
    if (event === 'call:transferred:away') {
      if (!state.call || incomingId !== callId(state.call)) return;
      cleanup();
      toast(`Chamada transferida para ${payload.toAgent?.name || 'outro atendente'}.`);
      return;
    }
    if (event === 'call:transfer:accepted') {
      if (state.outgoingTransfer?.transferId === payload.transferId) {
        setStatus('TRANSFER_PENDING', `${payload.toAgent?.name || 'Atendente'} aceitou; conectando o áudio...`);
      }
      return;
    }
    if (['call:transfer:rejected', 'call:transfer:cancelled', 'call:transfer:expired'].includes(event)) {
      const targetTransfer = state.transfer?.transferId === payload.transferId;
      const sourceTransfer = state.outgoingTransfer?.transferId === payload.transferId;
      if (!targetTransfer && !sourceTransfer) return;
      if (targetTransfer) {
        cleanup();
        toast(event === 'call:transfer:cancelled' ? 'A transferência foi cancelada.' : 'A transferência não está mais disponível.');
      } else {
        state.outgoingTransfer = null;
        refs.transferPicker.hidden = true;
        refs.transfer.innerHTML = '<i data-lucide="phone-forwarded" aria-hidden="true"></i><span>Transferir</span>';
        setStatus('ACTIVE', 'Chamada em andamento');
        window.lucide?.createIcons();
        toast(event === 'call:transfer:rejected' ? 'O atendente recusou a transferência.' : 'A transferência foi encerrada.');
      }
      return;
    }
    if (event === 'call:transfer:completed') {
      if (state.transfer?.transferId !== payload.transferId) return;
      state.transfer = null;
      setStatus('ACTIVE', 'Chamada transferida');
      startTimer(payload.call?.answeredAt || payload.answeredAt || state.call?.answeredAt || Date.now());
      return;
    }
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
      const previousStatus = state.status;
      state.call = { ...state.call, ...(payload.call || payload) };
      const updatedStatus = String(payload.call?.status || payload.status || '').toUpperCase();
      if (Core.TERMINAL_STATES.has(updatedStatus)) {
        const terminalStatus = updatedStatus === 'MISSED' ? 'ENDED' : updatedStatus;
        cleanup({ close: false });
        setStatus(terminalStatus, updatedStatus === 'MISSED' ? 'Chamada não atendida.'
          : updatedStatus === 'BUSY' ? 'Cliente ocupado.'
            : updatedStatus === 'REJECTED' ? 'O cliente recusou a chamada.'
              : updatedStatus === 'FAILED' ? 'Falha ao completar a chamada.' : 'A ligação foi encerrada.');
        if (state.conversation) loadHistory(state.conversation).catch(() => {});
        return;
      }
      const uiStatus = Core.callUpdateUiStatus(updatedStatus);
      if (uiStatus === 'ACTIVE') {
        stopRingtone();
        setStatus('ACTIVE', 'Chamada em andamento');
        if (previousStatus !== 'ACTIVE' || !state.timer) {
          startTimer(payload.call?.answeredAt || payload.answeredAt || state.call?.answeredAt || Date.now());
        }
      } else if (uiStatus === 'CONNECTING' && previousStatus !== 'ACTIVE') {
        setStatus('CONNECTING', 'Conectando áudio...');
      } else if (uiStatus === 'RINGING' && !['ACTIVE', 'CONNECTING'].includes(previousStatus)) {
        setStatus('RINGING', 'Chamando...');
      } else if (uiStatus === 'INITIATING' && !['ACTIVE', 'CONNECTING', 'RINGING'].includes(previousStatus)) {
        setStatus('INITIATING', `Ligando para ${contact(state.call).name}...`);
      }
      return;
    }
    if (!state.call) return;
    const direction = String(state.call.direction || '').toUpperCase();
    if (direction === 'OUTBOUND' && event === 'call:ringing') {
      setStatus('RINGING', 'Chamando...');
      return;
    }
    if (direction === 'OUTBOUND' && event === 'call:connecting') {
      setStatus('CONNECTING', 'Conectando áudio...');
      return;
    }
    const eventStatus = Core.eventUiStatus(event, state.status, Boolean(state.client));
    if (eventStatus === 'RINGING') setStatus('RINGING', 'Chamada recebida pelo WhatsApp');
    else if (eventStatus === 'CONNECTING') setStatus('CONNECTING', event === 'call:ringing' ? 'Chamando...' : 'Conectando áudio...');
    else if (event === 'call:active') {
      stopRingtone(); setStatus('ACTIVE', 'Chamada em andamento'); startTimer(payload.call?.answeredAt || payload.answeredAt);
    } else if (['call:ended', 'call:rejected', 'call:failed'].includes(event)) {
      const wasRinging = state.status === 'RINGING';
      const terminalStatus = event === 'call:rejected' ? 'REJECTED' : event === 'call:failed' ? 'FAILED' : 'ENDED';
      const message = event === 'call:rejected' ? 'O cliente recusou a chamada.'
        : event === 'call:failed' ? 'Falha ao estabelecer áudio.' : 'A ligação foi encerrada.';
      cleanup({ close: false });
      setStatus(terminalStatus, wasRinging ? `Chamada perdida de ${contact(payload).name}` : message);
      if (state.conversation) loadHistory(state.conversation).catch(() => {});
    }
  }

  function connectRealtime() {
    state.source?.close();
    const source = new EventSource('/api/chat/events');
    state.source = source;
    ['call:permission:updated', 'call:outgoing', 'call:incoming', 'call:claimed', 'call:ringing', 'call:connecting', 'call:active', 'call:ended', 'call:failed', 'call:rejected', 'call:updated', 'call:signal',
      'call:transfer:incoming', 'call:transfer:accepted', 'call:transfer:rejected', 'call:transfer:cancelled',
      'call:transfer:expired', 'call:transfer:completed', 'call:transferred:away']
      .forEach((event) => source.addEventListener(event, (message) => {
        try { handleEvent(event, JSON.parse(message.data)); } catch {}
      }));
    source.addEventListener('connection', () => {
      state.reconnecting = false;
      if (state.status !== 'IDLE') {
        const text = state.status === 'ACTIVE' ? 'Chamada em andamento'
          : state.status === 'TRANSFER_PENDING' ? 'Transferência pendente'
            : state.status === 'TRANSFER_CONNECTING' ? 'Finalizando transferência...' : 'Conectando áudio...';
        setStatus(state.status, text);
      }
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

  function loadHistory(conversation) {
    if (!refs.history || !conversation?.id) return;
    refs.history.innerHTML = `<button class="chat-call-history-button" type="button" data-chat-call-history-conversation="${escapeHtml(conversation.id)}">
      <span><i data-lucide="history" aria-hidden="true"></i><span><b>Histórico de chamadas</b><small>Ver chamadas deste chat</small></span></span>
      <i data-lucide="chevron-right" aria-hidden="true"></i>
    </button>`;
    window.lucide?.createIcons();
  }

  async function openHistory(conversation = null) {
    if (!refs.historyModal || !refs.historyGlobal) return;
    const conversationId = String(conversation?.id || '');
    const person = conversationId ? contact(conversation) : null;
    if (refs.historyTitle) refs.historyTitle.textContent = conversationId
      ? `Chamadas de ${person.name}` : 'Histórico de ligações';
    refs.historyModal.hidden = false;
    refs.historyGlobal.innerHTML = '<p>Carregando ligações...</p>';
    window.lucide?.createIcons();
    try {
      const endpoint = conversationId
        ? `/conversations/${encodeURIComponent(conversationId)}/calls?page=1&limit=100`
        : '/calls?page=1&limit=100';
      const payload = await api(endpoint);
      const calls = normalizeCalls(payload);
      refs.historyGlobal.innerHTML = calls.length
        ? `<div class="chat-call-history-list">${calls.map((item) => callHistoryItem(item, { global: !conversationId })).join('')}</div>`
        : '<div class="whatsapp-call-history-empty"><i data-lucide="phone-off" aria-hidden="true"></i><p>Nenhuma ligação registrada.</p></div>';
      window.lucide?.createIcons();
    } catch (error) {
      refs.historyGlobal.innerHTML = `<div class="whatsapp-call-history-empty"><p>${escapeHtml(error.message || 'Histórico temporariamente indisponível.')}</p></div>`;
    }
  }

  async function openGlobalHistory() {
    await openHistory();
  }

  function closeGlobalHistory() {
    if (refs.historyModal) refs.historyModal.hidden = true;
  }

  async function setConversation(conversation) {
    const previousConversationId = String(state.conversation?.id || '');
    const requestedConversationId = String(conversation?.id || '');
    const requestToken = ++state.conversationLoadToken;
    state.conversation = conversation || null;
    if (!requestedConversationId) {
      state.permission = null;
      refs.start.hidden = true;
      delete refs.start.dataset.loading;
      refs.start.removeAttribute('aria-busy');
      return;
    }
    const changedConversation = previousConversationId !== requestedConversationId;
    if (changedConversation) {
      state.permission = null;
      refs.start.hidden = false;
      refs.start.disabled = true;
      refs.start.dataset.loading = 'true';
      refs.start.setAttribute('aria-busy', 'true');
      refs.start.title = 'Verificando disponibilidade de ligação...';
      loadHistory(conversation);
    } else if (state.permission) {
      applyPermission(state.permission);
      refs.start.hidden = false;
    }
    try {
      const permission = await api(`/conversations/${encodeURIComponent(conversation.id)}/call-permission`);
      if (requestToken !== state.conversationLoadToken || String(state.conversation?.id || '') !== requestedConversationId) return;
      applyPermission(permission);
      refs.start.hidden = false;
      refs.start.disabled = state.status !== 'IDLE';
      refs.start.title = Core.normalizeCallPermission(permission).canCall
        ? 'Ligar pelo WhatsApp' : Core.callPermissionView(permission).label;
    } catch {
      if (requestToken !== state.conversationLoadToken || String(state.conversation?.id || '') !== requestedConversationId) return;
      if (!state.permission) {
        refs.start.hidden = false;
        refs.start.disabled = true;
        delete refs.start.dataset.loading;
        refs.start.removeAttribute('aria-busy');
        refs.start.title = 'Ligação indisponível no momento';
      }
    }
  }

  refs.accept?.addEventListener('click', acceptIncoming);
  refs.reject?.addEventListener('click', rejectIncoming);
  refs.end?.addEventListener('click', endCall);
  refs.mute?.addEventListener('click', toggleMute);
  refs.transfer?.addEventListener('click', openTransferPicker);
  refs.transferSend?.addEventListener('click', sendTransfer);
  refs.transferCancel?.addEventListener('click', () => { refs.transferPicker.hidden = true; });
  refs.permission?.addEventListener('click', () => {
    state.client ||= makeClient();
    state.client.unlockRemoteAudio();
    permissionAction();
  });
  refs.close?.addEventListener('click', () => cleanup());
  refs.start?.addEventListener('click', () => {
    state.client ||= makeClient();
    state.client.unlockRemoteAudio();
    startOutbound(state.conversation);
  });
  refs.panel?.addEventListener('click', () => state.client?.playRemoteStream());
  refs.history?.addEventListener('click', (event) => {
    if (event.target.closest('[data-chat-call-history-conversation]')) openHistory(state.conversation);
  });
  refs.historyOpen?.addEventListener('click', openGlobalHistory);
  refs.historyClose?.addEventListener('click', closeGlobalHistory);
  refs.historyModal?.addEventListener('click', (event) => { if (event.target === refs.historyModal) closeGlobalHistory(); });

  window.whatsappCallController = { start, stop, setConversation, startOutbound, handleEvent, state };
}());
