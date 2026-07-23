const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  criarEstoqueContagemStore,
  obterContagemAtual
} = require('../api/estoqueContagemStore');

function criarStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estoque-contagem-'));
  return criarEstoqueContagemStore({ namespace: 'sandbox', baseDir: dir });
}

const itens = [
  {
    CODPROD: 10,
    DESCRPROD: 'Produto A',
    CODVOL: 'UN',
    CODGRUPOPROD: 100,
    DESCRGRUPOPROD: 'Defensivos',
    CODLOCAL: 1,
    DESCRLOCAL: 'Deposito',
    CONTROLE: '',
    ESTOQUE: 5
  },
  {
    CODPROD: 20,
    DESCRPROD: 'Produto B',
    CODVOL: 'UN',
    CODGRUPOPROD: 200,
    DESCRGRUPOPROD: 'Sementes',
    CODLOCAL: 1,
    DESCRLOCAL: 'Deposito',
    CONTROLE: 'L1',
    ESTOQUE: 8
  }
];

test('cria copia cega e conclui contagem sem divergencia', () => {
  const store = criarStore();
  const sessao = store.criar({
    empresa: 1,
    usuario: 7,
    filtros: { grupo: 100, marca: 'Marca A', saldo: 'POSITIVO' },
    itens
  });

  assert.deepEqual(sessao.filtros, { grupo: 100, marca: 'Marca A', saldo: 'POSITIVO' });
  assert.equal(sessao.itens[0].codGrupoProd, 100);
  assert.equal(sessao.itens[0].descrGrupoProd, 'Defensivos');
  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 5, usuario: 7 });
  store.registrar({ id: sessao.id, chave: sessao.itens[1].chave, quantidade: 8, usuario: 7 });
  const concluida = store.finalizarRodada({ id: sessao.id, usuario: 7 });

  assert.equal(concluida.status, 'CONCLUIDA');
  assert.deepEqual(store.resumir(concluida), {
    totalItens: 2,
    itensContados: 2,
    itensPendentes: 0,
    itensDivergentes: 0,
    unidadesSistema: 13,
    unidadesContadas: 13,
    diferencaUnidades: 0
  });
});

test('preserva primeira contagem e permite recontar somente divergencias', () => {
  const store = criarStore();
  const sessao = store.criar({ empresa: 1, usuario: 7, itens });

  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 4, usuario: 7 });
  store.registrar({ id: sessao.id, chave: sessao.itens[1].chave, quantidade: 8, usuario: 7 });
  assert.equal(store.finalizarRodada({ id: sessao.id }).status, 'EM_ANALISE');

  const recontagem = store.iniciarRecontagem({ id: sessao.id, usuario: 9 });
  assert.equal(recontagem.rodadaAtual, 2);
  assert.equal(obterContagemAtual(recontagem, recontagem.itens[0]), 4);
  assert.equal(obterContagemAtual(recontagem, recontagem.itens[1]), 8);
  assert.throws(
    () => store.registrar({ id: sessao.id, chave: sessao.itens[1].chave, quantidade: 8 }),
    /somente itens divergentes/
  );

  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 5, usuario: 9 });
  const concluida = store.finalizarRodada({ id: sessao.id, usuario: 9 });
  assert.equal(concluida.status, 'CONCLUIDA');
  assert.equal(concluida.itens[0].contagens['1'], 4);
  assert.equal(concluida.itens[0].contagens['2'], 5);
});

test('conclui com pendentes sem transformar itens nao contados em ajuste', () => {
  const store = criarStore();
  const sessao = store.criar({ empresa: 1, itens });

  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 4 });
  const analisada = store.finalizarRodada({ id: sessao.id });

  assert.equal(analisada.status, 'EM_ANALISE');
  assert.equal(analisada.itens[1].contagens['1'], undefined);
  assert.deepEqual(store.resumir(analisada), {
    totalItens: 2,
    itensContados: 1,
    itensPendentes: 1,
    itensDivergentes: 1,
    unidadesSistema: 13,
    unidadesContadas: 4,
    diferencaUnidades: -1
  });
  const prontaParaAjuste = store.concluirAnalise({ id: sessao.id });
  assert.equal(prontaParaAjuste.status, 'PRONTA_PARA_AJUSTE');
  assert.equal(prontaParaAjuste.itens[1].contagens['1'], undefined);
});

test('conclui contagem parcial correta mantendo o restante pendente', () => {
  const store = criarStore();
  const sessao = store.criar({ empresa: 1, itens });

  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 5 });
  const concluida = store.finalizarRodada({ id: sessao.id });

  assert.equal(concluida.status, 'CONCLUIDA');
  assert.equal(concluida.itens[1].contagens['1'], undefined);
  assert.equal(store.resumir(concluida).itensPendentes, 1);
  assert.equal(store.resumir(concluida).itensDivergentes, 0);
  assert.equal(store.resumir(concluida).diferencaUnidades, 0);
});

test('registra notas pendentes e impede nova aplicacao do mesmo ajuste', () => {
  const store = criarStore();
  const sessao = store.criar({ empresa: 1, itens });
  store.registrar({ id: sessao.id, chave: sessao.itens[0].chave, quantidade: 4 });
  store.finalizarRodada({ id: sessao.id });
  store.concluirAnalise({ id: sessao.id });

  const ajustada = store.registrarAjustes({
    id: sessao.id,
    usuario: 7,
    notas: [{
      nunota: 123,
      tipo: 'SAIDA',
      codTipOper: 157,
      quantidadeItens: 1,
      observacao: 'Contagem app'
    }]
  });

  assert.equal(ajustada.status, 'AJUSTE_GERADO');
  assert.equal(ajustada.ajuste.notas[0].status, 'PENDENTE_CONFIRMACAO');
  assert.equal(store.registrarAjustes({ id: sessao.id, notas: [] }).ajuste.notas[0].nunota, 123);
});

test('exclui somente a copia controlada pelo app', () => {
  const store = criarStore();
  const sessao = store.criar({ empresa: 1, itens });

  const excluida = store.excluir({ id: sessao.id });

  assert.equal(excluida.id, sessao.id);
  assert.equal(store.obter(sessao.id), null);
  assert.equal(store.listar().length, 0);
});
