const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Core = require('../frontend/chat-core');
const { criarProcessadorCompartilhado } = require('../api/eventosCompartilhados');

test('status em lote e sem conversa usa a mensagem conhecida e preserva o canal de autorização', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');
  const cacheConversaCanonica = new Map([[12, { id: 12, channel: { id: 'mt' } }], [13, { id: 13, channel: { id: 'ms' } }]]);
  let consultas = 0;
  const contexto = vm.createContext({
    cacheConversaCanonica, criarProcessadorCompartilhado,
    grupoConversa: (id) => ({ ids: [id], canonicalId: id }),
    whatsappApi: { getConversation: async (id) => { consultas++; return { id, channel: { id: 'novo' } }; } },
    chaveCanalTelefoneConversa: () => null, conversaCanonicaPorTelefone: new Map(),
    consolidarConversas: (items) => { items.forEach((item) => cacheConversaCanonica.set(item.id, item)); return items; },
    comAtribuicao: (item) => item, vincularCadastrosSankhyaDoCache: (items) => items
  });
  vm.runInContext(fonte.slice(fonte.indexOf('const conversaPorMensagem'), fonte.indexOf('async function contatosDoParceiro')), contexto);
  vm.runInContext(fonte.slice(fonte.indexOf('const processarEventoTempoReal'), fonte.indexOf("router.get('/events'")), contexto);
  vm.runInContext("registrarConversaDasMensagens([{ id: 1, wamid: 'wamid.1' }], 12);", contexto);
  contexto.payload = { statuses: [{ messageId: 'wamid.1', status: 'READ' }, { conversationId: 13, messageId: 2, status: 'DELIVERED' }, { messageId: 'desconhecida', status: 'READ' }] };
  const result = await vm.runInContext("processarEventoTempoReal('message:status', payload)", contexto);
  assert.equal(result[0].conversationId, 12);
  assert.equal(result[0].statusUpdate.status, 'READ');
  assert.equal(result[0].conversation.channel.id, 'mt');
  assert.equal(result[1].conversation.channel.id, 'ms');
  assert.equal(result[2], null);
  assert.equal(consultas, 0);
  contexto.payload = { statusUpdate: { conversationId: 14, messageId: 3, status: 'READ' } };
  const unknown = await vm.runInContext("processarEventoTempoReal('message:status', payload)", contexto);
  assert.equal(unknown[0].conversation.channel.id, 'novo');
  assert.equal(consultas, 1);
});

test('status repetido não redesenha nem consulta e atualiza também mensagens no cache', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
  const cached = { messages: [{ id: 1, status: 'SENT' }] };
  const state = { conversationId: '12', messages: [{ id: 1, status: 'SENT' }], conversationCache: new Map([['12', cached]]) };
  let renders = 0;
  const contexto = vm.createContext({ state, Core,
    scheduleMessagesRender() { renders++; },
    updateCachedConversationMessages(id, updater) { cached.messages = updater(cached.messages); },
    refreshActiveConversation() { assert.fail('Status não deve consultar a conversa'); }
  });
  vm.runInContext(fonte.slice(fonte.indexOf('  function handleRealtime('), fonte.indexOf('  function connectRealtime(')), contexto);
  vm.runInContext("handleRealtime('message:status', { conversationId: 12, statusUpdate: { messageId: 1, status: 'READ' } });", contexto);
  assert.equal(state.messages[0].status, 'READ');
  assert.equal(cached.messages[0].status, 'READ');
  assert.equal(renders, 1);
  vm.runInContext("handleRealtime('message:status', { conversationId: 12, statusUpdate: { messageId: 1, status: 'READ' } });", contexto);
  assert.equal(renders, 1);
});
