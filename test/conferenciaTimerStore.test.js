const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { criarConferenciaTimerStore } = require('../api/conferenciaTimerStore');

test('persiste o tempo de conferencia para sobreviver ao restart da aplicacao', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fila-conferencia-'));
  const filePath = path.join(baseDir, 'timer-state.json');

  const store1 = criarConferenciaTimerStore({ filePath });
  store1.atualizarComItens([
    {
      NUNOTA: 101,
      STATUS_CONFERENCIA: 'EM ANDAMENTO'
    }
  ], new Date('2026-03-31T10:00:00Z'));

  store1.atualizarComItens([
    {
      NUNOTA: 101,
      STATUS_CONFERENCIA: 'CONFERIDO'
    }
  ], new Date('2026-03-31T10:12:00Z'));

  const store2 = criarConferenciaTimerStore({ filePath });
  const resultado = store2.atualizarComItens([
    {
      NUNOTA: 101,
      STATUS_CONFERENCIA: 'CONFERIDO'
    }
  ], new Date('2026-03-31T10:40:00Z'));

  assert.equal(resultado[0].TEMPO_TOTAL_CONFERENCIA_MIN, 12);
  assert.equal(store2.state[101].tempoTotalMinutos, 12);
  assert.equal(store2.state[101].iniciadoEm.toISOString(), '2026-03-31T10:00:00.000Z');

  fs.rmSync(baseDir, { recursive: true, force: true });
});
