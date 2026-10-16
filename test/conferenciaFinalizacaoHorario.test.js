const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function finalizarNoFuso(tz, inicio, fim) {
  const script = `
    const fs = require('node:fs');
    const vm = require('node:vm');
    const helpers = require('./routes')._internals;
    const fonte = fs.readFileSync('routes.js', 'utf8');
    let campos;
    const ctx = vm.createContext({
      ...helpers, Date, SANKHYA_TIMEZONE: 'America/Sao_Paulo',
      atualizarRegistroApi: async (_entidade, _chave, dados) => { campos = dados; }
    });
    vm.runInContext(fonte.slice(fonte.indexOf('function dataValida('), fonte.indexOf('function normalizarControleConferencia(')), ctx);
    ctx.preservarConferenteFinalizacao(1, 72, ${JSON.stringify(inicio)}, ${JSON.stringify(fim)})
      .then(() => {
        const { atualizarTempoConferencia } = require('./api/conferenciaTimer');
        const tempo = atualizarTempoConferencia({}, {
          NUNOTA: 1, STATUS_CONFERENCIA: 'CONFERIDO',
          DT_INICIO_CONFERENCIA: helpers.normalizarInicioConferencia(campos.DHINICONF),
          DT_FIM_CONFERENCIA: helpers.normalizarFimConferencia(campos.DHFINCONF || ${JSON.stringify(fim)})
        });
        console.log(JSON.stringify({ ...campos, tempoTotalMinutos: tempo.tempoTotalMinutos }));
      });
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: { ...process.env, TZ: tz, APP_TIMEZONE: 'America/Cuiaba', SANKHYA_TIMEZONE: 'America/Sao_Paulo' }
  }).trim());
}

test('finalização preserva início sem adicionar quatro horas à duração na VPS em UTC', () => {
  for (const tz of ['UTC', 'America/Cuiaba', 'America/Sao_Paulo']) {
    const campos = finalizarNoFuso(tz, '16102026 07:44:00', '16102026 09:28:00');
    assert.equal(campos.DHINICONF, '16/10/2026 07:44:00', tz);
    assert.equal(campos.CODUSUCONF, 72);
    assert.equal(campos.tempoTotalMinutos, 44, 'Deve exibir 44 min, não 284 min');
    assert.equal(campos.DHFINCONF, undefined, 'Fim válido do Sankhya não deve ser regravado');
  }
});

test('compara início e fim no respectivo fuso sem confundir fim anterior com posterior', () => {
  // 08:30 em São Paulo é 07:30 em Cuiabá, portanto anterior ao início 07:44.
  const campos = finalizarNoFuso('UTC', '16/10/2026 07:44:00', '16/10/2026 08:30:00');
  assert.equal(campos.DHINICONF, '16/10/2026 07:44:00');
  assert.ok(campos.DHFINCONF, 'Deve corrigir o fim que antecede o início real');
});

test('aceita início ISO com offset explícito sem deslocar o horário ao finalizar', () => {
  const campos = finalizarNoFuso('UTC', '2026-10-16T11:44:00Z', '2026-10-16T12:28:00Z');
  assert.equal(campos.DHINICONF, '16/10/2026 07:44:00');
  assert.equal(campos.DHFINCONF, undefined);
});
