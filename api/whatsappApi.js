const { EventEmitter } = require('events');
const { Readable } = require('stream');

const DEFAULT_API_URL = 'https://whatsapp-api.nortesulsementes.com';
const SOCKET_EVENTS = [
  'conversation:new',
  'conversation:updated',
  'message:new',
  'message:status',
  'conversation:read',
  'conversation:status',
  'conversation:assignment',
  'conversation:deleted',
  'call:incoming',
  'call:ringing',
  'call:connecting',
  'call:active',
  'call:rejected',
  'call:ended',
  'call:failed',
  'call:updated',
  'call:signal'
];

function baseUrl() {
  return String(process.env.WHATSAPP_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, '');
}

function apiKey() {
  return String(process.env.WHATSAPP_INTERNAL_API_KEY || '').trim();
}

function headers(extra = {}) {
  const result = { Accept: 'application/json', ...extra };
  const key = apiKey();
  if (key) result['X-API-Key'] = key;
  return result;
}

async function parseResponse(response) {
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = payload?.error?.message || payload?.erro || payload?.message
      || 'Não foi possível comunicar com o atendimento.';
    const error = new Error(message);
    error.status = response.status;
    error.integrationCode = payload?.error?.code || '';
    throw error;
  }
  return payload;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: headers(options.headers),
    signal: options.signal || AbortSignal.timeout(30000)
  });
  return parseResponse(response);
}

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function json(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

async function getConversations(params) {
  return request(`/api/conversations${queryString(params)}`);
}

async function getConversation(id) {
  return request(`/api/conversations/${encodeURIComponent(id)}`);
}

async function createConversation(payload) {
  const response = await request('/api/conversations', json('POST', payload));
  // A API de atendimento usa o envelope { success, data } nas criações,
  // enquanto os endpoints de consulta retornam o recurso diretamente.
  // Normalize aqui para os consumidores sempre receberem { conversation, ... }.
  return response?.data?.conversation ? response.data : response;
}

async function getMessages(id, params) {
  return request(`/api/conversations/${encodeURIComponent(id)}/messages${queryString(params)}`);
}

async function sendTextMessage(id, text, replyToMessageId = '') {
  return request(`/api/conversations/${encodeURIComponent(id)}/messages`, json('POST', {
    text,
    ...(replyToMessageId ? { replyToMessageId } : {})
  }));
}

async function sendReaction(id, messageId, emoji) {
  return request(`/api/conversations/${encodeURIComponent(id)}/messages/reaction`, json('POST', {
    messageId: String(messageId || '').trim(),
    emoji: String(emoji || '').trim()
  }));
}

async function markConversationRead(id) {
  return request(`/api/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', headers: {} });
}

async function updateConversationStatus(id, status) {
  return request(`/api/conversations/${encodeURIComponent(id)}/status`, json('PATCH', { status }));
}

async function updateAssignment(id, payload) {
  return request(`/api/conversations/${encodeURIComponent(id)}/assignment`, json('POST', payload));
}

async function getCalls(params) {
  return request(`/api/calls${queryString(params)}`);
}

async function getConversationCalls(id, params) {
  return request(`/api/conversations/${encodeURIComponent(id)}/calls${queryString(params)}`);
}

async function getCallPermission(id, params) {
  return request(`/api/conversations/${encodeURIComponent(id)}/calls/permission${queryString(params)}`);
}

async function requestCallPermission(id, payload) {
  return request(`/api/conversations/${encodeURIComponent(id)}/calls/permission`, json('POST', payload));
}

async function createCall(id, payload) {
  return request(`/api/conversations/${encodeURIComponent(id)}/calls`, json('POST', payload));
}

async function updateCall(callId, action, payload) {
  return request(`/api/calls/${encodeURIComponent(callId)}/${encodeURIComponent(action)}`, json('POST', payload));
}

async function deleteConversation(id) {
  try {
    return await request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', headers: {} });
  } catch (error) {
    if (error.status === 404) {
      const unavailable = new Error('A API de atendimento ainda não está atualizada para excluir chats. Atualize o serviço de atendimento e tente novamente.');
      unavailable.status = error.status;
      throw unavailable;
    }
    throw error;
  }
}

async function getTemplates(params) {
  return request(`/api/templates${queryString(params)}`);
}

async function getTemplate(name, language) {
  return request(`/api/templates/${encodeURIComponent(name)}${queryString({ language })}`);
}

async function previewTemplate(payload) {
  return request('/api/templates/preview', json('POST', payload));
}

async function sendTemplate(id, payload) {
  return request(`/api/conversations/${encodeURIComponent(id)}/messages/template`, json('POST', payload));
}

function uploadMime(kind, file = {}) {
  const declared = String(file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream') return declared;
  if (kind !== 'audio') return declared || 'application/octet-stream';
  const extension = String(file.originalname || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ({ ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', amr: 'audio/amr' })[extension]
    || 'audio/webm';
}

async function sendMedia(id, kind, file, fields = {}) {
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: uploadMime(kind, file) }), file.originalname);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  });
  return request(`/api/conversations/${encodeURIComponent(id)}/messages/${kind}`, {
    method: 'POST',
    body: form
  });
}

async function getMedia(mediaId) {
  const response = await fetch(`${baseUrl()}/api/media/${encodeURIComponent(mediaId)}`, {
    headers: headers({ Accept: '*/*' })
  });
  if (!response.ok) await parseResponse(response);
  return {
    body: response.body ? Readable.fromWeb(response.body) : null,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    contentLength: response.headers.get('content-length')
  };
}

function createRealtimeBridge({ ioFactory } = {}) {
  const emitter = new EventEmitter();
  let socket = null;
  let state = 'idle';

  function emitState(next, detail = '') {
    state = next;
    emitter.emit('connection', { state, detail });
  }

  function connect() {
    if (socket || emitter.listenerCount('event') === 0) return;
    let io = ioFactory;
    if (!io) ({ io } = require('socket.io-client'));
    socket = io(baseUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: { apiKey: apiKey() },
      timeout: 15000
    });
    emitState('connecting');
    socket.on('connect', () => emitState('connected'));
    socket.on('disconnect', (reason) => emitState('disconnected', reason));
    socket.on('connect_error', (error) => emitState('reconnecting', error?.message || ''));
    SOCKET_EVENTS.forEach((event) => {
      socket.on(event, (payload) => emitter.emit('event', { event, payload }));
    });
  }

  function subscribe(listener, connectionListener) {
    emitter.on('event', listener);
    if (connectionListener) {
      emitter.on('connection', connectionListener);
      connectionListener({ state });
    }
    connect();
    return () => {
      emitter.off('event', listener);
      if (connectionListener) emitter.off('connection', connectionListener);
      if (emitter.listenerCount('event') === 0 && socket) {
        socket.disconnect();
        socket = null;
        state = 'idle';
      }
    };
  }

  return { subscribe, events: SOCKET_EVENTS };
}

module.exports = {
  createRealtimeBridge,
  createCall,
  createConversation,
  deleteConversation,
  getConversation,
  getConversationCalls,
  getConversations,
  getCallPermission,
  getCalls,
  getMedia,
  getMessages,
  getTemplate,
  getTemplates,
  markConversationRead,
  previewTemplate,
  requestCallPermission,
  sendMedia,
  sendReaction,
  sendTemplate,
  sendTextMessage,
  updateAssignment,
  updateCall,
  updateConversationStatus,
  _internals: { baseUrl, queryString, uploadMime }
};
