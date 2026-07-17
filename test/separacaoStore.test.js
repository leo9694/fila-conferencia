const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { criarSeparacaoStore } = require('../api/separacaoStore');

test('compartilha progresso e conclusao da separacao entre instancias', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'separacao-store-'));
  const filePath = path.join(baseDir, 'separacoes.json');

  try {
    const dispositivoA = criarSeparacaoStore({ filePath });
    dispositivoA.iniciar({
      nunota: 123,
      codUsu: 10,
      itens: [
        { chave: 'seq:1', sequencia: 1, codProd: 1010, qtdEsperada: 10 },
        { chave: 'seq:2', sequencia: 2, codProd: 1011, qtdEsperada: 5 }
      ]
    });
    dispositivoA.atualizarItem({
      nunota: 123,
      codUsu: 10,
      item: {
        chave: 'seq:1',
        qtdSeparada: 5,
        processado: true,
        ajustado: true,
        controleSeparado: 'LOTE-02',
        dtValidadeSeparada: '2028-12-10'
      }
    });

    const dispositivoB = criarSeparacaoStore({ filePath });
    assert.equal(dispositivoB.obter(123).status, 'EM_SEPARACAO');
    assert.equal(dispositivoB.obter(123).itens[0].qtdSeparada, 5);
    assert.equal(dispositivoB.obter(123).itens[0].controleSeparado, 'LOTE-02');
    assert.equal(dispositivoB.obter(123).itens[0].dtValidadeSeparada, '2028-12-10');
    assert.throws(
      () => dispositivoB.concluir({ nunota: 123, codUsu: 11 }),
      /Todos os itens precisam/
    );

    dispositivoB.atualizarItem({
      nunota: 123,
      codUsu: 11,
      item: { chave: 'seq:2', qtdSeparada: 5, processado: true, ajustado: false }
    });
    const concluida = dispositivoB.concluir({ nunota: 123, codUsu: 11 });
    assert.equal(concluida.status, 'SEPARADO');
    assert.ok(concluida.concluidoEm);
    assert.throws(
      () => dispositivoB.atualizarItem({
        nunota: 123,
        item: { chave: 'seq:1', qtdSeparada: 10, processado: true }
      }),
      /ja foi concluida/
    );
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
