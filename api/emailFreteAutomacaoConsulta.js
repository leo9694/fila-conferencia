const TAMANHO_PAGINA = 30;
const LOTE_DESCOBERTA = 150;
const formatoData = 'YYYYMMDDHH24MISS';

const inteiro = (valor) => Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : 0;
const dataSql = (valor) => {
  if (!/^\d{14}$/.test(valor)) throw new Error('Marco inválido para a automação de frete.');
  return `TO_DATE('${valor}', '${formatoData}')`;
};

const camposNota = `CAB.NUNOTA, CAB.NUMNOTA, CAB.CODEMP, CAB.ORDEMCARGA, CAB.CODPARC,
  TO_CHAR(CAB.DTNEG, 'YYYY-MM-DD') DATA_NOTA,
  TO_CHAR(CAB.DTFATUR, 'YYYY-MM-DD') DATA_FATURAMENTO,
  COALESCE(PAR.RAZAOSOCIAL, PAR.NOMEPARC) CLIENTE,
  PAR.EMAILNFE, PAR.EMAIL, PAR.EMAILNOTIFENTREGA, PAR.EMAILDANFE, PAR.EMAILCTE, PAR.EMAILNFSE,
  TRA.NOMEPARC TRANSPORTADORA`;
const notasElegiveis = `FROM TGFCAB CAB
  JOIN TGFCON2 CONF ON CONF.NUCONF = CAB.NUCONFATUAL AND CONF.STATUS = 'F'
  LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC`;
const ordemComTransportadora = `JOIN TGFORD ORD ON ORD.CODEMP = CAB.CODEMP AND ORD.ORDEMCARGA = CAB.ORDEMCARGA
  LEFT JOIN TGFPAR TRA ON TRA.CODPARC = ORD.CODPARCTRANSP`;
const filtroNota = `CAB.CODTIPOPER IN (35, 10) AND CAB.TIPMOV = 'V' AND CAB.STATUSNOTA = 'L'`;

async function listarNotasSemCarga(query, pagina, { inicio, fim }) {
  const offset = (pagina - 1) * TAMANHO_PAGINA;
  const dataFaturamento = (data) => dataSql(`${data.replaceAll('-', '')}000000`);
  return query(`SELECT ${camposNota}, CAB.CODPARCTRANSP
    ${notasElegiveis}
    LEFT JOIN TGFPAR TRA ON TRA.CODPARC = CAB.CODPARCTRANSP
    WHERE ${filtroNota} AND NVL(CAB.ORDEMCARGA, 0) = 0
      AND CAB.DTFATUR >= ${dataFaturamento(inicio)} AND CAB.DTFATUR < ${dataFaturamento(fim)} + 1
    ORDER BY CAB.DTFATUR DESC, CAB.NUNOTA DESC
    OFFSET ${offset} ROWS FETCH NEXT ${TAMANHO_PAGINA + 1} ROWS ONLY`);
}

async function consultarTransportadorasCargas(query, notas) {
  const cargas = new Set();
  for (const nota of notas) {
    const empresa = inteiro(nota.empresa);
    const ordem = inteiro(nota.ordem);
    if (empresa && ordem) cargas.add(`(${empresa}, ${ordem})`);
  }
  if (!cargas.size) return [];
  return query(`SELECT ORD.CODEMP, ORD.ORDEMCARGA, TRA.NOMEPARC TRANSPORTADORA
    FROM TGFORD ORD LEFT JOIN TGFPAR TRA ON TRA.CODPARC = ORD.CODPARCTRANSP
    WHERE (ORD.CODEMP, ORD.ORDEMCARGA) IN (${[...cargas].join(', ')})`);
}

async function consultarDatasFaturamento(query, ids) {
  const notas = [...new Set(ids.map(inteiro).filter(Boolean))];
  if (!notas.length) return [];
  return query(`SELECT CAB.NUNOTA, TO_CHAR(CAB.DTFATUR, 'YYYY-MM-DD') DATA_FATURAMENTO
    FROM TGFCAB CAB WHERE CAB.NUNOTA IN (${notas.join(', ')})`);
}

async function obterMarcoCargas(query) {
  const rows = await query(`SELECT CODEMP, MAX(ORDEMCARGA) ULTIMA_CARGA,
    TO_CHAR(SYSDATE, '${formatoData}') AGORA FROM TGFORD GROUP BY CODEMP
    UNION ALL SELECT 0, 0, TO_CHAR(SYSDATE, '${formatoData}') FROM DUAL`);
  const marco = rows.find((r) => Number(r.CODEMP) === 0)?.AGORA;
  dataSql(marco);
  return {
    marco,
    cargas: rows.filter((r) => inteiro(r.CODEMP)).map((r) => [inteiro(r.CODEMP), inteiro(r.ULTIMA_CARGA)])
  };
}

async function obterJanelaCargas(query) {
  const [janela] = await query(`SELECT TO_CHAR(SYSDATE - 10/86400, '${formatoData}') ATE,
    TO_CHAR(SYSDATE - 310/86400, '${formatoData}') SOBREPOSICAO FROM DUAL`);
  dataSql(janela?.ATE);
  dataSql(janela?.SOBREPOSICAO);
  return janela;
}

function filtroCargasNovas(cargas) {
  if (!cargas.length) return 'ORD.ORDEMCARGA > 0';
  const limites = cargas.map(([empresa, carga]) => `WHEN ${inteiro(empresa)} THEN ${inteiro(carga)}`);
  return `ORD.ORDEMCARGA > CASE ORD.CODEMP ${limites.join(' ')} ELSE 0 END`;
}

async function descobrirNotasComCarga(query, { cargas, desde, cursor, ate }) {
  const evento = `GREATEST(NVL(CAB.DTALTER, DATE '1900-01-01'),
    NVL(ORD.DTALTER, DATE '1900-01-01'), NVL(CONF.DHFINCONF, DATE '1900-01-01'))`;
  const dataInicial = dataSql(cursor?.data || desde);
  const filtroInicial = cursor
    ? `(${evento} > ${dataInicial} OR (${evento} = ${dataInicial} AND CAB.NUNOTA > ${inteiro(cursor.nunota)}))`
    : `${evento} >= ${dataInicial}`;
  return query(`SELECT ${camposNota}, ORD.CODPARCTRANSP, TO_CHAR(${evento}, '${formatoData}') EVENTO
    ${notasElegiveis}
    ${ordemComTransportadora}
    WHERE ${filtroNota} AND ${filtroCargasNovas(cargas)}
      AND (CAB.DTALTER >= ${dataInicial} OR ORD.DTALTER >= ${dataInicial} OR CONF.DHFINCONF >= ${dataInicial})
      AND ${filtroInicial} AND ${evento} <= ${dataSql(ate)}
    ORDER BY EVENTO, CAB.NUNOTA
    FETCH FIRST ${LOTE_DESCOBERTA} ROWS ONLY`);
}

async function consultarNotasParaEnvio(query, cargas, ids, ambienteTeste = false) {
  const notas = ids.map(inteiro).filter(Boolean);
  if (!notas.length) return [];
  const chave = `(SELECT MAX(NFE.CHAVENFE) FROM TGFNFE NFE
    WHERE NFE.NUNOTA = CAB.NUNOTA ${ambienteTeste ? '' : 'AND NFE.XMLPROTAUTNOT IS NOT NULL'})`;
  const chaveNota = ambienteTeste ? chave : `CASE WHEN CAB.STATUSNFE = 'A' THEN ${chave} END`;
  return query(`SELECT ${camposNota}, ORD.CODPARCTRANSP, CAB.STATUSNFE, TRA.EMAIL EMAIL_TRANSPORTADORA,
    TRA.EMAILNOTIFENTREGA EMAILNOTIFENTREGA_TRANSPORTADORA, TRA.EMAILCTE EMAILCTE_TRANSPORTADORA,
    TRA.EMAILNFE EMAILNFE_TRANSPORTADORA, TRA.EMAILDANFE EMAILDANFE_TRANSPORTADORA,
    TRA.EMAILNFSE EMAILNFSE_TRANSPORTADORA, ${chaveNota} CHAVENFE
    ${notasElegiveis}
    ${ordemComTransportadora}
    WHERE ${filtroNota} AND ${filtroCargasNovas(cargas)} AND CAB.NUNOTA IN (${notas.join(', ')})`);
}

async function consultarPedidosOrigemNotas(query, ids) {
  const notas = [...new Set(ids.map(inteiro).filter(Boolean))];
  if (!notas.length) return [];
  return query(`SELECT DISTINCT VAR.NUNOTA, ORIG.NUNOTA NUNOTAORIG
    FROM TGFVAR VAR
    JOIN TGFCAB ORIG ON ORIG.NUNOTA = VAR.NUNOTAORIG AND ORIG.TIPMOV = 'P'
    WHERE VAR.NUNOTA IN (${notas.join(', ')})
    ORDER BY VAR.NUNOTA, ORIG.NUNOTA`);
}

async function consultarEmailsContatos(query, codigos) {
  const parceiros = [...new Set(codigos.map(inteiro).filter(Boolean))];
  if (!parceiros.length) return [];
  return query(`SELECT CTT.CODPARC, CTT.EMAIL
    FROM TGFCTT CTT
    WHERE CTT.CODPARC IN (${parceiros.join(', ')})
      AND NVL(CTT.ATIVO, 'S') = 'S' AND TRIM(CTT.EMAIL) IS NOT NULL
    ORDER BY CTT.CODPARC, NVL(CTT.PRIORIDADE, 999), CTT.NOMECONTATO, CTT.CODCONTATO`);
}

module.exports = {
  TAMANHO_PAGINA, LOTE_DESCOBERTA, listarNotasSemCarga, consultarDatasFaturamento, consultarTransportadorasCargas, obterMarcoCargas,
  obterJanelaCargas, descobrirNotasComCarga, consultarNotasParaEnvio, consultarEmailsContatos, consultarPedidosOrigemNotas
};
