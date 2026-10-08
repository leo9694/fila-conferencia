const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { extrairLoteFeltrin, consultarCodigoFeltrin, consultarMultiplicadorFeltrin, calcularQuantidadeFeltrin } = require('../api/separacaoFeltrin');
const { criarSeparacaoStore } = require('../api/separacaoStore');

const codigos = ['0173202900230025300420100004510010', '0172952200230025300590100002200010'];
const lotes = ['0023002530042010', '0023002530059010'];

test('lote compartilhado é identificado pelo produto previamente bipado sem conflito com outros produtos', async () => {
  for (const codProd of [1113, 2222]) {
    const lote = await consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], codProd, executeQuery: async (sql) => {
      assert.match(sql, new RegExp(`AND EST.CODPROD = ${codProd}\\b`));
      assert.match(sql, /TRIM\(ITE.CONTROLE\) = TRIM\(EST.CONTROLE\)/);
      return [{ CODPROD: codProd }];
    } });
    assert.equal(lote.codProd, codProd);
    assert.equal(lote.controle, lotes[0]);
  }
  await assert.rejects(consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], codProd: 1113, executeQuery: async () => [] }), /produto 1113/);
  for (const codProd of [null, 0, -1, 1.5, '1113 OR 1=1']) {
    await assert.rejects(consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], codProd, executeQuery: () => assert.fail() }), /Produto inválido/);
  }
});

test('gravação usa produto da linha da separação e não produto arbitrário enviado na requisição', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../routes.js'), 'utf8');
  let handler;
  let gravado;
  const contexto = vm.createContext({
    router: { post(_url, callback) { handler = callback; } }, obterNumeroInteiro: Number,
    garantirPedidoNaoConferidoParaSeparacao: async () => {}, executeQuery() { assert.fail(); },
    separacaoStore: {
      obter: () => ({ itens: [{ chave: 'seq:2', codProd: 2222 }] }),
      registrarLeituraFeltrin: (dados) => { gravado = dados; return {}; }
    },
    consultarCodigoFeltrin: async (dados) => { assert.equal(dados.codProd, 2222); return { codProd: 2222, controle: lotes[0] }; },
    consultarMultiplicadorFeltrin: async (dados) => { assert.equal(dados.codProd, 2222); return 10; },
    calcularQuantidadeFeltrin
  });
  vm.runInContext(fonte.slice(fonte.indexOf("router.post('/fila-conferencia/separacao/:nunota/leitura-feltrin'"), fonte.indexOf("router.get('/fila-conferencia/separacao/:nunota/produtos/:codprod/lotes'")), contexto);
  const res = { status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; } };
  await handler({ params: { nunota: '123' }, body: { chave: 'seq:2', codProd: 1113, codigo: codigos[0], codigoProduto: '7891234567890', leituraId: 'leitura-compartilhada-1' } }, res);
  assert.equal(gravado.lote.codProd, 2222);
  assert.equal(gravado.quantidade, 10);
  assert.ok(res.payload.separacao);
  gravado = null;
  await handler({ params: { nunota: '123' }, body: { chave: 'invalida', leituraId: 'leitura-compartilhada-1' } }, res);
  assert.equal(res.code, 400);
  assert.equal(gravado, null);
});

test('acumula leituras com multiplicador do servidor e rejeita contagens inválidas', () => {
  assert.equal(calcularQuantidadeFeltrin(10, 2), 20);
  assert.equal(calcularQuantidadeFeltrin(1, 2), 2);
  assert.equal(calcularQuantidadeFeltrin(0.5, 2), 1);
  assert.equal(calcularQuantidadeFeltrin(10), 10);
  for (const valor of [0, -1, 1.5, '2', null, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calcularQuantidadeFeltrin(10, valor), /leituras inválido/);
});

test('produtos distintos com lote idêntico guardam quantidades independentes', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-produtos-lote-igual-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [
    { chave: '1', codProd: 1113, controlePedido: lotes[0], qtdEsperada: 20 },
    { chave: '2', codProd: 2222, controlePedido: lotes[0], qtdEsperada: 30 }
  ] });
  for (const [chave, codProd, quantidade] of [['1', 1113, 10], ['2', 2222, 20]]) {
    store.registrarLeituraFeltrin({ nunota: 123, chave, lote: { codProd, controle: lotes[0] }, quantidade });
  }
  assert.deepEqual(store.obter(123).itens.map((item) => item.qtdSeparada), [10, 20]);
  assert.deepEqual(store.obter(123).itens.map((item) => item.lotesSeparados[0].controle), [lotes[0], lotes[0]]);
});

test('registra total acumulado atomicamente no lote e não duplica após repetir confirmação', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-acumulado-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, controlePedido: lotes[0], qtdEsperada: 20 }] });
  const leitura = { nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, quantidade: calcularQuantidadeFeltrin(10, 2), leituraId: 'caixas-acumuladas-1' };
  store.registrarLeituraFeltrin(leitura);
  store.registrarLeituraFeltrin(leitura);
  assert.equal(store.obter(123).itens[0].qtdSeparada, 20);
  assert.equal(store.obter(123).itens[0].lotesSeparados[0].qtdSeparada, 20);
  assert.throws(() => store.registrarLeituraFeltrin({ ...leitura, leituraId: 'caixas-acumuladas-2' }), /excede/);
});

test('código compartilhado direciona a quantidade para a linha do lote original e não a primeira linha do produto', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-linha-lote-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  const itens = [
    { chave: 'seq:2', sequencia: 2, codProd: 1113, controlePedido: lotes[0], qtdEsperada: 10 },
    { chave: 'seq:3', sequencia: 3, codProd: 1113, controlePedido: lotes[1], qtdEsperada: 20 }
  ];
  store.iniciar({ nunota: 3882094, itens });
  const ler = (controle, leituraId) => store.registrarLeituraFeltrin({ nunota: 3882094, chave: 'seq:2', lote: { codProd: 1113, controle }, quantidade: 10, leituraId });
  ler(lotes[1], 'leitura-segundo-lote-1');
  assert.equal(store.obter(3882094).itens[0].qtdSeparada, 0);
  assert.equal(store.obter(3882094).itens[1].qtdSeparada, 10);
  assert.equal(store.obter(3882094).itens[1].controleSeparado, lotes[1]);
  ler(lotes[1], 'leitura-segundo-lote-1');
  assert.equal(store.obter(3882094).itens[1].qtdSeparada, 10);
  ler(lotes[1], 'leitura-segundo-lote-2');
  assert.throws(() => ler(lotes[1], 'leitura-segundo-lote-3'), /excede/);
  ler(lotes[0], 'leitura-primeiro-lote-1');
  assert.equal(store.obter(3882094).itens[0].controleSeparado, lotes[0]);
  assert.deepEqual(store.obter(3882094).itens.map((item) => item.qtdSeparada), [10, 20]);
  store.iniciar({ nunota: 3882094, itens });
  assert.deepEqual(store.obter(3882094).itens.map((item) => item.controlePedido), lotes);
});

test('multiplicador usa o cadastro da caixa, unidade ou divisão e rejeita códigos desconhecidos', async () => {
  const params = { nunota: 123, codProd: 1113, codigoProduto: '7891234567890' };
  assert.equal(await consultarMultiplicadorFeltrin({ ...params, executeQuery: async () => [{ QUANTIDADE: 12, DIVIDEMULTIPLICA: 'M' }] }), 12);
  assert.equal(await consultarMultiplicadorFeltrin({ ...params, executeQuery: async () => [{ QUANTIDADE: 2, DIVIDEMULTIPLICA: 'D' }] }), 0.5);
  assert.equal(await consultarMultiplicadorFeltrin({ ...params, executeQuery: async (sql) => sql.includes('TGFVOA') ? [] : [{ CODPROD: 1113 }] }), 1);
  await assert.rejects(consultarMultiplicadorFeltrin({ ...params, executeQuery: async () => [] }), /não pertence/);
  await assert.rejects(consultarMultiplicadorFeltrin({ ...params, codigoProduto: '', executeQuery: () => assert.fail() }), /antes de ler o lote/);
  await assert.rejects(consultarMultiplicadorFeltrin({ ...params, executeQuery: async () => [{ QUANTIDADE: 12 }, { QUANTIDADE: 6 }] }), /ambíguo/);
});

test('caixa soma seu multiplicador, unidade soma um e lote mantém a distribuição correta', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-multiplicador-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, qtdEsperada: 14 }] });
  store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, quantidade: 12 });
  store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[1] }, quantidade: 1 });
  const item = store.obter(123).itens[0];
  assert.equal(item.qtdSeparada, 13);
  assert.deepEqual(item.lotesSeparados.map((lote) => lote.qtdSeparada), [12, 1]);
  assert.throws(() => store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, quantidade: 12 }), /excede/);
  assert.equal(item.qtdSeparada, 13);
});

test('extrai exatamente os lotes Feltrin dos exemplos preservando os zeros', () => {
  assert.equal(extrairLoteFeltrin(codigos[0]), lotes[0]);
  assert.equal(extrairLoteFeltrin(codigos[1]), lotes[1]);
  for (const codigo of ['', '1113', codigos[0].slice(1), `${codigos[0]}0`, `99${codigos[0].slice(2)}`]) {
    assert.throws(() => extrairLoteFeltrin(codigo), /34 dígitos/);
  }
});

test('consulta identifica o produto pelo lote no estoque da empresa e somente Feltrin do pedido', async () => {
  const result = await consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], executeQuery: async (sql) => {
    assert.match(sql, /EST.CODEMP = CAB.CODEMP/);
    assert.match(sql, /UPPER\(TRIM\(PRO.MARCA\)\) LIKE '%FELTRIN%'/);
    assert.match(sql, /ITE.NUNOTA = CAB.NUNOTA AND ITE.CODPROD = EST.CODPROD/);
    assert.match(sql, /TRIM\(ITE.CONTROLE\) = TRIM\(EST.CONTROLE\)/);
    assert.match(sql, /0023002530042010/);
    return [{ CODPROD: 1113, DTVALID: '2028-01-01' }];
  } });
  assert.deepEqual(result, { codProd: 1113, controle: lotes[0], dtValidade: '2028-01-01' });
  await assert.rejects(consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], executeQuery: async () => [] }), /não encontrado/);
  await assert.rejects(consultarCodigoFeltrin({ nunota: 123, codigo: codigos[0], executeQuery: async () => [{ CODPROD: 1113 }, { CODPROD: 2222 }] }), /mais de um produto/);
  await assert.rejects(consultarCodigoFeltrin({ nunota: -1, codigo: codigos[0], executeQuery: () => assert.fail() }), /Pedido inválido/);
});

test('lote original é obrigatório na leitura e na confirmação manual mesmo com uma única linha', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-lote-obrigatorio-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, controlePedido: lotes[0], qtdEsperada: 20 }] });
  const antes = JSON.stringify(store.obter(123));
  assert.throws(() => store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[1] }, quantidade: 10 }), /não corresponde/);
  assert.throws(() => store.atualizarItem({ nunota: 123, item: { chave: '1', qtdSeparada: 10, controleSeparado: lotes[1] } }), /previsto nesta linha/);
  assert.equal(JSON.stringify(store.obter(123)), antes);
});

test('não grava manualmente o mesmo lote nas duas linhas de lotes diferentes', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-lote-manual-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: lotes.map((controlePedido, indice) => ({ chave: String(indice), codProd: 1113, controlePedido, qtdEsperada: 10 })) });
  store.atualizarItem({ nunota: 123, item: { chave: '0', qtdSeparada: 10, processado: true, controleSeparado: lotes[0] } });
  assert.throws(() => store.atualizarItem({ nunota: 123, item: { chave: '1', qtdSeparada: 10, processado: true, controleSeparado: lotes[0] } }), /previsto nesta linha/);
  assert.equal(store.obter(123).itens[1].qtdSeparada, 0);
  store.atualizarItem({ nunota: 123, item: { chave: '1', qtdSeparada: 10, processado: true, controleSeparado: lotes[1] } });
  assert.deepEqual(store.obter(123).itens.map((item) => item.controleSeparado), lotes);
});

test('progresso antigo de lote incorreto não é misturado ou concluído e só é limpo explicitamente', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-lote-legado-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, controlePedido: lotes[0], qtdEsperada: 20, qtdSeparada: 10, processado: true, controleSeparado: lotes[1] }] });
  assert.throws(() => store.concluir({ nunota: 123 }), /previsto nesta linha/);
  store.obter(123).itens[0].processado = false;
  assert.throws(() => store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, quantidade: 10 }), /previsto nesta linha/);
  assert.equal(store.obter(123).itens[0].controleSeparado, lotes[1]);
  store.atualizarItem({ nunota: 123, item: { chave: '1', qtdSeparada: 0 } });
  store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, quantidade: 20 });
  assert.equal(store.obter(123).itens[0].controleSeparado, lotes[0]);
});

test('cada leitura soma uma unidade e mantém dois lotes separados ao reabrir sem exceder o pedido', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-test-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  const itens = [{ chave: 'seq:1', sequencia: 1, codProd: 1113, qtdEsperada: 3 }];
  store.iniciar({ nunota: 123, itens });
  const ler = (controle, codProd = 1113) => store.registrarLeituraFeltrin({ nunota: 123, codUsu: 72, chave: 'seq:1', lote: { codProd, controle, dtValidade: '2028-01-01' } });
  assert.throws(() => ler(lotes[0], 999), /produto selecionado/);
  ler(lotes[0]);
  ler(lotes[1]);
  ler(lotes[0]);
  const item = store.obter(123).itens[0];
  assert.equal(item.qtdSeparada, 3);
  assert.equal(item.processado, true);
  assert.equal(item.controleSeparado, null);
  assert.deepEqual(item.lotesSeparados.map((lote) => [lote.controle, lote.qtdSeparada]), [[lotes[0], 2], [lotes[1], 1]]);
  assert.throws(() => ler(lotes[1]), /excede/);
  const recarregado = criarSeparacaoStore({ baseDir });
  recarregado.iniciar({ nunota: 123, itens });
  assert.deepEqual(recarregado.obter(123).itens[0].lotesSeparados, item.lotesSeparados);
  assert.throws(() => recarregado.atualizarItem({ nunota: 123, item: { chave: 'seq:1', qtdSeparada: 2 } }), /vários lotes/);
  recarregado.concluir({ nunota: 123 });
  assert.throws(() => recarregado.registrarLeituraFeltrin({ nunota: 123, chave: 'seq:1', lote: { codProd: 1113, controle: lotes[0] } }), /não está aberta/);
});

test('voltar para pendente limpa as quantidades de todos os lotes sem afetar outros itens', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-reset-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, qtdEsperada: 1 }, { chave: '2', codProd: 2222, qtdEsperada: 2 }] });
  store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] } });
  store.atualizarItem({ nunota: 123, item: { chave: '1', qtdSeparada: 0, processado: false } });
  assert.deepEqual(store.obter(123).itens[0].lotesSeparados, []);
  assert.equal(store.obter(123).itens[1].qtdSeparada, 0);
});

test('repetir a mesma requisição após reconectar não conta a caixa duas vezes', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-retry-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, qtdEsperada: 2 }] });
  const leitura = { nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] }, leituraId: 'leitura-teste-123' };
  store.registrarLeituraFeltrin(leitura);
  const recarregado = criarSeparacaoStore({ baseDir });
  recarregado.registrarLeituraFeltrin(leitura);
  assert.equal(recarregado.obter(123).itens[0].qtdSeparada, 1);
  recarregado.registrarLeituraFeltrin({ ...leitura, leituraId: 'leitura-teste-456' });
  assert.equal(recarregado.obter(123).itens[0].qtdSeparada, 2);
});

test('falha de gravação não deixa uma unidade extra contada apenas na memória', (t) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feltrin-write-'));
  t.after(() => fs.rmSync(baseDir, { recursive: true, force: true }));
  const store = criarSeparacaoStore({ baseDir });
  store.iniciar({ nunota: 123, itens: [{ chave: '1', codProd: 1113, qtdEsperada: 2 }] });
  const versao = store.obter(123).versao;
  fs.mkdirSync(`${store.filePath}.tmp`);
  assert.throws(() => store.registrarLeituraFeltrin({ nunota: 123, chave: '1', lote: { codProd: 1113, controle: lotes[0] } }));
  assert.equal(store.obter(123).itens[0].qtdSeparada, 0);
  assert.deepEqual(store.obter(123).itens[0].lotesSeparados, []);
  assert.equal(store.obter(123).versao, versao);
});
