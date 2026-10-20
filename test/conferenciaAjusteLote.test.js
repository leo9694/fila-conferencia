const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { planejarAjusteLote, remapearProgressoAjusteLote, validarItensPreservados } = require('../api/conferenciaAjusteLote');
const { distribuirValorProporcional } = require('../api/conferenciaEntrada');
const { criarConferenciaProgressStore } = require('../api/conferenciaProgressStore');
const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
const itemOriginal = { NUNOTA: 123, SEQUENCIA: 1, CODPROD: 1010, CODEMP: 6, CODLOCALORIG: 100,
  QTDNEG: 10, VLRUNIT: 10, VLRTOT: 100, VLRDESC: 5, CONTROLE: 'A', CODVOL: 'UN',
  TIPMOV: 'V', CODTIPOPER: 35, STATUSNOTA: 'P', LIBCONF: 'S', NUCONFATUAL: 9, STATUS_CONF: 'A' };

test('troca apenas o saldo pendente sem alterar quantidade total ou leituras já conferidas', () => {
  const plano = planejarAjusteLote({ item: itemOriginal, progresso: { qtdConferida: 6 }, controle: 'B', quantidade: 4, quantidadeOriginal: 10, controleOriginal: 'A' });
  assert.deepEqual(plano.grupos.map((g) => [g.controle, g.quantidade]), [['A', 6], ['B', 4]]);
  const leituras = [{ codigo: '1010', quantidade: 6, quantidadeConvertida: 6, controle: 'A' }];
  const itens = remapearProgressoAjusteLote([{ sequencia: 1, qtdConferida: 6, leituras }], {
    sequenciaOriginal: 1, lotes: [{ sequencia: 1, quantidade: 6 }, { sequencia: 2, quantidade: 4 }]
  });
  assert.equal(itens[0].qtdConferida, 6);
  assert.deepEqual(itens[0].leituras, leituras);
  assert.equal(itens[1].qtdConferida, 0);
  assert.deepEqual(itens[1].leituras, []);
  const inteiro = planejarAjusteLote({ item: itemOriginal, progresso: {}, controle: 'B', quantidade: 10, quantidadeOriginal: 10, controleOriginal: 'A' });
  assert.deepEqual(inteiro.grupos.map((g) => [g.controle, g.quantidade]), [['B', 10]]);
});

test('rejeita lote igual, nota alterada, quantidade inválida e troca de parte já conferida ou cortada', () => {
  const dados = { item: itemOriginal, progresso: { qtdConferida: 6, qtdCortada: 1 }, controle: 'B', quantidade: 3, quantidadeOriginal: 10, controleOriginal: 'A' };
  for (const alteracao of [{ controle: 'A' }, { controle: '' }, { quantidadeOriginal: 9 }, { controleOriginal: 'C' },
    { quantidade: 4 }, { quantidade: 0 }, { quantidade: -1 }, { quantidade: NaN }, { quantidade: Infinity }]) {
    assert.throws(() => planejarAjusteLote({ ...dados, ...alteracao }));
  }
});

function ambiente(t, opcoes = {}) {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'ajuste-lote-conf-'));
  t.after(() => fs.rmSync(diretorio, { recursive: true, force: true }));
  const store = criarConferenciaProgressStore({ filePath: path.join(diretorio, 'state.json') });
  const conferido = opcoes.conferido ?? 6;
  store.salvar({ nunota: 123, nuconf: 9, codUsu: 72, itens: [{ sequencia: 1, qtdConferida: conferido, qtdCortada: 0,
    leituras: conferido ? [{ codigo: '1010', quantidade: conferido, quantidadeConvertida: conferido, controle: 'A' }] : [] }] });
  const linhas = new Map([[1, { ...itemOriginal, ...opcoes.item }]]);
  const estoque = { A: 0, B: 0 };
  const sqls = [];
  const escritas = [];
  const handlers = {};
  const locks = new Set();
  let vinculosAplicados = false;
  const ctx = vm.createContext({
    console: { error() {} },
    router: { get(url, fn) { handlers[url] = fn; }, post(url, fn) { handlers[url] = fn; } },
    obterNumeroInteiro: (v) => /^\d+$/.test(String(v)) ? Number(v) : null,
    obterCodigoUsuario: (v) => Number.isInteger(v) ? v : null,
    normalizarNumero: Number, distribuirValorProporcional, planejarAjusteLote, remapearProgressoAjusteLote, validarItensPreservados,
    conferenciaProgressStore: store, finalizacoesConferenciaEmAndamento: locks,
    executeQuery: async (sql) => {
      sqls.push(sql);
      if (sql.includes('FROM TGFEST')) {
        assert.match(sql, /CODEMP = 6/);
        assert.match(sql, /CODPROD = 1010/);
        assert.match(sql, /CODLOCAL = 100/);
        assert.doesNotMatch(sql, /ESTOQUE.*>\s*0|ATIVO|RESERVADO/);
        return opcoes.loteInexistente ? [] : [{ CONTROLE: 'B', ESTOQUE: 0, DTVALID: null }];
      }
      if (sql.includes('FROM TGFCAB WHERE')) return [{ VLRNOTA: 95 }];
      if (sql.includes('FROM TGFITE WHERE')) return [...linhas.values()].map((item) => ({ ...item }));
      if (sql.includes('FROM TGFITE ITE')) return [linhas.get(1)];
      assert.fail(sql);
    },
    consultarVinculosAtendimentoItem: async () => [{ NUNOTAORIG: 120, SEQUENCIAORIG: 1, QTDATENDIDA: 10 }],
    consultarSequenciasNota: async () => new Set(linhas.keys()),
    salvarQuantidadeLoteItemNotaApi: async (_nunota, item, dados, incluir) => {
      const seq = incluir ? Math.max(...linhas.keys()) + 1 : Number(item.SEQUENCIA);
      const antes = linhas.get(seq);
      if (antes) estoque[antes.CONTROLE] += Number(antes.QTDNEG);
      estoque[dados.controle] -= Number(dados.quantidade);
      linhas.set(seq, { ...item, SEQUENCIA: seq, CONTROLE: dados.controle, QTDNEG: dados.quantidade, VLRTOT: dados.vlrTot, VLRDESC: dados.vlrDesc });
      escritas.push({ incluir, seq, controle: dados.controle, quantidade: dados.quantidade });
      if (incluir && opcoes.timeoutInclusao) throw new Error('Resposta perdida após incluir a linha');
    },
    excluirItemNotaApi: async (_nunota, seq) => {
      if (opcoes.falhaRollback) throw new Error('Falha ao excluir linha');
      const antes = linhas.get(seq);
      estoque[antes.CONTROLE] += Number(antes.QTDNEG);
      linhas.delete(seq);
    },
    reconciliarTotaisDesmembramento: async () => ({ camposItem: {} }),
    aplicarVinculosAtendimentoDesmembramento: async ({ gruposAplicados }) => {
      assert.equal(gruposAplicados.reduce((s, g) => s + g.quantidade, 0), 10);
      vinculosAplicados = true;
    },
    validarVinculosAtendimentoDesmembramento: async () => {},
    validarDesmembramentoLotes: async ({ gruposAplicados }) => {
      for (const grupo of gruposAplicados) {
        assert.equal(linhas.get(grupo.sequencia).CONTROLE, grupo.controle);
        assert.equal(linhas.get(grupo.sequencia).QTDNEG, grupo.quantidade);
      }
      assert.equal([...linhas.values()].reduce((s, i) => s + i.QTDNEG, 0), 10);
      assert.equal([...linhas.values()].reduce((s, i) => s + i.VLRTOT, 0), 100);
      assert.equal([...linhas.values()].reduce((s, i) => s + i.VLRDESC, 0), 5);
    },
    atualizarQuantidadeVinculoAtendimento: async () => {},
    camposCabecalhoAlteradosPeloDesmembramento: () => [], atualizarRegistroApi: async () => {}
  });
  vm.runInContext(fonte.slice(fonte.indexOf('async function desmembrarItensEntradaPorLote('), fonte.indexOf('async function aplicarCortesNoPedido(')), ctx);
  vm.runInContext(fonte.slice(fonte.indexOf('function validarVersaoLotesConferencia('), fonte.indexOf("router.get('/fila-conferencia/pedidos/:nunota/itens',")), ctx);
  async function ajustar(body = {}) {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(v) { this.payload = v; return this; } };
    await handlers['/fila-conferencia/pedidos/:nunota/itens/:sequencia/ajustar-lote']({ params: { nunota: '123', sequencia: '1' }, usuario: { codUsu: 72 },
      body: { controle: 'B', quantidade: 4, quantidadeOriginal: 10, controleOriginal: 'A', versaoLotes: 0, ...body } }, res);
    return res;
  }
  return { ajustar, store, linhas, estoque, sqls, escritas, ctx, locks, vinculosAplicados: () => vinculosAplicados };
}

test('ajusta 6 de A e 4 de B zerado pelo serviço de itens e preserva valores, origem e progresso', async (t) => {
  const env = ambiente(t);
  const res = await env.ajustar();
  assert.equal(res.code, 200, JSON.stringify(res.payload));
  assert.deepEqual(env.estoque, { A: 4, B: -4 });
  assert.equal(env.linhas.get(1).QTDNEG, 6);
  assert.equal(env.linhas.get(2).QTDNEG, 4);
  assert.ok(env.vinculosAplicados());
  assert.equal(env.store.obter(123).itens[0].qtdConferida, 6);
  assert.equal(env.store.obter(123).itens[1].qtdConferida, 0);
  assert.equal(env.store.obter(123).versaoLotes, 1);
  assert.equal(env.store.obter(123).ajustesLote[0].codUsu, 72);
  assert.equal(env.store.obter(123).ajusteLotePendente, undefined);
  const repeticao = await env.ajustar();
  assert.equal(repeticao.code, 409);
  assert.equal(env.escritas.length, 2);
});

test('troca integral mantém a sequência original e estorna o lote anterior', async (t) => {
  const env = ambiente(t, { conferido: 0 });
  const res = await env.ajustar({ quantidade: 10 });
  assert.equal(res.code, 200, JSON.stringify(res.payload));
  assert.equal(env.linhas.size, 1);
  assert.equal(env.linhas.get(1).CONTROLE, 'B');
  assert.deepEqual(env.estoque, { A: 10, B: -10 });
});

test('não altera nota confirmada, outro produto/local/empresa ou quantidade já conferida', async (t) => {
  for (const opcoes of [{ item: { STATUSNOTA: 'L' } }, { item: { TIPMOV: 'P' } }, { item: { STATUS_CONF: 'F' } },
    { loteInexistente: true }, { conferido: 8 }]) {
    const env = ambiente(t, opcoes);
    assert.equal((await env.ajustar()).code, 409);
    assert.equal(env.escritas.length, 0);
  }
});

test('resposta perdida após inclusão desfaz a linha criada e restaura estoque sem duplicação', async (t) => {
  const env = ambiente(t, { timeoutInclusao: true });
  const res = await env.ajustar();
  assert.equal(res.code, 409);
  assert.equal(env.linhas.size, 1);
  assert.equal(env.linhas.get(1).QTDNEG, 10);
  assert.deepEqual(env.estoque, { A: 0, B: 0 });
  assert.equal(env.store.obter(123).ajusteLotePendente, undefined);
  assert.equal(env.store.obter(123).versaoLotes, undefined);
});

test('falha na restauração mantém bloqueio persistente e impede nova tentativa ou confirmação', async (t) => {
  const env = ambiente(t, { timeoutInclusao: true, falhaRollback: true });
  const res = await env.ajustar();
  assert.match(res.payload.erro, /bloqueada para revisão/);
  assert.ok(env.store.obter(123).ajusteLotePendente);
  assert.equal((await env.ajustar()).code, 409);
  assert.throws(() => vm.runInContext('validarVersaoLotesConferencia(123, 0)', env.ctx), /interrompido/);
});

test('nota em finalização não aceita ajuste concorrente', async (t) => {
  const env = ambiente(t);
  env.locks.add(123);
  assert.equal((await env.ajustar()).code, 409);
  assert.equal(env.escritas.length, 0);
});

test('detecta alteração em outro item, lote agrupado em linha existente ou sequência inesperada', () => {
  assert.throws(() => validarItensPreservados([itemOriginal], [{ ...itemOriginal, QTDNEG: 14 }]));
  assert.throws(() => validarItensPreservados([itemOriginal], [{ ...itemOriginal }, { ...itemOriginal, SEQUENCIA: 2 }]));
  assert.throws(() => validarItensPreservados([itemOriginal], []));
});

test('auditoria, revisão e bloqueio sobrevivem à reinicialização e a salvamentos normais', async (t) => {
  const env = ambiente(t);
  await env.ajustar();
  const recarregado = criarConferenciaProgressStore({ filePath: env.store.filePath });
  assert.equal(recarregado.obter(123).versaoLotes, 1);
  assert.equal(recarregado.obter(123).ajustesLote[0].controleAnterior, 'A');
  recarregado.salvar({ nunota: 123, nuconf: 9, codUsu: 72, itens: recarregado.obter(123).itens });
  assert.equal(recarregado.obter(123).versaoLotes, 1);
  assert.equal(recarregado.obter(123).ajustesLote.length, 1);
  recarregado.iniciarAjusteLote(123, { sequencia: 2 });
  const pendente = criarConferenciaProgressStore({ filePath: env.store.filePath });
  assert.equal(pendente.obter(123).ajusteLotePendente.sequencia, 2);
});
