function extrairLoteFeltrin(codigo) {
  const valor = String(codigo || '').trim();
  if (!/^01\d{32}$/.test(valor)) throw new Error('Bipe o código completo de 34 dígitos da caixa Feltrin.');
  return valor.slice(8, 24);
}

async function consultarCodigoFeltrin({ nunota, codigo, executeQuery }) {
  if (!Number.isSafeInteger(nunota) || nunota <= 0) throw new Error('Pedido inválido.');
  const controle = extrairLoteFeltrin(codigo);
  // O prefixo varia entre caixas do mesmo produto. A identificação é feita
  // pelo lote exato no estoque, restrita aos produtos Feltrin do pedido.
  const rows = await executeQuery(`
    SELECT EST.CODPROD, TRIM(EST.CONTROLE) AS CONTROLE,
      TO_CHAR(MAX(EST.DTVAL), 'YYYY-MM-DD') AS DTVALID,
      SUM(NVL(EST.ESTOQUE, 0)) AS ESTOQUE
    FROM TGFCAB CAB
    JOIN TGFEST EST ON EST.CODEMP = CAB.CODEMP
    JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
    WHERE CAB.NUNOTA = ${nunota}
      AND UPPER(TRIM(PRO.MARCA)) LIKE '%FELTRIN%'
      AND TRIM(EST.CONTROLE) = '${controle}'
      AND NVL(EST.ATIVO, 'S') = 'S'
      AND NVL(EST.ESTOQUE, 0) > 0
      AND EXISTS (SELECT 1 FROM TGFITE ITE
        WHERE ITE.NUNOTA = CAB.NUNOTA AND ITE.CODPROD = EST.CODPROD
          AND (TRIM(ITE.CONTROLE) = TRIM(EST.CONTROLE) OR TRIM(ITE.CONTROLE) IS NULL))
    GROUP BY EST.CODPROD, TRIM(EST.CONTROLE)
    HAVING SUM(NVL(EST.ESTOQUE, 0)) > 0
  `);
  if (!rows.length) throw new Error(`Lote ${controle} não encontrado com estoque para um produto Feltrin deste pedido.`);
  if (rows.length !== 1) throw new Error(`Lote ${controle} corresponde a mais de um produto. Não foi possível identificar a caixa com segurança.`);
  return { codProd: Number(rows[0].CODPROD), controle, dtValidade: rows[0].DTVALID || null };
}

async function consultarMultiplicadorFeltrin({ nunota, codProd, codigoProduto, executeQuery }) {
  const codigo = String(codigoProduto || '').trim();
  if (!Number.isSafeInteger(nunota) || nunota <= 0 || !Number.isSafeInteger(codProd) || codProd <= 0 || !/^\d{1,100}$/.test(codigo)) {
    throw new Error('Bipe o código de barras da caixa ou da unidade antes de ler o lote.');
  }
  const alternativas = await executeQuery(`
    SELECT VOA.QUANTIDADE, VOA.DIVIDEMULTIPLICA FROM TGFVOA VOA
    WHERE VOA.CODPROD = ${codProd} AND VOA.CODBARRA = '${codigo}'
      AND NVL(VOA.ATIVO, 'S') = 'S'
  `);
  if (alternativas.length) {
    const multiplicadores = alternativas.map((row) => {
      const quantidade = Number(row.QUANTIDADE) || 1;
      return String(row.DIVIDEMULTIPLICA || '').toUpperCase().startsWith('D') ? 1 / quantidade : quantidade;
    });
    const quantidade = multiplicadores[0];
    if (!Number.isFinite(quantidade) || quantidade <= 0 || multiplicadores.some((valor) => valor !== quantidade)) throw new Error('Multiplicador do código de barras inválido ou ambíguo.');
    return quantidade;
  }
  const unidades = await executeQuery(`
    SELECT ITE.CODPROD FROM TGFITE ITE JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
    WHERE ITE.NUNOTA = ${nunota} AND ITE.CODPROD = ${codProd}
      AND ('${codigo}' IN (TO_CHAR(PRO.CODPROD), PRO.REFERENCIA, PRO.AD_CODBAR, PRO.AD_CBARANT,
        ITE.GTINNFE, ITE.GTINTRIBNFE, ITE.PRODUTONFE)
        OR EXISTS (SELECT 1 FROM TGFEST EST WHERE EST.CODPROD = PRO.CODPROD AND EST.CODBARRA = '${codigo}'))
  `);
  if (!unidades.length) throw new Error('O código de barras não pertence ao produto selecionado.');
  return 1;
}

function calcularQuantidadeFeltrin(multiplicador, numeroLeituras = 1) {
  if (!Number.isSafeInteger(numeroLeituras) || numeroLeituras <= 0) throw new Error('Número de leituras inválido.');
  const quantidade = Math.round(multiplicador * numeroLeituras * 1000000) / 1000000;
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > Number.MAX_SAFE_INTEGER) throw new Error('Quantidade das leituras inválida.');
  return quantidade;
}

module.exports = { extrairLoteFeltrin, consultarCodigoFeltrin, consultarMultiplicadorFeltrin, calcularQuantidadeFeltrin };
