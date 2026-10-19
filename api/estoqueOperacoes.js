const { planejarDatasRastreabilidade } = require('./estoqueRastreabilidade');

function inteiro(valor, nome, minimo = 1) {
  if (String(valor ?? '').trim() === '' || !Number.isSafeInteger(Number(valor)) || Number(valor) < minimo) {
    throw new Error(`Informe ${nome} válido.`);
  }
  return Number(valor);
}

function montarFiltrosAjusteIndividual(dados) {
  const codProd = inteiro(dados.codProd, 'um produto');
  return {
    empresa: inteiro(dados.empresa, 'uma empresa'), local: inteiro(dados.local, 'um local'),
    produtoInicial: codProd, produtoFinal: codProd, codProd, ajusteIndividual: true,
    grupos: [], grupo: null, marca: null, incluirSubgrupos: false,
    situacao: 'TODOS', controle: 'TODOS', saldo: 'TODOS'
  };
}

function criarOperacoesDatasEstoque({ executeQuery, atualizarRegistroApi, normalizarData, formatarData }) {
  const literal = (valor) => String(valor ?? '').replace(/'/g, "''");

  async function listar({ empresa, codProd }) {
    const codEmp = inteiro(empresa, 'uma empresa');
    const produto = inteiro(codProd, 'um produto');
    return executeQuery(`
      SELECT EST.CODEMP, EST.CODPROD, PRO.DESCRPROD, PRO.CODVOL,
        EST.CODLOCAL, NVL(LOC.DESCRLOCAL, 'Local ' || EST.CODLOCAL) AS DESCRLOCAL,
        NVL(TRIM(EST.CONTROLE), ' ') AS CONTROLE,
        NVL(EST.CODPARC, 0) AS CODPARC, NVL(EST.TIPO, 'P') AS TIPO,
        NVL(EST.ESTOQUE, 0) AS ESTOQUE,
        TO_CHAR(EST.DTFABRICACAO, 'YYYY-MM-DD') AS DTFABRICACAO,
        TO_CHAR(EST.DTVAL, 'YYYY-MM-DD') AS DTVAL
      FROM TGFEST EST
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
      LEFT JOIN TGFLOC LOC ON LOC.CODLOCAL = EST.CODLOCAL
      WHERE EST.CODEMP = ${codEmp} AND EST.CODPROD = ${produto}
        AND NVL(EST.ATIVO, 'S') = 'S' AND NVL(EST.ESTOQUE, 0) > 0
      ORDER BY EST.CODLOCAL, EST.CONTROLE, EST.CODPARC, EST.TIPO
    `);
  }

  async function atualizar(dados) {
    const chave = {
      CODEMP: inteiro(dados.empresa, 'uma empresa'), CODPROD: inteiro(dados.codProd, 'um produto'),
      CODLOCAL: inteiro(dados.codLocal, 'um local', 0), CODPARC: inteiro(dados.codParc, 'um parceiro', 0),
      CONTROLE: String(dados.controle ?? '').trim() || ' ', TIPO: String(dados.tipo || '').trim()
    };
    if (chave.CONTROLE.length > 100 || !/^[A-Z]$/.test(chave.TIPO)) throw new Error('Posição de estoque inválida.');
    const dtFabricacao = normalizarData(dados.dtFabricacao, 'A data de fabricação');
    const dtValidade = normalizarData(dados.dtValidade, 'A data de validade');
    if (!dtFabricacao && !dtValidade) throw new Error('Informe fabricação ou validade.');
    if (dtFabricacao && dtValidade && dtValidade < dtFabricacao) throw new Error('A validade não pode ser anterior à fabricação.');
    if (!Object.hasOwn(dados, 'fabricacaoAnterior') || !Object.hasOwn(dados, 'validadeAnterior')) {
      throw new Error('Recarregue os estoques antes de salvar as datas.');
    }
    const sql = `SELECT CODEMP, CODPROD, CODLOCAL, CONTROLE, CODPARC, TIPO, ESTOQUE,
      TO_CHAR(DTFABRICACAO, 'YYYY-MM-DD') AS DTFABRICACAO, TO_CHAR(DTVAL, 'YYYY-MM-DD') AS DTVAL
      FROM TGFEST WHERE CODEMP = ${chave.CODEMP} AND CODPROD = ${chave.CODPROD}
        AND CODLOCAL = ${chave.CODLOCAL} AND NVL(CODPARC, 0) = ${chave.CODPARC}
        AND NVL(TIPO, 'P') = '${chave.TIPO}'
        AND NVL(TRIM(CONTROLE), ' ') = '${literal(chave.CONTROLE)}'
        AND NVL(ATIVO, 'S') = 'S' AND NVL(ESTOQUE, 0) > 0`;
    const registros = await executeQuery(sql);
    if (registros.length !== 1) throw new Error('Posição ausente, sem saldo positivo ou ambígua. Recarregue os estoques.');
    const atual = registros[0];
    if ((atual.DTFABRICACAO || null) !== (dados.fabricacaoAnterior || null)
      || (atual.DTVAL || null) !== (dados.validadeAnterior || null)) {
      const erro = new Error('As datas foram alteradas por outro usuário. Recarregue os estoques.');
      erro.status = 409;
      throw erro;
    }
    if ((atual.DTFABRICACAO && !dtFabricacao) || (atual.DTVAL && !dtValidade)) {
      throw new Error('Não apague datas existentes. Informe a nova data.');
    }
    const plano = planejarDatasRastreabilidade({ registro: atual, dtFabricacao, dtValidade });
    if (Object.keys(plano.camposAlterados).length) {
      const campos = Object.fromEntries(Object.entries(plano.camposAlterados).map(([campo, valor]) => [campo, formatarData(valor)]));
      await atualizarRegistroApi('Estoque', chave, campos);
      const confirmados = await executeQuery(sql);
      if (confirmados.length !== 1 || (dtFabricacao && confirmados[0].DTFABRICACAO !== dtFabricacao)
        || (dtValidade && confirmados[0].DTVAL !== dtValidade)) {
        throw new Error('O Sankhya não confirmou a gravação das datas. Recarregue os estoques antes de tentar novamente.');
      }
      return confirmados[0];
    }
    return atual;
  }

  return { listar, atualizar };
}

module.exports = { montarFiltrosAjusteIndividual, criarOperacoesDatasEstoque };
