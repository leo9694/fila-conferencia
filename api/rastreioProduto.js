const { validarPeriodo } = require('./relatorioCtes');
const CAMPOS_COLUNAS = {
  colData: "TO_CHAR(NVL(CAB.DTENTSAI, CAB.DTNEG), 'DD/MM/YYYY')",
  colMovimento: "(CASE CAB.TIPMOV WHEN 'V' THEN 'Venda' WHEN 'C' THEN 'Compra' WHEN 'P' THEN 'Pedido de venda' WHEN 'O' THEN 'Pedido de compra' WHEN 'D' THEN 'Devolução de venda' WHEN 'E' THEN 'Devolução de compra' WHEN 'T' THEN 'Transferência' WHEN 'F' THEN 'Produção' WHEN 'J' THEN 'Requisição' WHEN 'Q' THEN 'Requisição' ELSE CAB.TIPMOV END)",
  colDocumento: 'TO_CHAR(NVL(NULLIF(CAB.NUMNOTA, 0), CAB.NUNOTA))',
  colTop: "(TO_CHAR(CAB.CODTIPOPER) || ' - ' || NVL(TOP.DESCROPER, '—'))",
  colEmpresa: "(TO_CHAR(CAB.CODEMP) || ' - ' || NVL(EMP.NOMEFANTASIA, '—'))",
  colParceiro: "(TO_CHAR(CAB.CODPARC) || ' - ' || NVL(PAR.NOMEPARC, '—'))"
};

function validarFiltrosRastreio(query = {}) {
  const periodo = validarPeriodo(query.dataInicial, query.dataFinal);
  const inteiro = (valor, padrao) => {
    const texto = String(valor ?? padrao);
    if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) < 1) {
      throw Object.assign(new Error('Informe um código de produto e paginação válidos.'), { statusCode: 400 });
    }
    return Number(texto);
  };
  const codProd = inteiro(query.codProd, '');
  const pagina = inteiro(query.pagina, 1);
  const limite = Math.min(inteiro(query.limite, 50), 100);
  const empresa = query.empresa == null || query.empresa === '' ? null : inteiro(query.empresa);
  const top = query.top == null || query.top === '' ? null : inteiro(query.top);
  const colunas = {};
  const selecoes = query.selecoes ?? {};
  if (!selecoes || typeof selecoes !== 'object' || Array.isArray(selecoes)) throw Object.assign(new Error('Seleção de coluna inválida.'), { statusCode: 400 });
  for (const [campo, selecao] of Object.entries(selecoes)) {
    if (!Object.hasOwn(CAMPOS_COLUNAS, campo) || !selecao || !['incluir', 'excluir'].includes(selecao.modo)
      || !Array.isArray(selecao.valores) || selecao.valores.length > 10000
      || selecao.valores.some((valor) => typeof valor !== 'string' || valor.length > 500)) {
      throw Object.assign(new Error('Seleção de coluna inválida.'), { statusCode: 400 });
    }
  }
  for (const campo of ['colData', 'colMovimento', 'colDocumento', 'colTop', 'colEmpresa', 'colParceiro']) {
    const valor = query[campo] ?? '';
    if (typeof valor !== 'string' || valor.length > 160) {
      throw Object.assign(new Error('Filtro de coluna inválido (máximo de 160 caracteres).'), { statusCode: 400 });
    }
    colunas[campo] = valor.trim();
  }
  if (!Number.isSafeInteger(pagina * limite)) {
    throw Object.assign(new Error('Página inválida.'), { statusCode: 400 });
  }
  return { ...periodo, codProd, pagina, limite, empresa, top, ...colunas, selecoes };
}

function montarSqlRastreio(filtros, colunaValores = null) {
  const validado = validarFiltrosRastreio(filtros);
  const { codProd, dataInicial, dataFinal, pagina, limite, empresa, top } = validado;
  const campos = {
    colData: "TO_CHAR(NVL(CAB.DTENTSAI, CAB.DTNEG), 'DD/MM/YYYY')",
    colMovimento: "(CASE CAB.TIPMOV WHEN 'V' THEN 'Venda' WHEN 'C' THEN 'Compra' WHEN 'P' THEN 'Pedido de venda' WHEN 'O' THEN 'Pedido de compra' WHEN 'D' THEN 'Devolução de venda' WHEN 'E' THEN 'Devolução de compra' WHEN 'T' THEN 'Transferência' WHEN 'F' THEN 'Produção' WHEN 'J' THEN 'Requisição' WHEN 'Q' THEN 'Requisição' ELSE CAB.TIPMOV END)",
    colDocumento: "(TO_CHAR(CAB.NUMNOTA) || ' ' || TO_CHAR(CAB.NUNOTA) || ' ' || CAB.SERIENOTA)",
    colTop: "(TO_CHAR(CAB.CODTIPOPER) || ' - ' || TOP.DESCROPER)",
    colEmpresa: "(TO_CHAR(CAB.CODEMP) || ' - ' || EMP.NOMEFANTASIA)",
    colParceiro: "(TO_CHAR(CAB.CODPARC) || ' - ' || PAR.NOMEPARC)"
  };
  const filtrosColunas = Object.entries(campos).filter(([campo]) => validado[campo]).map(([campo, expressao]) => {
    const texto = validado[campo].toUpperCase().replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&').replace(/'/g, "''");
    return `AND UPPER(${expressao}) LIKE '%${texto}%' ESCAPE '\\'`;
  }).join('\n');
  const filtrosSelecao = Object.entries(validado.selecoes).map(([campo, selecao]) => {
    if (!selecao.valores.length) return selecao.modo === 'incluir' ? 'AND 1 = 0' : '';
    const grupos = [];
    for (let index = 0; index < selecao.valores.length; index += 900) {
      const valores = selecao.valores.slice(index, index + 900).map((valor) => `'${valor.replace(/'/g, "''")}'`).join(',');
      grupos.push(`${CAMPOS_COLUNAS[campo]} ${selecao.modo === 'incluir' ? 'IN' : 'NOT IN'} (${valores})`);
    }
    return `AND (${grupos.join(selecao.modo === 'incluir' ? ' OR ' : ' AND ')})`;
  }).join('\n');
  if (colunaValores && !Object.hasOwn(CAMPOS_COLUNAS, colunaValores)) throw Object.assign(new Error('Coluna inválida.'), { statusCode: 400 });
  const base = `
      SELECT
        ${colunaValores ? `${CAMPOS_COLUNAS[colunaValores]} AS VALOR,` : ''}
        TO_CHAR(NVL(CAB.DTENTSAI, CAB.DTNEG), 'YYYY-MM-DD') AS DATA_MOVIMENTO,
        TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') AS DATA_NEGOCIACAO,
        CAB.NUNOTA, CAB.NUMNOTA, CAB.SERIENOTA, CAB.CODEMP,
        EMP.NOMEFANTASIA AS EMPRESA, CAB.CODPARC, PAR.NOMEPARC,
        CAB.TIPMOV, CAB.CODTIPOPER, TOP.DESCROPER, CAB.STATUSNOTA,
        ITE.SEQUENCIA, ITE.CONTROLE, ITE.CODLOCALORIG, ITE.CODVOL,
        ITE.QTDNEG, ITE.VLRUNIT, ITE.VLRTOT, ITE.ATUALESTOQUE, ITE.RESERVA,
        COUNT(*) OVER () AS TOTAL,
        ROW_NUMBER() OVER (ORDER BY NVL(CAB.DTENTSAI, CAB.DTNEG), CAB.NUNOTA, ITE.SEQUENCIA) AS LINHA
      FROM TGFITE ITE
      JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
      LEFT JOIN TGFTOP TOP ON TOP.CODTIPOPER = CAB.CODTIPOPER AND TOP.DHALTER = CAB.DHTIPOPER
      LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
      WHERE ITE.CODPROD = ${codProd}
        ${empresa ? `AND CAB.CODEMP = ${empresa}` : ''}
        ${top ? `AND CAB.CODTIPOPER = ${top}` : ''}
        ${filtrosColunas}
        ${filtrosSelecao}
        AND NVL(CAB.DTENTSAI, CAB.DTNEG) >= TO_DATE('${dataInicial}', 'YYYY-MM-DD')
        AND NVL(CAB.DTENTSAI, CAB.DTNEG) < TO_DATE('${dataFinal}', 'YYYY-MM-DD') + 1`;
  if (colunaValores) return `SELECT DISTINCT VALOR FROM (${base}) ORDER BY VALOR`;
  return `SELECT * FROM (${base}) WHERE LINHA > ${(pagina - 1) * limite} AND LINHA <= ${pagina * limite}
    ORDER BY LINHA`;
}

async function consultarValoresColuna(query, executeQuery) {
  const filtros = validarFiltrosRastreio(query);
  const coluna = query.coluna;
  if (!Object.hasOwn(CAMPOS_COLUNAS, coluna)) throw Object.assign(new Error('Coluna inválida.'), { statusCode: 400 });
  const selecoes = { ...filtros.selecoes };
  delete selecoes[coluna];
  const rows = await executeQuery(montarSqlRastreio({ ...filtros, [coluna]: '', selecoes }, coluna));
  return { valores: rows.map((row) => String(row.VALOR ?? '')) };
}

async function consultarRastreioProduto(query, executeQuery) {
  const filtros = validarFiltrosRastreio(query);
  const produtos = await executeQuery(`SELECT CODPROD, DESCRPROD, CODVOL FROM TGFPRO WHERE CODPROD = ${filtros.codProd}`);
  if (!produtos.length) throw Object.assign(new Error('Produto não encontrado.'), { statusCode: 404 });
  const movimentacoes = await executeQuery(montarSqlRastreio(filtros));
  const total = Number(movimentacoes[0]?.TOTAL || 0);
  return { produto: produtos[0], movimentacoes, total, pagina: filtros.pagina, limite: filtros.limite, totalPaginas: Math.ceil(total / filtros.limite) };
}

async function consultarFiltrosRastreio(executeQuery) {
  const [empresas, tops] = await Promise.all([
    executeQuery('SELECT CODEMP, NOMEFANTASIA FROM TSIEMP ORDER BY CODEMP'),
    executeQuery(`SELECT TOP.CODTIPOPER, TOP.DESCROPER FROM TGFTOP TOP
      WHERE TOP.DHALTER = (SELECT MAX(T.DHALTER) FROM TGFTOP T WHERE T.CODTIPOPER = TOP.CODTIPOPER)
      ORDER BY TOP.CODTIPOPER`)
  ]);
  return { empresas, tops };
}

module.exports = { validarFiltrosRastreio, montarSqlRastreio, consultarRastreioProduto, consultarFiltrosRastreio, consultarValoresColuna };
