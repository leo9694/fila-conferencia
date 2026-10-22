const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../frontend/chat-core');
const Pipeline = require('../frontend/chat-pipeline');
const source = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
const trecho = (inicio, fim) => source.slice(source.indexOf(inicio), source.indexOf(fim, source.indexOf(inicio)));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const conversa = (id, channel = 1, userId = null) => ({ id, channel: { id: channel }, assignment: userId ? { userId } : null,
  lastMessageAt: '2026-10-20T12:00:00Z', lastMessage: { text: `Chat ${id}` }, unreadCount: 1 });
const payload = (data, totalPages = 1) => ({ data, pagination: { total: data.length, totalPages } });

function ambienteLista(api) {
  const renders = [];
  const frames = [];
  const cache = new Map();
  const refs = { list: { scrollTop: 0, innerHTML: '', classList: { add() {}, remove() {} }, querySelector() { return null; } }, count: {}, more: {} };
  const ctx = vm.createContext({ Core, Pipeline, refs, URLSearchParams, AbortController, Map, Set, UI_CACHE_TTL: 600000,
    conversationListCache: cache, api, renderActiveFilters() {}, renderConversationSkeleton() {},
    isConversationHidden: () => false, migrateHiddenConversationIds() {}, syncUnreadConversation() {},
    renderUnreadAlert() {}, scheduleUiCachePersist() {}, escapeHtml: String, loadMoreConversationsIfNeeded() {},
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    scheduleConversationsRender() {}, conversationTimestamp: (item) => item.lastMessageAt || item.createdAt || item.updatedAt,
    renderConversations() { ctx.ensureConversationListScope(); renders.push(ctx.state.conversations.map((item) => item.id)); }
  });
  vm.runInContext(trecho('  const state = {', '  const CONVERSATION_CACHE_LIMIT'), ctx);
  vm.runInContext('globalThis.state = state;', ctx);
  Object.assign(ctx.state, { profile: { id: 7 }, selectedChannelId: '1' });
  vm.runInContext(trecho('  function assignedUser(', '  function ownsConversation('), ctx);
  vm.runInContext(trecho('  function matchesAssignment(', '  async function verificarAcesso('), ctx);
  vm.runInContext(trecho('  function conversationMatchesChannel(', '  function fillChannelSelects('), ctx);
  vm.runInContext(trecho('  function conversationListKey(', '  function persistUiCache('), ctx);
  vm.runInContext(trecho('  async function loadConversations(', '  function loadMoreConversationsIfNeeded('), ctx);
  vm.runInContext(trecho('  function upsertConversation(', '  function applyConversationUpdate('), ctx);
  return { ctx, refs, cache, renders, frames };
}

test('troca de número limpa a lista imediatamente e resposta atrasada não contamina o novo número', async () => {
  const requests = [];
  const env = ambienteLista((url, options) => { const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise; });
  const a = env.ctx.loadConversations();
  requests[0].resolve(payload([conversa(1)]));
  await a;
  const antiga = env.ctx.loadConversations();
  env.ctx.state.selectedChannelId = '2';
  const nova = env.ctx.loadConversations();
  assert.equal(env.renders.at(-1).length, 0);
  assert.equal(requests[1].options.signal.aborted, true);
  requests[2].resolve(payload([conversa(2, 2)]));
  await nova;
  requests[1].resolve(payload([conversa(3)]));
  await antiga;
  assert.deepEqual(Array.from(env.ctx.state.conversations, (item) => item.id), [2]);
  assert.equal(env.ctx.state.loading, false);
});

test('resposta e erro do filtro anterior não substituem o filtro selecionado', async () => {
  const requests = [];
  const env = ambienteLista(() => { const pending = deferred(); requests.push(pending); return pending.promise; });
  const antigo = env.ctx.loadConversations();
  env.ctx.state.assignment = 'UNASSIGNED';
  const novo = env.ctx.loadConversations();
  assert.equal(env.renders.at(-1).length, 0);
  requests[0].reject(new Error('Falha antiga'));
  await antigo;
  assert.equal(env.ctx.state.loading, true);
  assert.equal(env.refs.list.innerHTML, '');
  requests[1].resolve(payload([conversa(2), conversa(3, 1, 7)]));
  await novo;
  assert.deepEqual(Array.from(env.ctx.state.conversations, (item) => item.id), [2]);
});

test('atualização da lista paginada consulta página um e mantém páginas já carregadas embaixo', async () => {
  let url;
  const env = ambienteLista(async (path) => { url = path; return payload(Array.from({ length: 30 }, (_, i) => conversa(i + 1)), 5); });
  env.ctx.ensureConversationListScope();
  Object.assign(env.ctx.state, { listReady: true, page: 3, totalPages: 5,
    conversations: Array.from({ length: 90 }, (_, i) => conversa(i + 1)) });
  await env.ctx.loadConversations();
  assert.equal(new URLSearchParams(url.split('?')[1]).get('page'), '1');
  assert.equal(env.ctx.state.conversations[0].id, 1);
  assert.equal(env.ctx.state.conversations.at(-1).id, 90);
  assert.equal(env.ctx.state.page, 3);
});

test('eventos e cache respeitam número, atribuição, pipeline, status e busca ativos', async () => {
  const env = ambienteLista(async () => payload([]));
  env.ctx.ensureConversationListScope();
  env.ctx.state.listReady = true;
  env.ctx.upsertConversation(conversa(1, 2));
  assert.equal(env.ctx.state.conversations.length, 0);
  env.ctx.state.assignment = 'UNASSIGNED';
  await env.ctx.loadConversations();
  env.ctx.upsertConversation(conversa(2, 1, 7));
  assert.equal(env.ctx.state.conversations.length, 0);
  env.ctx.state.pipelineId = '10';
  await env.ctx.loadConversations();
  env.ctx.upsertConversation({ ...conversa(3), bitrix: { pipelines: [{ categoryId: 11 }] } });
  assert.equal(env.ctx.state.conversations.length, 0);
  env.ctx.state.pipelineId = '';
  env.ctx.state.status = 'OPEN';
  await env.ctx.loadConversations();
  env.ctx.upsertConversation({ ...conversa(4), status: 'CLOSED' });
  assert.equal(env.ctx.state.conversations.length, 0);
  env.ctx.state.status = '';
  env.ctx.state.search = 'Maria';
  await env.ctx.loadConversations();
  env.ctx.upsertConversation({ ...conversa(5), contact: { name: 'Outro cliente' } });
  assert.equal(env.ctx.state.conversations.length, 0);
});

test('cache de um filtro é atualizado antes de voltar a ele e não restaura atribuição antiga', async () => {
  const env = ambienteLista(async () => payload([conversa(1)]));
  env.ctx.state.assignment = 'UNASSIGNED';
  await env.ctx.loadConversations();
  env.ctx.state.assignment = 'ALL';
  await env.ctx.loadConversations();
  env.ctx.upsertConversation(conversa(1, 1, 7));
  env.ctx.state.assignment = 'UNASSIGNED';
  env.ctx.ensureConversationListScope();
  assert.equal(env.ctx.state.conversations.length, 0);
});

test('preserva acesso intencional a uma conversa transferida entre números em Meus atendimentos', async () => {
  const transferida = { ...conversa(1, 2, 7), crossChannelTransfer: true };
  const env = ambienteLista(async () => payload([transferida]));
  env.ctx.state.assignment = 'MINE';
  await env.ctx.loadConversations();
  assert.equal(env.ctx.state.conversations[0].id, 1);
});

test('cache persistido de outro número ou filtro não aparece ao reabrir o chat', () => {
  const env = ambienteLista(async () => payload([]));
  env.ctx.UI_CACHE_KEY = 'test';
  env.ctx.UI_CACHE_TTL = 10000;
  env.ctx.sessionStorage = { getItem: () => JSON.stringify({ savedAt: Date.now(), profileId: '7', listKey: 'outro-filtro', conversations: [conversa(1, 2)] }), removeItem() {} };
  vm.runInContext(trecho('  function restoreUiCache(', '  function cacheActiveConversation('), env.ctx);
  assert.equal(env.ctx.restoreUiCache(), false);
  assert.equal(env.ctx.state.conversations.length, 0);
});

test('enriquecimento atrasado não regride a última mensagem recebida em tempo real', () => {
  const atual = { ...conversa(1), lastMessageAt: '2026-10-22T10:00:00Z', lastMessage: { text: 'Nova' }, unreadCount: 2 };
  const antigo = { ...conversa(1), lastMessageAt: '2026-10-21T10:00:00Z', lastMessage: { text: 'Antiga' }, unreadCount: 0, cadastroSankhya: { verificado: true } };
  const [merged] = Core.mergeConversationList([atual], [antigo]);
  assert.equal(merged.lastMessage.text, 'Nova');
  assert.equal(merged.unreadCount, 2);
  assert.equal(merged.cadastroSankhya.verificado, true);
  const [lida] = Core.mergeConversationList([atual], [{ id: 1, unreadCount: 0 }]);
  assert.equal(lida.unreadCount, 0);
});

test('rolagem preserva mensagem visível ao anexar ou inserir histórico e não duplica ancoragem do navegador', () => {
  let offset = 20;
  let height = 1000;
  const node = { getAttribute: () => 'm1', getBoundingClientRect: () => ({ top: offset, bottom: offset + 40 }) };
  const messages = { scrollTop: 300, get scrollHeight() { return height; }, getBoundingClientRect: () => ({ top: 0 }), querySelectorAll: () => [node] };
  const ctx = vm.createContext({ refs: { messages }, nearBottom: () => false, scrollBottom: () => assert.fail('Leitor fora do fim não pode ser puxado para baixo') });
  vm.runInContext(trecho('  function captureMessageViewport(', '  function renderMessages('), ctx);
  const snapshot = ctx.captureMessageViewport();
  height += 100;
  ctx.restoreMessageViewport(snapshot);
  assert.equal(messages.scrollTop, 300);
  offset += 200;
  ctx.restoreMessageViewport(snapshot, { prepend: true });
  assert.equal(messages.scrollTop, 500);
  offset = 20;
  ctx.restoreMessageViewport(snapshot, { prepend: true });
  assert.equal(messages.scrollTop, 500);
});

test('erro de histórico de outra conversa não escreve feedback nem altera o carregamento atual', async () => {
  const pending = deferred();
  const state = { conversationId: '1', activeLoadToken: 1, messagePage: 1, messageTotalPages: 3, loadingOlder: false };
  const ctx = vm.createContext({ state, MESSAGE_PAGE_SIZE: 20, api: () => pending.promise,
    refs: { messages: { classList: { add() {}, remove() { assert.fail('Não pertence mais ao chat'); } } } },
    setFeedback: () => assert.fail('Erro antigo não pode aparecer no chat selecionado'), requestAnimationFrame() {} });
  vm.runInContext(trecho('  async function loadOlderMessages(', '  async function markRead('), ctx);
  const loading = ctx.loadOlderMessages();
  state.conversationId = '2';
  state.activeLoadToken += 1;
  pending.reject(new Error('Falha antiga'));
  await loading;
});

test('abrir A e depois B nunca aplica mensagens nem cabeçalho de A em B', async () => {
  const requests = new Map();
  const frames = [];
  const state = { conversationId: null, conversation: null, messages: [], calls: [], conversations: [],
    conversationCache: new Map(), activeLoadToken: 0, activeRefreshToken: 0, callsRefreshToken: 0, sendToken: 0 };
  const ctx = vm.createContext({ state, Core, MESSAGE_PAGE_SIZE: 20, clearTimeout() {},
    setFeedback() {}, cacheActiveConversation() {}, cancelScheduledMessagesRender() {}, clearReply() {},
    renderConversations() {}, renderConversationDetails() {}, renderMessages() {}, refreshActiveCalls() {},
    ownsConversation: () => false, updateConversationHistory() {}, fillMessageViewport() {}, escapeHtml: String,
    requestAnimationFrame(fn) { frames.push(fn); },
    refs: { messages: { innerHTML: '', classList: { remove() {} } }, workspace: { classList: { add() {} } }, empty: {}, active: {} },
    api: (url) => { const pending = deferred(); requests.set(url, pending); return pending.promise; }
  });
  vm.runInContext(trecho('  async function openConversation(', '  function fillMessageViewport('), ctx);
  const a = ctx.openConversation('A');
  const b = ctx.openConversation('B');
  requests.get('/conversations/B').resolve({ id: 'B', contact: { name: 'B' } });
  requests.get('/conversations/B/messages?page=1&limit=20').resolve(payload([{ id: 'b1', text: 'B' }]));
  await b;
  requests.get('/conversations/A').resolve({ id: 'A', contact: { name: 'A' } });
  requests.get('/conversations/A/messages?page=1&limit=20').resolve(payload([{ id: 'a1', text: 'A' }]));
  await a;
  assert.equal(state.conversation.id, 'B');
  assert.equal(state.messages[0].id, 'b1');
  assert.equal(state.openingConversation, false);
});
