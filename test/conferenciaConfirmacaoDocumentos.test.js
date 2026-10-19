const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { confirmarNotaSaidaTeste } = require('../api/conferenciaSaidaNota');
const frontend = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

test('responde ao evento de data via TXProperties nativo mantendo a data original sem repetir confirmação', async () => {
  let confirmada = false;
  let chamadas = 0;
  const resultado = await confirmarNotaSaidaTeste({ nunota: 3885442,
    executeQuery: async () => [{ NUNOTA: 3885442, CODTIPOPER: 35, TIPMOV: 'V', LIBCONF: 'S', STATUS_CONF: 'F', STATUSNOTA: confirmada ? 'L' : 'A' }],
    executeService: async (_servico, body) => {
      chamadas++;
      if (body.nota.txProperties?.prop.some((p) => p.name === 'br.com.utiliza.dtneg.servidor' && p.value === false)) {
        confirmada = true;
        return { status: '1', responseBody: { pk: { NUNOTA: { $: '3885442' } } } };
      }
      return { status: '4', clientEvents: [{ id: 'br.com.utiliza.dtneg.servidor' }] };
    }
  });
  assert.equal(resultado.status, 'CONFIRMADA');
  assert.equal(chamadas, 1);
});

test('evento adicional desconhecido não é aceito automaticamente nem confundido com confirmação', async () => {
  let chamadas = 0;
  await assert.rejects(confirmarNotaSaidaTeste({ nunota: 3885442,
    executeQuery: async () => [{ NUNOTA: 3885442, CODTIPOPER: 35, TIPMOV: 'V', LIBCONF: 'S', STATUS_CONF: 'F', STATUSNOTA: 'A' }],
    executeService: async () => { chamadas++; return { status: '4', clientEvents: [{ id: 'autorizacao.adicional' }] }; }
  }), /confirmação adicional: autorizacao.adicional/);
  assert.equal(chamadas, 1);
});

test('confirmação recupera resposta perdida consultando a nota sem repetir serviço nem contagem', async () => {
  for (const confirmada of [true, false]) {
    let consultas = 0;
    let escritas = 0;
    const chamada = confirmarNotaSaidaTeste({ nunota: 3885442,
      executeQuery: async () => [{ NUNOTA: 3885442, CODTIPOPER: 35, TIPMOV: 'V', LIBCONF: 'S', STATUS_CONF: 'F',
        STATUSNOTA: ++consultas > 1 && confirmada ? 'L' : 'A' }],
      executeService: async () => { escritas++; throw new Error('Conexão encerrada'); }
    });
    if (confirmada) assert.equal((await chamada).status, 'CONFIRMADA');
    else await assert.rejects(chamada, /conferência foi preservada.*Conexão encerrada/);
    assert.equal(escritas, 1);
    assert.equal(consultas, 2);
  }
});

function painel() {
  const timers = [];
  const renders = [];
  let chamadas = 0;
  let oculto = false;
  const container = { hidden: false, isConnected: true, innerHTML: '',
    closest: () => oculto ? {} : null, querySelector: () => ({ textContent: '' }) };
  const ctx = vm.createContext({ WeakMap,
    setTimeout: (fn) => timers.push(fn),
    fetch: async (_url, options) => {
      assert.equal(options.cache, 'no-store');
      chamadas++;
      return { ok: true, json: async () => ({ nota: { NUNOTA: 3885442 },
        danfe: { disponivel: chamadas >= 2 }, boleto: { disponivel: true } }) };
    },
    renderizarPainelDocumentosFiscais: (_container, payload) => renders.push(payload)
  });
  vm.runInContext(frontend.slice(frontend.indexOf('const consultasDocumentosFiscais ='), frontend.indexOf('async function abrirDocumentoFiscal(')), ctx);
  return { ctx, timers, renders, container, chamadas: () => chamadas, ocultar: () => { oculto = true; } };
}

test('após confirmar consulta documentos até autorização sem enviar novamente a confirmação', async () => {
  const p = painel();
  await p.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 3885442, SAIDA_POR_NOTA: true }, p.container);
  assert.equal(p.renders[0].danfe.disponivel, false);
  assert.equal(p.timers.length, 1);
  await p.timers.shift()();
  assert.equal(p.renders[1].danfe.disponivel, true);
  assert.equal(p.chamadas(), 2);
  assert.equal(p.timers.length, 0);
});

test('fechar painel ou abrir outra consulta cancela atualização antiga dos documentos', async () => {
  const p = painel();
  await p.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 3885442, SAIDA_POR_NOTA: true }, p.container);
  const antiga = p.timers.shift();
  await p.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 123, SAIDA_POR_NOTA: true }, p.container);
  await antiga();
  assert.equal(p.chamadas(), 2);
  const fechado = painel();
  await fechado.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 3885442, SAIDA_POR_NOTA: true }, fechado.container);
  fechado.ocultar();
  await fechado.timers.shift()();
  assert.equal(fechado.chamadas(), 1);
});

test('limita consultas automáticas e mantém fluxo histórico sem polling', async () => {
  const p = painel();
  await p.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 3885442, SAIDA_POR_NOTA: true }, p.container, null, false, false, 20);
  assert.equal(p.timers.length, 0);
  const historico = painel();
  await historico.ctx.carregarDocumentosFiscaisPedido({ NUNOTA: 123 }, historico.container);
  assert.equal(historico.timers.length, 0);
});

test('DANFE só habilita após autorização e boleto mantém sua disponibilidade independente', () => {
  const ctx = vm.createContext({ escaparHtml: String, escaparAtributo: String, atualizarIcones() {} });
  vm.runInContext(frontend.slice(frontend.indexOf('function renderizarPainelDocumentosFiscais('), frontend.indexOf('const consultasDocumentosFiscais =')), ctx);
  const container = {};
  ctx.renderizarPainelDocumentosFiscais(container, { faturado: true, nota: { NUNOTA: 3885442 },
    danfe: { disponivel: false }, boleto: { disponivel: true } });
  assert.match(container.innerHTML, /data-documento="danfe"[^>]*disabled/);
  assert.doesNotMatch(container.innerHTML, /data-documento="boleto"[^>]*disabled/);
  ctx.renderizarPainelDocumentosFiscais(container, { faturado: true, nota: { NUNOTA: 3885442 },
    danfe: { disponivel: true }, boleto: { disponivel: true } });
  assert.doesNotMatch(container.innerHTML, /data-documento="danfe"[^>]*disabled/);
});
