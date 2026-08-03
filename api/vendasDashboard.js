const LIMITE_PERIODO_DIAS = 731;

function dataIsoValida(valor) {
  const texto = String(valor || '').trim();
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, ano, mes, dia] = match.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia;
}

function validarPeriodoVendas(dataInicial, dataFinal) {
  if (!dataIsoValida(dataInicial) || !dataIsoValida(dataFinal)) {
    throw new Error('Informe data inicial e data final validas.');
  }

  const inicio = new Date(`${dataInicial}T00:00:00Z`);
  const fim = new Date(`${dataFinal}T00:00:00Z`);
  const dias = Math.round((fim - inicio) / 86400000) + 1;
  if (dias <= 0) throw new Error('A data final deve ser igual ou posterior a data inicial.');
  if (dias > LIMITE_PERIODO_DIAS) throw new Error('O periodo maximo para o painel e de 24 meses.');
  return { inicio: dataInicial, fim: dataFinal, dias };
}

function normalizarEmpresa(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) throw new Error('Empresa invalida.');
  return numero;
}

function filtroEmpresaSql(empresa, alias = 'CAB') {
  return empresa ? `AND ${alias}.CODEMP = ${empresa}` : '';
}

function cteBaseVendas(periodo, empresa) {
  return `
    WITH FATURADOS AS (
      SELECT DISTINCT VAR.NUNOTAORIG
      FROM TGFVAR VAR
      INNER JOIN TGFCAB DEST ON DEST.NUNOTA = VAR.NUNOTA
      WHERE DEST.TIPMOV <> 'P'
        AND DEST.STATUSNOTA = 'L'
    ),
    BASE_VENDAS AS (
      SELECT
        CAB.NUNOTA,
        CAB.CODEMP,
        CAB.CODPARC,
        CAB.CODVEND,
        CAB.DTNEG,
        NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
        NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS EMPRESA,
        NVL(VEN.APELIDO, 'SEM VENDEDOR') AS VENDEDOR,
        CASE
          WHEN FAT.NUNOTAORIG IS NOT NULL THEN 'FATURADO'
          WHEN CAB.STATUSNOTA = 'L' THEN 'LIBERADO'
          WHEN CAB.STATUSNOTA = 'A' THEN 'EM_ATENDIMENTO'
          WHEN CAB.STATUSNOTA = 'P' THEN 'PENDENTE'
          ELSE 'OUTROS'
        END AS STATUS_VENDA
      FROM TGFCAB CAB
      INNER JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
      LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
      LEFT JOIN FATURADOS FAT ON FAT.NUNOTAORIG = CAB.NUNOTA
      WHERE CAB.TIPMOV = 'P'
        AND CAB.STATUSNOTA IN ('A', 'P', 'L')
        AND CAB.DTNEG >= TO_DATE('${periodo.inicio}', 'YYYY-MM-DD')
        AND CAB.DTNEG < TO_DATE('${periodo.fim}', 'YYYY-MM-DD') + 1
        ${filtroEmpresaSql(empresa)}
    )`;
}

function montarSqlDimensoesVendas(periodo, empresa) {
  return `${cteBaseVendas(periodo, empresa)}
    SELECT
      CODEMP,
      EMPRESA,
      TO_CHAR(TRUNC(DTNEG, 'MM'), 'YYYY-MM') AS MES,
      CODVEND,
      VENDEDOR,
      STATUS_VENDA,
      COUNT(*) AS PEDIDOS,
      COUNT(DISTINCT CODPARC) AS CLIENTES,
      CAST(SUM(VLRNOTA) AS NUMBER(18,2)) AS VALOR
    FROM BASE_VENDAS
    GROUP BY CODEMP, EMPRESA, TRUNC(DTNEG, 'MM'), CODVEND, VENDEDOR, STATUS_VENDA
    ORDER BY TRUNC(DTNEG, 'MM'), CODEMP, VENDEDOR`;
}

function montarSqlTotaisVendas(periodo, empresa) {
  return `${cteBaseVendas(periodo, empresa)}
    SELECT
      CODEMP,
      EMPRESA,
      COUNT(*) AS PEDIDOS,
      COUNT(DISTINCT CODPARC) AS CLIENTES,
      COUNT(DISTINCT CODVEND) AS VENDEDORES,
      CAST(SUM(VLRNOTA) AS NUMBER(18,2)) AS VALOR,
      CAST(AVG(VLRNOTA) AS NUMBER(18,2)) AS TICKET_MEDIO
    FROM BASE_VENDAS
    GROUP BY GROUPING SETS ((CODEMP, EMPRESA), ())
    ORDER BY CODEMP NULLS FIRST`;
}

function montarSqlGruposVendas(periodo, empresa) {
  return `
    SELECT
      CAB.CODEMP,
      NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS EMPRESA,
      PRO.CODGRUPOPROD,
      NVL(GRU.DESCRGRUPOPROD, 'GRUPO ' || PRO.CODGRUPOPROD) AS GRUPO,
      CAST(SUM(NVL(ITE.QTDNEG, 0)) AS NUMBER(18,3)) AS QUANTIDADE,
      CAST(SUM(NVL(ITE.VLRTOT, NVL(ITE.QTDNEG, 0) * NVL(ITE.VLRUNIT, 0))) AS NUMBER(18,2)) AS VALOR
    FROM TGFCAB CAB
    INNER JOIN TGFITE ITE ON ITE.NUNOTA = CAB.NUNOTA
    INNER JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
    LEFT JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
    INNER JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
    WHERE CAB.TIPMOV = 'P'
      AND CAB.STATUSNOTA IN ('A', 'P', 'L')
      AND CAB.DTNEG >= TO_DATE('${periodo.inicio}', 'YYYY-MM-DD')
      AND CAB.DTNEG < TO_DATE('${periodo.fim}', 'YYYY-MM-DD') + 1
      ${filtroEmpresaSql(empresa)}
    GROUP BY CAB.CODEMP, NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL), PRO.CODGRUPOPROD, NVL(GRU.DESCRGRUPOPROD, 'GRUPO ' || PRO.CODGRUPOPROD)
    ORDER BY VALOR DESC`;
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function somarEmMapa(mapa, chave, base, linha) {
  const atual = mapa.get(chave) || { ...base, pedidos: 0, clientes: 0, valor: 0 };
  atual.pedidos += numero(linha.PEDIDOS);
  atual.clientes += numero(linha.CLIENTES);
  atual.valor += numero(linha.VALOR);
  mapa.set(chave, atual);
}

function consolidarDashboardVendas({ dimensoes = [], totais = [], grupos = [] } = {}) {
  const meses = new Map();
  const vendedores = new Map();
  const status = new Map();

  dimensoes.forEach((linha) => {
    somarEmMapa(meses, linha.MES, { mes: linha.MES }, linha);
    somarEmMapa(vendedores, String(linha.CODVEND ?? ''), {
      codVend: linha.CODVEND,
      nome: linha.VENDEDOR || 'SEM VENDEDOR'
    }, linha);
    somarEmMapa(status, linha.STATUS_VENDA, { status: linha.STATUS_VENDA }, linha);
  });

  const total = totais.find((item) => item.CODEMP === null || item.CODEMP === undefined || item.CODEMP === '') || totais[0] || {};
  const empresas = totais
    .filter((item) => item.CODEMP !== null && item.CODEMP !== undefined && item.CODEMP !== '')
    .map((item) => ({
      codEmp: numero(item.CODEMP),
      nome: item.EMPRESA || `Empresa ${item.CODEMP}`,
      pedidos: numero(item.PEDIDOS),
      clientes: numero(item.CLIENTES),
      vendedores: numero(item.VENDEDORES),
      valor: numero(item.VALOR),
      ticketMedio: numero(item.TICKET_MEDIO)
    }))
    .sort((a, b) => b.valor - a.valor);
  const totalGrupos = grupos.reduce((soma, item) => soma + numero(item.VALOR), 0);
  return {
    resumo: {
      pedidos: numero(total.PEDIDOS),
      clientes: numero(total.CLIENTES),
      vendedores: numero(total.VENDEDORES),
      valor: numero(total.VALOR),
      ticketMedio: numero(total.TICKET_MEDIO)
    },
    meses: [...meses.values()].sort((a, b) => String(a.mes).localeCompare(String(b.mes))),
    vendedores: [...vendedores.values()]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
      .map((item, indice) => ({ ...item, posicao: indice + 1, ticketMedio: item.pedidos ? item.valor / item.pedidos : 0 })),
    empresas,
    status: [...status.values()].sort((a, b) => b.valor - a.valor),
    grupos: grupos
      .map((item) => ({
        codGrupo: numero(item.CODGRUPOPROD),
        nome: item.GRUPO || `Grupo ${item.CODGRUPOPROD}`,
        codEmp: numero(item.CODEMP),
        empresa: item.EMPRESA,
        quantidade: numero(item.QUANTIDADE),
        valor: numero(item.VALOR),
        percentual: totalGrupos ? numero(item.VALOR) / totalGrupos * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
  };
}

module.exports = {
  LIMITE_PERIODO_DIAS,
  consolidarDashboardVendas,
  montarSqlDimensoesVendas,
  montarSqlGruposVendas,
  montarSqlTotaisVendas,
  normalizarEmpresa,
  validarPeriodoVendas
};
