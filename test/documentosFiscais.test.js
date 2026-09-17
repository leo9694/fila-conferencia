const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../routes');

test('extrai chave do PDF retornada pelo servico de impressao', () => {
  const resultado = {
    responseBody: {
      documento: { valor: 'preVisualizacao_ABC123' }
    }
  };

  assert.equal(routes._internals.extrairChaveDocumento(resultado), 'preVisualizacao_ABC123');
});

test('extrai chave do PDF retornada pelo visualizador de relatorios', () => {
  const resultado = {
    responseBody: {
      chave: { valor: 'vRfe_ABC123' }
    }
  };

  assert.equal(routes._internals.extrairChaveDocumento(resultado), 'vRfe_ABC123');
});

test('usa o modelo DACTE configurado no Sankhya e possui fallback seguro', () => {
  assert.equal(routes._internals.extrairModeloDacte('<value modeloDacte="987" />'), 987);
  assert.equal(routes._internals.extrairModeloDacte(null), 163);
});

test('normaliza avisos de impressao do Sankhya', () => {
  const resultado = {
    responseBody: {
      avisos: {
        aviso: [{ $: 'Nota sem status NFe.' }, { $: 'Boleto indisponivel.' }]
      }
    }
  };

  assert.deepEqual(routes._internals.extrairAvisosDocumento(resultado), [
    'Nota sem status NFe.',
    'Boleto indisponivel.'
  ]);
});
