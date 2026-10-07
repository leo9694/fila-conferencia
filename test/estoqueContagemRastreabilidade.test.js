const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { semControleAdicional } = require('../api/estoqueContagemControle');
const { planejarDatasRastreabilidade, deveMigrarPosicaoControle } = require('../api/estoqueRastreabilidade');

// Exercita o fluxo real da rota com o Sankhya inteiramente simulado.
const fonte = fs.readFileSync(path.join(__dirname, '..', 'routes.js'), 'utf8');
const inicio = fonte.indexOf('async function atualizarRastreabilidadeItemEstoque(');
const funcao = fonte.slice(inicio, fonte.indexOf('\nfunction dataNegociacaoAjusteEstoque', inicio));

function preparar({ tipo = 'N', posicoes = [] } = {}) {
  const gravacoes = [];
  let criada = null;
  const contexto = {
    semControleAdicional, planejarDatasRastreabilidade, deveMigrarPosicaoControle,
    normalizarDataIsoRastreabilidade: (valor) => valor || null,
    normalizarControleConferencia: (valor) => String(valor || '').trim() || ' ',
    textoSql: (valor) => String(valor).replace(/'/g, "''"),
    formatarDataCampoSankhya: (valor) => valor,
    consultarPosicoesRastreabilidade: async () => posicoes,
    executeQuery: async (sql) => sql.includes('FROM TGFPRO') ? [{ TIPCONTEST: tipo }] : (criada ? [criada] : posicoes),
    salvarRegistroApi: async (entidade, dados) => { gravacoes.push({ entidade, dados }); criada = dados; },
    atualizarRegistroApi: async () => { throw new Error('Não deveria alterar datas.'); },
    migrarPosicaoControle: async () => { throw new Error('Não deveria migrar controle.'); }
  };
  vm.createContext(contexto);
  vm.runInContext(funcao, contexto);
  return { executar: contexto.atualizarRastreabilidadeItemEstoque, gravacoes };
}
const parametros = { sessao: { empresa: 1 }, item: { codProd: 30, codLocal: 1, chave: '30|1|SEM_CONTROLE', controle: '', adicionadoManualmente: true }, dados: { controle: '', dtFabricacao: null, dtValidade: null } };

test('cria posição sem lote nem datas para item sem controle adicional', async () => {
  const { executar, gravacoes } = preparar();
  const retorno = await executar(parametros);
  assert.equal(retorno.controle, '');
  assert.equal(retorno.dtValidade, null);
  assert.equal(gravacoes.length, 1);
  assert.equal(gravacoes[0].dados.CONTROLE, ' ');
  assert.equal(gravacoes[0].dados.ESTOQUE, 0);
  assert.equal(gravacoes[0].dados.DTVAL, undefined);
});

test('confirma posição existente sem inventar lote, datas ou migrar saldo', async () => {
  const { executar, gravacoes } = preparar({ posicoes: [{ CONTROLE: ' ', ESTOQUE: 12 }] });
  const retorno = await executar({ ...parametros, dados: { controle: 'LOTE-INDEVIDO', dtFabricacao: '2026-01-01', dtValidade: '2027-01-01' } });
  assert.equal(retorno.estoqueSistema, 12);
  assert.equal(retorno.controle, '');
  assert.equal(gravacoes.length, 0);
});

test('não permite criar posição sem controle para produto controlado nem misturar posições ambíguas', async () => {
  await assert.rejects(preparar({ tipo: 'L' }).executar(parametros), /Nenhuma posição/);
  await assert.rejects(preparar({ posicoes: [{ CONTROLE: '', ESTOQUE: 1 }, { CONTROLE: ' ', ESTOQUE: 2 }] }).executar(parametros), /Mais de uma posição/);
});
