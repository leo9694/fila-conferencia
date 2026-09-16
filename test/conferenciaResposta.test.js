const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
const inicio = source.indexOf('async function obterRespostaConfirmacaoConferencia(');
const fim = source.indexOf('async function confirmarConferencia(', inicio);
function preparar(fetch) {
  return vm.runInNewContext(`${source.slice(inicio, fim)}; obterRespostaConfirmacaoConferencia`, { fetch });
}
const html = () => Promise.resolve({ ok: false, status: 504, json: async () => { throw new SyntaxError('HTML'); } });

test('preserva sucesso e rejeição JSON sem consultar ou repetir faturamento', async () => {
  const recuperar = preparar(() => assert.fail('Não deve consultar'));
  for (const ok of [true, false]) {
    const payload = ok ? { ok: true } : { erro: 'Lote divergente' };
    const res = { ok, json: async () => payload };
    const resultado = await recuperar(Promise.resolve(res), 3883032, 'saida');
    assert.equal(resultado.res, res);
    assert.equal(resultado.payload, payload);
  }
});

test('recupera nota faturada após HTML 504 fazendo somente consulta GET', async () => {
  let consultas = 0;
  const recuperar = preparar(async (url, options) => {
    consultas++;
    assert.equal(url, '/api/fila-conferencia/pedidos/3883032/documentos');
    assert.equal(options.method, undefined);
    return { ok: true, json: async () => ({ faturado: true, nota: { NUNOTA: 3883050, NUMNOTA: 82799 } }) };
  });
  const resultado = await recuperar(html(), 3883032, 'saida');
  assert.equal(resultado.payload.faturamento.nota.NUMNOTA, 82799);
  assert.equal(resultado.payload.recuperado, true);
  assert.equal(consultas, 1);
});

test('não presume faturamento concluído se a consulta não encontra nota ou falha', async () => {
  for (const response of [
    { ok: true, json: async () => ({ faturado: false }) },
    { ok: false },
    { ok: true, json: async () => { throw new Error('Falha'); } }
  ]) {
    await assert.rejects(preparar(async () => response)(html(), 1, 'saida'), /verifique o resultado antes/);
  }
});

test('perda de rede também consulta faturamento sem repetir confirmação', async () => {
  const recuperar = preparar(async () => ({ ok: true, json: async () => ({ faturado: true, nota: { NUNOTA: 2 } }) }));
  assert.equal((await recuperar(Promise.reject(new Error('rede')), 1, 'saida')).payload.recuperado, true);
});

test('não usa nota de venda para inferir conclusão de conferência de entrada', async () => {
  await assert.rejects(preparar(() => assert.fail('Não consultar'))(html(), 1, 'entrada'), /verifique o resultado antes/);
});
