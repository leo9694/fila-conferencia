const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WhatsAppCallClient, agentAvailability, callControls, eventUiStatus, formatDuration, normalizeAgentList
} = require('../frontend/whatsapp-call-core');

class PeerMock {
  constructor() {
    this.iceGatheringState = 'complete';
    this.connectionState = 'connected';
    this.tracks = [];
  }
  addTrack(track) { this.tracks.push(track); }
  async setRemoteDescription(value) { this.remoteDescription = value; }
  async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
  async createOffer() { return { type: 'offer', sdp: 'offer-sdp' }; }
  async setLocalDescription(value) { this.localDescription = value; }
  close() { this.closed = true; }
}

function fixture() {
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const calls = [];
  const api = {
    claim: async (...args) => calls.push(['claim', ...args]),
    joinMedia: async (...args) => { calls.push(['joinMedia', ...args]); return { session: { sdpType: 'answer', sdp: 'gateway-answer' } }; },
    mediaReady: async (...args) => calls.push(['mediaReady', ...args]),
    createOutboundMedia: async (...args) => {
      calls.push(['createOutboundMedia', ...args]);
      return { mediaSessionId: 'media-1', session: { sdpType: 'answer', sdp: 'gateway-answer' } };
    },
    create: async (...args) => { calls.push(['create', ...args]); return { id: 'call-2' }; }
  };
  let microphoneRequests = 0;
  const client = new WhatsAppCallClient({
    api,
    PeerConnection: PeerMock,
    mediaDevices: { getUserMedia: async () => { microphoneRequests += 1; return stream; } },
    remoteAudio: { pause() {}, set srcObject(value) { this.value = value; } }
  });
  return { api, calls, client, stream, track, microphoneRequests: () => microphoneRequests };
}

test('solicita microfone somente ao aceitar e conecta pelo gateway antes de ativar', async () => {
  const item = fixture();
  assert.equal(item.microphoneRequests(), 0);
  await item.client.acceptIncoming({ callId: 'call-1', conversationId: 12 });
  assert.equal(item.microphoneRequests(), 1);
  assert.deepEqual(item.calls.map(([name]) => name), ['claim', 'joinMedia', 'mediaReady']);
  assert.equal(item.calls[1][2].session.sdpType, 'offer');
  assert.equal(item.client.peer.remoteDescription.sdp, 'gateway-answer');
});

test('mute desabilita somente a faixa local e cleanup encerra mídia e peer', async () => {
  const item = fixture();
  await item.client.startOutgoing({ conversationId: 12 });
  assert.deepEqual(item.calls.map(([name]) => name), ['createOutboundMedia', 'create']);
  assert.equal(item.calls[1][2].mediaSessionId, 'media-1');
  assert.equal(item.client.toggleMute(true), true);
  assert.equal(item.track.enabled, false);
  const peer = item.client.peer;
  item.client.cleanup();
  assert.equal(item.track.stopped, true);
  assert.equal(peer.closed, true);
  assert.equal(item.client.peer, null);
});

test('formata duração curta e com horas', () => {
  assert.equal(formatDuration(88), '01:28');
  assert.equal(formatDuration(3661), '01:01:01');
});

test('mantém botões de atender e recusar durante eventos de chamada recebida', () => {
  assert.equal(eventUiStatus('call:ringing', 'RINGING', false), 'RINGING');
  assert.equal(eventUiStatus('call:connecting', 'RINGING', false), 'RINGING');
  assert.equal(eventUiStatus('call:ringing', 'CONNECTING', true), 'CONNECTING');
  assert.equal(eventUiStatus('call:active', 'RINGING', false), null);
});

test('mantém mídia e cancelamento disponíveis durante uma transferência pendente', () => {
  assert.deepEqual(callControls('TRANSFER_PENDING'), {
    accept: false, reject: false, mute: true, end: true, transfer: true
  });
  assert.deepEqual(callControls('TRANSFER_CONNECTING'), {
    accept: false, reject: false, mute: true, end: false, transfer: false
  });
});

test('normaliza disponibilidade sem oferecer atendentes ocupados ou offline', () => {
  assert.deepEqual(agentAvailability({ availability: 'AVAILABLE' }), {
    code: 'AVAILABLE', label: 'disponível', available: true
  });
  assert.equal(agentAvailability({ status: 'BUSY' }).available, false);
  assert.equal(agentAvailability({ online: false, status: 'AVAILABLE' }).code, 'OFFLINE');
});

test('normaliza os envelopes aceitos pela listagem de atendentes', () => {
  const agents = [{ id: 72 }];
  assert.equal(normalizeAgentList(agents), agents);
  assert.equal(normalizeAgentList({ data: agents }), agents);
  assert.equal(normalizeAgentList({ agents }), agents);
  assert.equal(normalizeAgentList({ data: { agents } }), agents);
  assert.equal(normalizeAgentList({ data: { items: agents } }), agents);
});

test('prepara microfone antes de reivindicar uma chamada e reaproveita a mídia', async () => {
  const item = fixture();
  const order = [];
  item.client.mediaDevices.getUserMedia = async () => {
    order.push('microphone');
    return item.stream;
  };
  item.api.claim = async (...args) => {
    order.push('claim');
    item.calls.push(['claim', ...args]);
  };
  await item.client.acceptIncoming({ callId: 'call-1', conversationId: 12 });
  assert.deepEqual(order, ['microphone', 'claim']);
  assert.equal(item.client.peer.tracks.length, 1);
});

test('propaga transferId ao conectar mídia e confirmar media-ready', async () => {
  const item = fixture();
  await item.client.prepareLocalMedia();
  await item.client.connectGateway({ callId: 'call-1', transferId: 'transfer-1' });
  assert.equal(item.calls[0][2].transferId, 'transfer-1');
  assert.deepEqual(item.calls[1][2], { transferId: 'transfer-1' });
  assert.equal(item.microphoneRequests(), 1);
});
