const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarConferenciaProgressStore } = require('../api/conferenciaProgressStore');

test('preserva leituras com unidade alternativa e quantidade convertida', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-progress-'));
  const filePath = path.join(diretorio, 'state.json');
  const store = criarConferenciaProgressStore({ filePath });

  store.salvar({
    nunota: 123,
    nuconf: 456,
    codUsu: 72,
    itens: [{
      sequencia: 1,
      qtdConferida: 40,
      qtdCortada: 0,
      leituras: [{
        codigo: '17896061733755',
        tipo: 'UNIDADE_ALTERNATIVA',
        codVol: 'PT',
        controle: 'LOTE-01',
        multiplicador: 10,
        quantidade: 4,
        quantidadeConvertida: 40
      }]
    }]
  });

  const recarregado = criarConferenciaProgressStore({ filePath }).obter(123);
  assert.equal(recarregado.itens[0].qtdConferida, 40);
  assert.deepEqual(recarregado.itens[0].leituras[0], {
    codigo: '17896061733755',
    tipo: 'UNIDADE_ALTERNATIVA',
    codVol: 'PT',
    controle: 'LOTE-01',
    multiplicador: 10,
    quantidade: 4,
    quantidadeConvertida: 40
  });

  fs.rmSync(diretorio, { recursive: true, force: true });
});

test('preserva produto extra e seus codigos ao restaurar a conferencia', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-extra-progress-'));
  const filePath = path.join(diretorio, 'state.json');
  const store = criarConferenciaProgressStore({ filePath });

  store.salvar({
    nunota: 123,
    nuconf: 456,
    codUsu: 72,
    itens: [{
      extra: true,
      sequencia: -1789,
      codProd: 1789,
      descrProd: 'PRODUTO RECEBIDO A MAIS',
      codGrupoProd: 100,
      descrGrupoProd: 'VASOS',
      codVol: 'UN',
      codVolPadrao: 'UN',
      codigoBarras: '1789',
      codigos: ['1789'],
      codigosConferencia: [{
        codigo: '1789',
        tipo: 'CODIGO_PRODUTO',
        multiplicador: 1,
        codVol: 'UN'
      }],
      qtdConferida: 16,
      leituras: [{
        codigo: '1789',
        tipo: 'CODIGO_PRODUTO',
        codVol: 'UN',
        quantidade: 16,
        quantidadeConvertida: 16
      }]
    }]
  });

  const item = criarConferenciaProgressStore({ filePath }).obter(123).itens[0];
  assert.equal(item.extra, true);
  assert.equal(item.sequencia, -1789);
  assert.equal(item.codProd, 1789);
  assert.equal(item.descrProd, 'PRODUTO RECEBIDO A MAIS');
  assert.equal(item.qtdConferida, 16);
  assert.equal(item.codigosConferencia[0].codigo, '1789');

  fs.rmSync(diretorio, { recursive: true, force: true });
});

test('preserva o agrupamento e o fechamento das caixas da entrada', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-box-progress-'));
  const filePath = path.join(diretorio, 'state.json');
  const store = criarConferenciaProgressStore({ filePath });

  store.salvar({
    nunota: 789,
    nuconf: 987,
    codUsu: 72,
    itens: [{
      sequencia: 1,
      qtdConferida: 20,
      qtdCortada: 0,
      leituras: [{
        codigo: '7896061733758',
        tipo: 'CODIGO_BARRAS',
        codVol: 'UN',
        controle: '0000702410000020',
        dtValidade: '10/12/2028',
        multiplicador: 1,
        quantidade: 20,
        quantidadeConvertida: 20,
        caixaId: 3,
        caixaFechada: true
      }]
    }]
  });

  const leitura = criarConferenciaProgressStore({ filePath }).obter(789).itens[0].leituras[0];
  assert.equal(leitura.caixaId, 3);
  assert.equal(leitura.caixaFechada, true);
  assert.equal(leitura.dtValidade, '10/12/2028');

  fs.rmSync(diretorio, { recursive: true, force: true });
});

test('sincroniza o encerramento da caixa e impede que um salvamento antigo a reabra', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-box-sync-'));
  const filePath = path.join(diretorio, 'state.json');
  const store = criarConferenciaProgressStore({ filePath });
  const progressoOriginal = {
    nunota: 321,
    nuconf: 654,
    codUsu: 72,
    itens: [{
      sequencia: 1,
      qtdConferida: 10,
      qtdCortada: 0,
      leituras: [{
        codigo: '7896061733758',
        tipo: 'CODIGO_BARRAS',
        codVol: 'UN',
        quantidade: 10,
        quantidadeConvertida: 10,
        caixaId: 1,
        caixaFechada: false
      }]
    }]
  };

  store.salvar(progressoOriginal);
  const encerramento = store.encerrarCaixa({ nunota: 321, caixaId: 1 });
  assert.equal(encerramento.alterado, true);
  assert.deepEqual(store.resumoCaixas(321).caixas, [{ caixaId: 1, fechada: true, leituras: 1 }]);

  // Simula um tablet que ainda tinha a caixa aberta no estado local ao salvar novamente.
  store.salvar(progressoOriginal);
  assert.equal(store.obter(321).itens[0].leituras[0].caixaFechada, true);
  assert.equal(store.encerrarCaixa({ nunota: 321, caixaId: 1 }).alterado, false);

  fs.rmSync(diretorio, { recursive: true, force: true });
});
