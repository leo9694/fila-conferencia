const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WhatsAppCallClient, agentAvailability, callControls, callPermissionView, callUpdateUiStatus, eventUiStatus,
  formatDuration, friendlyCallError, normalizeAgentList, normalizeCallPermission,
  shouldPlayOutboundRingback
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

test('traduz atualizações genéricas da API para os estados visuais da chamada', () => {
  assert.equal(callUpdateUiStatus('ringing'), 'RINGING');
  assert.equal(callUpdateUiStatus('connecting'), 'CONNECTING');
  assert.equal(callUpdateUiStatus('active'), 'ACTIVE');
  assert.equal(callUpdateUiStatus('answered'), 'ACTIVE');
  assert.equal(callUpdateUiStatus('connected'), 'ACTIVE');
  assert.equal(callUpdateUiStatus('in_progress'), 'ACTIVE');
  assert.equal(callUpdateUiStatus('unknown'), null);
});

test('notifica uma única vez quando a mídia remota é liberada', async () => {
  let onUnmute;
  let notifications = 0;
  const client = new WhatsAppCallClient({
    api: {},
    PeerConnection: PeerMock,
    onRemoteMedia: () => { notifications += 1; },
    remoteAudio: { play: async () => {}, pause() {}, set srcObject(value) { this.value = value; } }
  });
  await client.preparePeer();
  client.peer.ontrack({
    streams: [{ getTracks: () => [] }],
    track: { addEventListener: (event, listener) => { if (event === 'unmute') onUnmute = listener; } }
  });
  onUnmute();
  onUnmute();
  assert.equal(notifications, 1);
});

test('mantém mídia e cancelamento disponíveis durante uma transferência pendente', () => {
  assert.deepEqual(callControls('TRANSFER_PENDING'), {
    accept: false, reject: false, mute: true, end: true, transfer: true
  });
  assert.deepEqual(callControls('TRANSFER_CONNECTING'), {
    accept: false, reject: false, mute: true, end: false, transfer: false
  });
});

test('representa os estados reais da permissão sem iniciar chamada automaticamente', () => {
  assert.deepEqual(callPermissionView({ status: 'UNKNOWN' }), {
    action: 'REQUEST', label: 'Solicitar permissão de ligação',
    message: 'Solicite autorização do cliente antes de ligar.', disabled: false
  });
  assert.deepEqual(callPermissionView({ status: 'PENDING' }), {
    action: 'NONE', label: 'Permissão solicitada',
    message: 'Solicitação enviada. Aguardando autorização do cliente...', disabled: true
  });
  assert.deepEqual(callPermissionView({ status: 'GRANTED', canCall: true }), {
    action: 'CALL', label: 'Ligar', message: '✓ Cliente autorizou ligações', disabled: false
  });
});

test('permite nova solicitação negada ou expirada somente quando a API autoriza', () => {
  const allowed = [{ action_name: 'send_call_permission_request', can_perform_action: true }];
  assert.equal(callPermissionView({ status: 'DENIED', actions: allowed }).action, 'REQUEST');
  assert.equal(callPermissionView({ status: 'EXPIRED', actions: allowed }).action, 'REQUEST');
  assert.deepEqual(callPermissionView({ status: 'DENIED', actions: [] }), {
    action: 'NONE', label: 'Nova solicitação indisponível',
    message: 'Cliente não autorizou ligações.', disabled: true
  });
});

test('usa canCall da API como única fonte para habilitar a ligação', () => {
  assert.equal(normalizeCallPermission({ status: 'GRANTED', canStart: true }).canCall, false);
  assert.equal(callPermissionView({ status: 'GRANTED', canStart: true }).action, 'NONE');
});

test('traduz erros reais do fluxo outbound', () => {
  assert.equal(friendlyCallError({ code: 'CALL_PERMISSION_REQUIRED' }), 'Solicite a permissão do cliente antes de ligar.');
  assert.equal(friendlyCallError({ code: 'CALL_PERMISSION_EXPIRED' }), 'A permissão de ligação expirou. Solicite novamente.');
  assert.equal(friendlyCallError({ code: 'CALL_ALREADY_ACTIVE' }), 'Já existe uma chamada ativa para esta conversa.');
  assert.equal(friendlyCallError({ code: 'AGENT_BUSY' }), 'Você já está em outra chamada.');
  assert.equal(friendlyCallError({ code: 'META_CALL_FAILED' }), 'A Meta não conseguiu iniciar a ligação. Tente novamente.');
});

test('mantém encerramento disponível enquanto a chamada outbound toca', () => {
  assert.deepEqual(callControls('RINGING', { direction: 'OUTBOUND' }), {
    accept: false, reject: false, mute: false, end: true, transfer: false
  });
});

test('toca o retorno sonoro somente enquanto a chamada outbound chama', () => {
  assert.equal(shouldPlayOutboundRingback('INITIATING', 'OUTBOUND'), true);
  assert.equal(shouldPlayOutboundRingback('RINGING', 'OUTBOUND'), true);
  assert.equal(shouldPlayOutboundRingback('CONNECTING', 'OUTBOUND'), false);
  assert.equal(shouldPlayOutboundRingback('ACTIVE', 'OUTBOUND'), false);
  assert.equal(shouldPlayOutboundRingback('RINGING', 'INBOUND'), false);
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
