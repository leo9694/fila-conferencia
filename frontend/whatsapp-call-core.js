(function exposeWhatsAppCallCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WhatsAppCallCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createWhatsAppCallCore() {
  'use strict';

  const CALL_STATES = Object.freeze({
    IDLE: 'IDLE',
    INITIATING: 'INITIATING',
    RINGING: 'RINGING',
    CONNECTING: 'CONNECTING',
    ACTIVE: 'ACTIVE',
    TRANSFER_PENDING: 'TRANSFER_PENDING',
    TRANSFER_CONNECTING: 'TRANSFER_CONNECTING',
    ENDING: 'ENDING',
    ENDED: 'ENDED',
    FAILED: 'FAILED',
    BUSY: 'BUSY',
    REJECTED: 'REJECTED'
  });
  const TERMINAL_STATES = new Set(['REJECTED', 'MISSED', 'BUSY', 'FAILED', 'ENDED']);

  function callControls(status, { direction = 'INBOUND' } = {}) {
    const hasMedia = ['CONNECTING', 'ACTIVE', 'TRANSFER_PENDING', 'TRANSFER_CONNECTING'].includes(status);
    const incomingRinging = status === 'RINGING' && direction !== 'OUTBOUND';
    return {
      accept: incomingRinging,
      reject: incomingRinging,
      mute: hasMedia,
      end: ['RINGING', 'CONNECTING', 'ACTIVE', 'TRANSFER_PENDING'].includes(status)
        && (status !== 'RINGING' || direction === 'OUTBOUND'),
      transfer: ['ACTIVE', 'TRANSFER_PENDING'].includes(status)
    };
  }

  function shouldPlayOutboundRingback(status, direction) {
    return String(direction || '').toUpperCase() === 'OUTBOUND'
      && ['INITIATING', 'RINGING'].includes(String(status || '').toUpperCase());
  }

  function normalizeCallPermission(payload = {}) {
    const status = String(payload.status || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
    return { ...payload, status, canCall: payload.canCall === true };
  }

  function canRequestCallPermission(permission = {}) {
    if (permission.status === 'PENDING' || permission.canCall) return false;
    if (!Array.isArray(permission.actions)) return permission.status === 'UNKNOWN';
    const requestAction = permission.actions.find((action) => (
      String(action?.action_name || action?.name || '').toLowerCase() === 'send_call_permission_request'
    ));
    return requestAction?.can_perform_action === true;
  }

  function callPermissionView(payload = {}) {
    const permission = normalizeCallPermission(payload);
    const canRequest = canRequestCallPermission(permission);
    if (permission.status === 'GRANTED' && permission.canCall) {
      return { action: 'CALL', label: 'Ligar', message: '✓ Cliente autorizou ligações', disabled: false };
    }
    if (permission.status === 'PENDING') {
      return {
        action: 'NONE', label: 'Permissão solicitada',
        message: 'Solicitação enviada. Aguardando autorização do cliente...', disabled: true
      };
    }
    if (permission.status === 'DENIED') {
      return {
        action: canRequest ? 'REQUEST' : 'NONE',
        label: canRequest ? 'Solicitar novamente' : 'Nova solicitação indisponível',
        message: 'Cliente não autorizou ligações.', disabled: !canRequest
      };
    }
    if (permission.status === 'EXPIRED') {
      return {
        action: canRequest ? 'REQUEST' : 'NONE',
        label: canRequest ? 'Solicitar novamente' : 'Nova solicitação indisponível',
        message: 'Permissão de ligação expirada.', disabled: !canRequest
      };
    }
    if (permission.status === 'REVOKED') {
      return {
        action: canRequest ? 'REQUEST' : 'NONE',
        label: canRequest ? 'Solicitar novamente' : 'Nova solicitação indisponível',
        message: 'Permissão de ligação revogada.', disabled: !canRequest
      };
    }
    if (canRequest) {
      return {
        action: 'REQUEST', label: 'Solicitar permissão de ligação',
        message: 'Solicite autorização do cliente antes de ligar.', disabled: false
      };
    }
    return {
      action: 'NONE', label: 'Ligação indisponível',
      message: 'A ligação não está disponível para esta conversa.', disabled: true
    };
  }

  function friendlyCallError(error = {}) {
    const code = String(error.code || error.publicCode || '').toUpperCase();
    const messages = {
      CALL_PERMISSION_REQUIRED: 'Solicite a permissão do cliente antes de ligar.',
      CALL_PERMISSION_EXPIRED: 'A permissão de ligação expirou. Solicite novamente.',
      CALL_ALREADY_ACTIVE: 'Já existe uma chamada ativa para esta conversa.',
      AGENT_BUSY: 'Você já está em outra chamada.',
      META_CALL_FAILED: 'A Meta não conseguiu iniciar a ligação. Tente novamente.'
    };
    return messages[code] || error.message || 'Não foi possível concluir a chamada.';
  }

  function normalizeAgentList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.agents)) return payload.data.agents;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.agents)) return payload.agents;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function agentAvailability(agent = {}) {
    const raw = String(agent.availability || agent.status || '').trim().toUpperCase();
    if (agent.online === false || ['OFFLINE', 'DISCONNECTED'].includes(raw)) {
      return { code: 'OFFLINE', label: 'offline', available: false };
    }
    if (agent.busy === true || ['BUSY', 'IN_CALL', 'UNAVAILABLE'].includes(raw)) {
      return { code: 'BUSY', label: 'ocupado', available: false };
    }
    if (agent.online === true || ['AVAILABLE', 'ONLINE', 'IDLE'].includes(raw)) {
      return { code: 'AVAILABLE', label: 'disponível', available: true };
    }
    return { code: raw || 'OFFLINE', label: raw ? raw.toLowerCase() : 'offline', available: false };
  }

  function formatDuration(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours
      ? [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
      : [minutes, rest].map((part) => String(part).padStart(2, '0')).join(':');
  }

  function waitForIceGathering(peer, timeoutMs = 5000) {
    if (!peer || peer.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.removeEventListener?.('icegatheringstatechange', change);
        resolve();
      };
      const change = () => {
        if (peer.iceGatheringState === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      peer.addEventListener?.('icegatheringstatechange', change);
    });
  }

  function sessionFrom(description) {
    if (!description?.sdp || !description?.type) throw new Error('Sinalização WebRTC incompleta.');
    return { sdpType: description.type, sdp: description.sdp };
  }

  function waitForPeerConnected(peer, timeoutMs = 12000) {
    if (['connected', 'completed'].includes(peer?.connectionState) || peer?.iceConnectionState === 'connected') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.removeEventListener?.('connectionstatechange', change);
        peer.removeEventListener?.('iceconnectionstatechange', change);
        if (error) reject(error); else resolve();
      };
      const change = () => {
        if (['connected', 'completed'].includes(peer.connectionState)
          || ['connected', 'completed'].includes(peer.iceConnectionState)) finish();
        else if (['failed', 'closed'].includes(peer.connectionState)
          || ['failed', 'closed'].includes(peer.iceConnectionState)) finish(new Error('Falha ao conectar o áudio.'));
      };
      const timer = setTimeout(() => finish(new Error('Tempo esgotado ao conectar o áudio.')), timeoutMs);
      peer.addEventListener?.('connectionstatechange', change);
      peer.addEventListener?.('iceconnectionstatechange', change);
    });
  }

  function eventUiStatus(event, currentStatus, hasClient) {
    if (!['call:ringing', 'call:connecting'].includes(event)) return null;
    if (currentStatus === 'RINGING' && !hasClient) return 'RINGING';
    return 'CONNECTING';
  }

  function callUpdateUiStatus(status) {
    const normalized = String(status || '').trim().toUpperCase();
    if (['ACTIVE', 'ANSWERED', 'CONNECTED', 'IN_PROGRESS'].includes(normalized)) return 'ACTIVE';
    if (['INITIATING', 'RINGING', 'CONNECTING'].includes(normalized)) return normalized;
    return null;
  }

  async function retryMediaAction(action, { attempts = 15, delayMs = 200 } = {}) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { return await action(); }
      catch (error) {
        lastError = error;
        const pendingMedia = error?.status === 409 && /(?:microfone|áudio).*(?:pronto|ready)|media_not_ready/i.test(error.message || '');
        if (!pendingMedia || attempt === attempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  class WhatsAppCallClient {
    constructor({ api, mediaDevices, PeerConnection, remoteAudio, onRemoteMedia, rtcConfig = {} } = {}) {
      this.api = api;
      this.mediaDevices = mediaDevices;
      this.PeerConnection = PeerConnection;
      this.remoteAudio = remoteAudio || null;
      this.onRemoteMedia = typeof onRemoteMedia === 'function' ? onRemoteMedia : null;
      this.rtcConfig = rtcConfig;
      this.peer = null;
      this.localStream = null;
      this.remoteStream = null;
      this.muted = false;
      this.remoteMediaNotified = false;
    }

    async preparePeer() {
      if (!this.PeerConnection) throw new Error('Este navegador não oferece suporte a chamadas WebRTC.');
      this.peer = new this.PeerConnection(this.rtcConfig);
      this.peer.ontrack = (event) => {
        const stream = event.streams?.[0];
        if (stream) this.remoteStream = stream;
        else if (typeof MediaStream !== 'undefined') {
          this.remoteStream ||= new MediaStream();
          if (event.track) this.remoteStream.addTrack(event.track);
        }
        if (this.remoteAudio && this.remoteStream) {
          this.remoteAudio.srcObject = this.remoteStream;
          Promise.resolve(this.remoteAudio.play?.()).catch(() => {});
        }
        if (event.track?.addEventListener) {
          event.track.addEventListener('unmute', () => {
            if (this.remoteMediaNotified) return;
            this.remoteMediaNotified = true;
            this.onRemoteMedia?.();
          }, { once: true });
        }
      };
      return this.peer;
    }

    async captureMicrophone() {
      if (!this.mediaDevices?.getUserMedia) throw new Error('Não foi possível acessar o microfone neste navegador.');
      this.localStream = await this.mediaDevices.getUserMedia({ audio: true });
      this.localStream.getTracks().forEach((track) => this.peer.addTrack(track, this.localStream));
    }

    async prepareLocalMedia() {
      if (!this.peer) await this.preparePeer();
      if (!this.localStream) await this.captureMicrophone();
      return this.localStream;
    }

    async connectGateway({ callId, transferId }) {
      await this.prepareLocalMedia();
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      await waitForIceGathering(this.peer);
      const response = await this.api.joinMedia(callId, {
        session: sessionFrom(this.peer.localDescription),
        ...(transferId ? { transferId } : {})
      });
      const answer = response?.session || response;
      await this.peer.setRemoteDescription({ type: answer.sdpType || answer.type || 'answer', sdp: answer.sdp });
      await waitForPeerConnected(this.peer);
      await retryMediaAction(() => this.api.mediaReady(callId, transferId ? { transferId } : {}));
      return answer;
    }

    async acceptIncoming({ callId, conversationId }) {
      try {
        await this.prepareLocalMedia();
        await this.api.claim(callId, { conversationId });
        return await this.connectGateway({ callId });
      } catch (error) {
        this.cleanup();
        throw error;
      }
    }

    async startOutgoing({ conversationId }) {
      try {
        await this.preparePeer();
        await this.captureMicrophone();
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        await waitForIceGathering(this.peer);
        const media = await this.api.createOutboundMedia(conversationId, {
          session: sessionFrom(this.peer.localDescription)
        });
        const answer = media?.session || media;
        await this.peer.setRemoteDescription({ type: answer.sdpType || answer.type || 'answer', sdp: answer.sdp });
        await waitForPeerConnected(this.peer);
        return retryMediaAction(() => this.api.create(conversationId, { mediaSessionId: media.mediaSessionId }));
      } catch (error) {
        this.cleanup();
        throw error;
      }
    }

    async applySignal(signal = {}) {
      const session = signal.session || signal;
      if (!this.peer || !session.sdp) return false;
      const type = session.sdpType || session.type || 'answer';
      await this.peer.setRemoteDescription({ type, sdp: session.sdp });
      return true;
    }

    toggleMute(force) {
      const next = typeof force === 'boolean' ? force : !this.muted;
      this.localStream?.getAudioTracks?.().forEach((track) => { track.enabled = !next; });
      this.muted = next;
      return next;
    }

    cleanup() {
      this.localStream?.getTracks?.().forEach((track) => track.stop());
      this.remoteStream?.getTracks?.().forEach((track) => track.stop());
      if (this.peer) {
        this.peer.ontrack = null;
        this.peer.close?.();
      }
      if (this.remoteAudio) {
        this.remoteAudio.pause?.();
        this.remoteAudio.srcObject = null;
      }
      this.peer = null;
      this.localStream = null;
      this.remoteStream = null;
      this.muted = false;
      this.remoteMediaNotified = false;
    }
  }

  return {
    CALL_STATES, TERMINAL_STATES, WhatsAppCallClient, agentAvailability, callControls,
    canRequestCallPermission,
    callPermissionView, callUpdateUiStatus, eventUiStatus, formatDuration, friendlyCallError, normalizeAgentList,
    normalizeCallPermission, sessionFrom,
    retryMediaAction, shouldPlayOutboundRingback, waitForIceGathering, waitForPeerConnected
  };
}));
