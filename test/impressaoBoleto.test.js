const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../api/sankhyaApi');
const banco = require('../api/faturamentoBanco');

function preparar(t, { itau = true, sicredi = false, direto = true, semChave = false, erroConta = false } = {}) {
  const ambienteOriginal = process.env.SANKHYA_OM_BASE_URL;
  if (direto) process.env.SANKHYA_OM_BASE_URL = 'http://sankhya.test/mge';
  else delete process.env.SANKHYA_OM_BASE_URL;
  const chamadas = [];
  const pdf = Buffer.from('%PDF-1.4\n');
  t.after(() => {
    if (ambienteOriginal === undefined) delete process.env.SANKHYA_OM_BASE_URL;
    else process.env.SANKHYA_OM_BASE_URL = ambienteOriginal;
    delete require.cache[require.resolve('../routes')];
  });
  t.mock.method(banco, 'garantirContaFaturamento', async () => {
    chamadas.push('conta');
    if (erroConta) throw new Error('Conta divergente');
    return { aplicavel: itau || sicredi, corrigidos: 0, ...(sicredi ? { relatorioBoleto: 12 } : {}) };
  });
  t.mock.method(api, 'executeQuery', async () => [{
    NUFIN: 200, CODEMP: 1, CODCTABCOINT: sicredi ? 82 : 50, CODBCO: sicredi ? 748 : 1, NURFEMODBOLETO: sicredi ? 314 : 11
  }]);
  t.mock.method(api, 'executeService', async (servico, payload, opcoes) => {
    chamadas.push({ servico, payload, opcoes });
    return semChave ? {} : { responseBody: { documento: { valor: 'arquivo-teste' } } };
  });
  t.mock.method(api, 'executeDirectService', async (servico, payload) => {
    if (sicredi) {
      assert.equal(payload.configBoleto.codigoRelatorio, 12);
      assert.equal(payload.configBoleto.codBco, '82');
      assert.equal(payload.configBoleto.codigoConta, '748');
      assert.equal(payload.configBoleto.gerarNumeroBoleto, false);
      assert.equal(payload.configBoleto.registraConta, false);
    }
    chamadas.push(servico);
    return { responseBody: { documento: { valor: 'arquivo-teste' } } };
  });
  for (const metodo of ['downloadGatewayFile', 'downloadDirectFile']) {
    t.mock.method(api, metodo, async (modulo, recurso) => {
      chamadas.push(`${metodo}:${recurso}`);
      return { buffer: pdf };
    });
  }
  delete require.cache[require.resolve('../routes')];
  return { gerar: require('../routes')._internals.gerarDocumentoFiscalSankhya, chamadas, pdf };
}

test('imprime Itaú da empresa 8 pelo serviço nativo mesmo com OM direto configurado', async (t) => {
  const { gerar, chamadas, pdf } = preparar(t);
  assert.deepEqual(await gerar(100, 'boleto'), pdf);
  assert.deepEqual(chamadas, [
    'conta',
    {
      servico: 'ImpressaoNotasSP.imprimeDocumentos',
      payload: { notas: {
        pedidoWeb: 'false', gerarpdf: 'true', ownerServiceCall: 'CentralNotas',
        nota: [{ nuNota: 100, tipoImp: 3 }]
      } },
      opcoes: { modulePath: 'mge', forceAccessSession: true }
    },
    'downloadGatewayFile:visualizadorArquivos.mge'
  ]);
});

test('preserva pré-visualização direta dos demais bancos e empresas', async (t) => {
  const { gerar, chamadas } = preparar(t, { itau: false });
  await gerar(100, 'boleto');
  assert.deepEqual(chamadas, ['conta', 'BoletoSP.buildPreVisualizacao', 'downloadDirectFile:visualizadorArquivos.mge']);
});

test('imprime Sicredi conta 82 pelo relatório 12 sem gerar novo nosso número', async (t) => {
  const { gerar, chamadas } = preparar(t, { sicredi: true });
  await gerar(100, 'boleto');
  assert.deepEqual(chamadas, ['conta', 'BoletoSP.buildPreVisualizacao', 'downloadDirectFile:visualizadorArquivos.mge']);
});

test('preserva impressão nativa sem OM direto para outros bancos', async (t) => {
  const { gerar, chamadas } = preparar(t, { itau: false, direto: false });
  await gerar(100, 'boleto');
  assert.equal(chamadas[1].servico, 'ImpressaoNotasSP.imprimeDocumentos');
});

test('mantém recuperação do boleto armazenado quando impressão não retorna chave', async (t) => {
  const { gerar, chamadas, pdf } = preparar(t, { semChave: true });
  assert.deepEqual(await gerar(100, 'boleto'), pdf);
  assert.equal(chamadas.at(-1), 'downloadGatewayFile:download.mge');
});

test('não imprime boleto se a validação da conta falhar', async (t) => {
  const { gerar, chamadas } = preparar(t, { erroConta: true });
  await assert.rejects(gerar(100, 'boleto'), /Conta divergente/);
  assert.deepEqual(chamadas, ['conta']);
});

test('mantém impressão de DANFE sem validação bancária', async (t) => {
  const { gerar, chamadas } = preparar(t);
  await gerar(100, 'danfe');
  assert.equal(chamadas[0].payload.notas.nota[0].tipoImp, 9);
  assert.equal(chamadas.includes('conta'), false);
});
