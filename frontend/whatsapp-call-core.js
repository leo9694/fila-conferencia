(function exposeWhatsAppCallCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WhatsAppCallCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createWhatsAppCallCore() {
  'use strict';

  const CALL_STATES = Object.freeze({
    IDLE: 'IDLE',
    RINGING: 'RINGING',
    CONNECTING: 'CONNECTING',
    ACTIVE: 'ACTIVE',
    TRANSFER_PENDING: 'TRANSFER_PENDING',
    TRANSFER_CONNECTING: 'TRANSFER_CONNECTING',
    ENDING: 'ENDING',
    ENDED: 'ENDED'
  });
  const TERMINAL_STATES = new Set(['REJECTED', 'MISSED', 'BUSY', 'FAILED', 'ENDED']);

  function callControls(status) {
    const hasMedia = ['CONNECTING', 'ACTIVE', 'TRANSFER_PENDING', 'TRANSFER_CONNECTING'].includes(status);
    return {
      accept: status === 'RINGING',
      reject: status === 'RINGING',
      mute: hasMedia,
      end: ['CONNECTING', 'ACTIVE', 'TRANSFER_PENDING'].includes(status),
      transfer: ['ACTIVE', 'TRANSFER_PENDING'].includes(status)
    };
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
    constructor({ api, mediaDevices, PeerConnection, remoteAudio, rtcConfig = {} } = {}) {
      this.api = api;
      this.mediaDevices = mediaDevices;
      this.PeerConnection = PeerConnection;
      this.remoteAudio = remoteAudio || null;
      this.rtcConfig = rtcConfig;
      this.peer = null;
      this.localStream = null;
      this.remoteStream = null;
      this.muted = false;
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
    }
  }

  return {
    CALL_STATES, TERMINAL_STATES, WhatsAppCallClient, agentAvailability, callControls,
    eventUiStatus, formatDuration, normalizeAgentList, sessionFrom,
    retryMediaAction, waitForIceGathering, waitForPeerConnected
  };
}));
