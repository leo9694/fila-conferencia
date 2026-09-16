const { validarPeriodoTransporte } = require('./transporteDashboard');
const { calcularFormulaFrete } = require('./formulaFrete');

function filtrosAnalise(query) {
  const periodo = validarPeriodoTransporte(query.dataInicial, query.dataFinal);
  const pagina = Number(query.pagina || 1);
  const transportadora = Number(query.transportadora || 0);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000 || !Number.isSafeInteger(transportadora) || transportadora < 0) {
    throw new Error('Página ou transportadora inválida.');
  }
  return { ...periodo, pagina, transportadora };
}

function sqlPedidos(f) {
  return `SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.CODEMP, EMP.NOMEFANTASIA NOMEEMP, CAB.TIPMOV,
    TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') DATA_PEDIDO,
    PAR.CODPARC, PAR.NOMEPARC CLIENTE, NVL(CAB.CODPARCTRANSP,0) CODPARCTRANSP,
    NVL(TRA.NOMEPARC,'Sem transportadora') TRANSPORTADORA,
    CAB.VLRNOTA, CAB.VLRFRETE, CAB.CIF_FOB,
    CAB.PESOBRUTO PESO, CAB.QTDVOL, CID.NOMECID CIDADE,
    COUNT(*) OVER() TOTAL
    FROM TGFCAB CAB
    LEFT JOIN TGFPAR PAR ON PAR.CODPARC=CAB.CODPARC
    LEFT JOIN TGFPAR TRA ON TRA.CODPARC=CAB.CODPARCTRANSP
    LEFT JOIN TSICID CID ON CID.CODCID=PAR.CODCID
    LEFT JOIN TSIEMP EMP ON EMP.CODEMP=CAB.CODEMP
    WHERE CAB.STATUSNOTA='L'
      AND (CAB.TIPMOV='P' OR (CAB.TIPMOV='V' AND NOT EXISTS (
        SELECT 1 FROM TGFVAR V JOIN TGFCAB O ON O.NUNOTA=V.NUNOTAORIG
        WHERE V.NUNOTA=CAB.NUNOTA AND O.TIPMOV='P')))
      AND CAB.DTNEG >= TO_DATE('${f.inicio}','YYYY-MM-DD')
      AND CAB.DTNEG < TO_DATE('${f.fim}','YYYY-MM-DD')+1
      ${f.transportadora ? `AND CAB.CODPARCTRANSP=${f.transportadora}` : ''}
    ORDER BY NVL(TRA.NOMEPARC,'Sem transportadora'), CAB.DTNEG DESC, CAB.NUNOTA DESC
    OFFSET ${(f.pagina - 1) * 10} ROWS FETCH NEXT 10 ROWS ONLY`;
}

function sqlFretesReais(ids) {
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Pedidos inválidos.');
  return `WITH NOTAS AS (
    SELECT DISTINCT V.NUNOTAORIG PEDIDO, N.NUNOTA, N.CHAVENFE
    FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA=V.NUNOTA AND C.TIPMOV='V' AND C.STATUSNOTA='L'
    JOIN TGFNFE N ON N.NUNOTA=C.NUNOTA
    WHERE V.NUNOTAORIG IN (${ids.join(',')})
    UNION
    SELECT C.NUNOTA PEDIDO, C.NUNOTA, N.CHAVENFE FROM TGFCAB C
    JOIN TGFNFE N ON N.NUNOTA=C.NUNOTA
    WHERE C.NUNOTA IN (${ids.join(',')}) AND C.TIPMOV='V'
  ), ARQUIVOS AS (
    SELECT IX.CHAVEACESSO, IX.NUMNOTA, IX.CODPARC, IX.XNOMEEMIT, IX.VLRNOTA, IX.STATUS STATUS_IMPORTACAO, IX.DOCSREF,
      ROW_NUMBER() OVER(PARTITION BY IX.CHAVEACESSO ORDER BY IX.NUARQUIVO DESC) RN
    FROM TGFIXN IX WHERE IX.TIPO='C' AND IX.STATUS=2 AND IX.CHAVEACESSO IS NOT NULL
      AND EXISTS (SELECT 1 FROM NOTAS N WHERE INSTR(IX.DOCSREF,N.CHAVENFE)>0)
  ), REFERENCIAS AS (
    SELECT DISTINCT A.CHAVEACESSO, A.NUMNOTA, A.CODPARC, A.XNOMEEMIT, A.VLRNOTA, A.STATUS_IMPORTACAO, X.CHAVE
    FROM ARQUIVOS A, XMLTABLE('/docsRef/chaveAcesso' PASSING XMLTYPE(A.DOCSREF)
      COLUMNS CHAVE VARCHAR2(44) PATH '.') X WHERE A.RN=1
  ), NOTAS_CTE AS (
    SELECT R.CHAVEACESSO, R.NUMNOTA, R.XNOMEEMIT, R.VLRNOTA, R.STATUS_IMPORTACAO, N.NUNOTA,
      NVL(NULLIF(C.PESOBRUTO,0),NVL(NULLIF(C.PESO,0),1)) PESO_NOTA
    FROM REFERENCIAS R JOIN TGFNFE N ON N.CHAVENFE=R.CHAVE
    JOIN TGFCAB C ON C.NUNOTA=N.NUNOTA
  ), PESOS_CTE AS (
    SELECT N.*, SUM(N.PESO_NOTA) OVER(PARTITION BY N.CHAVEACESSO) PESO_TOTAL_CTE,
      COUNT(*) OVER(PARTITION BY N.CHAVEACESSO) QTD_NOTAS_CTE
    FROM NOTAS_CTE N
  ), VINCULOS AS (
    SELECT DISTINCT P.*, NVL(V.NUNOTAORIG,P.NUNOTA) PEDIDO,
      NVL(NULLIF(O.PESOBRUTO,0),NVL(NULLIF(O.PESO,0),1)) PESO_PEDIDO
    FROM PESOS_CTE P LEFT JOIN TGFVAR V ON V.NUNOTA=P.NUNOTA
    LEFT JOIN TGFCAB O ON O.NUNOTA=V.NUNOTAORIG
  ), RATEIOS AS (
    SELECT V.*, SUM(V.PESO_PEDIDO) OVER(PARTITION BY V.CHAVEACESSO,V.NUNOTA) PESO_TOTAL_PEDIDOS_NOTA,
      COUNT(*) OVER(PARTITION BY V.CHAVEACESSO,V.NUNOTA) QTD_PEDIDOS_NOTA
    FROM VINCULOS V
  )
  SELECT DISTINCT N.PEDIDO, R.CHAVEACESSO, R.NUMNOTA NUM_CTE, R.XNOMEEMIT TRANSPORTADORA_CTE, R.STATUS_IMPORTACAO,
    R.VLRNOTA FRETE_CTE_TOTAL,
    ROUND(R.VLRNOTA * (R.PESO_NOTA / R.PESO_TOTAL_CTE) *
      (R.PESO_PEDIDO / R.PESO_TOTAL_PEDIDOS_NOTA), 2) FRETE_REAL,
    CASE WHEN R.QTD_NOTAS_CTE>1 OR R.QTD_PEDIDOS_NOTA>1 THEN 1 ELSE 0 END COMPARTILHADO
  FROM NOTAS N JOIN RATEIOS R ON R.NUNOTA=N.NUNOTA AND R.PEDIDO=N.PEDIDO`;
}

function compararFrete(pedido, registros, simulacoes) {
  const ctes = [...new Map(registros.map((r) => [r.CHAVEACESSO, r])).values()];
  const valoresValidos = ctes.every((r) => r.FRETE_REAL != null && Number.isFinite(Number(r.FRETE_REAL)));
  const compartilhado = ctes.some((r) => Number(r.COMPARTILHADO) === 1);
  const real = ctes.length && valoresValidos ? ctes.reduce((s, r) => s + Number(r.FRETE_REAL), 0) : null;
  const diferenca = (sugerido) => real !== null && sugerido != null ? Math.round((real - sugerido) * 100) / 100 : null;
  return { ...pedido, ctes, compartilhado, real,
    simulacoes: simulacoes.map((s) => ({ ...s, diferenca: diferenca(s.valor) })) };
}

function sqlSimulacoes(ids) {
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Pedidos inválidos.');
  return `SELECT CAB.NUNOTA, T.NUCFR, T.DESCRCALCFRET, R.CODEVENTO, R.FORMULA,
    R.VALOR, R.PERCENTUAL, R.VLRMIN, R.DISTANCIA, R.TEMPO,
    CAB.VLRNOTA, CAB.PESOBRUTO PESO, CAB.M3,
    RD.NOMEREG REGIAO
    FROM TGFCAB CAB
    JOIN TGFPAR PAR ON PAR.CODPARC=CAB.CODPARC
    JOIN TSIEMP EMP ON EMP.CODEMP=CAB.CODEMP
    JOIN TSICID ORI ON ORI.CODCID=EMP.CODCID
    JOIN TSICID DES ON DES.CODCID=PAR.CODCID
    JOIN TGFCFP P ON P.CODPARC=CAB.CODPARCTRANSP
    JOIN TGFCFR T ON T.NUCFR=P.NUCFR
    JOIN TGFRCF R ON R.NUCFR=T.NUCFR AND R.OBRIGATORIO='S'
    LEFT JOIN TGFCFRC RD ON RD.NUCFR=R.NUCFR AND RD.CODREG=R.CODREGDEST
    WHERE CAB.NUNOTA IN (${ids.join(',')})
      AND NVL(T.SERVICOECT,0)=0
      AND (NVL(R.CODCIDORIG,0)=0 OR R.CODCIDORIG=EMP.CODCID)
      AND (NVL(R.CODCIDDEST,0)=0 OR R.CODCIDDEST=PAR.CODCID)
      AND (NVL(R.CODPARCORIG,0)=0 OR R.CODPARCORIG=EMP.CODPARC)
      AND (NVL(R.CODPARCDEST,0)=0 OR R.CODPARCDEST=PAR.CODPARC)
      AND (NVL(R.UFORIG,0)=0 OR R.UFORIG=ORI.UF)
      AND (NVL(R.UFDEST,0)=0 OR R.UFDEST=DES.UF)
      AND (NVL(R.CODREGORIG,0)=0 OR EXISTS (SELECT 1 FROM TGFCFC F
        WHERE F.NUCFR=R.NUCFR AND F.CODREG=R.CODREGORIG AND F.CODCID=EMP.CODCID))
      AND (NVL(R.CODREGDEST,0)=0 OR EXISTS (SELECT 1 FROM TGFCFC F
        WHERE F.NUCFR=R.NUCFR AND F.CODREG=R.CODREGDEST AND F.CODCID=PAR.CODCID))`;
}

function simularTabelas(registros) {
  const tabelas = new Map();
  for (const r of registros) {
    const chave = String(r.NUCFR);
    if (!tabelas.has(chave)) tabelas.set(chave, { codigo: r.NUCFR, tabela: r.DESCRCALCFRET,
      regiao: r.REGIAO, valor: 0, eventos: [], erro: false });
    const tabela = tabelas.get(chave);
    try {
      // Duas rotas do mesmo evento tornam a seleção ambígua: não inventar precedência.
      if (tabela.eventos.includes(r.CODEVENTO)) throw new Error('Rotas sobrepostas.');
      tabela.eventos.push(r.CODEVENTO);
      tabela.valor += calcularFormulaFrete(r.FORMULA, {
        VALOR: r.VALOR, PERCENTUAL: r.PERCENTUAL, VLRMIN: r.VLRMIN,
        DISTANCIA: r.DISTANCIA, TEMPO: r.TEMPO, VLRNOTA: r.VLRNOTA, PESO: r.PESO, M3: r.M3
      });
    } catch { tabela.erro = true; }
  }
  return [...tabelas.values()].map((t) => ({ ...t, valor: t.erro ? null : Math.round(t.valor * 100) / 100 }));
}

async function carregarAnaliseFrete(query, executeQuery) {
  const filtros = filtrosAnalise(query);
  const pedidos = await executeQuery(sqlPedidos(filtros));
  const reais = pedidos.length ? await executeQuery(sqlFretesReais(pedidos.map((p) => Number(p.NUNOTA)))) : [];
  const simulacoes = pedidos.length ? await executeQuery(sqlSimulacoes(pedidos.map((p) => Number(p.NUNOTA)))) : [];
  const transportadoras = await executeQuery(`SELECT DISTINCT P.CODPARC, P.NOMEPARC FROM TGFPAR P
    JOIN TGFCAB C ON C.CODPARCTRANSP=P.CODPARC
    WHERE C.TIPMOV IN ('P','V') AND C.STATUSNOTA='L'
      AND C.DTNEG>=TO_DATE('${filtros.inicio}','YYYY-MM-DD')
      AND C.DTNEG<TO_DATE('${filtros.fim}','YYYY-MM-DD')+1 ORDER BY P.NOMEPARC`);
  const linhas = pedidos.map((p) => compararFrete(p,
    reais.filter((r) => Number(r.PEDIDO) === Number(p.NUNOTA)),
    simularTabelas(simulacoes.filter((r) => Number(r.NUNOTA) === Number(p.NUNOTA)))));
  return { linhas, transportadoras, pagina: filtros.pagina, total: Number(pedidos[0]?.TOTAL || 0), tamanhoPagina: 10 };
}

module.exports = { carregarAnaliseFrete, compararFrete, filtrosAnalise, sqlPedidos, sqlFretesReais, sqlSimulacoes, simularTabelas };
