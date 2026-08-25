(function exposeWhatsAppCallCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WhatsAppCallCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createWhatsAppCallCore() {
  'use strict';

  const TERMINAL_STATES = new Set(['REJECTED', 'MISSED', 'BUSY', 'FAILED', 'ENDED']);

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

  function eventUiStatus(event, currentStatus, hasClient) {
    if (!['call:ringing', 'call:connecting'].includes(event)) return null;
    if (currentStatus === 'RINGING' && !hasClient) return 'RINGING';
    return 'CONNECTING';
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

    async acceptIncoming({ callId, conversationId, offer }) {
      try {
        await this.api.claim(callId, { conversationId });
        await this.preparePeer();
        await this.captureMicrophone();
        await this.peer.setRemoteDescription({ type: offer.sdpType || offer.type || 'offer', sdp: offer.sdp });
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        await waitForIceGathering(this.peer);
        const session = sessionFrom(this.peer.localDescription);
        const payload = { conversationId, session };
        await this.api.preAccept(callId, payload);
        await this.api.accept(callId, payload);
        return session;
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
        return this.api.create(conversationId, { session: sessionFrom(this.peer.localDescription) });
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

  return { TERMINAL_STATES, WhatsAppCallClient, eventUiStatus, formatDuration, sessionFrom, waitForIceGathering };
}));
