function literal(valor) {
  return String(valor).replace(/'/g, "''");
}

async function listarFiltrosProdutos({ executeQuery }) {
  const grupos = await executeQuery(`
    SELECT DISTINCT PRO.CODGRUPOPROD, NVL(GRU.DESCRGRUPOPROD, 'Grupo ' || PRO.CODGRUPOPROD) AS DESCRGRUPOPROD
    FROM TGFPRO PRO LEFT JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
    WHERE PRO.CODGRUPOPROD IS NOT NULL ORDER BY DESCRGRUPOPROD
  `);
  const marcas = await executeQuery(`
    SELECT DISTINCT TRIM(PRO.MARCA) AS MARCA FROM TGFPRO PRO
    WHERE TRIM(PRO.MARCA) IS NOT NULL ORDER BY MARCA
  `);
  return { grupos, marcas: marcas.map((item) => item.MARCA).filter(Boolean) };
}

async function pesquisarProdutos({ busca, grupo, marca, executeQuery }) {
  const termo = String(busca || '').trim();
  const codigoGrupo = String(grupo ?? '').trim();
  const nomeMarca = String(marca ?? '').trim();
  if ((!termo && !codigoGrupo && !nomeMarca) || termo.length > 120 || nomeMarca.length > 120
    || (codigoGrupo && (!/^\d+$/.test(codigoGrupo) || !Number.isSafeInteger(Number(codigoGrupo))))) {
    const error = new Error('Informe uma pesquisa ou filtros válidos, com até 120 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  const palavras = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/\s+/).filter(Boolean);
  const numero = /^\d+$/.test(termo) && Number.isSafeInteger(Number(termo)) && Number(termo) > 0 ? Number(termo) : null;
  const exato = termo ? `(PRO.REFERENCIA = '${literal(termo)}' OR PRO.AD_CODBAR = '${literal(termo)}'
    OR PRO.AD_CBARANT = '${literal(termo)}' ${numero ? `OR PRO.CODPROD = ${numero}` : ''}
    OR EXISTS (SELECT 1 FROM TGFVOA VOA WHERE VOA.CODPROD = PRO.CODPROD AND VOA.CODBARRA = '${literal(termo)}' AND NVL(VOA.ATIVO, 'S') = 'S')
    OR EXISTS (SELECT 1 FROM TGFEST EST WHERE EST.CODPROD = PRO.CODPROD AND EST.CODBARRA = '${literal(termo)}'))` : '(1 = 0)';
  const descricao = "TRANSLATE(UPPER(PRO.DESCRPROD), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')";
  const porNome = palavras.map((palavra) => `INSTR(${descricao}, '${literal(palavra)}') > 0`).join(' AND ');
  const encontrados = await executeQuery(`
    SELECT * FROM (
      SELECT PRO.CODPROD, PRO.DESCRPROD, PRO.REFERENCIA, PRO.CODVOL,
        CASE WHEN ${exato} THEN 1 ELSE 0 END AS EXATO
      FROM TGFPRO PRO
      WHERE ${termo ? `(${exato} OR (${porNome}))` : '1 = 1'}
        ${codigoGrupo ? `AND PRO.CODGRUPOPROD = ${Number(codigoGrupo)}` : ''}
        ${nomeMarca ? `AND TRIM(PRO.MARCA) = '${literal(nomeMarca)}'` : ''}
      ORDER BY EXATO DESC, UPPER(PRO.DESCRPROD), PRO.CODPROD
    ) WHERE ROWNUM <= 101
  `);
  const exatos = encontrados.filter((produto) => Number(produto.EXATO) === 1);
  const candidatos = exatos.length ? exatos : encontrados;
  const produtos = candidatos.slice(0, 100);
  const ids = produtos.map((p) => Number(p.CODPROD)).filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return { produtos: [], empresas: [], limitado: false };
  const saldos = await executeQuery(`
    SELECT EST.CODPROD, EST.CODEMP, NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS NOMEEMPRESA,
      SUM(NVL(EST.ESTOQUE, 0)) AS ESTOQUE,
      SUM(NVL(EST.ESTOQUE, 0) - NVL(EST.RESERVADO, 0)) AS DISPONIVEL
    FROM TGFEST EST LEFT JOIN TSIEMP EMP ON EMP.CODEMP = EST.CODEMP
    WHERE EST.CODPROD IN (${ids.join(', ')}) AND NVL(EST.ATIVO, 'S') = 'S' AND NVL(EST.ESTOQUE, 0) > 0
    GROUP BY EST.CODPROD, EST.CODEMP, NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL)
    ORDER BY EST.CODEMP, EST.CODPROD
  `);
  const empresas = new Map();
  for (const saldo of saldos) empresas.set(Number(saldo.CODEMP), { CODEMP: saldo.CODEMP, NOMEEMPRESA: saldo.NOMEEMPRESA });
  return {
    produtos: produtos.map((produto) => ({ ...produto, estoquePorEmpresa: saldos.filter((saldo) => Number(saldo.CODPROD) === Number(produto.CODPROD)) })),
    empresas: [...empresas.values()], limitado: candidatos.length > 100
  };
}

module.exports = { pesquisarProdutos, listarFiltrosProdutos };
