const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');

test('pesquisa de mensagens retorna oito candidatos por página sem baixar o histórico e respeita acesso local', async () => {
  let handler;
  let chamadas = 0;
  const ctx = vm.createContext({ router: { get(_url, fn) { handler = fn; } }, asyncRoute: (fn) => fn,
    idPipelineBitrix: () => null,
    whatsappApi: { getConversations: async (args) => {
      chamadas += 1;
      assert.equal(args.messageSearch, 'entrega');
      assert.equal(args.limit, 8);
      assert.equal(args.page, 2);
      assert.equal(args.channelId, '6');
      return { data: [{ id: 1, matchedMessage: { text: 'entrega' } }, { id: 2, matchedMessage: { text: 'entrega' } }], pagination: { totalPages: 5 } };
    } },
    comAtribuicao: (c) => c, vincularCadastrosSankhyaDoCache: (c) => c,
    atendentePodeAcessarConversa: (_a, c) => c.id === 1, conversaOcultaParaUsuario: () => false,
    conversaCorrespondeFiltroAtendente: () => true, comAcessoAtendente: (c) => c });
  vm.runInContext(source.slice(source.indexOf("router.get('/conversations',"), source.indexOf("router.get('/channels',")), ctx);
  const res = { json(value) { this.value = value; } };
  await handler({ query: { messageSearch: 'entrega', page: '2', channelId: '6' }, usuario: { codUsu: 72 }, atendente: { id: 72 } }, res);
  assert.equal(chamadas, 1);
  assert.equal(res.value.data.length, 1);
  assert.equal(res.value.pagination.limit, 8);
  assert.equal(res.value.pagination.totalPages, 5);
});

test('pesquisa exige ação explícita e mantém a chave de cache e ordenação separadas', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
  assert.match(frontend, /messageSearchButton\?\.addEventListener\('click', buscarMensagem\)/);
  assert.match(frontend, /state.messageSearch \? 8 : 30/);
  assert.match(frontend, /new Date\(b.matchedMessage\?\.messageTimestamp/);
  assert.match(frontend, /state.pipelineScope, state.messageSearch\]/);
});

test('botão de pesquisar mensagem não herda a largura fixa dos botões de ícone', () => {
  const css = fs.readFileSync(path.join(__dirname, '../frontend/chat.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
  const regra = css.match(/#chat-message-search-button\s*\{([^}]+)\}/)?.[1];
  assert.ok(regra);
  assert.match(regra, /width:\s*auto\s*;/);
  assert.match(regra, /height:\s*32px\s*;/);
  assert.match(regra, /white-space:\s*nowrap\s*;/);
  assert.match(html, /id="chat-message-search-button" type="button">Buscar<\/button>/);
});
