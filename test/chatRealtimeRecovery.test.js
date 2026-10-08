const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../frontend/chat-core');

function ambiente(api) {
  const source = { handlers: {}, addEventListener(event, callback) { this.handlers[event] = callback; } };
  const state = { conversationId: '12', activeLoadToken: 1, messages: [{ id: 1, text: 'Anterior' }] };
  let renderizacoes = 0;
  const contexto = vm.createContext({ window: { chatRealtime: { subscribe: () => source } }, state, Core, api,
    MESSAGE_PAGE_SIZE: 2, handleRealtime() {}, updateRealtime() {}, loadConversations: async () => {},
    loadUnreadSummary: async () => {}, cacheActiveConversation() {}, scheduleMessagesRender() { renderizacoes++; },
    refreshActiveConversation: async () => {}, console });
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
  const inicio = fonte.indexOf('  function connectRealtime()');
  const fim = fonte.indexOf('  async function loadAgents()', inicio);
  vm.runInContext(`${fonte.slice(inicio, fim)}; connectRealtime();`, contexto);
  return { source, state, renders: () => renderizacoes };
}

test('após reconectar recupera todas as páginas perdidas sem duplicar mensagens ou apagar histórico', async () => {
  const paginas = [];
  const { source, state, renders } = ambiente(async (url) => {
    const pagina = Number(new URL(url, 'http://teste').searchParams.get('page'));
    paginas.push(pagina);
    return { data: { 1: [{ id: 5 }, { id: 4 }], 2: [{ id: 3 }, { id: 2 }], 3: [{ id: 1 }] }[pagina], pagination: { totalPages: 3 } };
  });
  source.handlers.connection({ data: '{"state":"connected"}' });
  assert.equal(paginas.length, 0);
  source.onerror();
  // Mensagem nova chegando pelo SSE antes da recuperação não pode encurtar o intervalo perdido.
  state.messages.push({ id: 5 });
  source.handlers.open();
  source.handlers.connection({ data: '{"state":"connected"}' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(paginas, [1, 2, 3]);
  assert.equal(state.messages.length, 5);
  assert.equal(new Set(state.messages.map((message) => message.id)).size, 5);
  assert.equal(renders(), 1);
});

test('recuperação atrasada não insere mensagens quando o usuário troca de conversa', async () => {
  let liberar;
  const { source, state, renders } = ambiente(() => new Promise((resolve) => { liberar = resolve; }));
  source.handlers.connection({ data: '{"state":"disconnected"}' });
  source.handlers.connection({ data: '{"state":"connected"}' });
  await new Promise((resolve) => setImmediate(resolve));
  state.conversationId = '99';
  state.activeLoadToken++;
  liberar({ data: [{ id: 8 }], pagination: { totalPages: 1 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.messages.length, 1);
  assert.equal(renders(), 0);
});
