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
