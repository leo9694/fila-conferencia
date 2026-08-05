const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Cuiaba';

const CABECALHOS = [
  'Número CT-e',
  'Data Emissão',
  'Transportadora',
  'Empresa',
  'Parceiro/Destinatário',
  'Cidade',
  'Estado',
  'Número da Nota',
  'Valor do Pedido',
  'Peso (Kg)',
  'Volumes',
  'Valor do Frete'
];

function dataIsoValida(valor) {
  const texto = String(valor || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function validarPeriodo(dataInicial, dataFinal) {
  if (!dataIsoValida(dataInicial) || !dataIsoValida(dataFinal)) {
    throw Object.assign(new Error('Informe Data Inicial e Data Final validas.'), { statusCode: 400 });
  }
  if (dataInicial > dataFinal) {
    throw Object.assign(new Error('A Data Final deve ser igual ou posterior a Data Inicial.'), { statusCode: 400 });
  }

  return { dataInicial, dataFinal };
}

function formatarDataIsoUtc(data) {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}`;
}

function dividirPeriodoMensal(dataInicial, dataFinal) {
  const periodo = validarPeriodo(dataInicial, dataFinal);
  const fim = new Date(`${periodo.dataFinal}T00:00:00.000Z`);
  let cursor = new Date(`${periodo.dataInicial}T00:00:00.000Z`);
  const blocos = [];

  while (cursor <= fim) {
    const ultimoDiaMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const fimBloco = ultimoDiaMes < fim ? ultimoDiaMes : fim;
    blocos.push({
      dataInicial: formatarDataIsoUtc(cursor),
      dataFinal: formatarDataIsoUtc(fimBloco)
    });
    cursor = new Date(fimBloco.getTime() + 86400000);
  }

  return blocos;
}

function montarSqlRelatorioCtes(dataInicial, dataFinal) {
  const periodo = validarPeriodo(dataInicial, dataFinal);
  return `
WITH XML_CTE AS (
  SELECT IX.NUMNOTA, IX.DHEMISS, IX.XNOMEEMIT, IX.CODEMP,
         IX.VLRNOTA, IX.CHAVEACESSO, IX.DOCSREF,
         ROW_NUMBER() OVER (
           PARTITION BY IX.CHAVEACESSO ORDER BY IX.NUARQUIVO DESC
         ) RN
  FROM TGFIXN IX
  WHERE IX.STATUS = 2
    AND IX.TIPO = 'C'
    AND IX.DHEMISS >= TRUNC(TO_DATE('${periodo.dataInicial}', 'YYYY-MM-DD'))
    AND IX.DHEMISS < TRUNC(TO_DATE('${periodo.dataFinal}', 'YYYY-MM-DD')) + 1
    AND IX.CHAVEACESSO IS NOT NULL
    AND IX.DOCSREF IS NOT NULL
),
LINHAS_CTE AS (
  SELECT /*+ MATERIALIZE */
         IX.NUMNOTA NUM_CTE, IX.DHEMISS DATA_EMISSAO,
         IX.XNOMEEMIT TRANSPORTADORA, IX.CODEMP,
         NVL(IX.VLRNOTA, 0) VALOR_FRETE, X.CHAVENFE
  FROM XML_CTE IX,
       XMLTABLE(
         '/docsRef/chaveAcesso'
         PASSING XMLTYPE(IX.DOCSREF)
         COLUMNS CHAVENFE VARCHAR2(44) PATH '.'
       ) X
  WHERE IX.RN = 1
)
SELECT L.NUM_CTE,
       L.DATA_EMISSAO,
       NVL(L.TRANSPORTADORA, 'NAO INFORMADA') TRANSPORTADORA,
       EMP.NOMEFANTASIA EMPRESA,
       NVL(PAR.NOMEPARC, XMLNF.XNOMEDEST) PARCEIRO,
       NVL(CIDCAB.NOMECID, CID.NOMECID) CIDADE,
       NVL(UFSCAB.DESCRICAO, NVL(UFSCAB.UF, NVL(UFS.DESCRICAO, UFS.UF))) ESTADO,
       NVL(TO_CHAR(CAB.NUMNOTA), TO_CHAR(XMLNF.NUMNOTA)) NUM_NOTA,
       NVL(CAB.VLRNOTA, NVL(XMLNF.VLRNOTA, 0)) VALOR_PEDIDO,
       NVL(NULLIF(CAB.PESOBRUTO, 0), NVL(CAB.PESO, 0)) PESO,
       NVL(CAB.QTDVOL, 0) VOLUMES,
       L.VALOR_FRETE
FROM LINHAS_CTE L
JOIN TSIEMP EMP ON EMP.CODEMP = L.CODEMP
OUTER APPLY (
  SELECT /*+ INDEX(N IDX_TGFNFE_CHAVENFE) */
         MAX(N.NUNOTA) NUNOTA
  FROM TGFNFE N
  WHERE N.CHAVENFE = L.CHAVENFE
) NF
LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = NF.NUNOTA
LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
LEFT JOIN TSICID CIDCAB ON CIDCAB.CODCID = CAB.CODCID
LEFT JOIN TSIUFS UFSCAB ON UFSCAB.CODUF = CIDCAB.UF
OUTER APPLY (
  SELECT /*+ INDEX(IX TGFIXN_I02) */
         MAX(IX.NUMNOTA) KEEP (
           DENSE_RANK LAST ORDER BY IX.NUARQUIVO
         ) NUMNOTA,
         MAX(IX.VLRNOTA) KEEP (
           DENSE_RANK LAST ORDER BY IX.NUARQUIVO
         ) VLRNOTA,
         MAX(IX.XNOMEDEST) KEEP (
           DENSE_RANK LAST ORDER BY IX.NUARQUIVO
         ) XNOMEDEST
  FROM TGFIXN IX
  WHERE IX.CHAVEACESSO = L.CHAVENFE
    AND IX.TIPO = 'N'
) XMLNF
ORDER BY L.DATA_EMISSAO, L.TRANSPORTADORA, L.NUM_CTE, NUM_NOTA`;
}

function escaparXml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizarData(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
  const texto = String(valor || '').trim();
  let match = texto.match(/^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)));
  match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)));
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

function serialDataExcel(data) {
  return (Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000;
}

function numero(valor, inteiro = false) {
  const convertido = Number(valor);
  if (!Number.isFinite(convertido)) return 0;
  return inteiro ? Math.trunc(convertido) : convertido;
}

function letraColuna(indice) {
  let numeroColuna = indice;
  let texto = '';
  while (numeroColuna > 0) {
    numeroColuna -= 1;
    texto = String.fromCharCode(65 + (numeroColuna % 26)) + texto;
    numeroColuna = Math.floor(numeroColuna / 26);
  }
  return texto;
}

function celulaTexto(referencia, valor, estilo = 0) {
  return `<c r="${referencia}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function celulaNumero(referencia, valor, estilo = 0) {
  return `<c r="${referencia}"${estilo ? ` s="${estilo}"` : ''}><v>${Number(valor)}</v></c>`;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dataHoraDos(data = new Date()) {
  const ano = Math.max(1980, data.getFullYear());
  const hora = (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2);
  const dia = ((ano - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  return { hora, dia };
}

function criarZip(arquivos) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  const agora = dataHoraDos();

  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, 'utf8');
    const conteudo = Buffer.isBuffer(arquivo.conteudo) ? arquivo.conteudo : Buffer.from(arquivo.conteudo, 'utf8');
    const crc = crc32(conteudo);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(agora.hora, 10);
    local.writeUInt16LE(agora.dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(conteudo.length, 18);
    local.writeUInt32LE(conteudo.length, 22);
    local.writeUInt16LE(nome.length, 26);
    locais.push(local, nome, conteudo);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(agora.hora, 12);
    central.writeUInt16LE(agora.dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(conteudo.length, 20);
    central.writeUInt32LE(conteudo.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nome);
    deslocamento += local.length + nome.length + conteudo.length;
  }

  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

function gerarPlanilhaCtes(rows) {
  const larguras = [14, 14, 48, 38, 55, 30, 30, 16, 18, 14, 11, 18];
  const linhas = [
    `<row r="1" ht="24" customHeight="1">${CABECALHOS.map((cabecalho, index) => celulaTexto(`${letraColuna(index + 1)}1`, cabecalho, 5)).join('')}</row>`
  ];

  rows.forEach((row, index) => {
    const numeroLinha = index + 2;
    const data = normalizarData(row.DATA_EMISSAO);
    const valores = [
      ['texto', row.NUM_CTE ?? '', 0],
      data ? ['numero', serialDataExcel(data), 1] : ['texto', '', 0],
      ['texto', row.TRANSPORTADORA ?? 'NAO INFORMADA', 6],
      ['texto', row.EMPRESA ?? '', 6],
      ['texto', row.PARCEIRO ?? '', 6],
      ['texto', row.CIDADE ?? '', 6],
      ['texto', row.ESTADO ?? '', 6],
      ['texto', row.NUM_NOTA ?? '', 0],
      ['numero', numero(row.VALOR_PEDIDO), 2],
      ['numero', numero(row.PESO), 3],
      ['numero', numero(row.VOLUMES, true), 4],
      ['numero', numero(row.VALOR_FRETE), 2]
    ];
    const celulas = valores.map(([tipo, valor, estilo], coluna) => {
      const referencia = `${letraColuna(coluna + 1)}${numeroLinha}`;
      return tipo === 'numero' ? celulaNumero(referencia, valor, estilo) : celulaTexto(referencia, valor, estilo);
    });
    const linhasTexto = Math.max(
      1,
      Math.ceil(String(row.TRANSPORTADORA ?? 'NAO INFORMADA').length / 44),
      Math.ceil(String(row.EMPRESA ?? '').length / 34),
      Math.ceil(String(row.PARCEIRO ?? '').length / 50),
      Math.ceil(String(row.CIDADE ?? '').length / 26),
      Math.ceil(String(row.ESTADO ?? '').length / 26)
    );
    linhas.push(`<row r="${numeroLinha}" ht="${Math.max(18, linhasTexto * 15)}" customHeight="1">${celulas.join('')}</row>`);
  });

  const ultimaLinha = Math.max(1, rows.length + 1);
  const colunas = larguras.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const planilha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colunas}</cols>
  <sheetData>${linhas.join('')}</sheetData>
  <autoFilter ref="A1:L${ultimaLinha}"/>
</worksheet>`;

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="166" formatCode="#,##0.###"/></numFmts>
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087F6D"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><bottom style="thin"><color rgb="FFD7E3E0"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return criarZip([
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { nome: 'docProps/core.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>CT-es Importados por Período</dc:title><dc:creator>Norte Sul Sementes</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>` },
    { nome: 'docProps/app.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Central de Conferência</Application></Properties>` },
    { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CT-es Importados" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: 'xl/styles.xml', conteudo: estilos },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilha }
  ]);
}

function nomeArquivoRelatorio(data = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(data).filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, parte.value]));
  return `CT-es Importados por Periodo_${partes.day}-${partes.month}-${partes.year}_${partes.hour}-${partes.minute}.xlsx`;
}

module.exports = {
  CABECALHOS,
  dividirPeriodoMensal,
  gerarPlanilhaCtes,
  montarSqlRelatorioCtes,
  nomeArquivoRelatorio,
  normalizarData,
  validarPeriodo
};
