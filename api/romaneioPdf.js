const path = require('path');
const PDFDocument = require('pdfkit');

const PAGE = { width: 595.28, height: 841.89, margin: 28 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const LOGO_PATH = path.join(__dirname, '..', 'frontend', 'logo-norte-sul-label.png');

function texto(valor, fallback = '-') {
  const resultado = String(valor ?? '').trim();
  return resultado && resultado.toLowerCase() !== 'null' ? resultado : fallback;
}

function formatarData(valor) {
  const valorTexto = String(valor ?? '').trim();
  const correspondencia = valorTexto.match(/^(\d{2})\/?(\d{2})\/?(\d{4})/);
  if (correspondencia) return `${correspondencia[1]}/${correspondencia[2]}/${correspondencia[3]}`;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valorTexto || '-' : data.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarQuantidade(valor, casas = 0) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  });
}

function formatarPeso(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function textoAjustado(doc, valor, x, y, largura, tamanhoInicial, opcoes = {}) {
  let tamanho = tamanhoInicial;
  const tamanhoMinimo = opcoes.tamanhoMinimo || 5.5;
  const conteudo = texto(valor, '');
  while (tamanho > tamanhoMinimo && doc.fontSize(tamanho).widthOfString(conteudo) > largura) tamanho -= 0.25;
  doc.fontSize(tamanho).text(conteudo || '-', x, y, {
    width: largura,
    height: opcoes.height || tamanho + 2,
    lineBreak: false,
    ellipsis: true,
    ...opcoes
  });
}

function criarBufferPdf(construir) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE.margin, right: PAGE.margin, bottom: 30, left: PAGE.margin },
      bufferPages: true
    });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));
    construir(doc);
    doc.end();
  });
}

function desenharCabecalho(doc, romaneio) {
  const emissao = new Date();
  const dataEmissao = emissao.toLocaleDateString('pt-BR');
  const horaEmissao = emissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  try {
    doc.image(LOGO_PATH, PAGE.margin + 18, 25, { fit: [36, 36] });
  } catch (_) {
    // O romaneio continua sendo gerado mesmo se o arquivo visual da logo estiver indisponivel.
  }

  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(13)
    .text(`ROMANEIO DE DESPACHO - ${texto(romaneio.ordemCarga)}`, 105, 34, {
      width: 385,
      align: 'center',
      lineBreak: false
    });
  doc.font('Helvetica-Bold').fontSize(10)
    .text(texto(romaneio.empresa, 'NORTE SUL SEMENTES'), 105, 61, {
      width: 385,
      align: 'center',
      lineBreak: false
    });
  doc.font('Helvetica').fontSize(6.5)
    .text(`Emissao: ${dataEmissao}    ${horaEmissao}`, 463, 25, {
      width: 104,
      align: 'right',
      lineBreak: false
    });
  doc.moveTo(PAGE.margin, 82).lineTo(PAGE.width - PAGE.margin, 82).lineWidth(0.65).strokeColor('#a0a0a0').stroke();
  doc.y = 94;
}

function desenharTituloTransportadora(doc, transportadora) {
  const y = doc.y;
  doc.fillColor('#000000').font('Helvetica-Bold');
  textoAjustado(
    doc,
    `Transportadora : ${texto(transportadora)}`,
    PAGE.margin + 2,
    y,
    CONTENT_WIDTH - 4,
    9.5
  );
  doc.y = y + 17;
}

function desenharCabecalhoTabela(doc) {
  const larguras = [64, 54, 176, 88, 52, 48, 57];
  const titulos = ['Data', 'NF-e', 'Cliente', 'Cidade', 'Qtd. Vol', 'Peso', 'Valor'];
  const y = doc.y;
  let x = PAGE.margin;

  titulos.forEach((titulo, indice) => {
    doc.rect(x, y, larguras[indice], 18).lineWidth(1).strokeColor('#000000').stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(6.2)
      .text(titulo, x + 2, y + 5, {
        width: larguras[indice] - 4,
        align: indice >= 4 ? 'center' : 'left',
        lineBreak: false
      });
    x += larguras[indice];
  });
  doc.y = y + 18;
}

function desenharLinha(doc, nota) {
  const larguras = [64, 54, 176, 88, 52, 48, 57];
  const altura = 18;
  const valores = [
    formatarData(nota.DTNEG),
    Number(nota.NUMNOTA || 0) > 0 ? String(nota.NUMNOTA) : `Int. ${nota.NUNOTA}`,
    texto(nota.CLIENTE),
    [texto(nota.CIDADE, ''), texto(nota.UF, '')].filter(Boolean).join(' - '),
    formatarQuantidade(nota.QTDVOL),
    formatarPeso(nota.PESO),
    formatarMoeda(nota.VLRNOTA)
  ];
  const y = doc.y;
  let x = PAGE.margin;

  valores.forEach((valor, indice) => {
    textoAjustado(doc, valor, x + 2, y + 5, larguras[indice] - 4, indice === 2 ? 5.8 : 6, {
      align: indice >= 4 ? 'center' : 'left',
      ...(indice === 3 ? { tamanhoMinimo: 4, ellipsis: false } : {})
    });
    doc.moveTo(x, y + altura).lineTo(x + larguras[indice], y + altura).lineWidth(0.6).strokeColor('#000000').stroke();
    x += larguras[indice];
  });
  doc.y = y + altura;
}

function desenharAssinaturas(doc, transportadora, linhaInicio) {
  const x = 160;
  const largura = 310;
  doc.moveTo(x, linhaInicio).lineTo(x + largura, linhaInicio).lineWidth(0.7).strokeColor('#000000').stroke();
  doc.fillColor('#000000').font('Helvetica').fontSize(10)
    .text('NORTE SUL SEMENTES', x, linhaInicio + 8, { width: largura, align: 'center', lineBreak: false });
  doc.moveTo(x, linhaInicio + 38).lineTo(x + largura, linhaInicio + 38).lineWidth(0.7).strokeColor('#000000').stroke();
  textoAjustado(doc, transportadora, x, linhaInicio + 46, largura, 10, { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(5.8)
    .text('ORDEM DE COLETA DE CARGA (Art. 1o, XV e art. 70 Conv. SINIEF 06/89)', PAGE.margin, linhaInicio + 76, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false
    });
}

function agruparNotasPorTransportadora(notas) {
  const grupos = new Map();
  notas.forEach((nota) => {
    const codigo = texto(nota.CODPARCTRANSP);
    const nome = texto(nota.TRANSPORTADORA);
    const chave = `${codigo}|${nome}`;
    if (!grupos.has(chave)) grupos.set(chave, { codigo, nome, notas: [] });
    grupos.get(chave).notas.push(nota);
  });
  return [...grupos.values()];
}

async function gerarRomaneioCargaPdf({ ordemCarga, transportadora, empresa, notas }) {
  const lista = Array.isArray(notas) ? notas : [];
  const grupos = agruparNotasPorTransportadora(lista);
  const totalVolumes = lista.reduce((total, nota) => total + Number(nota.QTDVOL || 0), 0);
  const totalPeso = lista.reduce((total, nota) => total + Number(nota.PESO || 0), 0);
  const totalValor = lista.reduce((total, nota) => total + Number(nota.VLRNOTA || 0), 0);
  const identificacoesTransportadoras = [...new Set(
    grupos
      .map((grupo) => [grupo.codigo, grupo.nome].filter((valor) => valor && valor !== '-').join(' - '))
      .filter(Boolean)
  )];
  const assinaturaTransportadora = identificacoesTransportadoras.join(' / ') || transportadora;

  return criarBufferPdf((doc) => {
    desenharCabecalho(doc, { ordemCarga, empresa });

    grupos.forEach((grupo, indiceGrupo) => {
      if (indiceGrupo > 0) doc.y += 8;
      if (doc.y + 53 > PAGE.height - 200) {
        doc.addPage();
        desenharCabecalho(doc, { ordemCarga, empresa });
      }

      const identificacao = `${grupo.codigo} - ${grupo.nome}`;
      desenharTituloTransportadora(doc, identificacao);
      desenharCabecalhoTabela(doc);

      grupo.notas.forEach((nota) => {
        if (doc.y + 18 > PAGE.height - 200) {
          doc.addPage();
          desenharCabecalho(doc, { ordemCarga, empresa });
          desenharTituloTransportadora(doc, identificacao);
          desenharCabecalhoTabela(doc);
        }
        desenharLinha(doc, nota);
      });
    });

    // Reserve only the space actually needed by the totals block before the
    // fixed signature area. The previous 82px gap forced short romaneios onto
    // a second page even when the rows and footer still fit together.
    const yTotais = Math.max(doc.y + 12, 270);
    if (yTotais + 155 > PAGE.height - 30) {
      doc.addPage();
      desenharCabecalho(doc, { ordemCarga, empresa });
    }
    const y = Math.max(doc.y + 12, 270);
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12)
      .text('Vlr. Total:', 103, y, { continued: true })
      .font('Helvetica').text(` ${formatarMoeda(totalValor)}`);
    doc.font('Helvetica-Bold').fontSize(12)
      .text('Vol. Total:', 120, y + 30, { continued: true })
      .font('Helvetica').text(` ${formatarQuantidade(totalVolumes)}`);
    doc.font('Helvetica-Bold').fontSize(12)
      .text('Peso Total:', 91, y + 60, { continued: true })
      .font('Helvetica').text(` ${formatarPeso(totalPeso)}`);

    const linhaAssinatura = y + 82;
    desenharAssinaturas(doc, assinaturaTransportadora, linhaAssinatura);
  });
}

module.exports = { gerarRomaneioCargaPdf };
