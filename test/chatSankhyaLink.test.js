const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { criarChatAtendenteStore } = require('../api/chatAtendenteStore');

test('vínculo de contato avulso persiste após recarregar sem perder atendente e pipeline', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-vinculo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'atendentes.json');
  const store = criarChatAtendenteStore({ filePath });
  store.marcarConversaAvulsa(123);
  store.atribuirConversa(123, { acao: 'CLAIM', ator: { id: '72', name: 'Leonardo' }, destino: { id: '72', name: 'Leonardo' } });
  store.vincularPipeline(123, { categoryId: 0, dealId: 99 });
  const anterior = store.obterConversa(123);
  store.marcarConversaAvulsa(123, false);
  const atual = criarChatAtendenteStore({ filePath }).obterConversa(123);
  assert.equal(atual.contatoAvulso, false);
  for (const key of Object.keys(anterior).filter((key) => !['contatoAvulso', 'atualizadoEm'].includes(key))) {
    assert.deepEqual(atual[key], anterior[key]);
  }
});

test('vincula avulso e atualiza conversas relacionadas somente após sucesso no Sankhya', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../api/chatRouter.js'), 'utf8');
  const inicio = fonte.indexOf("router.post('/conversations/:id/sankhya-link'");
  const fim = fonte.indexOf("router.get('/conversations/:id/messages'", inicio);
  for (const falha of [false, true]) {
    const flags = new Map([[1, true], [2, true]]);
    const eventos = [];
    let handler;
    const ctx = vm.createContext({
      router: { post(_url, fn) { handler = fn; } }, asyncRoute: (fn) => fn, id: Number,
      obterConversaConsolidada: async () => ({ id: 1, relatedConversationIds: [2] }),
      textoContatoChat: (v) => v, nomeDaConversa: () => 'Michele',
      normalizarTelefoneWhatsapp: (v) => v, telefoneDaConversa: () => '5566999999999',
      identidadeTelefoneWhatsapp: (v) => v,
      contatosDoParceiro: async () => ({ parceiro: { nome: 'Cliente' }, contatos: [] }),
      criarContatoWhatsappNoSankhya: async () => {
        if (falha) throw new Error('Sankhya indisponível');
        return { codContato: 10, nomeContato: 'Michele' };
      },
      cadastroSankhyaSelecionado: (v) => ({ verificado: true, vinculos: v }),
      cacheCadastroSankhyaPorTelefone: new Map(), CADASTRO_SANKHYA_CACHE_MS: 1000,
      idsRelacionadosConversa: () => [1, 2],
      atendentes: {
        obterConversa: (id) => ({ contatoAvulso: flags.get(id) }),
        marcarConversaAvulsa: (id, value) => flags.set(id, value)
      },
      comAtribuicao: (v) => ({ ...v, contatoAvulso: [...flags.values()].some(Boolean) }),
      eventosAtendimento: { emit: (...args) => eventos.push(args) }
    });
    vm.runInContext(fonte.slice(inicio, fim), ctx);
    const res = { json(payload) { this.payload = payload; } };
    const chamada = handler({ params: { id: '1' }, body: { codParc: 99, nomeContato: 'Michele' } }, res);
    if (falha) {
      await assert.rejects(chamada, /Sankhya indisponível/);
      assert.deepEqual([...flags.values()], [true, true]);
      assert.equal(eventos.length, 0);
    } else {
      await chamada;
      assert.deepEqual([...flags.values()], [false, false]);
      assert.equal(res.payload.conversation.contatoAvulso, false);
      assert.equal(res.payload.conversation.cadastroSankhya.verificado, true);
      assert.equal(eventos[0][0], 'updated');
    }
  }
});

test('painel oferece vínculo Sankhya para avulso e permite abrir a pesquisa', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/chat.js'), 'utf8');
  assert.match(fonte, /Contato avulso<\/strong>[^\n]+data-chat-link-partner/);
  const inicio = fonte.indexOf('  function openLinkPartner()');
  const funcao = fonte.slice(inicio, fonte.indexOf('  function closeLinkPartner()', inicio));
  assert.doesNotMatch(funcao, /contatoAvulso/);
});
