const test = require('node:test');
const assert = require('node:assert/strict');

const { createAsyncRefreshLoop } = require('../frontend/asyncRefresh');

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('refresh async nao sobrepoe requests mesmo com intervalo menor que a duracao da tarefa', async () => {
  let execucoes = 0;
  let concorrenciaAtual = 0;
  let maiorConcorrencia = 0;

  const loop = createAsyncRefreshLoop(async () => {
    execucoes += 1;
    concorrenciaAtual += 1;
    maiorConcorrencia = Math.max(maiorConcorrencia, concorrenciaAtual);
    await esperar(30);
    concorrenciaAtual -= 1;
  }, {
    intervalMs: 5
  });

  loop.start();
  await esperar(85);
  await loop.stop();
  await esperar(10);

  assert.ok(execucoes >= 2);
  assert.equal(maiorConcorrencia, 1);
});
