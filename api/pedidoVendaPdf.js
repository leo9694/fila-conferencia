const PDFDocument = require('pdfkit');

const PAGE = { width: 595.28, height: 841.89, margin: 18 };
const COLORS = { green: '#087f5b', light: '#eef7f3', grid: '#4b5563', text: '#111827' };

function texto(valor, fallback = '-') {
  const resultado = String(valor ?? '').trim();
  return resultado && resultado.toLowerCase() !== 'null' ? resultado : fallback;
}

function quantidade(valor) {
  const numero = Number(valor || 0);
  return Number.isInteger(numero)
    ? String(numero)
    : numero.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function dataHora(valor) {
  if (!valor) return '-';
  const sankhya = String(valor).match(/^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (sankhya) return `${sankhya[1]}/${sankhya[2]}/${sankhya[3]} ${sankhya[4] || '00'}:${sankhya[5] || '00'}`;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleString('pt-BR');
}

function criarBufferPdf(construir) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: PAGE.margin, bottom: 28, left: PAGE.margin, right: PAGE.margin }, bufferPages: true });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));
    construir(doc);
    doc.end();
  });
}

function desenharCabecalho(doc, pedido, logoPath) {
  const esquerda = PAGE.margin;
  const direita = PAGE.width - PAGE.margin;

  if (logoPath) doc.image(logoPath, esquerda, 18, { fit: [58, 58], align: 'center', valign: 'center' });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(20).text(texto(pedido.NOME_EMPRESA, 'Norte Sul Sementes'), 82, 20, { width: 305, lineBreak: false, ellipsis: true });
  doc.font('Helvetica').fontSize(7.5)
    .text(texto(pedido.ENDERECO_EMPRESA), 82, 49, { width: 300, lineBreak: false, ellipsis: true })
    .text(texto(pedido.EMAIL_EMPRESA), 82, 61, { width: 210, lineBreak: false, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(8.5)
    .text(`VENDEDOR: ${texto(pedido.CODVEND)} - ${texto(pedido.VENDEDOR)}`, 390, 25, { width: direita - 390, align: 'right' })
    .text(texto(pedido.TELEFONE_EMPRESA), 390, 51, { width: direita - 390, align: 'right' });

  doc.moveTo(82, 76).lineTo(direita, 76).lineWidth(1).strokeColor(COLORS.grid).stroke();
  doc.font('Helvetica-Bold').fontSize(16).text(`PEDIDO DE VENDA ${pedido.NUNOTA}`, 82, 82, { width: 330 });
  doc.fontSize(7.5)
    .text(`DT IMPRESSAO: ${new Date().toLocaleString('pt-BR')}`, 405, 82, { width: direita - 405, align: 'right' })
    .text(`DT PEDIDO: ${dataHora(pedido.DTNEG)}`, 405, 94, { width: direita - 405, align: 'right' });
  doc.moveTo(esquerda, 109).lineTo(direita, 109).stroke();

  doc.font('Helvetica-Bold').fontSize(10).text('CLIENTE', 28, 122);
  doc.font('Helvetica').text(`${texto(pedido.CODPARC)} - ${texto(pedido.NOMEPARC)}`, 76, 122, { width: 470 });
  const campos = [
    ['CNPJ:', pedido.CGC_CPF, 36, 141, 280], ['IE:', pedido.IDENTINSCESTAD, 405, 141, 150],
    ['END:', pedido.ENDERECO_CLIENTE, 44, 158, 330], ['BAIRRO:', pedido.BAIRRO, 380, 158, 175],
    ['CIDADE:', [pedido.CIDADE, pedido.UF].filter(Boolean).join('-'), 28, 175, 320], ['CEP:', pedido.CEP, 394, 175, 160],
    ['FONE:', pedido.TELEFONE_CLIENTE, 37, 192, 300]
  ];
  campos.forEach(([rotulo, valor, x, y, largura]) => {
    doc.font('Helvetica-Bold').text(rotulo, x, y);
    doc.font('Helvetica').text(texto(valor), x + doc.widthOfString(rotulo) + 4, y, {
      width: largura - doc.widthOfString(rotulo) - 4,
      height: 11,
      ellipsis: true,
      lineBreak: false
    });
  });
  doc.font('Helvetica-Bold').fontSize(10).text('TRANS:', 28, 210);
  doc.font('Helvetica').fontSize(9).text(texto(pedido.TRANSPORTADORA), 72, 209, {
    width: direita - 72,
    height: 26,
    lineGap: 1
  });
  doc.y = 244;
}

function desenharCabecalhoTabela(doc, grupo) {
  const x = PAGE.margin;
  const largura = PAGE.width - PAGE.margin * 2;
  const colunas = [66, 300, 30, 42, 85, 36];
  const yGrupo = doc.y;
  doc.rect(x, yGrupo, largura, 18).fillAndStroke('#e5e7eb', COLORS.grid);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
    .text(`Grupo: ${texto(grupo.CODGRUPOPROD)} - ${texto(grupo.DESCRGRUPOPROD)}`, x + 4, yGrupo + 5, { width: largura - 8, align: 'center', lineBreak: false });
  doc.y = yGrupo + 18;
  const y = doc.y;
  const titulos = ['Codigo', 'Descricao', 'UN', 'QTD', 'Lote', 'Local'];
  let atual = x;
  titulos.forEach((titulo, indice) => {
    doc.rect(atual, y, colunas[indice], 15).stroke(COLORS.grid);
    doc.font('Helvetica-Bold').fontSize(7.5).text(titulo, atual + 2, y + 4, { width: colunas[indice] - 4, align: indice > 1 ? 'center' : 'left' });
    atual += colunas[indice];
  });
  doc.y = y + 15;
}

function desenharItem(doc, item) {
  const x = PAGE.margin;
  const colunas = [66, 300, 30, 42, 85, 36];
  const valores = [item.CODPROD, item.DESCRPROD, item.CODVOL, quantidade(item.QTDNEG), item.CONTROLE, item.LOCAL];
  const altura = 14;
  const y = doc.y;
  let atual = x;
  valores.forEach((valor, indice) => {
    doc.rect(atual, y, colunas[indice], altura).stroke(COLORS.grid);
    doc.font('Helvetica').fontSize(6.8).text(texto(valor, indice === 5 ? '<SEM LOCAL>' : '-'), atual + 2, y + 3.5, {
      width: colunas[indice] - 4,
      height: altura - 4,
      align: indice === 2 || indice === 3 ? 'center' : 'left',
      ellipsis: true,
      lineBreak: false
    });
    atual += colunas[indice];
  });
  doc.y = y + altura;
}

async function gerarPedidoVendaPdf({ pedido, itens, logoPath }) {
  return criarBufferPdf((doc) => {
    desenharCabecalho(doc, pedido, logoPath);
    let grupoAtual = null;
    let grupo = null;

    itens.forEach((item) => {
      const chaveGrupo = String(item.CODGRUPOPROD ?? '');
      const precisaGrupo = chaveGrupo !== grupoAtual;
      const alturaNecessaria = (precisaGrupo ? 33 : 0) + 14;
      if (doc.y + alturaNecessaria > PAGE.height - 42) {
        doc.addPage();
        doc.y = PAGE.margin;
        if (!precisaGrupo && grupo) desenharCabecalhoTabela(doc, grupo);
      }
      if (precisaGrupo) {
        grupoAtual = chaveGrupo;
        grupo = item;
        desenharCabecalhoTabela(doc, grupo);
      }
      desenharItem(doc, item);
    });

    const observacao = texto(pedido.OBSERVACAO, '');
    const larguraObservacao = PAGE.width - PAGE.margin * 2;
    const alturaTexto = Math.max(42, doc.heightOfString(observacao || ' ', {
      width: larguraObservacao - 16,
      lineGap: 2
    }) + 16);
    const alturaObservacao = 24 + alturaTexto;
    if (doc.y + alturaObservacao + 8 > PAGE.height - 48) {
      doc.addPage();
      doc.y = PAGE.margin;
    } else {
      doc.y += 10;
    }
    const yObservacao = doc.y;
    doc.rect(PAGE.margin, yObservacao, larguraObservacao, alturaObservacao).stroke(COLORS.grid);
    doc.font('Helvetica-Bold').fontSize(11).text('OBSERVACOES', PAGE.margin + 8, yObservacao + 6, {
      width: larguraObservacao - 16,
      align: 'center',
      lineBreak: false
    });
    doc.font('Helvetica').fontSize(8).text(observacao, PAGE.margin + 8, yObservacao + 28, {
      width: larguraObservacao - 16,
      height: alturaTexto - 8,
      lineGap: 2
    });
    doc.y = yObservacao + alturaObservacao;

    const paginas = doc.bufferedPageRange();
    for (let indice = paginas.start; indice < paginas.start + paginas.count; indice += 1) {
      doc.switchToPage(indice);
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.text)
        .text(`Pagina ${indice + 1} de ${paginas.count}`, 0, PAGE.height - 48, { width: PAGE.width, align: 'center', lineBreak: false });
    }
  });
}

module.exports = { gerarPedidoVendaPdf };
