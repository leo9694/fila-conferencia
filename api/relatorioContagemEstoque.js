const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Cuiaba';

const CABECALHOS = [
  'ID da Contagem', 'Empresa', 'Local', 'Foto Criada em', 'Finalizada em',
  'Codigo Produto', 'Descricao', 'Grupo', 'Origem',
  'Lote da Foto', 'Lote Final', 'Fabricacao da Foto', 'Fabricacao Final',
  'Validade da Foto', 'Validade Final', 'Estoque na Foto', '1a Contagem',
  'Recontagem', 'Quantidade Final', 'Diferenca', 'Unidade', 'Resultado',
  'Atualizado por', 'Atualizado em', 'Notas de Ajuste'
];

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function valorContagem(item, rodada) {
  const valor = item?.contagens?.[String(rodada)];
  return valor === null || valor === undefined ? null : numero(valor);
}

function valorOriginal(item, campo, fallback) {
  return Object.prototype.hasOwnProperty.call(item, campo) ? item[campo] : fallback;
}

function usuarioTexto(usuario) {
  if (!usuario || typeof usuario !== 'object') return usuario ?? '';
  return usuario.nome || usuario.usuario || usuario.username || usuario.codigo || usuario.codUsu || '';
}

function formatarData(valor, incluirHora = false) {
  if (!valor) return '';
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso && !incluirHora) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const compacta = texto.match(/^(\d{2})(\d{2})(\d{4})/);
  if (compacta) return `${compacta[1]}/${compacta[2]}/${compacta[3]}`;
  const brasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brasileira) return brasileira[0];
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(incluirHora ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {})
  }).format(data);
}

function dadosRelatorio(sessao) {
  const notas = (sessao.ajuste?.notas || []).map((nota) => nota.nunota).filter(Boolean).join(', ');
  return (sessao.itens || []).map((item) => {
    const primeira = valorContagem(item, 1);
    const segunda = valorContagem(item, 2);
    const final = segunda === null ? primeira : segunda;
    const manual = item.adicionadoManualmente === true;
    const estoqueFoto = numero(item.estoqueFoto ?? (manual ? 0 : item.estoqueSistema));
    const diferenca = final === null ? null : final - estoqueFoto;
    const efeito = diferenca === null || Math.abs(diferenca) <= 0.000001
      ? 'SEM DIVERGENCIA'
      : diferenca > 0 ? 'SOBRA' : 'FALTA';
    let resultado = 'PENDENTE - NAO CONTADO';
    if (final !== null && segunda !== null && primeira !== null && Math.abs(segunda - primeira) > 0.000001) {
      resultado = `DIVERGENTE DA 1a CONTAGEM - ${efeito}`;
    } else if (final !== null && segunda !== null) {
      resultado = `OK RECONTAGEM - ${efeito}`;
    } else if (final !== null) {
      resultado = efeito;
    }

    const controleFoto = valorOriginal(item, 'controleFoto', manual ? '' : item.controle);
    const fabricacaoFoto = valorOriginal(item, 'dtFabricacaoFoto', manual ? null : item.dtFabricacao);
    const validadeFoto = valorOriginal(item, 'dtValFoto', manual ? null : item.dtVal);
    return [
      sessao.id, `${sessao.empresa} - ${sessao.nomeEmpresa || ''}`.trim(),
      item.descrLocal || sessao.nomeLocal || item.codLocal || '',
      formatarData(sessao.criadoEm, true), formatarData(sessao.finalizadoEm, true),
      item.codProd, item.descrProd || '', item.descrGrupoProd || 'Sem grupo',
      manual ? 'ADICIONADO NA CONTAGEM' : 'FOTO DO ESTOQUE',
      controleFoto || 'Sem controle', item.controle || 'Sem controle',
      formatarData(fabricacaoFoto), formatarData(item.dtFabricacao),
      formatarData(validadeFoto), formatarData(item.dtVal),
      estoqueFoto, primeira, segunda, final, diferenca, item.codVol || 'UN', resultado,
      usuarioTexto(item.atualizadoPor), formatarData(item.atualizadoEm, true), notas
    ];
  });
}

function xml(valor) {
  return String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function coluna(indice) {
  let resultado = '';
  for (let atual = indice; atual > 0; atual = Math.floor((atual - 1) / 26)) {
    resultado = String.fromCharCode(65 + ((atual - 1) % 26)) + resultado;
  }
  return resultado;
}

function celula(ref, valor, estilo = 0) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}><v>${valor}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function criarZip(arquivos) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const dia = ((Math.max(1980, agora.getFullYear()) - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, 'utf8');
    const conteudo = Buffer.from(arquivo.conteudo, 'utf8');
    const crc = crc32(conteudo);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(hora, 10); local.writeUInt16LE(dia, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(conteudo.length, 18); local.writeUInt32LE(conteudo.length, 22); local.writeUInt16LE(nome.length, 26);
    locais.push(local, nome, conteudo);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(hora, 12); central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(conteudo.length, 20); central.writeUInt32LE(conteudo.length, 24);
    central.writeUInt16LE(nome.length, 28); central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nome);
    deslocamento += local.length + nome.length + conteudo.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12); fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

function gerarRelatorioContagemEstoque(sessao) {
  const dados = dadosRelatorio(sessao);
  const linhas = [
    `<row r="1" ht="24" customHeight="1">${CABECALHOS.map((titulo, indice) => celula(`${coluna(indice + 1)}1`, titulo, 2)).join('')}</row>`
  ];
  dados.forEach((valores, indice) => {
    const numeroLinha = indice + 2;
    linhas.push(`<row r="${numeroLinha}">${valores.map((valor, posicao) => celula(`${coluna(posicao + 1)}${numeroLinha}`, valor, typeof valor === 'number' ? 1 : 0)).join('')}</row>`);
  });
  const larguras = [24, 32, 24, 20, 20, 14, 48, 28, 24, 18, 18, 18, 18, 18, 18, 16, 16, 16, 18, 14, 12, 28, 18, 20, 24];
  const cols = larguras.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const ultimaLinha = Math.max(1, dados.length + 1);
  const planilha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData><autoFilter ref="A1:Y${ultimaLinha}"/></worksheet>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF087F6D"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFD7E3E0"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf borderId="1"/><xf numFmtId="164" borderId="1" applyNumberFormat="1"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return criarZip([
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Auditoria da Contagem" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: 'xl/styles.xml', conteudo: estilos },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilha }
  ]);
}

function nomeArquivoRelatorioContagem(sessao, data = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(data).filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, parte.value]));
  return `Relatorio Contagem Estoque_${sessao.empresa}_${partes.day}-${partes.month}-${partes.year}_${partes.hour}-${partes.minute}.xlsx`;
}

module.exports = { CABECALHOS, dadosRelatorio, gerarRelatorioContagemEstoque, nomeArquivoRelatorioContagem };
