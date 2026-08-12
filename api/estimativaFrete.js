function validarNumeroNota(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw Object.assign(new Error('Pedido inválido para estimar o frete.'), { statusCode: 400 });
  }
  return numero;
}

function dataIsoValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function obterPeriodoHistorico(periodo = {}) {
  const inicio = String(periodo.inicio || '').trim();
  const fim = String(periodo.fim || '').trim();
  if (!inicio && !fim) return null;
  if (!dataIsoValida(inicio) || !dataIsoValida(fim) || inicio > fim) {
    throw new Error('O período de histórico do frete deve ter datas válidas e ordenadas.');
  }
  return { inicio, fim };
}

function montarSqlEstimativaFrete(nunota, periodo) {
  const numeroNota = validarNumeroNota(nunota);
  const periodoHistorico = obterPeriodoHistorico(periodo);
  const filtroPeriodo = periodoHistorico
    ? `IX.DHEMISS >= TO_DATE('${periodoHistorico.inicio}', 'YYYY-MM-DD')
    AND IX.DHEMISS < TO_DATE('${periodoHistorico.fim}', 'YYYY-MM-DD') + 1`
    : `IX.DHEMISS >= ADD_MONTHS(TRUNC(SYSDATE), -3)
    AND IX.DHEMISS < TRUNC(SYSDATE) + 1`;
  return `
WITH PEDIDO AS (
  SELECT CAB.NUNOTA,
         CAB.CODEMP,
         NVL(NULLIF(CAB.PESOBRUTO, 0), NVL(CAB.PESO, 0)) PESO_PEDIDO,
         NVL(CAB.VLRNOTA, 0) VALOR_PEDIDO,
         NVL(CAB.QTDVOL, 0) VOLUMES_PEDIDO,
         NVL(CAB.CODPARCTRANSP, 0) CODPARCTRANSP,
         CASE
           WHEN CAB.CODCID IS NULL OR CAB.CODCID = 0
             OR UPPER(TRIM(NVL(CID_CAB.NOMECID, ''))) IN ('<SEM DESCRIÇÃO>', '<SEM DESCRICAO>')
             OR NVL(UFS_CAB.UF, '0') = '0'
           THEN PAR.CODCID
           ELSE CAB.CODCID
         END CODCID,
         NVL(NULLIF(CASE WHEN UPPER(TRIM(NVL(CID_CAB.NOMECID, ''))) IN ('<SEM DESCRIÇÃO>', '<SEM DESCRICAO>') THEN NULL ELSE CID_CAB.NOMECID END, ''), CID_PAR.NOMECID) CIDADE,
         NVL(NULLIF(UFS_CAB.UF, '0'), UFS_PAR.UF) UF
  FROM TGFCAB CAB
  LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
  LEFT JOIN TSICID CID_CAB ON CID_CAB.CODCID = CAB.CODCID
  LEFT JOIN TSIUFS UFS_CAB ON UFS_CAB.CODUF = CID_CAB.UF
  LEFT JOIN TSICID CID_PAR ON CID_PAR.CODCID = PAR.CODCID
  LEFT JOIN TSIUFS UFS_PAR ON UFS_PAR.CODUF = CID_PAR.UF
  WHERE CAB.NUNOTA = ${numeroNota}
), CTES AS (
  SELECT IX.CHAVEACESSO,
         NVL(IX.VLRNOTA, 0) VALOR_FRETE,
         NVL(IX.CODPARC, 0) CODPARCTRANSP,
         IX.DOCSREF,
         ROW_NUMBER() OVER (PARTITION BY IX.CHAVEACESSO ORDER BY IX.NUARQUIVO DESC) RN
  FROM TGFIXN IX
  WHERE IX.STATUS = 2
    AND IX.TIPO = 'C'
    AND ${filtroPeriodo}
    AND IX.CHAVEACESSO IS NOT NULL
    AND IX.DOCSREF IS NOT NULL
), REFERENCIAS AS (
  SELECT DISTINCT C.CHAVEACESSO, C.VALOR_FRETE, C.CODPARCTRANSP, X.CHAVENFE
  FROM CTES C,
       XMLTABLE('/docsRef/chaveAcesso' PASSING XMLTYPE(C.DOCSREF)
         COLUMNS CHAVENFE VARCHAR2(44) PATH '.') X
  WHERE C.RN = 1
), HISTORICO AS (
  SELECT R.CHAVEACESSO,
         CAB.CODEMP,
         NVL(NULLIF(CAB.CODCID, 0), DEST.CODCID) CODCID,
         NVL(UFS.UF, '0') UF,
         R.CODPARCTRANSP,
         MAX(R.VALOR_FRETE) VALOR_FRETE,
         SUM(NVL(NULLIF(CAB.PESOBRUTO, 0), NVL(CAB.PESO, 0))) PESO,
         SUM(NVL(CAB.VLRNOTA, 0)) VALOR_PEDIDO
  FROM REFERENCIAS R
  JOIN TGFNFE NFE ON NFE.CHAVENFE = R.CHAVENFE
  JOIN TGFCAB CAB ON CAB.NUNOTA = NFE.NUNOTA
  LEFT JOIN TGFPAR DEST ON DEST.CODPARC = CAB.CODPARC
  LEFT JOIN TSICID CID ON CID.CODCID = NVL(NULLIF(CAB.CODCID, 0), DEST.CODCID)
  LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
  JOIN PEDIDO P ON P.CODEMP = CAB.CODEMP
  GROUP BY R.CHAVEACESSO,
           CAB.CODEMP,
           NVL(NULLIF(CAB.CODCID, 0), DEST.CODCID),
           NVL(UFS.UF, '0'),
           R.CODPARCTRANSP
), ESTATISTICAS AS (
  SELECT
    COUNT(CASE WHEN H.CODCID = P.CODCID
                    AND H.CODPARCTRANSP = P.CODPARCTRANSP
                    AND P.CODPARCTRANSP > 0
                    AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
               THEN 1 END) AS N_CIDADE_TRANSP_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_FRETE END) AS FRETE_CIDADE_TRANSP_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.PESO END) AS PESO_CIDADE_TRANSP_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_PEDIDO END) AS PEDIDO_CIDADE_TRANSP_FAIXA,
    COUNT(CASE WHEN H.CODCID = P.CODCID
                    AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
               THEN 1 END) AS N_CIDADE_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_FRETE END) AS FRETE_CIDADE_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.PESO END) AS PESO_CIDADE_FAIXA,
    SUM(CASE WHEN H.CODCID = P.CODCID
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_PEDIDO END) AS PEDIDO_CIDADE_FAIXA,
    COUNT(CASE WHEN H.UF = P.UF
                    AND H.CODPARCTRANSP = P.CODPARCTRANSP
                    AND P.CODPARCTRANSP > 0
                    AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
               THEN 1 END) AS N_UF_TRANSP_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_FRETE END) AS FRETE_UF_TRANSP_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.PESO END) AS PESO_UF_TRANSP_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.CODPARCTRANSP = P.CODPARCTRANSP
                  AND P.CODPARCTRANSP > 0
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_PEDIDO END) AS PEDIDO_UF_TRANSP_FAIXA,
    COUNT(CASE WHEN H.UF = P.UF
                    AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
               THEN 1 END) AS N_UF_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_FRETE END) AS FRETE_UF_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.PESO END) AS PESO_UF_FAIXA,
    SUM(CASE WHEN H.UF = P.UF
                  AND H.PESO BETWEEN GREATEST(P.PESO_PEDIDO / 2, 1) AND P.PESO_PEDIDO * 2
             THEN H.VALOR_PEDIDO END) AS PEDIDO_UF_FAIXA,
    COUNT(CASE WHEN H.CODCID = P.CODCID THEN 1 END) AS N_CIDADE,
    SUM(CASE WHEN H.CODCID = P.CODCID THEN H.VALOR_FRETE END) AS FRETE_CIDADE,
    SUM(CASE WHEN H.CODCID = P.CODCID THEN H.PESO END) AS PESO_CIDADE,
    SUM(CASE WHEN H.CODCID = P.CODCID THEN H.VALOR_PEDIDO END) AS PEDIDO_CIDADE,
    COUNT(CASE WHEN H.UF = P.UF THEN 1 END) AS N_UF,
    SUM(CASE WHEN H.UF = P.UF THEN H.VALOR_FRETE END) AS FRETE_UF,
    SUM(CASE WHEN H.UF = P.UF THEN H.PESO END) AS PESO_UF,
    SUM(CASE WHEN H.UF = P.UF THEN H.VALOR_PEDIDO END) AS PEDIDO_UF,
    COUNT(*) AS N_EMPRESA,
    SUM(H.VALOR_FRETE) AS FRETE_EMPRESA,
    SUM(H.PESO) AS PESO_EMPRESA,
    SUM(H.VALOR_PEDIDO) AS PEDIDO_EMPRESA
  FROM HISTORICO H
  CROSS JOIN PEDIDO P
), MEDIA AS (
  SELECT * FROM ESTATISTICAS
)
SELECT P.PESO_PEDIDO,
       P.VALOR_PEDIDO,
       P.VOLUMES_PEDIDO,
       P.CODPARCTRANSP,
       P.CIDADE,
       P.UF,
       M.*
FROM PEDIDO P
CROSS JOIN MEDIA M`;
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function nivelConfiancaFrete(fonte) {
  if (!fonte || fonte.ctes <= 0) return 'indisponível';
  if (fonte.chave === 'CIDADE_TRANSP_FAIXA') {
    if (fonte.ctes >= 12) return 'alta';
    if (fonte.ctes >= 6) return 'média';
    return 'baixa';
  }
  if (fonte.chave === 'CIDADE_FAIXA') {
    return fonte.ctes >= 15 ? 'média' : 'baixa';
  }
  return 'baixa';
}

function calcularIntervaloFrete(valor, confianca) {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const margem = ({ alta: 0.20, média: 0.40, baixa: 0.65 })[confianca];
  if (!margem) return null;
  return {
    minimo: valor * (1 - margem),
    maximo: valor * (1 + margem),
    margemPercentual: Math.round(margem * 100)
  };
}

function normalizarEstimativaFrete(registro = {}) {
  const pesoPedido = numero(registro.PESO_PEDIDO);
  const valorPedido = numero(registro.VALOR_PEDIDO);
  const fontes = [
    // Poucos CT-es da mesma cidade e faixa sao mais representativos do que
    // centenas de entregas do estado inteiro. A confianca continua baixa.
    { chave: 'CIDADE_TRANSP_FAIXA', descricao: 'cidade, transportadora e faixa de peso', minimo: 2, confianca: 'média' },
    { chave: 'CIDADE_FAIXA', descricao: 'cidade e faixa de peso', minimo: 2, confianca: 'baixa' },
    { chave: 'UF_TRANSP_FAIXA', descricao: 'estado, transportadora e faixa de peso', minimo: 5, confianca: 'média' },
    { chave: 'UF_FAIXA', descricao: 'estado e faixa de peso', minimo: 8, confianca: 'baixa' },
    { chave: 'CIDADE', descricao: 'cidade', minimo: 8, confianca: 'baixa' },
    { chave: 'UF', descricao: 'estado', minimo: 12, confianca: 'baixa' },
    { chave: 'EMPRESA', descricao: 'empresa', minimo: 20, confianca: 'baixa' }
  ];
  const fontesDisponiveis = fontes.map((fonte) => ({
    ...fonte,
    ctes: numero(registro[`N_${fonte.chave}`]),
    frete: numero(registro[`FRETE_${fonte.chave}`]),
    peso: numero(registro[`PESO_${fonte.chave}`]),
    valor: numero(registro[`PEDIDO_${fonte.chave}`])
  })).filter((fonte) => fonte.ctes > 0 && fonte.frete > 0);
  const fonte = fontesDisponiveis.find((item) => item.ctes >= item.minimo)
    || fontesDisponiveis[0]
    || { descricao: 'sem histórico suficiente', confianca: 'indisponível', ctes: 0, frete: 0, peso: 0, valor: 0 };
  const freteHistorico = fonte.frete;
  const pesoHistorico = fonte.peso;
  const valorHistorico = fonte.valor;
  const fretePorKg = pesoHistorico > 0 ? freteHistorico / pesoHistorico : null;
  const percentualFreteSobrePedido = valorHistorico > 0 ? freteHistorico / valorHistorico : null;
  const freteEstimado = fretePorKg !== null && pesoPedido > 0 ? fretePorKg * pesoPedido : null;
  const freteEstimadoPorValor = percentualFreteSobrePedido !== null && valorPedido > 0
    ? percentualFreteSobrePedido * valorPedido
    : null;
  const confianca = nivelConfiancaFrete(fonte);
  return {
    cidade: String(registro.CIDADE || '').trim(),
    uf: String(registro.UF || '').trim(),
    pesoPedido,
    valorPedido,
    volumesPedido: numero(registro.VOLUMES_PEDIDO),
    ctesHistorico: fonte.ctes,
    freteHistorico,
    pesoHistorico,
    valorHistorico,
    fonteHistorico: fonte.descricao,
    confianca,
    fretePorKg,
    percentualFreteSobrePedido,
    freteEstimado,
    freteEstimadoPorValor,
    intervaloFretePorPeso: calcularIntervaloFrete(freteEstimado, confianca),
    intervaloFretePorValor: calcularIntervaloFrete(freteEstimadoPorValor, confianca)
  };
}

module.exports = {
  montarSqlEstimativaFrete,
  normalizarEstimativaFrete,
  validarNumeroNota,
  obterPeriodoHistorico,
  nivelConfiancaFrete,
  calcularIntervaloFrete
};
