const test = require('node:test');
const assert = require('node:assert/strict');
const { planejarDetalhesConferenciaSaida, gravarDetalhesConferenciaSaida } = require('../api/conferenciaSaida');

const item = { CODPROD: 1072, CODBARRA: '7896061734915', CODVOL: 'UN', CONTROLE: '0070702310000020', QTDNEG: 10, QTDCORTE: 0 };

test('consolida as linhas 24 e 30 do pedido sem duplicar a quantidade ja salva', () => {
  const existentes = [{ ...item, SEQCONF: 24, QTDCONF: 10 }];
  const plano = planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 30 }
  ], existentes);
  assert.equal(plano.atribuicoes.length, 1);
  assert.equal(plano.atribuicoes[0].seqConf, 24);
  assert.equal(plano.atribuicoes[0].existente, true);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 20);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONFVOLPAD, 20);
  assert.equal(existentes[0].QTDCONF, 10);
  const repeticao = planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 30 }
  ], [{ ...plano.atribuicoes[0].detalhe, SEQCONF: 24 }]);
  assert.equal(repeticao.atribuicoes[0].detalhe.QTDCONF, 20);
});

test('bloqueia a mesma linha retornada duas vezes por unidades alternativas', () => {
  assert.throws(() => planejarDetalhesConferenciaSaida([
    { ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 24 }
  ], []), /sequencia 24 mais de uma vez/);
});

test('aloca os itens restantes depois das 29 linhas parcialmente salvas', () => {
  const itens = Array.from({ length: 29 }, (_, i) => ({ ...item, SEQUENCIA: i + 1, CODPROD: 9000 + i }));
  itens[23] = { ...item, SEQUENCIA: 24 };
  const existentes = itens.map((r) => ({ ...r, SEQCONF: r.SEQUENCIA }));
  itens.push({ ...item, SEQUENCIA: 30 }, { ...item, SEQUENCIA: 31, CODPROD: 1092 });
  const plano = planejarDetalhesConferenciaSaida(itens, existentes);
  assert.equal(plano.atribuicoes.length, 30);
  assert.equal(plano.atribuicoes[23].detalhe.QTDCONF, 20);
  assert.equal(plano.atribuicoes[29].seqConf, 30);
  assert.equal(plano.atribuicoes[29].existente, false);
});

test('retoma um detalhe existente sem somar a quantidade novamente', () => {
  const plano = planejarDetalhesConferenciaSaida([{ ...item, SEQUENCIA: 24 }], [
    { ...item, SEQCONF: 24, QTDCONF: 10 }
  ]);
  assert.equal(plano.atribuicoes[0].seqConf, 24);
  assert.equal(plano.atribuicoes[0].existente, true);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 10);
});

test('preserva lotes, unidades e barras diferentes e desconta cortes por linha', () => {
  const plano = planejarDetalhesConferenciaSaida([
    { ...item, QTDCORTE: 3 },
    { ...item, CONTROLE: 'outro' }, { ...item, CODVOLCONF: 'PC' },
    { ...item, CODBARRACONF: 'outra' }, { ...item, CODPROD: 8888, QTDCORTE: 10 }
  ], []);
  assert.equal(plano.atribuicoes.length, 4);
  assert.equal(plano.atribuicoes[0].detalhe.QTDCONF, 7);
});

test('mantem sequencias das chaves existentes e zera detalhes que foram cortados', () => {
  const existentes = [{ ...item, SEQCONF: 7 }, { ...item, CONTROLE: 'outro', SEQCONF: 1 }];
  const plano = planejarDetalhesConferenciaSaida([item], existentes);
  assert.equal(plano.atribuicoes[0].seqConf, 7);
  assert.deepEqual(plano.sequenciasObsoletas, [1]);
});

function ambienteGravacao(itens, existentes = []) {
  const banco = existentes.map((d) => ({ ...d }));
  const chamadas = [];
  return {
    banco, chamadas,
    opcoes: {
      nuconf: 700, itens, existentes, dhAlter: '18/09/2026 10:00:00',
      consultarGravados: async () => banco,
      executeService: async (servico, body) => {
        chamadas.push(body);
        assert.equal(servico, 'DatasetSP.save');
        assert.equal(body.entityName, 'DetalhesConferencia');
        for (const record of body.records) {
          const dados = Object.fromEntries(Object.entries(record.values).map(([i, v]) => [body.fields[i], v]));
          if (record.pk) {
            const atual = banco.find((d) => Number(d.SEQCONF) === record.pk.SEQCONF);
            assert.ok(atual, 'atualização precisa apontar para registro existente');
            Object.assign(atual, dados);
          } else {
            assert.equal(record.foreignKey.NUCONF, 700);
            assert.ok(!banco.some((d) => d.SEQCONF === dados.SEQCONF));
            banco.push(dados);
          }
        }
      }
    }
  };
}

test('grava 69 itens em uma chamada e não regrava detalhes já corretos', async () => {
  const itens = Array.from({ length: 69 }, (_, i) => ({ ...item, CODPROD: 1000 + i, SEQUENCIA: i + 1 }));
  const a = ambienteGravacao(itens);
  assert.deepEqual(await gravarDetalhesConferenciaSaida(a.opcoes), { registros: 69, lotes: 1 });
  assert.equal(a.chamadas.length, 1);
  assert.deepEqual(await gravarDetalhesConferenciaSaida({ ...a.opcoes, existentes: a.banco }), { registros: 0, lotes: 0 });
  assert.equal(a.chamadas.length, 1);
});

test('consolida duplicação anterior e zera sobra no mesmo lote sem somar novamente', async () => {
  const a = ambienteGravacao([{ ...item, SEQUENCIA: 24 }, { ...item, SEQUENCIA: 30 }], [
    { ...item, SEQCONF: 24, QTDCONF: 10, QTDCONFVOLPAD: 10 },
    { ...item, SEQCONF: 30, QTDCONF: 10, QTDCONFVOLPAD: 10 }
  ]);
  await gravarDetalhesConferenciaSaida(a.opcoes);
  assert.equal(a.chamadas.length, 1);
  assert.equal(a.banco[0].QTDCONF, 20);
  assert.equal(a.banco[1].QTDCONF, 0);
});

test('limita lote a 100 registros e retoma gravação parcial usando as chaves existentes', async () => {
  const itens = Array.from({ length: 205 }, (_, i) => ({ ...item, CODPROD: 1000 + i, SEQUENCIA: i + 1 }));
  const a = ambienteGravacao(itens);
  const gravar = a.opcoes.executeService;
  let tentativa = 0;
  await assert.rejects(gravarDetalhesConferenciaSaida({ ...a.opcoes, executeService: async (...args) => {
    if (++tentativa === 2) throw new Error('Conexão interrompida');
    return gravar(...args);
  } }), /Conexão interrompida/);
  assert.equal(tentativa, 2);
  assert.equal(a.banco.length, 100);
  assert.deepEqual(await gravarDetalhesConferenciaSaida({ ...a.opcoes, existentes: a.banco }), { registros: 105, lotes: 2 });
  assert.equal(a.banco.length, 205);
});

test('impede avanço quando o serviço responde mas não grava todos os itens', async () => {
  const a = ambienteGravacao([item]);
  await assert.rejects(gravarDetalhesConferenciaSaida({ ...a.opcoes, executeService: async () => ({ status: '1' }) }), /não foi gravada integralmente/);
});

test('verificação após gravação detecta linhas duplicadas e quantidades divergentes', async () => {
  for (const corromper of [
    (banco) => banco.push({ ...banco[0], SEQCONF: 99 }),
    (banco) => { banco[0].QTDCONF = 999; }
  ]) {
    const a = ambienteGravacao([item]);
    await assert.rejects(gravarDetalhesConferenciaSaida({ ...a.opcoes, consultarGravados: async () => {
      corromper(a.banco);
      return a.banco;
    } }), /não foi gravada integralmente/);
  }
});
