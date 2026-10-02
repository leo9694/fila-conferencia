const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../frontend/chat-core');

const source = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
const functions = source.slice(source.indexOf('  async function startChatFromSharedContact('), source.indexOf('  async function deleteConversation('));

function setup(overrides = {}) {
  const events = [];
  const context = {
    Core, URLSearchParams,
    state: { conversations: [], conversation: { channelId: 2 }, selectedChannelId: '2' },
    refs: { manualContactName: {}, manualContactPhone: {}, newChannel: {} },
    conversationChannelId: (item) => String(item.channel?.id ?? item.channelId ?? ''),
    api: async (url) => { events.push(['api', url]); return { data: [] }; },
    openNewContact: () => events.push(['new']),
    setManualContact: (enabled) => events.push(['manual', enabled]),
    updateNewContactSubmit: () => events.push(['submit']),
    restoreConversationLocally: (item) => events.push(['restore', item.id]),
    openConversation: async (id) => events.push(['open', id]),
    assignedUser: () => null,
    claimConversation: async (id) => events.push(['claim', id]),
    ownsConversation: () => false,
    openTemplates: () => events.push(['templates']),
    setFeedback: (message) => events.push(['error', message]),
    ...overrides
  };
  vm.createContext(context);
  vm.runInContext(functions, context);
  const button = { disabled: false, dataset: { contactPhone: '5566999990000', contactName: 'Maria' } };
  return { context, events, button };
}

test('preenche contato avulso compartilhado no canal de origem sem exigir cadastro Sankhya', async () => {
  const { context, events, button } = setup();
  await context.startChatFromSharedContact(button);
  assert.equal(context.refs.manualContactName.value, 'Maria');
  assert.equal(context.refs.manualContactPhone.value, button.dataset.contactPhone);
  assert.equal(context.refs.newChannel.value, '2');
  assert.ok(events.some(([event]) => event === 'new'));
  assert.ok(events.some(([event, value]) => event === 'manual' && value === true));
  assert.ok(events[0][1].includes('channelId=2'));
  assert.equal(button.disabled, false);
});

test('reabre conversa existente do mesmo canal sem criar outro contato', async () => {
  const { context, events, button } = setup();
  context.state.conversations = [{ id: 42, channelId: 2, contact: { phone: button.dataset.contactPhone } }];
  await context.startChatFromSharedContact(button);
  assert.deepEqual(events, [['restore', 42], ['open', 42], ['claim', 42]]);
});

test('não abre conversa do outro número de atendimento para o mesmo telefone', async () => {
  const { context, events, button } = setup();
  context.state.conversations = [{ id: 42, channelId: 1, contact: { phone: button.dataset.contactPhone } }];
  await context.startChatFromSharedContact(button);
  assert.ok(events.some(([event]) => event === 'new'));
  assert.ok(!events.some(([event]) => event === 'open'));
});

test('mostra falha da busca e libera o botão para tentar novamente', async () => {
  const { context, events, button } = setup({ api: async () => { throw new Error('Serviço indisponível'); } });
  await context.startChatFromSharedContact(button);
  assert.deepEqual(events, [['error', 'Serviço indisponível']]);
  assert.equal(button.disabled, false);
});

test('ignora clique repetido enquanto busca o contato compartilhado', async () => {
  const { context, events, button } = setup();
  button.disabled = true;
  await context.startChatFromSharedContact(button);
  assert.equal(events.length, 0);
});
