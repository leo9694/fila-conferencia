async function consultarTdePorCte(fretes, executarConsulta) {
  const chaves = [...new Set(fretes.map((frete) => frete.CHAVEACESSO).filter((chave) => /^\d{44}$/.test(chave)))];
  if (!chaves.length) return new Map();

  try {
    const valores = await executarConsulta(`WITH XML_CTE AS (
      SELECT IX.CHAVEACESSO, IX.XML,
        ROW_NUMBER() OVER(PARTITION BY IX.CHAVEACESSO
          ORDER BY CASE WHEN IX.STATUS=2 THEN 0 ELSE 1 END, IX.NUARQUIVO DESC) RN
      FROM TGFIXN IX
      WHERE IX.TIPO='C' AND IX.XML IS NOT NULL
        AND IX.CHAVEACESSO IN (${chaves.map((chave) => `'${chave}'`).join(',')})
    )
    SELECT C.CHAVEACESSO, SUM(CASE WHEN REGEXP_LIKE(UPPER(TRIM(X.NOME)),
      '(^|[^A-Z0-9])T[.[:space:]-]*D[.[:space:]-]*E([^A-Z0-9]|$)|DIF(IC(ULDADE)?)?[.[:space:]]+(DE[[:space:]]+)?ENTR')
      THEN TO_NUMBER(TRIM(X.VALOR) DEFAULT NULL ON CONVERSION ERROR,
        '9999999999999D99', 'NLS_NUMERIC_CHARACTERS=''.,''') ELSE 0 END) VALOR_TDE
    FROM XML_CTE C, XMLTABLE(
      '(/*:cteProc/*:CTe | /*:CTe)/*:infCte/*:vPrest/*:Comp'
      PASSING XMLTYPE(C.XML)
      COLUMNS NOME VARCHAR2(60) PATH '*:xNome', VALOR VARCHAR2(30) PATH '*:vComp'
    ) X WHERE C.RN=1
    GROUP BY C.CHAVEACESSO`);
    return new Map(valores.filter(({ VALOR_TDE }) => VALOR_TDE != null && Number.isFinite(Number(VALOR_TDE)))
      .map(({ CHAVEACESSO, VALOR_TDE }) => [CHAVEACESSO, Math.round(Number(VALOR_TDE) * 100)]));
  } catch (erro) {
    console.warn('Não foi possível consultar a TDE nos XMLs dos CT-es:', erro.message);
    return new Map();
  }
}

module.exports = { consultarTdePorCte };
