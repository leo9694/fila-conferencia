const express = require('express');
const path = require('path');
const router = express.Router();
const {
  downloadDirectFile,
  downloadGatewayFile,
  executeDirectService,
  executeQuery,
  executeService
} = require('./api/sankhyaApi');
const { criarConferenciaTimerStore } = require('./api/conferenciaTimerStore');
const { criarConferenciaProgressStore } = require('./api/conferenciaProgressStore');
const { criarContatoStatusStore } = require('./api/contatoStatusStore');
const { gerarPedidoVendaPdf } = require('./api/pedidoVendaPdf');
const { criarPedidoPrintStore } = require('./api/pedidoPrintStore');

const conferenciaTimerStore = criarConferenciaTimerStore();
const conferenciaProgressStore = criarConferenciaProgressStore();
const contatoStatusStore = criarContatoStatusStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const pedidoPrintStore = criarPedidoPrintStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Cuiaba';

function obterDataHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function obterIntervaloDatas(dataInicial, dataFinal) {
  const inicioValido = typeof dataInicial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataInicial);
  const fimValido = typeof dataFinal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataFinal);
  const hoje = obterDataHoje();

  let inicio = inicioValido ? dataInicial : hoje;
  let fim = fimValido ? dataFinal : inicio;

  if (inicio > fim) {
    [inicio, fim] = [fim, inicio];
  }

  return { inicio, fim };
}

function obterFiltroEmpresa(empresa) {
  if (empresa === undefined || empresa === null) {
    return null;
  }

  const valor = String(empresa).trim();
  return /^\d+$/.test(valor) ? valor : null;
}

function sqlFiltroEmpresa(empresa) {
  return empresa ? `AND TO_CHAR(CAB.CODEMP) = '${empresa}'` : '';
}

function obterNumeroInteiro(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function sqlFiltroPerfilContato(perfil) {
  const valor = String(perfil || '').trim();

  if (valor === 'todos') {
    return '';
  }

  if (valor === 'sem-perfil') {
    return 'AND NVL(PAR.CODTIPPARC, 0) <= 0';
  }

  const codPerfil = obterNumeroInteiro(valor);
  return codPerfil ? `AND PAR.CODTIPPARC = ${codPerfil}` : null;
}

function sqlFiltroAtivoContato(valor) {
  return String(valor || '1') === '0' ? '' : "AND NVL(PAR.ATIVO, 'S') = 'S'";
}

function obterListaFiltroContato(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  try {
    const lista = JSON.parse(String(valor));
    return Array.isArray(lista)
      ? lista.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 500)
      : [];
  } catch {
    return null;
  }
}

function sqlFiltroListaTexto(expressao, valores) {
  if (valores === null) return '';
  if (!valores.length) return 'AND 1 = 0';
  return `AND ${expressao} IN (${valores.map((valor) => `'${textoSql(valor)}'`).join(', ')})`;
}

function sqlFiltroPeriodoCompra(dataInicial, dataFinal) {
  const inicial = /^\d{4}-\d{2}-\d{2}$/.test(String(dataInicial || '')) ? dataInicial : null;
  const final = /^\d{4}-\d{2}-\d{2}$/.test(String(dataFinal || '')) ? dataFinal : null;
  return [
    inicial ? `AND ULTIMA_COMPRA.DTULTCOMPRA >= TO_DATE('${inicial}', 'YYYY-MM-DD')` : '',
    final ? `AND ULTIMA_COMPRA.DTULTCOMPRA < TO_DATE('${final}', 'YYYY-MM-DD') + 1` : ''
  ].filter(Boolean).join('\n');
}

function valorTextoContato(valor, limite = 255) {
  return String(valor ?? '').trim().slice(0, limite);
}

function contatoTemConteudo(contato = {}) {
  return [
    contato.nome,
    contato.cargo,
    contato.telefone,
    contato.email
  ].some(valorPreenchido);
}

function validarContatoObrigatorio(contato, nome) {
  const faltando = [];

  if (!valorPreenchido(contato?.nome)) faltando.push(`nome do ${nome}`);
  if (!valorPreenchido(contato?.cargo)) faltando.push(`cargo do ${nome}`);
  if (!valorPreenchido(contato?.telefone)) faltando.push(`telefone do ${nome}`);
  if (!valorPreenchido(contato?.email)) faltando.push(`email do ${nome}`);

  return faltando;
}

function anexarStatusContato(clientes) {
  return clientes.map((cliente) => {
    const registro = contatoStatusStore.obter(cliente.CODPARC);
    const status = registro?.status || (valorPreenchido(cliente.DATA_ATUALIZACAO_CONTATO) ? 'atualizado' : 'pendente');

    return {
      ...cliente,
      STATUS_ATUALIZACAO_CONTATO: status
    };
  });
}

async function salvarContatoParceiro(codParc, contato, codContatoNovo) {
  let codContato = obterNumeroInteiro(contato?.codContato);
  const camposEditaveis = {
    NOMECONTATO: valorTextoContato(contato?.nome, 40),
    APELIDO: valorTextoContato(contato?.nome, 15),
    CARGO: valorTextoContato(contato?.cargo, 20),
    TELEFONE: valorTextoContato(contato?.telefone, 13),
    EMAIL: valorTextoContato(contato?.email, 80),
    ATIVO: 'S'
  };

  if (!codContato && ['nfe', 'transporte', 'financeiro'].includes(String(contato?.tipo || '').toLowerCase())) {
    const cargosFixos = {
      nfe: 'NFE',
      transporte: 'TRANSPORTE',
      financeiro: 'FINANCEIRO'
    };
    const cargoBusca = cargosFixos[String(contato.tipo).toLowerCase()];
    const [contatoExistente] = await executeQuery(`
      SELECT MIN(CODCONTATO) AS CODCONTATO
      FROM TGFCTT
      WHERE CODPARC = ${codParc}
        AND UPPER(TRIM(CARGO)) = '${cargoBusca}'
    `);
    codContato = obterNumeroInteiro(contatoExistente?.CODCONTATO);
  }

  if (codContato) {
    await atualizarRegistroApi('Contato', { CODPARC: codParc, CODCONTATO: codContato }, camposEditaveis);
    return codContato;
  }

  codContato = codContatoNovo;

  await salvarRegistroApi('Contato', {
    CODPARC: codParc,
    CODCONTATO: codContato,
    ...camposEditaveis
  });

  return codContato;
}

function obterCodigoUsuario(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function obterValorMonetario(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor >= 0 ? valor : null;
  }

  let texto = String(valor ?? '').trim().replace(/R\$/gi, '').replace(/\s+/g, '');
  if (!texto) return null;

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function valorPreenchido(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== '';
}

function adicionarCodigoConferencia(lista, codigo, tipo, multiplicador = 1, descricao = '') {
  if (!valorPreenchido(codigo)) return;

  const codigoNormalizado = String(codigo).trim();
  const fator = normalizarNumero(multiplicador) || 1;
  const jaExiste = lista.some((item) => String(item.codigo).trim().toUpperCase() === codigoNormalizado.toUpperCase());

  if (!jaExiste) {
    lista.push({
      codigo: codigoNormalizado,
      tipo,
      multiplicador: fator,
      descricao
    });
  }
}

function formatarDataHoraSankhya(data = new Date()) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  const segundo = String(data.getSeconds()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

function formatarDataHoraLocalISO(data) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(data);
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));

  return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}:${mapa.second}`;
}

function campoApi(valor) {
  return {
    $: valor === null || valor === undefined ? '' : String(valor)
  };
}

function textoSql(valor) {
  return String(valor ?? '').replace(/'/g, "''");
}

async function salvarRegistroApi(rootEntity, campos) {
  return executeService('CRUDServiceProvider.saveRecord', {
    dataSet: {
      rootEntity,
      includePresentationFields: 'N',
      entity: {
        path: '',
        fieldset: {
          list: Object.keys(campos).join(',')
        }
      },
      dataRow: {
        localFields: Object.fromEntries(
          Object.entries(campos).map(([campo, valor]) => [campo, campoApi(valor)])
        )
      }
    }
  }, {
    forceAccessSession: true
  });
}

async function atualizarRegistroApi(rootEntity, chave, campos) {
  return executeService('CRUDServiceProvider.saveRecord', {
    dataSet: {
      rootEntity,
      includePresentationFields: 'N',
      entity: {
        path: '',
        fieldset: {
          list: [...Object.keys(chave), ...Object.keys(campos)].join(',')
        }
      },
      dataRow: {
        key: Object.fromEntries(
          Object.entries(chave).map(([campo, valor]) => [campo, campoApi(valor)])
        ),
        localFields: Object.fromEntries(
          Object.entries(campos).map(([campo, valor]) => [campo, campoApi(valor)])
        )
      }
    }
  }, {
    forceAccessSession: true
  });
}

async function finalizarConferenciaNativa(nuconf, nunota) {
  return executeService(
    'ConferenciaSP.finalizarConferencia',
    {
      params: {
        nuConf: nuconf,
        nuNota: nunota
      }
    },
    { modulePath: 'mgecom', forceAccessSession: true }
  );
}

async function consultarFaturamentoExistente(nunotaOrigem) {
  const [nota] = await executeQuery(`
    SELECT *
    FROM (
      SELECT RESULTADO.*
      FROM (
        SELECT DISTINCT
          DEST.NUNOTA,
          DEST.NUMNOTA,
          DEST.CODTIPOPER,
          DEST.STATUSNOTA,
          DEST.VLRNOTA,
          1 AS PRIORIDADE
        FROM TGFVAR VAR
        JOIN TGFCAB DEST
          ON DEST.NUNOTA = VAR.NUNOTA
        WHERE VAR.NUNOTAORIG = ${nunotaOrigem}
          AND DEST.TIPMOV <> 'P'

        UNION ALL

        SELECT
          CAB.NUNOTA,
          CAB.NUMNOTA,
          CAB.CODTIPOPER,
          CAB.STATUSNOTA,
          CAB.VLRNOTA,
          2 AS PRIORIDADE
        FROM TGFCAB CAB
        WHERE CAB.NUNOTA = ${nunotaOrigem}
          AND CAB.TIPMOV <> 'P'
      ) RESULTADO
      ORDER BY RESULTADO.PRIORIDADE, RESULTADO.NUNOTA DESC
    )
    WHERE ROWNUM = 1
  `);

  return nota || null;
}

function extrairChaveDocumento(resultado = {}) {
  const documento = resultado?.responseBody?.documento;
  const boleto = resultado?.responseBody?.boleto;
  return String(
    documento?.valor?.$
    ?? documento?.valor
    ?? documento?.$
    ?? documento
    ?? boleto?.valor?.$
    ?? boleto?.valor
    ?? boleto?.$
    ?? boleto
    ?? ''
  ).trim();
}

function extrairAvisosDocumento(resultado = {}) {
  const avisos = resultado?.responseBody?.avisos?.aviso;
  const lista = Array.isArray(avisos) ? avisos : avisos ? [avisos] : [];
  return lista
    .map((aviso) => String(aviso?.$ ?? aviso?.mensagem ?? aviso ?? '').trim())
    .filter(Boolean);
}

async function obterSituacaoDocumentosPedido(nunotaPedido) {
  const nota = await consultarFaturamentoExistente(nunotaPedido);

  if (!nota) {
    return {
      faturado: false,
      pedido: nunotaPedido,
      nota: null,
      danfe: { disponivel: false, motivo: 'Pedido ainda nao faturado.' },
      boleto: { disponivel: false, motivo: 'Pedido ainda nao faturado.' }
    };
  }

  const [situacao] = await executeQuery(`
    SELECT
      CAB.NUNOTA,
      CAB.NUMNOTA,
      CASE
        WHEN NFE.CHAVENFE IS NOT NULL AND NFE.XMLPROTAUTNOT IS NOT NULL THEN 'S'
        ELSE 'N'
      END AS NFE_AUTORIZADA,
      (SELECT COUNT(*) FROM TGFFIN FIN WHERE FIN.NUNOTA = CAB.NUNOTA) AS QTD_TITULOS
    FROM TGFCAB CAB
    LEFT JOIN TGFNFE NFE
      ON NFE.NUNOTA = CAB.NUNOTA
    WHERE CAB.NUNOTA = ${nota.NUNOTA}
  `);
  const nfeAutorizada = situacao?.NFE_AUTORIZADA === 'S';
  const possuiFinanceiro = normalizarNumero(situacao?.QTD_TITULOS) > 0;

  return {
    faturado: true,
    pedido: nunotaPedido,
    nota: {
      ...nota,
      NUMNOTA: situacao?.NUMNOTA ?? nota.NUMNOTA
    },
    danfe: {
      disponivel: nfeAutorizada,
      motivo: nfeAutorizada ? null : 'DANFE aguardando autorizacao da NF-e.'
    },
    boleto: {
      disponivel: possuiFinanceiro,
      motivo: possuiFinanceiro ? null : 'A nota nao possui titulo financeiro para boleto.'
    }
  };
}

async function obterDanfeArmazenado(nunota) {
  const [registro] = await executeQuery(`
    SELECT DBMS_LOB.GETLENGTH(PDFDANFE) AS TAMANHO
    FROM TGFPDF
    WHERE NUNOTA = ${nunota}
      AND TIPO = 'N'
      AND PDFDANFE IS NOT NULL
  `);
  const tamanho = normalizarNumero(registro?.TAMANHO);
  if (tamanho <= 0) return null;

  const tamanhoChunk = 2000;
  const totalChunks = Math.ceil(tamanho / tamanhoChunk);
  const chunks = await executeQuery(`
    SELECT
      NIVEL AS IDX,
      RAWTOHEX(DBMS_LOB.SUBSTR(PDF.PDFDANFE, ${tamanhoChunk}, ((N.NIVEL - 1) * ${tamanhoChunk}) + 1)) AS HEXPDF
    FROM TGFPDF PDF
    CROSS JOIN (
      SELECT LEVEL NIVEL
      FROM DUAL
      CONNECT BY LEVEL <= ${totalChunks}
    ) N
    WHERE PDF.NUNOTA = ${nunota}
      AND PDF.TIPO = 'N'
    ORDER BY N.NIVEL
  `);
  const hex = chunks
    .sort((a, b) => Number(a.IDX) - Number(b.IDX))
    .map((row) => String(row.HEXPDF || ''))
    .join('');

  return hex ? Buffer.from(hex, 'hex') : null;
}

async function obterBoletoArmazenado(nunota, direto = false) {
  const baixar = direto ? downloadDirectFile : downloadGatewayFile;
  const arquivo = await baixar('mge', 'download.mge', {
    fileName: `Repo://Sistema/boletos/boleto_${nunota}.pdf`,
    pkValues: JSON.stringify({ NUNOTA: nunota, TIPO: 'N' }),
    tableName: 'TGFPDF',
    entityName: 'ArquivoPdf'
  });
  return arquivo.buffer;
}

async function gerarPrevisualizacaoBoleto(nunota) {
  const titulos = await executeQuery(`
    SELECT
      FIN.NUFIN,
      FIN.CODEMP,
      FIN.CODCTABCOINT,
      CTA.CODBCO,
      CTA.MODBOLETA,
      CTA.NURFEMODBOLETO
    FROM TGFFIN FIN
    LEFT JOIN TSICTA CTA
      ON CTA.CODCTABCOINT = FIN.CODCTABCOINT
    WHERE FIN.NUNOTA = ${nunota}
    ORDER BY FIN.NUFIN
  `);

  if (titulos.length === 0) {
    throw new Error('A nota faturada nao possui titulos financeiros para gerar boleto.');
  }

  const primeiro = titulos[0];
  const codigoContaInterna = normalizarNumero(primeiro.CODCTABCOINT);
  const codigoBanco = normalizarNumero(primeiro.CODBCO);
  const codigoEmpresa = normalizarNumero(primeiro.CODEMP);
  const relatorioPadraoPorBanco = {
    1: 11,
    237: 61,
    341: 271,
    422: 267,
    748: 12,
    756: 191
  };
  const codigoRelatorio = normalizarNumero(primeiro.NURFEMODBOLETO)
    || relatorioPadraoPorBanco[codigoBanco]
    || 0;

  if (!codigoContaInterna || !codigoBanco || !codigoRelatorio) {
    throw new Error('A conta bancaria do titulo nao possui banco ou modelo de boleto configurado no Sankhya.');
  }

  const resultado = await executeDirectService('BoletoSP.buildPreVisualizacao', {
    configBoleto: {
      agrupamentoBoleto: '4',
      ordenacaoParceiro: '1',
      dupRenegociadas: false,
      gerarNumeroBoleto: false,
      codigoConta: String(codigoBanco),
      codBco: String(codigoContaInterna),
      codEmp: String(codigoEmpresa),
      nossoNumComecando: '',
      alterarTipoTitulo: false,
      tipoTitulo: '-1',
      bcoIgualConta: false,
      empIgualConta: false,
      reimprimir: true,
      tipoReimpressao: 'S',
      registraConta: false,
      codigoRelatorio,
      codCtaBcoInt: '',
      boletoRapido: false,
      telaImpressaoBoleto: true,
      boleto: { binicial: '', bfinal: '' },
      titulo: titulos.map((titulo) => ({ $: normalizarNumero(titulo.NUFIN) }))
    }
  });
  const chaveArquivo = extrairChaveDocumento(resultado);
  if (!chaveArquivo) {
    throw new Error(extrairAvisosDocumento(resultado).join(' ') || 'O Sankhya nao retornou a chave de visualizacao do boleto.');
  }

  const arquivo = await downloadDirectFile('mge', 'visualizadorArquivos.mge', {
    chaveArquivo,
    download: 'S'
  });
  return arquivo.buffer;
}

async function gerarDocumentoFiscalSankhya(nunota, tipo) {
  if (tipo === 'boleto' && process.env.SANKHYA_OM_BASE_URL) {
    const pdfBoleto = await gerarPrevisualizacaoBoleto(nunota);
    if (!pdfBoleto.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error('O Sankhya retornou um arquivo invalido para BOLETO.');
    }
    return pdfBoleto;
  }

  const tipoImp = tipo === 'danfe' ? 9 : 3;
  const resultado = await executeService(
    'ImpressaoNotasSP.imprimeDocumentos',
    {
      notas: {
        pedidoWeb: 'false',
        gerarpdf: 'true',
        ownerServiceCall: 'CentralNotas',
        nota: [{ nuNota: nunota, tipoImp }]
      }
    },
    { modulePath: 'mge', forceAccessSession: true }
  );
  const chaveArquivo = extrairChaveDocumento(resultado);
  const avisos = extrairAvisosDocumento(resultado);

  let pdf = null;

  if (chaveArquivo) {
    const arquivo = await downloadGatewayFile('mge', 'visualizadorArquivos.mge', {
      hidemail: 'S',
      download: 'S',
      chaveArquivo
    });
    pdf = arquivo.buffer;
  } else if (tipo === 'danfe') {
    pdf = await obterDanfeArmazenado(nunota);
  } else {
    try {
      pdf = await obterBoletoArmazenado(nunota);
    } catch {
      pdf = null;
    }
  }

  if (!pdf) {
    const complemento = tipo === 'boleto'
      ? `${process.env.SANKHYA_OM_BASE_URL ? '' : ' Configure SANKHYA_OM_BASE_URL com o endereco direto do ambiente Sankhya.'} Confira tambem o parametro VERPDFBOLPORTAL e a configuracao de impressao da TOP, negociacao, parceiro e conta.`
      : '';
    throw new Error(`${avisos.join(' ') || `O Sankhya nao gerou o PDF de ${tipo.toUpperCase()}.`}${complemento}`);
  }

  if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error(`O Sankhya retornou um arquivo invalido para ${tipo.toUpperCase()}.`);
  }

  return pdf;
}

function coletarDetalhesSankhya(valor, prefixo = '') {
  if (!valor || typeof valor !== 'object') {
    return [];
  }

  const nomesRelevantes = new Set([
    'status',
    'statusMessage',
    'message',
    'mensagem',
    'msg',
    'erro',
    'error',
    'descricao',
    'podeCortar',
    'podeRecontar',
    'existeConferenciaHaMenor',
    'nuConf',
    'nuNota'
  ]);

  return Object.entries(valor).flatMap(([chave, conteudo]) => {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;

    if (conteudo && typeof conteudo === 'object') {
      return coletarDetalhesSankhya(conteudo, caminho);
    }

    if (!nomesRelevantes.has(chave) && !/erro|msg|mens|status|diverg|conf/i.test(chave)) {
      return [];
    }

    if (conteudo === null || conteudo === undefined || conteudo === '') {
      return [];
    }

    return [`${caminho}: ${conteudo}`];
  });
}

function traduzirStatusConferencia(status) {
  const statusNormalizado = String(status || '').toUpperCase();

  if (statusNormalizado === 'D') {
    return 'Status D: o Sankhya classificou a conferencia como divergente/nao finalizada.';
  }

  if (statusNormalizado === 'A') {
    return 'Status A: a conferencia continua em andamento no Sankhya.';
  }

  if (statusNormalizado === 'F') {
    return 'Status F: conferencia finalizada.';
  }

  return status ? `Status ${status}: status retornado pelo Sankhya.` : null;
}

function finalizacaoPermiteFechamentoOperacional(resultadoFinalizacao) {
  const body = resultadoFinalizacao?.responseBody || {};
  return String(body.status || '').toUpperCase() === 'D' && String(body.podeCortar || '').toLowerCase() === 'true';
}

function numeroApi(valor) {
  const numero = normalizarNumero(valor);
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function obterMimeImagem(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return 'application/octet-stream';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  if (buffer.slice(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif';
  }

  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return 'application/octet-stream';
}

async function atualizarCorteItemNotaApi(nunota, item, qtdCortada = 0) {
  const qtdOriginal = normalizarNumero(item.QTDNEG);
  const vlrUnit = normalizarNumero(item.VLRUNIT);
  const vlrTot = qtdOriginal * vlrUnit;

  return executeService(
    'CACSP.incluirAlterarItemNota',
    {
      nota: {
        NUNOTA: String(nunota),
        itens: {
          item: {
            CODPROD: campoApi(item.CODPROD),
            NUNOTA: campoApi(nunota),
            SEQUENCIA: campoApi(item.SEQUENCIA),
            QTDNEG: campoApi(numeroApi(qtdOriginal)),
            VLRUNIT: campoApi(numeroApi(vlrUnit)),
            VLRTOT: campoApi(numeroApi(vlrTot)),
            CODVOL: campoApi(item.CODVOL || 'UN'),
            CODLOCALORIG: campoApi(item.CODLOCALORIG || 0),
            CONTROLE: campoApi(item.CONTROLE || ''),
            QTDCONFERIDA: campoApi(numeroApi(qtdCortada)),
            VLRDESC: campoApi(numeroApi(item.VLRDESC || 0)),
            PERCDESC: campoApi(numeroApi(item.PERCDESC || 0))
          }
        }
      }
    },
    { modulePath: 'mgecom', forceAccessSession: true }
  );
}

async function aplicarCortesNoPedido({ nunota, itensPedido, conferidosPorSequencia, cortadosPorSequencia }) {
  const cortes = itensPedido
    .map((item) => {
      const sequencia = Number(item.SEQUENCIA);
      const qtdOriginal = normalizarNumero(item.QTDNEG);
      const qtdConferida = conferidosPorSequencia.get(sequencia) ?? 0;
      const qtdCortada = cortadosPorSequencia.get(sequencia) ?? 0;
      const novaQuantidade = Math.max(0, qtdOriginal - qtdCortada);

      return {
        sequencia,
        qtdOriginal,
        qtdConferida,
        qtdCortada,
        novaQuantidade
      };
    })
    .filter((item) => item.qtdCortada > 0);

  for (const corte of cortes) {
    if (Math.abs(corte.novaQuantidade - corte.qtdConferida) > 0.0001) {
      throw new Error(`Corte invalido no item ${corte.sequencia}: a quantidade restante precisa bater com a quantidade conferida.`);
    }

    const itemPedido = itensPedido.find((item) => Number(item.SEQUENCIA) === corte.sequencia);
    await atualizarCorteItemNotaApi(nunota, itemPedido, corte.qtdCortada);
  }

  return cortes;
}

async function finalizarConferenciaOperacional(nuconf, nunota, codUsu, qtdVol = 1) {
  await atualizarRegistroApi(
    'CabecalhoConferencia',
    { NUCONF: nuconf },
    {
      STATUS: 'F',
      DHFINCONF: formatarDataHoraSankhya(),
      CODUSUCONF: codUsu,
      QTDVOL: Math.max(1, normalizarNumero(qtdVol))
    }
  );
}

function dataValida(valor) {
  if (!valor) {
    return null;
  }

  const data = new Date(normalizarDataSankhya(valor));
  return Number.isNaN(data.getTime()) ? null : data;
}

async function preservarConferenteFinalizacao(nuconf, codUsu, dhInicioOriginal = null, dhFimAtual = null) {
  const campos = {
    CODUSUCONF: codUsu
  };

  const dataInicio = dataValida(dhInicioOriginal);
  const dataFim = dataValida(dhFimAtual);

  if (dhInicioOriginal) {
    campos.DHINICONF = dataInicio
      ? formatarDataHoraSankhya(dataInicio)
      : dhInicioOriginal;
  }

  if (!dataFim || (dataInicio && dataFim.getTime() <= dataInicio.getTime())) {
    campos.DHFINCONF = formatarDataHoraSankhya();
  }

  await atualizarRegistroApi(
    'CabecalhoConferencia',
    { NUCONF: nuconf },
    campos
  );
}

function normalizarControleConferencia(controle) {
  const valor = String(controle ?? '').trim();
  return valor || ' ';
}

async function salvarDetalhesConferenciaSankhya({ nuconf, nunota }) {
  const itens = await executeQuery(`
    SELECT
      ITE.SEQUENCIA,
      ITE.CODPROD,
      ITE.CODVOL,
      NVL(TRIM(ITE.CONTROLE), ' ') AS CONTROLE,
      NVL(ITE.QTDNEG, 0) AS QTDNEG,
      NVL(ITE.QTDCONFERIDA, 0) AS QTDCORTE,
      NVL(ITE.GTINNFE, ITE.PRODUTONFE) AS CODBARRA,
      VOA.CODVOL AS CODVOLCONF,
      VOA.CODBARRA AS CODBARRACONF
    FROM TGFITE ITE
    LEFT JOIN TGFVOA VOA
      ON VOA.CODPROD = ITE.CODPROD
     AND VOA.CODBARRA = NVL(ITE.GTINNFE, ITE.PRODUTONFE)
     AND NVL(VOA.ATIVO, 'S') = 'S'
     AND NVL(VOA.QUANTIDADE, 1) = 1
    WHERE ITE.NUNOTA = ${nunota}
    ORDER BY ITE.SEQUENCIA
  `);

  const dhAlter = formatarDataHoraSankhya();
  const detalhesExistentes = await executeQuery(`
    SELECT SEQCONF
    FROM TGFCOI2
    WHERE NUCONF = ${nuconf}
    ORDER BY SEQCONF
  `);
  const sequenciasExistentes = new Set(detalhesExistentes.map((item) => Number(item.SEQCONF)));

  let seqConf = 1;
  for (const item of itens) {
    const qtdConferida = Math.max(0, normalizarNumero(item.QTDNEG) - normalizarNumero(item.QTDCORTE));

    if (qtdConferida <= 0) {
      continue;
    }

    const qtdConferidaApi = numeroApi(qtdConferida);
    const campos = {
      CODBARRA: item.CODBARRACONF || item.CODBARRA || item.CODPROD,
      CODPROD: item.CODPROD,
      CODVOL: item.CODVOLCONF || item.CODVOL || 'UN',
      CONTROLE: normalizarControleConferencia(item.CONTROLE),
      QTDCONFVOLPAD: qtdConferidaApi,
      QTDCONF: qtdConferidaApi,
      DHALTER: dhAlter
    };

    if (sequenciasExistentes.has(seqConf)) {
      await atualizarRegistroApi(
        'DetalhesConferencia',
        { NUCONF: nuconf, SEQCONF: seqConf },
        campos
      );
    } else {
      await salvarRegistroApi('DetalhesConferencia', {
        NUCONF: nuconf,
        SEQCONF: seqConf,
        ...campos
      });
      sequenciasExistentes.add(seqConf);
    }

    seqConf += 1;
  }
}

function normalizarDataSankhya(valor) {
  if (!valor) {
    return null;
  }

  if (valor instanceof Date) {
    return formatarDataHoraLocalISO(valor);
  }

  const texto = String(valor).trim();
  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);

  if (sankhyaMatch) {
    const [, dia, mes, ano, hora = '00', minuto = '00', segundo = '00'] = sankhyaMatch;
    return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  }

  const brMatch = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);

  if (brMatch) {
    const [, dia, mes, ano, hora = '00', minuto = '00', segundo = '00'] = brMatch;
    return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  }

  return texto;
}

function normalizarLinhaConferencia(row) {
  return {
    ...row,
    DTNEG: normalizarDataSankhya(row.DTNEG),
    DT_INICIO_CONFERENCIA: normalizarDataSankhya(row.DT_INICIO_CONFERENCIA),
    DT_FIM_CONFERENCIA: normalizarDataSankhya(row.DT_FIM_CONFERENCIA)
  };
}

function montarSqlConferencias(intervalo, empresa) {
  return `
    SELECT
      CAB.DTNEG,
      CAB.NUNOTA,
      CAB.CODEMP,
      PAR.RAZAOSOCIAL AS EMPRESA,
      CAB.CODPARC AS CODIGO_PARCEIRO,
      CAST(NVL(CAB.VLRNOTA, 0) AS NUMBER(15,2)) AS VLRNOTA,
      CAB.AD_STATUSINTPED AS STATUS_FINANCEIRO,
      CAB.AD_STATUSCOMERCIAL AS STATUS_COMERCIAL,
      CONF.STATUS AS STATUS_CONF_BD,
      CONF.DHINICONF AS DT_INICIO_CONFERENCIA,
      CONF.DHFINCONF AS DT_FIM_CONFERENCIA,
      USU.NOMEUSU AS NOME_CONFERENTE,
      COUNT(ITE.SEQUENCIA) AS QTD_ITENS,
      SUM(NVL(ITE.QTDNEG, 0)) AS QTD_TOTAL,
      CASE
        WHEN CAB.NUCONFATUAL IS NULL THEN 'AGUARDANDO CONFERENCIA'
        WHEN CONF.STATUS = 'F' THEN 'CONFERIDO'
        WHEN CONF.STATUS = 'A' THEN 'EM ANDAMENTO'
        ELSE 'STATUS DESCONHECIDO'
      END AS STATUS_CONFERENCIA
    FROM TGFCAB CAB
    LEFT JOIN TGFCON2 CONF
      ON CONF.NUCONF = CAB.NUCONFATUAL
    LEFT JOIN TGFPAR PAR
      ON PAR.CODPARC = CAB.CODPARC
    LEFT JOIN TSIUSU USU
      ON USU.CODUSU = CONF.CODUSUCONF
    LEFT JOIN TGFITE ITE
      ON ITE.NUNOTA = CAB.NUNOTA
    WHERE CAB.DTNEG >= TO_DATE('${intervalo.inicio}', 'YYYY-MM-DD')
      AND CAB.DTNEG < TO_DATE('${intervalo.fim}', 'YYYY-MM-DD') + 1
      AND CAB.CODTIPOPER IN (5, 6, 237)
      AND CAB.STATUSNOTA = 'L'
      ${sqlFiltroEmpresa(empresa)}
    GROUP BY CAB.DTNEG, CAB.NUNOTA, CAB.CODEMP, PAR.RAZAOSOCIAL, CAB.CODPARC, CAB.VLRNOTA,
      CAB.AD_STATUSINTPED, CAB.AD_STATUSCOMERCIAL,
      CONF.STATUS, CONF.DHINICONF, CONF.DHFINCONF, USU.NOMEUSU, CAB.NUCONFATUAL
  `;
}

router.get('/empresas', async (req, res) => {
  try {
    const rows = await executeQuery(`
      SELECT DISTINCT
        TO_CHAR(CAB.CODEMP) AS CODEMP,
        EMP.RAZAOSOCIAL AS EMPRESA
      FROM TGFCAB CAB
      LEFT JOIN TSIEMP EMP
        ON EMP.CODEMP = CAB.CODEMP
      WHERE CAB.CODTIPOPER IN (5, 6, 237)
        AND CAB.STATUSNOTA = 'L'
        AND CAB.CODEMP IS NOT NULL
      ORDER BY EMP.RAZAOSOCIAL, TO_CHAR(CAB.CODEMP)
    `);

    res.json({
      itens: rows.map((row) => ({
        codEmp: row.CODEMP,
        empresa: row.EMPRESA || `Empresa ${row.CODEMP}`
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar empresas' });
  }
});

router.get('/conferencias', async (req, res) => {
  try {
    const intervalo = obterIntervaloDatas(req.query.dataInicial, req.query.dataFinal);
    const empresa = obterFiltroEmpresa(req.query.empresa);
    const rows = await executeQuery(montarSqlConferencias(intervalo, empresa));

    const resultado = conferenciaTimerStore.atualizarComItens(rows.map(normalizarLinhaConferencia));

    res.json({
      dataInicial: intervalo.inicio,
      dataFinal: intervalo.fim,
      empresa,
      itens: resultado
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar conferencias' });
  }
});

router.get('/fila-conferencia/conferentes', async (req, res) => {
  try {
    const rows = await executeQuery(`
      SELECT CODUSU, NOMEUSU
      FROM TSIUSU
      WHERE CODUSU IS NOT NULL
        AND NOMEUSU IS NOT NULL
      ORDER BY NOMEUSU
    `);

    res.json({
      itens: rows.map((row) => ({
        codUsu: row.CODUSU,
        nome: row.NOMEUSU
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar conferentes' });
  }
});

router.get('/fila-conferencia/pedidos', async (req, res) => {
  try {
    const intervalo = obterIntervaloDatas(req.query.dataInicial, req.query.dataFinal);
    const empresa = obterFiltroEmpresa(req.query.empresa);
    const pedidoBusca = obterNumeroInteiro(req.query.pedido);
    const filtroBusca = pedidoBusca
      ? `CAB.NUNOTA = ${pedidoBusca}`
      : `CAB.DTNEG >= TO_DATE('${intervalo.inicio}', 'YYYY-MM-DD')
        AND CAB.DTNEG < TO_DATE('${intervalo.fim}', 'YYYY-MM-DD') + 1
        AND (CAB.NUCONFATUAL IS NULL OR CONF.STATUS IN ('A', 'F'))
        AND NVL(CAB.AD_STATUSINTPED, '0') = '1'
        AND NVL(CAB.AD_STATUSCOMERCIAL, '0') = '1'
        ${sqlFiltroEmpresa(empresa)}`;

    const rows = await executeQuery(`
      SELECT
        CAB.DTNEG,
        CAB.NUNOTA,
        CAB.CODEMP,
        PAR.RAZAOSOCIAL AS EMPRESA,
        CAB.CODPARC AS CODIGO_PARCEIRO,
        CAST(NVL(CAB.VLRNOTA, 0) AS NUMBER(15,2)) AS VLRNOTA,
        CAST(NVL(CAB.QTDVOL, 0) AS NUMBER(15,0)) AS QTDVOL,
        CAB.NUCONFATUAL,
        CONF.STATUS AS STATUS_CONF,
        USU.NOMEUSU AS NOME_CONFERENTE,
        CASE
          WHEN CAB.NUCONFATUAL IS NULL THEN 'AGUARDANDO CONFERENCIA'
          WHEN CONF.STATUS = 'A' THEN 'EM ANDAMENTO'
          WHEN CONF.STATUS = 'F' THEN 'CONFERIDO'
          ELSE 'STATUS DESCONHECIDO'
        END AS STATUS_CONFERENCIA,
        COUNT(ITE.SEQUENCIA) AS QTD_ITENS,
        SUM(NVL(ITE.QTDNEG, 0)) AS QTD_TOTAL
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      LEFT JOIN TGFPAR PAR
        ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TSIUSU USU
        ON USU.CODUSU = CONF.CODUSUCONF
      LEFT JOIN TGFITE ITE
        ON ITE.NUNOTA = CAB.NUNOTA
      WHERE ${filtroBusca}
        AND CAB.CODTIPOPER IN (5, 6, 237)
        AND CAB.STATUSNOTA = 'L'
      GROUP BY CAB.DTNEG, CAB.NUNOTA, CAB.CODEMP, PAR.RAZAOSOCIAL, CAB.CODPARC, CAB.VLRNOTA, CAB.QTDVOL,
        CAB.NUCONFATUAL, CONF.STATUS, USU.NOMEUSU
      ORDER BY
        CASE
          WHEN CONF.STATUS = 'A' THEN 0
          WHEN CAB.NUCONFATUAL IS NULL THEN 1
          WHEN CONF.STATUS = 'F' THEN 2
          ELSE 3
        END,
        CAB.DTNEG,
        CAB.NUNOTA
    `);

    res.json({
      dataInicial: intervalo.inicio,
      dataFinal: intervalo.fim,
      empresa,
      pedido: pedidoBusca,
      itens: rows.map((row) => ({
        ...row,
        DTNEG: normalizarDataSankhya(row.DTNEG),
        NUCONFATUAL: row.NUCONFATUAL ? Number(row.NUCONFATUAL) : null,
        STATUS_CONF: row.STATUS_CONF || null,
        STATUS_CONFERENCIA: row.STATUS_CONFERENCIA,
        NOME_CONFERENTE: row.NOME_CONFERENTE || null,
        QTDVOL: normalizarNumero(row.QTDVOL),
        QTD_ITENS: normalizarNumero(row.QTD_ITENS),
        QTD_TOTAL: normalizarNumero(row.QTD_TOTAL),
        PEDIDO_IMPRESSO: Boolean(pedidoPrintStore.obter(row.NUNOTA)),
        IMPRESSAO_PEDIDO: pedidoPrintStore.obter(row.NUNOTA)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar fila de conferencia' });
  }
});

router.get('/fila-conferencia/pedidos/:nunota/itens', async (req, res) => {
  try {
    const nunota = obterNumeroInteiro(req.params.nunota);
    if (!nunota) {
      res.status(400).json({ erro: 'Pedido invalido' });
      return;
    }

    const rows = await executeQuery(`
      SELECT
        ITE.NUNOTA,
        ITE.SEQUENCIA,
        ITE.CODPROD,
        PRO.DESCRPROD,
        ITE.CONTROLE,
        ITE.CODVOL,
        CAST(NVL(ITE.QTDNEG, 0) AS NUMBER(15,3)) AS QTDNEG,
        CAST(NVL(ITE.VLRUNIT, 0) AS NUMBER(15,2)) AS VLRUNIT,
        NVL(ITE.GTINNFE, PRO.REFERENCIA) AS CODIGO_BARRAS,
        ITE.GTINNFE,
        ITE.GTINTRIBNFE,
        ITE.PRODUTONFE,
        PRO.REFERENCIA,
        PRO.AD_CODBAR,
        PRO.AD_CBARANT
      FROM TGFITE ITE
      LEFT JOIN TGFPRO PRO
        ON PRO.CODPROD = ITE.CODPROD
      WHERE ITE.NUNOTA = ${nunota}
      ORDER BY ITE.SEQUENCIA
    `);

    const codigosProduto = [...new Set(rows.map((row) => Number(row.CODPROD)).filter(Boolean))];
    let unidadesAlternativas = [];

    if (codigosProduto.length > 0) {
      unidadesAlternativas = await executeQuery(`
        SELECT
          VOA.CODPROD,
          VOA.CODVOL,
          VOA.CODBARRA,
          VOA.DIVIDEMULTIPLICA,
          CAST(NVL(VOA.QUANTIDADE, 1) AS NUMBER(15,6)) AS QUANTIDADE
        FROM TGFVOA VOA
        WHERE VOA.CODPROD IN (${codigosProduto.join(',')})
          AND NVL(VOA.ATIVO, 'S') = 'S'
          AND VOA.CODBARRA IS NOT NULL
      `);
    }

    const unidadesPorProduto = new Map();
    unidadesAlternativas.forEach((row) => {
      const codProd = Number(row.CODPROD);
      if (!unidadesPorProduto.has(codProd)) {
        unidadesPorProduto.set(codProd, []);
      }

      unidadesPorProduto.get(codProd).push(row);
    });

    const progresso = conferenciaProgressStore.obter(nunota);
    const progressoPorSequencia = new Map(
      (progresso?.itens || []).map((item) => [Number(item.sequencia), item])
    );

    res.json({
      nunota,
      itens: rows.map((row) => {
        const codigosConferencia = [];
        const progressoItem = progressoPorSequencia.get(Number(row.SEQUENCIA)) || {};

        (unidadesPorProduto.get(Number(row.CODPROD)) || []).forEach((unidade) => {
          const quantidade = normalizarNumero(unidade.QUANTIDADE) || 1;
          const operacao = String(unidade.DIVIDEMULTIPLICA || '').trim().toUpperCase();
          const multiplicador = operacao.startsWith('D') && quantidade !== 0
            ? 1 / quantidade
            : quantidade;

          adicionarCodigoConferencia(
            codigosConferencia,
            unidade.CODBARRA,
            'UNIDADE_ALTERNATIVA',
            multiplicador,
            unidade.CODVOL ? `Unidade alternativa ${unidade.CODVOL}` : 'Unidade alternativa'
          );
        });

        adicionarCodigoConferencia(codigosConferencia, row.REFERENCIA, 'REFERENCIA', 1, 'Referencia');
        adicionarCodigoConferencia(codigosConferencia, row.GTINNFE, 'CODIGO_BARRAS', 1, 'Codigo de barras');
        adicionarCodigoConferencia(codigosConferencia, row.GTINTRIBNFE, 'CODIGO_BARRAS', 1, 'Codigo de barras tributavel');
        adicionarCodigoConferencia(codigosConferencia, row.PRODUTONFE, 'CODIGO_BARRAS', 1, 'Codigo do produto na NFe');
        adicionarCodigoConferencia(codigosConferencia, row.AD_CODBAR, 'CODIGO_BARRAS', 1, 'Codigo de barras adicional');
        adicionarCodigoConferencia(codigosConferencia, row.AD_CBARANT, 'CODIGO_BARRAS', 1, 'Codigo de barras anterior');
        adicionarCodigoConferencia(codigosConferencia, row.CODPROD, 'CODIGO_PRODUTO', 1, 'Codigo do produto');

        return {
          nunota: row.NUNOTA,
          sequencia: row.SEQUENCIA,
          codProd: row.CODPROD,
          descrProd: row.DESCRPROD || `Produto ${row.CODPROD}`,
          controle: row.CONTROLE || '',
          codVol: row.CODVOL || 'UN',
          qtdNeg: normalizarNumero(row.QTDNEG),
          vlrUnit: normalizarNumero(row.VLRUNIT),
          codigoBarras: row.CODIGO_BARRAS || '',
          codigos: codigosConferencia.map((item) => item.codigo),
          codigosConferencia,
          qtdConferida: normalizarNumero(progressoItem.qtdConferida),
          qtdCortada: normalizarNumero(progressoItem.qtdCortada)
        };
      })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar itens do pedido' });
  }
});

router.get('/fila-conferencia/produtos/:codprod/foto', async (req, res) => {
  try {
    const codprod = obterNumeroInteiro(req.params.codprod);
    if (!codprod) {
      res.status(400).json({ erro: 'Produto invalido' });
      return;
    }

    const [produto] = await executeQuery(`
      SELECT
        CODPROD,
        ENDIMAGEM,
        CASE WHEN IMAGEM IS NULL THEN 0 ELSE DBMS_LOB.GETLENGTH(IMAGEM) END AS TAMIMG
      FROM TGFPRO
      WHERE CODPROD = ${codprod}
    `);

    if (!produto) {
      res.status(404).json({ erro: 'Produto nao encontrado' });
      return;
    }

    const endImagem = String(produto.ENDIMAGEM || '').trim();
    if (endImagem && /^https?:\/\//i.test(endImagem)) {
      res.redirect(endImagem);
      return;
    }

    const tamanho = normalizarNumero(produto.TAMIMG);
    if (tamanho <= 0) {
      res.status(404).json({ erro: 'Produto sem foto cadastrada' });
      return;
    }

    const tamanhoChunk = 2000;
    const totalChunks = Math.ceil(tamanho / tamanhoChunk);
    const chunks = await executeQuery(`
      SELECT
        NIVEL AS IDX,
        RAWTOHEX(DBMS_LOB.SUBSTR(P.IMAGEM, ${tamanhoChunk}, ((N.NIVEL - 1) * ${tamanhoChunk}) + 1)) AS HEXIMG
      FROM TGFPRO P
      CROSS JOIN (
        SELECT LEVEL NIVEL
        FROM DUAL
        CONNECT BY LEVEL <= ${totalChunks}
      ) N
      WHERE P.CODPROD = ${codprod}
      ORDER BY N.NIVEL
    `);

    const hex = chunks
      .sort((a, b) => Number(a.IDX) - Number(b.IDX))
      .map((row) => String(row.HEXIMG || ''))
      .join('');

    if (!hex) {
      res.status(404).json({ erro: 'Foto do produto nao encontrada' });
      return;
    }

    const buffer = Buffer.from(hex, 'hex');
    res.setHeader('Content-Type', obterMimeImagem(buffer));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar foto do produto' });
  }
});

router.get('/produtos/consulta', async (req, res) => {
  try {
    const codigo = String(req.query.codigo || '').trim();

    if (!codigo) {
      res.status(400).json({ erro: 'Informe o codigo do produto' });
      return;
    }

    const codigoSql = textoSql(codigo);
    const codigoNumero = obterNumeroInteiro(codigo);
    const filtroCodigoProduto = codigoNumero ? `OR PRO.CODPROD = ${codigoNumero}` : '';

    const produtos = await executeQuery(`
      SELECT
        PRO.CODPROD,
        PRO.DESCRPROD,
        PRO.REFERENCIA,
        PRO.CODVOL,
        PRO.CODGRUPOPROD,
        GRU.DESCRGRUPOPROD
      FROM TGFPRO PRO
      LEFT JOIN TGFGRU GRU
        ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
      WHERE (
        PRO.REFERENCIA = '${codigoSql}'
        OR PRO.AD_CODBAR = '${codigoSql}'
        OR PRO.AD_CBARANT = '${codigoSql}'
        ${filtroCodigoProduto}
        OR EXISTS (
          SELECT 1
          FROM TGFVOA VOA
          WHERE VOA.CODPROD = PRO.CODPROD
            AND VOA.CODBARRA = '${codigoSql}'
            AND NVL(VOA.ATIVO, 'S') = 'S'
        )
        OR EXISTS (
          SELECT 1
          FROM TGFEST EST
          WHERE EST.CODPROD = PRO.CODPROD
            AND EST.CODBARRA = '${codigoSql}'
        )
      )
      ORDER BY PRO.CODPROD
    `);

    const produto = produtos[0];

    if (!produto) {
      res.status(404).json({ erro: 'Produto nao encontrado' });
      return;
    }

    const codProd = Number(produto.CODPROD);
    const estoque = await executeQuery(`
      SELECT
        EST.CODEMP,
        NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS NOMEEMPRESA,
        EST.CODLOCAL,
        LOC.DESCRLOCAL,
        EST.CONTROLE,
        NVL(EST.ESTOQUE, 0) AS ESTOQUE,
        NVL(EST.RESERVADO, 0) AS RESERVADO,
        NVL(EST.ESTOQUE, 0) - NVL(EST.RESERVADO, 0) AS DISPONIVEL,
        EST.DTVAL,
        EST.TIPO,
        EST.CODPARC,
        EST.CODBARRA,
        EST.STATUSLOTE
      FROM TGFEST EST
      LEFT JOIN TSIEMP EMP
        ON EMP.CODEMP = EST.CODEMP
      LEFT JOIN TGFLOC LOC
        ON LOC.CODLOCAL = EST.CODLOCAL
      WHERE EST.CODPROD = ${codProd}
        AND NVL(EST.ATIVO, 'S') = 'S'
        AND NVL(EST.ESTOQUE, 0) > 0
      ORDER BY EST.CODEMP, EST.CODLOCAL, EST.CONTROLE
    `);

    const estoquePorEmpresa = await executeQuery(`
      SELECT
        EST.CODEMP,
        NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS NOMEEMPRESA,
        SUM(NVL(EST.ESTOQUE, 0)) AS ESTOQUE,
        SUM(NVL(EST.RESERVADO, 0)) AS RESERVADO,
        SUM(NVL(EST.ESTOQUE, 0) - NVL(EST.RESERVADO, 0)) AS DISPONIVEL
      FROM TGFEST EST
      LEFT JOIN TSIEMP EMP
        ON EMP.CODEMP = EST.CODEMP
      WHERE EST.CODPROD = ${codProd}
        AND NVL(EST.ATIVO, 'S') = 'S'
        AND NVL(EST.ESTOQUE, 0) > 0
      GROUP BY EST.CODEMP, NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL)
      ORDER BY EST.CODEMP
    `);

    res.json({
      produto,
      estoquePorEmpresa,
      estoque
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar produto' });
  }
});

router.get('/contatos/perfis', async (req, res) => {
  try {
    const filtroAtivo = sqlFiltroAtivoContato(req.query.ativos);

    const rows = await executeQuery(`
      SELECT DISTINCT
        TPP.CODTIPPARC,
        TPP.DESCRTIPPARC
      FROM TGFPAR PAR
      JOIN TGFTPP TPP
        ON TPP.CODTIPPARC = PAR.CODTIPPARC
      WHERE NVL(PAR.CLIENTE, 'N') = 'S'
        ${filtroAtivo}
        AND PAR.CODTIPPARC > 0
        AND NVL(TPP.ATIVO, 'N') = 'S'
        AND NVL(TPP.ANALITICO, 'N') = 'S'
      ORDER BY TPP.DESCRTIPPARC
    `);

    res.json({
      perfis: [
        { CODTIPPARC: 'todos', DESCRTIPPARC: 'Todos os perfis' },
        { CODTIPPARC: 'sem-perfil', DESCRTIPPARC: 'Sem perfil' },
        ...rows
      ]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar perfis' });
  }
});

router.get('/contatos/estados', async (req, res) => {
  try {
    const filtroPerfil = sqlFiltroPerfilContato(req.query.perfil);
    const filtroAtivo = sqlFiltroAtivoContato(req.query.ativos);

    if (filtroPerfil === null) {
      res.status(400).json({ erro: 'Informe o perfil' });
      return;
    }

    const rows = await executeQuery(`
      SELECT DISTINCT
        UFS.CODUF,
        UFS.UF
      FROM TGFPAR PAR
      JOIN TSICID CID
        ON CID.CODCID = PAR.CODCID
      JOIN TSIUFS UFS
        ON UFS.CODUF = CID.UF
      WHERE NVL(PAR.CLIENTE, 'N') = 'S'
        ${filtroAtivo}
        ${filtroPerfil}
      ORDER BY UFS.UF
    `);

    res.json({ estados: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar estados' });
  }
});

router.get('/contatos/cidades', async (req, res) => {
  try {
    const filtroPerfil = sqlFiltroPerfilContato(req.query.perfil);
    const filtroAtivo = sqlFiltroAtivoContato(req.query.ativos);
    const ufOriginal = String(req.query.uf || '').trim().toUpperCase();
    const uf = textoSql(ufOriginal);
    const filtroUf = ufOriginal === 'TODOS' ? '' : `AND UFS.UF = '${uf}'`;

    if (filtroPerfil === null) {
      res.status(400).json({ erro: 'Informe o perfil' });
      return;
    }

    if (!ufOriginal) {
      res.status(400).json({ erro: 'Informe o estado' });
      return;
    }

    const rows = await executeQuery(`
      SELECT DISTINCT
        CID.CODCID,
        CID.NOMECID
      FROM TGFPAR PAR
      JOIN TSICID CID
        ON CID.CODCID = PAR.CODCID
      JOIN TSIUFS UFS
        ON UFS.CODUF = CID.UF
      WHERE NVL(PAR.CLIENTE, 'N') = 'S'
        ${filtroAtivo}
        ${filtroPerfil}
        ${filtroUf}
      ORDER BY CID.NOMECID
    `);

    res.json({ cidades: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar cidades' });
  }
});

router.get('/contatos/clientes', async (req, res) => {
  try {
    const filtroPerfil = sqlFiltroPerfilContato(req.query.perfil);
    const filtroAtivo = sqlFiltroAtivoContato(req.query.ativos);
    const cidadeOriginal = String(req.query.cidade || '').trim().toLowerCase();
    const codCid = obterNumeroInteiro(req.query.cidade);
    const ufOriginal = String(req.query.uf || '').trim().toUpperCase();
    const uf = textoSql(ufOriginal);
    const filtroCidade = cidadeOriginal === 'todos' ? '' : `AND PAR.CODCID = ${codCid}`;
    const filtroUf = cidadeOriginal === 'todos' && ufOriginal && ufOriginal !== 'TODOS'
      ? `AND UFS.UF = '${uf}'`
      : '';
    const pagina = obterNumeroInteiro(req.query.pagina) || 1;
    const tamanhoPagina = 50;
    const perfisGrade = obterListaFiltroContato(req.query.perfisGrade);
    const vendedoresGrade = obterListaFiltroContato(req.query.vendedoresGrade);
    const filtroPerfilGrade = sqlFiltroListaTexto("NVL(TPP.DESCRTIPPARC, 'Sem perfil')", perfisGrade);
    const filtroVendedorGrade = sqlFiltroListaTexto("NVL(VEN.APELIDO, 'Sem vendedor')", vendedoresGrade);
    const filtroPeriodo = sqlFiltroPeriodoCompra(req.query.dataInicial, req.query.dataFinal);
    const colunaOrdenacao = ['codigo', 'cliente', 'ultima'].includes(String(req.query.ordenar))
      ? String(req.query.ordenar)
      : 'cliente';
    const direcaoOrdenacao = String(req.query.direcao).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const ordemSql = colunaOrdenacao === 'codigo'
      ? `PAR.CODPARC ${direcaoOrdenacao}`
      : colunaOrdenacao === 'ultima'
        ? `ULTIMA_COMPRA.DTULTCOMPRA ${direcaoOrdenacao} NULLS LAST, PAR.NOMEPARC ASC`
        : `PAR.NOMEPARC ${direcaoOrdenacao}, PAR.CODPARC ${direcaoOrdenacao}`;

    if (filtroPerfil === null) {
      res.status(400).json({ erro: 'Informe o perfil' });
      return;
    }

    if (cidadeOriginal !== 'todos' && !codCid) {
      res.status(400).json({ erro: 'Informe a cidade' });
      return;
    }

    const joinsBase = `
      FROM TGFPAR PAR
      LEFT JOIN TGFTPP TPP ON TPP.CODTIPPARC = PAR.CODTIPPARC
      LEFT JOIN TGFVEN VEN ON VEN.CODVEND = PAR.CODVEND
      LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
      LEFT JOIN (
        SELECT CODPARC, MAX(DTNEG) AS DTULTCOMPRA
        FROM TGFCAB
        WHERE TIPMOV IN ('P', 'V')
          AND STATUSNOTA = 'L'
        GROUP BY CODPARC
      ) ULTIMA_COMPRA ON ULTIMA_COMPRA.CODPARC = PAR.CODPARC
      WHERE NVL(PAR.CLIENTE, 'N') = 'S'
        ${filtroAtivo}
        ${filtroPerfil}
        ${filtroCidade}
        ${filtroUf}
    `;

    const [facetasPerfil, facetasVendedor] = await Promise.all([
      executeQuery(`
        SELECT DISTINCT NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS VALOR
        ${joinsBase}
        ORDER BY VALOR
      `),
      executeQuery(`
        SELECT DISTINCT NVL(VEN.APELIDO, 'Sem vendedor') AS VALOR
        ${joinsBase}
        ORDER BY VALOR
      `)
    ]);

    const filtrosGrade = `${filtroPerfilGrade}\n${filtroVendedorGrade}\n${filtroPeriodo}`;
    const [totalRow] = await executeQuery(`SELECT COUNT(*) AS TOTAL ${joinsBase} ${filtrosGrade}`);
    const total = normalizarNumero(totalRow?.TOTAL);
    const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));
    const paginaValida = Math.min(pagina, totalPaginas);
    const inicioValido = ((paginaValida - 1) * tamanhoPagina) + 1;
    const fimValido = paginaValida * tamanhoPagina;

    const rows = await executeQuery(`
      SELECT *
      FROM (
        SELECT RESULTADO_PAGINADO.*, ROWNUM AS RN
        FROM (
          SELECT
            PAR.CODPARC,
            PAR.NOMEPARC,
            CAST(NVL(PAR.LIMCRED, 0) AS NUMBER(15,2)) AS LIMCRED,
            CASE WHEN PAR.LIMCRED IS NULL THEN 'N' ELSE 'S' END AS LIMCRED_CADASTRADO,
            CASE WHEN NVL(PAR.ATIVO, 'S') = 'S' THEN 'Sim' ELSE 'Nao' END AS ATIVO,
            NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
            NVL(VEN.APELIDO, 'Sem vendedor') AS VENDEDOR,
            TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'DD/MM/YYYY') AS ULTIMA_COMPRA,
            TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'YYYYMMDD') AS ULTIMA_COMPRA_ORD,
            TO_CHAR(PAR.AD_DTATUCONTATO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO_CONTATO
          FROM TGFPAR PAR
          LEFT JOIN TGFTPP TPP ON TPP.CODTIPPARC = PAR.CODTIPPARC
          LEFT JOIN TGFVEN VEN ON VEN.CODVEND = PAR.CODVEND
          LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
          LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
          LEFT JOIN (
            SELECT CODPARC, MAX(DTNEG) AS DTULTCOMPRA
            FROM TGFCAB
            WHERE TIPMOV IN ('P', 'V')
              AND STATUSNOTA = 'L'
            GROUP BY CODPARC
          ) ULTIMA_COMPRA ON ULTIMA_COMPRA.CODPARC = PAR.CODPARC
          WHERE NVL(PAR.CLIENTE, 'N') = 'S'
            ${filtroAtivo}
            ${filtroPerfil}
            ${filtroCidade}
            ${filtroUf}
            ${filtrosGrade}
          ORDER BY ${ordemSql}
        ) RESULTADO_PAGINADO
        WHERE ROWNUM <= ${fimValido}
      )
      WHERE RN >= ${inicioValido}
      ORDER BY RN
    `);

    res.json({
      clientes: anexarStatusContato(rows),
      paginacao: { pagina: paginaValida, tamanho: tamanhoPagina, total, totalPaginas },
      facetas: {
        perfis: facetasPerfil.map((item) => item.VALOR).filter(Boolean),
        vendedores: facetasVendedor.map((item) => item.VALOR).filter(Boolean)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

router.get('/contatos/busca', async (req, res) => {
  try {
    const termoOriginal = String(req.query.q || '').trim();
    const termo = textoSql(termoOriginal.toUpperCase());
    const termoNumerico = termoOriginal.replace(/\D/g, '');
    const filtroAtivo = sqlFiltroAtivoContato(req.query.ativos);

    if (termoOriginal.length < 2) {
      res.json({ clientes: [] });
      return;
    }

    const filtroCodigo = /^\d+$/.test(termoNumerico) ? `OR TO_CHAR(PAR.CODPARC) LIKE '${termoNumerico}%'` : '';
    const filtroCpfCnpj = termoNumerico ? `OR REGEXP_REPLACE(NVL(PAR.CGC_CPF, ''), '[^0-9]', '') LIKE '%${termoNumerico}%'` : '';
    const ordemNumerica = termoNumerico
      ? `
            WHEN TO_CHAR(PAR.CODPARC) = '${termoNumerico}' THEN 0
            WHEN TO_CHAR(PAR.CODPARC) LIKE '${termoNumerico}%' THEN 1`
      : '';

    const rows = await executeQuery(`
      SELECT * FROM (
        SELECT
          PAR.CODPARC,
          PAR.NOMEPARC,
          CAST(NVL(PAR.LIMCRED, 0) AS NUMBER(15,2)) AS LIMCRED,
          CASE WHEN PAR.LIMCRED IS NULL THEN 'N' ELSE 'S' END AS LIMCRED_CADASTRADO,
          CASE WHEN NVL(PAR.ATIVO, 'S') = 'S' THEN 'Sim' ELSE 'Nao' END AS ATIVO,
          NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
          NVL(VEN.APELIDO, 'Sem vendedor') AS VENDEDOR,
          TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'DD/MM/YYYY') AS ULTIMA_COMPRA,
          TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'YYYYMMDD') AS ULTIMA_COMPRA_ORD,
          TO_CHAR(PAR.AD_DTATUCONTATO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO_CONTATO
        FROM TGFPAR PAR
        LEFT JOIN TGFTPP TPP
          ON TPP.CODTIPPARC = PAR.CODTIPPARC
        LEFT JOIN TGFVEN VEN
          ON VEN.CODVEND = PAR.CODVEND
        LEFT JOIN (
          SELECT CODPARC, MAX(DTNEG) AS DTULTCOMPRA
          FROM TGFCAB
          WHERE TIPMOV IN ('P', 'V')
            AND STATUSNOTA = 'L'
          GROUP BY CODPARC
        ) ULTIMA_COMPRA
          ON ULTIMA_COMPRA.CODPARC = PAR.CODPARC
        WHERE NVL(PAR.CLIENTE, 'N') = 'S'
          ${filtroAtivo}
          AND (
            UPPER(PAR.NOMEPARC) LIKE '%${termo}%'
            ${filtroCodigo}
            ${filtroCpfCnpj}
          )
        ORDER BY
          CASE
            ${ordemNumerica}
            WHEN UPPER(PAR.NOMEPARC) LIKE '${termo}%' THEN 2
            ELSE 3
          END,
          PAR.NOMEPARC
      ) WHERE ROWNUM <= 80
    `);

    res.json({ clientes: anexarStatusContato(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

router.get('/contatos/atualizados', async (req, res) => {
  try {
    const rows = await executeQuery(`
      SELECT
        PAR.CODPARC,
        PAR.NOMEPARC,
        CAST(NVL(PAR.LIMCRED, 0) AS NUMBER(15,2)) AS LIMCRED,
        CASE WHEN PAR.LIMCRED IS NULL THEN 'N' ELSE 'S' END AS LIMCRED_CADASTRADO,
        CASE WHEN NVL(PAR.ATIVO, 'S') = 'S' THEN 'Sim' ELSE 'Nao' END AS ATIVO,
        NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
        NVL(VEN.APELIDO, 'Sem vendedor') AS VENDEDOR,
        TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'DD/MM/YYYY') AS ULTIMA_COMPRA,
        TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'YYYYMMDD') AS ULTIMA_COMPRA_ORD,
        TO_CHAR(PAR.AD_DTATUCONTATO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO_CONTATO
      FROM TGFPAR PAR
      LEFT JOIN TGFTPP TPP
        ON TPP.CODTIPPARC = PAR.CODTIPPARC
      LEFT JOIN TGFVEN VEN
        ON VEN.CODVEND = PAR.CODVEND
      LEFT JOIN (
        SELECT CODPARC, MAX(DTNEG) AS DTULTCOMPRA
        FROM TGFCAB
        WHERE TIPMOV IN ('P', 'V')
          AND STATUSNOTA = 'L'
        GROUP BY CODPARC
      ) ULTIMA_COMPRA
        ON ULTIMA_COMPRA.CODPARC = PAR.CODPARC
      WHERE NVL(PAR.CLIENTE, 'N') = 'S'
        AND PAR.AD_DTATUCONTATO IS NOT NULL
      ORDER BY PAR.AD_DTATUCONTATO DESC, PAR.NOMEPARC
    `);

    const clientes = anexarStatusContato(rows)
      .filter((cliente) => cliente.STATUS_ATUALIZACAO_CONTATO === 'atualizado');

    res.json({ clientes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar clientes atualizados' });
  }
});

router.get('/contatos/clientes/:codParc', async (req, res) => {
  try {
    const codParc = obterNumeroInteiro(req.params.codParc);

    if (!codParc) {
      res.status(400).json({ erro: 'Informe o cliente' });
      return;
    }

    const rows = await executeQuery(`
      SELECT
        PAR.CODPARC,
        PAR.NOMEPARC,
        PAR.RAZAOSOCIAL,
        PAR.CGC_CPF,
        PAR.CODTIPPARC,
        CASE WHEN NVL(PAR.ATIVO, 'S') = 'S' THEN 'Sim' ELSE 'Nao' END AS ATIVO,
        CASE WHEN PAR.TIPPESSOA = 'J' THEN 'Juridica' WHEN PAR.TIPPESSOA = 'F' THEN 'Fisica' ELSE NVL(PAR.TIPPESSOA, '-') END AS TIPO_PESSOA,
        NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
        PAR.CODVEND,
        VEN.APELIDO AS VENDEDOR_PREFERENCIAL,
        PAR.TELEFONE,
        PAR.FAX,
        CPL.AD_TELERECEB AS TELEFONE_RECEBIMENTO,
        CPL.AD_TELENTREGA AS TELEFONE_ENTREGA,
        PAR.TIMOUTTELS,
        PAR.EMAIL,
        PAR.EMAILNFE,
        PAR.EMAILDANFE,
        PAR.EMAILNOTIFENTREGA,
        CAST(NVL(PAR.LIMCRED, 0) AS NUMBER(15,2)) AS LIMCRED,
        CASE WHEN PAR.LIMCRED IS NULL THEN 'N' ELSE 'S' END AS LIMCRED_CADASTRADO,
        PAR.SITUACAO,
        PAR.OBSERVACOES,
        PAR.MOTBLOQ,
        CAST(NVL(SUGESTAO_LIMITE.MEDIA_PEDIDOS, 0) AS NUMBER(15,2)) AS SUGESTAO_LIMCRED,
        NVL(SUGESTAO_LIMITE.QTD_PEDIDOS, 0) AS QTD_PEDIDOS_SUGESTAO,
        TO_CHAR(PAR.DTULTCONTATO, 'DD/MM/YYYY') AS DTULTCONTATO,
        TO_CHAR(PAR.AD_DTATUCONTATO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO_CONTATO,
        TO_CHAR(ULTIMA_COMPRA.DTULTCOMPRA, 'DD/MM/YYYY') AS ULTIMA_COMPRA,
        TRIM(NVL(ENDR.TIPO || ' ', '') || NVL(ENDR.NOMEEND, '')) AS ENDERECO,
        PAR.NUMEND,
        PAR.COMPLEMENTO,
        BAI.NOMEBAI AS BAIRRO,
        CID.NOMECID AS CIDADE,
        UFS.UF,
        PAR.CEP
      FROM TGFPAR PAR
      LEFT JOIN TGFTPP TPP
        ON TPP.CODTIPPARC = PAR.CODTIPPARC
      LEFT JOIN TGFVEN VEN
        ON VEN.CODVEND = PAR.CODVEND
      LEFT JOIN TGFCPL CPL
        ON CPL.CODPARC = PAR.CODPARC
      LEFT JOIN TSIEND ENDR
        ON ENDR.CODEND = PAR.CODEND
      LEFT JOIN TSIBAI BAI
        ON BAI.CODBAI = PAR.CODBAI
      LEFT JOIN TSICID CID
        ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS
        ON UFS.CODUF = CID.UF
      LEFT JOIN (
        SELECT CODPARC, MAX(DTNEG) AS DTULTCOMPRA
        FROM TGFCAB
        WHERE TIPMOV IN ('P', 'V')
          AND STATUSNOTA = 'L'
        GROUP BY CODPARC
      ) ULTIMA_COMPRA
        ON ULTIMA_COMPRA.CODPARC = PAR.CODPARC
      LEFT JOIN (
        SELECT
          CODPARC,
          AVG(VLRNOTA) AS MEDIA_PEDIDOS,
          COUNT(*) AS QTD_PEDIDOS
        FROM (
          SELECT
            CAB.CODPARC,
            NVL(CAB.VLRNOTA, 0) AS VLRNOTA,
            ROW_NUMBER() OVER (
              PARTITION BY CAB.CODPARC
              ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC
            ) AS ORDEM_PEDIDO
          FROM TGFCAB CAB
          WHERE CAB.TIPMOV = 'P'
            AND CAB.STATUSNOTA = 'L'
        )
        WHERE ORDEM_PEDIDO <= 5
        GROUP BY CODPARC
      ) SUGESTAO_LIMITE
        ON SUGESTAO_LIMITE.CODPARC = PAR.CODPARC
      WHERE PAR.CODPARC = ${codParc}
    `);

    const parceiro = rows[0];

    if (!parceiro) {
      res.status(404).json({ erro: 'Cliente nao encontrado' });
      return;
    }

    parceiro.STATUS_ATUALIZACAO_CONTATO = contatoStatusStore.obter(parceiro.CODPARC)?.status
      || (valorPreenchido(parceiro.DATA_ATUALIZACAO_CONTATO) ? 'atualizado' : 'pendente');

    const contatos = await executeQuery(`
      SELECT
        CODCONTATO,
        NOMECONTATO,
        APELIDO,
        CARGO,
        TELEFONE,
        CELULAR,
        TELRESID,
        EMAIL,
        CASE WHEN NVL(ATIVO, 'S') = 'S' THEN 'Sim' ELSE 'Nao' END AS ATIVO
      FROM TGFCTT
      WHERE CODPARC = ${codParc}
      ORDER BY NVL(PRIORIDADE, 999), NOMECONTATO
    `);

    const perfis = await executeQuery(`
      SELECT CODTIPPARC, DESCRTIPPARC
      FROM TGFTPP
      WHERE CODTIPPARC > 0
        AND NVL(ATIVO, 'N') = 'S'
        AND NVL(ANALITICO, 'N') = 'S'
      ORDER BY DESCRTIPPARC
    `);

    const situacoes = await executeQuery(`
      SELECT OPC.VALOR, OPC.OPCAO
      FROM TDDCAM CAM
      JOIN TDDOPC OPC ON OPC.NUCAMPO = CAM.NUCAMPO
      WHERE UPPER(CAM.NOMETAB) = 'TGFPAR'
        AND UPPER(CAM.NOMECAMPO) = 'SITUACAO'
      ORDER BY OPC.ORDEM NULLS LAST, OPC.OPCAO
    `);

    res.json({ parceiro, contatos, perfis, situacoes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar dados do cliente' });
  }
});

router.patch('/contatos/clientes/:codParc', async (req, res) => {
  try {
    const codParc = obterNumeroInteiro(req.params.codParc);
    const acao = String(req.body?.acao || 'salvar').trim().toLowerCase();

    if (!codParc) {
      res.status(400).json({ erro: 'Informe o cliente' });
      return;
    }

    if (!['salvar', 'aguardando', 'salvar-perfil', 'salvar-limite'].includes(acao)) {
      res.status(400).json({ erro: 'Acao de atualizacao invalida' });
      return;
    }

    const campos = {};

    if (acao === 'salvar' || acao === 'aguardando') {
      campos.AD_DTATUCONTATO = formatarDataHoraSankhya();
    }

    if (acao === 'salvar') {
      campos.FAX = valorTextoContato(req.body?.telefonePrincipal, 30);
      campos.EMAIL = valorTextoContato(req.body?.email, 80);
    }

    if (acao === 'salvar-perfil') {
      const perfilInformado = String(req.body?.codTipParc ?? '').trim();
      const codTipParc = obterNumeroInteiro(perfilInformado);

      if (!codTipParc) {
        res.status(400).json({ erro: 'Selecione um perfil ativo e analitico' });
        return;
      }

      const [perfilValido] = await executeQuery(`
        SELECT CODTIPPARC
        FROM TGFTPP
        WHERE CODTIPPARC = ${codTipParc}
          AND NVL(ATIVO, 'N') = 'S'
          AND NVL(ANALITICO, 'N') = 'S'
      `);

      if (!perfilValido) {
        res.status(400).json({ erro: 'O perfil selecionado nao esta ativo ou nao e analitico' });
        return;
      }

      campos.CODTIPPARC = codTipParc;
    }

    if (acao === 'salvar-limite') {
      const limiteCredito = obterValorMonetario(req.body?.limiteCredito);
      const situacao = valorTextoContato(req.body?.situacao, 1).toUpperCase();
      const observacoes = valorTextoContato(req.body?.observacoes, 4000);

      if (limiteCredito === null) {
        res.status(400).json({ erro: 'Informe um limite de credito valido' });
        return;
      }

      const [situacaoValida] = await executeQuery(`
        SELECT OPC.VALOR
        FROM TDDCAM CAM
        JOIN TDDOPC OPC ON OPC.NUCAMPO = CAM.NUCAMPO
        WHERE UPPER(CAM.NOMETAB) = 'TGFPAR'
          AND UPPER(CAM.NOMECAMPO) = 'SITUACAO'
          AND OPC.VALOR = '${textoSql(situacao)}'
      `);

      if (!situacao || !situacaoValida) {
        res.status(400).json({ erro: 'Selecione uma situacao de credito valida' });
        return;
      }

      campos.LIMCRED = numeroApi(limiteCredito);
      campos.SITUACAO = situacao;
      campos.OBSERVACOES = observacoes;
    }

    const contatos = Array.isArray(req.body?.contatos) ? req.body.contatos : [];
    const contatoNfe = contatos.find((contato) => contato?.tipo === 'nfe');
    const contatoTransporte = contatos.find((contato) => contato?.tipo === 'transporte');
    const contatoFinanceiro = contatos.find((contato) => contato?.tipo === 'financeiro');

    if (acao === 'salvar') {
      const faltando = [];
      if (!valorPreenchido(req.body?.telefonePrincipal)) faltando.push('telefone principal');
      if (!valorPreenchido(req.body?.email)) faltando.push('email principal');
      faltando.push(...validarContatoObrigatorio(contatoNfe, 'contato NF-e'));
      faltando.push(...validarContatoObrigatorio(contatoTransporte, 'contato de Transporte/Logistica'));
      faltando.push(...validarContatoObrigatorio(contatoFinanceiro, 'contato Financeiro'));

      if (faltando.length > 0) {
        res.status(400).json({ erro: `Preencha os campos obrigatorios: ${faltando.join(', ')}` });
        return;
      }

      campos.EMAILNFE = valorTextoContato(contatoNfe?.email, 80);
      campos.EMAILNOTIFENTREGA = valorTextoContato(contatoTransporte?.email, 80);
    }

    if (acao === 'salvar') {
      const contatosParaSalvar = contatos.filter(contatoTemConteudo);
      const [sequenciaContato] = await executeQuery(`
        SELECT NVL(MAX(CODCONTATO), 0) AS ULTIMO
        FROM TGFCTT
        WHERE CODPARC = ${codParc}
      `);
      let proximoContato = Number(sequenciaContato?.ULTIMO || 0) + 1;

      for (const contato of contatosParaSalvar) {
        const codContatoAtual = obterNumeroInteiro(contato?.codContato) || proximoContato;
        await salvarContatoParceiro(codParc, contato, codContatoAtual);
        if (!obterNumeroInteiro(contato?.codContato)) {
          proximoContato += 1;
        }
      }
    }

    await atualizarRegistroApi('Parceiro', { CODPARC: codParc }, campos);

    if (acao === 'aguardando') {
      contatoStatusStore.salvar(codParc, 'aguardando');
    } else if (acao === 'salvar') {
      contatoStatusStore.salvar(codParc, 'atualizado');
    }

    const [parceiro] = await executeQuery(`
      SELECT
        PAR.CODPARC,
        PAR.CODTIPPARC,
        CAST(NVL(PAR.LIMCRED, 0) AS NUMBER(15,2)) AS LIMCRED,
        CASE WHEN PAR.LIMCRED IS NULL THEN 'N' ELSE 'S' END AS LIMCRED_CADASTRADO,
        PAR.SITUACAO,
        PAR.OBSERVACOES,
        PAR.MOTBLOQ,
        NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
        TO_CHAR(PAR.AD_DTATUCONTATO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO_CONTATO
      FROM TGFPAR PAR
      LEFT JOIN TGFTPP TPP
        ON TPP.CODTIPPARC = PAR.CODTIPPARC
      WHERE PAR.CODPARC = ${codParc}
    `);

    const statusContato = contatoStatusStore.obter(codParc)?.status
      || (valorPreenchido(parceiro?.DATA_ATUALIZACAO_CONTATO) ? 'atualizado' : 'pendente');

    res.json({
      ok: true,
      statusContato,
      parceiro
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao atualizar contato do cliente' });
  }
});

router.post('/fila-conferencia/iniciar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const codUsu = obterCodigoUsuario(req.usuario?.codUsu);

  if (!nunota || codUsu === null) {
    res.status(400).json({ erro: 'Informe pedido e usuario logado' });
    return;
  }

  try {
    const pedidoRows = await executeQuery(`
      SELECT CAB.NUNOTA, CAB.NUCONFATUAL, CAB.QTDVOL, CONF.STATUS
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      WHERE NUNOTA = ${nunota}
        AND CODTIPOPER IN (5, 6, 237)
        AND STATUSNOTA = 'L'
    `);

    const pedido = pedidoRows[0];
    if (!pedido) {
      res.status(404).json({ erro: 'Pedido nao encontrado ou nao esta liberado para conferencia' });
      return;
    }

    if (pedido.NUCONFATUAL) {
      const [conferenciaAtual] = await executeQuery(`
        SELECT NUCONF, STATUS
        FROM TGFCON2
        WHERE NUCONF = ${Number(pedido.NUCONFATUAL)}
      `);

      if (conferenciaAtual?.STATUS === 'A') {
        await atualizarRegistroApi(
          'CabecalhoConferencia',
          { NUCONF: pedido.NUCONFATUAL },
          {
            CODUSUCONF: codUsu,
            QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
          }
        );

        res.json({
          ok: true,
          nunota,
          nuconf: Number(pedido.NUCONFATUAL),
          status: 'EM ANDAMENTO'
        });
        return;
      }

      res.status(409).json({ erro: 'Pedido ja possui conferencia finalizada ou em outro status no Sankhya' });
      return;
    }

    const [conferenciaAberta] = await executeQuery(`
      SELECT NUCONF, STATUS
      FROM TGFCON2
      WHERE NUNOTAORIG = ${nunota}
        AND STATUS = 'A'
      ORDER BY NUCONF DESC
    `);

    if (conferenciaAberta) {
      await atualizarRegistroApi(
        'CabecalhoConferencia',
        { NUCONF: conferenciaAberta.NUCONF },
        {
          CODUSUCONF: codUsu,
          QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
        }
      );

      await atualizarRegistroApi(
        'CabecalhoNota',
        { NUNOTA: nunota },
        { NUCONFATUAL: conferenciaAberta.NUCONF }
      );

      res.json({
        ok: true,
        nunota,
        nuconf: Number(conferenciaAberta.NUCONF),
        status: 'EM ANDAMENTO'
      });
      return;
    }

    const usuarioRows = await executeQuery(`
      SELECT CODUSU
      FROM TSIUSU
      WHERE CODUSU = ${codUsu}
    `);

    if (usuarioRows.length === 0) {
      res.status(400).json({ erro: 'Conferente nao encontrado no Sankhya' });
      return;
    }

    const nuconfRows = await executeQuery(`
      SELECT NVL(MAX(NUCONF), 0) + 1 AS NUCONF
      FROM (
        SELECT NUCONF FROM TGFCON2
        UNION ALL
        SELECT NUCONF FROM TGFCON
      )
    `);
    const nuconf = nuconfRows[0].NUCONF;

    await salvarRegistroApi('CabecalhoConferencia', {
      NUCONF: nuconf,
      NUNOTAORIG: nunota,
      STATUS: 'A',
      DHINICONF: formatarDataHoraSankhya(),
      CODUSUCONF: codUsu,
      QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
    });

    await atualizarRegistroApi(
      'CabecalhoNota',
      { NUNOTA: nunota },
      { NUCONFATUAL: nuconf }
    );

    res.json({
      ok: true,
      nunota,
      nuconf,
      status: 'EM ANDAMENTO'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao iniciar conferencia' });
  }
});

router.post('/fila-conferencia/progresso', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const nuconf = obterNumeroInteiro(req.body?.nuconf);
  const codUsu = obterCodigoUsuario(req.usuario?.codUsu);
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

  if (!nunota || codUsu === null) {
    res.status(400).json({ erro: 'Informe pedido e usuario logado' });
    return;
  }

  try {
    const [pedido] = await executeQuery(`
      SELECT CAB.NUNOTA, CAB.NUCONFATUAL, CONF.STATUS
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      WHERE CAB.NUNOTA = ${nunota}
    `);

    if (!pedido) {
      res.status(404).json({ erro: 'Pedido nao encontrado' });
      return;
    }

    if (pedido.NUCONFATUAL && pedido.STATUS && pedido.STATUS !== 'A') {
      conferenciaProgressStore.remover(nunota);
      res.status(409).json({ erro: 'Conferencia ja finalizada ou em outro status no Sankhya' });
      return;
    }

    const progresso = conferenciaProgressStore.salvar({
      nunota,
      nuconf: nuconf || pedido.NUCONFATUAL || null,
      codUsu,
      itens
    });

    res.json({ ok: true, progresso });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar progresso da conferencia' });
  }
});

router.post('/fila-conferencia/confirmar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const nuconfInformado = obterNumeroInteiro(req.body?.nuconf);
  const codUsu = obterCodigoUsuario(req.usuario?.codUsu);
  const volumes = obterNumeroInteiro(req.body?.volumes);
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

  if (!nunota || codUsu === null || !volumes || itens.length === 0) {
    res.status(400).json({ erro: 'Informe pedido, usuario logado, quantidade de volumes e itens conferidos' });
    return;
  }

  try {
    const pedidoRows = await executeQuery(`
      SELECT
        CAB.NUNOTA,
        CAB.NUCONFATUAL,
        CAB.QTDVOL,
        CONF.STATUS,
        NVL(CCO.FATAOCONCLUIR, 'N') AS FATAOCONCLUIR
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      LEFT JOIN TGFTOP TOP
        ON TOP.CODTIPOPER = CAB.CODTIPOPER
       AND TOP.DHALTER = CAB.DHTIPOPER
      LEFT JOIN TGFCCO CCO
        ON CCO.NUCCO = TOP.NUCCO
      WHERE CAB.NUNOTA = ${nunota}
        AND CAB.CODTIPOPER IN (5, 6, 237)
        AND CAB.STATUSNOTA = 'L'
    `);

    const pedido = pedidoRows[0];
    if (!pedido) {
      res.status(404).json({ erro: 'Pedido nao encontrado ou nao esta liberado para conferencia' });
      return;
    }

    if (pedido.NUCONFATUAL && pedido.STATUS !== 'A') {
      res.status(409).json({ erro: 'Pedido ja possui conferencia finalizada ou em outro status no Sankhya' });
      return;
    }

    const usuarioRows = await executeQuery(`
      SELECT CODUSU
      FROM TSIUSU
      WHERE CODUSU = ${codUsu}
    `);

    if (usuarioRows.length === 0) {
      res.status(400).json({ erro: 'Conferente nao encontrado no Sankhya' });
      return;
    }

    const itensPedido = await executeQuery(`
      SELECT
        SEQUENCIA,
        CODPROD,
        CODVOL,
        CODLOCALORIG,
        CONTROLE,
        NVL(QTDNEG, 0) AS QTDNEG,
        NVL(VLRUNIT, 0) AS VLRUNIT,
        NVL(VLRTOT, 0) AS VLRTOT,
        NVL(VLRDESC, 0) AS VLRDESC,
        NVL(PERCDESC, 0) AS PERCDESC,
        NVL(GTINNFE, PRODUTONFE) AS CODBARRA
      FROM TGFITE
      WHERE NUNOTA = ${nunota}
      ORDER BY SEQUENCIA
    `);

    const conferidosPorSequencia = new Map(
      itens.map((item) => [Number(item.sequencia), normalizarNumero(item.qtdConferida)])
    );
    const cortadosPorSequencia = new Map(
      itens.map((item) => [Number(item.sequencia), normalizarNumero(item.qtdCortada)])
    );

    const divergencias = itensPedido
      .map((item) => {
        const qtdEsperada = normalizarNumero(item.QTDNEG);
        const qtdConferida = conferidosPorSequencia.get(Number(item.SEQUENCIA)) ?? 0;
        const qtdCortada = cortadosPorSequencia.get(Number(item.SEQUENCIA)) ?? 0;

        return {
          sequencia: item.SEQUENCIA,
          codProd: item.CODPROD,
          qtdEsperada,
          qtdConferida,
          qtdCortada,
          ok: Math.abs(qtdEsperada - (qtdConferida + qtdCortada)) < 0.0001
        };
      })
      .filter((item) => !item.ok);

    if (divergencias.length > 0) {
      res.status(409).json({
        erro: 'Existem divergencias na conferencia',
        divergencias
      });
      return;
    }

    await atualizarRegistroApi(
      'CabecalhoNota',
      { NUNOTA: nunota },
      { QTDVOL: volumes }
    );
    pedido.QTDVOL = volumes;

    let nuconf = Number(pedido.NUCONFATUAL || nuconfInformado || 0);
    if (!nuconf) {
      const [conferenciaAberta] = await executeQuery(`
        SELECT NUCONF
        FROM TGFCON2
        WHERE NUNOTAORIG = ${nunota}
          AND STATUS = 'A'
        ORDER BY NUCONF DESC
      `);
      nuconf = Number(conferenciaAberta?.NUCONF || 0);
    }

    const conferenciaJaIniciada = Boolean(nuconf);
    const agoraSankhya = formatarDataHoraSankhya();
    let dhInicioConferencia = null;

    if (conferenciaJaIniciada) {
      const [conferenciaAtual] = await executeQuery(`
        SELECT NUCONF, NUNOTAORIG, STATUS, DHINICONF
        FROM TGFCON2
        WHERE NUCONF = ${nuconf}
      `);

      if (!conferenciaAtual || Number(conferenciaAtual.NUNOTAORIG) !== nunota) {
        res.status(409).json({ erro: 'Conferencia iniciada nao pertence a este pedido no Sankhya' });
        return;
      }

      if (conferenciaAtual.STATUS && conferenciaAtual.STATUS !== 'A') {
        res.status(409).json({ erro: 'Conferencia ja esta finalizada ou em outro status no Sankhya' });
        return;
      }

      dhInicioConferencia = conferenciaAtual.DHINICONF || null;
    }

    if (!conferenciaJaIniciada) {
      const nuconfRows = await executeQuery(`
        SELECT NVL(MAX(NUCONF), 0) + 1 AS NUCONF
        FROM (
          SELECT NUCONF FROM TGFCON2
          UNION ALL
          SELECT NUCONF FROM TGFCON
        )
      `);
      nuconf = nuconfRows[0].NUCONF;

      await salvarRegistroApi('CabecalhoConferencia', {
        NUCONF: nuconf,
        NUNOTAORIG: nunota,
        STATUS: 'A',
        DHINICONF: agoraSankhya,
        CODUSUCONF: codUsu,
        QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
      });
      dhInicioConferencia = agoraSankhya;
    } else {
      await atualizarRegistroApi(
        'CabecalhoConferencia',
        { NUCONF: nuconf },
        {
          CODUSUCONF: codUsu,
          QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
        }
      );
    }

    const cortesAplicados = await aplicarCortesNoPedido({
      nunota,
      itensPedido,
      conferidosPorSequencia,
      cortadosPorSequencia
    });

    await salvarDetalhesConferenciaSankhya({ nuconf, nunota });

    let resultadoFinalizacao = null;
    let erroFinalizacaoNativa = null;

    try {
      resultadoFinalizacao = await finalizarConferenciaNativa(nuconf, nunota);
    } catch (err) {
      erroFinalizacaoNativa = err;
    }

    const [conferenciaFinal] = await executeQuery(`
      SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF
      FROM TGFCON2
      WHERE NUCONF = ${nuconf}
    `);

    let conferenciaConferida = conferenciaFinal;
    let fechamentoOperacionalAplicado = false;

    if (conferenciaConferida?.STATUS !== 'F' && finalizacaoPermiteFechamentoOperacional(resultadoFinalizacao)) {
      await finalizarConferenciaOperacional(nuconf, nunota, codUsu, pedido.QTDVOL);
      fechamentoOperacionalAplicado = true;
      [conferenciaConferida] = await executeQuery(`
        SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF
        FROM TGFCON2
        WHERE NUCONF = ${nuconf}
      `);
    }

    if (conferenciaConferida?.STATUS !== 'F') {
      if (erroFinalizacaoNativa) {
        throw erroFinalizacaoNativa;
      }

      const detalhesSankhya = [
        traduzirStatusConferencia(conferenciaConferida?.STATUS),
        ...coletarDetalhesSankhya(resultadoFinalizacao)
      ].filter(Boolean);

      res.status(409).json({
        erro: 'O Sankhya recebeu a conferencia, mas nao finalizou como conferido',
        statusSankhya: conferenciaConferida?.STATUS || null,
        detalhesSankhya,
        resultadoFinalizacao
      });
      return;
    }

    await preservarConferenteFinalizacao(nuconf, codUsu, dhInicioConferencia, conferenciaConferida.DHFINCONF);
    [conferenciaConferida] = await executeQuery(`
      SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF
      FROM TGFCON2
      WHERE NUCONF = ${nuconf}
    `);

    conferenciaProgressStore.remover(nunota);

    const notaFaturada = await consultarFaturamentoExistente(nunota);
    const faturamentoAutomatico = pedido.FATAOCONCLUIR === 'S';
    const detalhesFaturamento = notaFaturada || !faturamentoAutomatico
      ? []
      : [
          erroFinalizacaoNativa?.message,
          ...coletarDetalhesSankhya(resultadoFinalizacao)
        ].filter(Boolean);
    const faturamento = notaFaturada
      ? {
          status: 'FATURADO',
          automatico: faturamentoAutomatico,
          nota: notaFaturada,
          detalhes: []
        }
      : faturamentoAutomatico
        ? {
            status: 'ERRO',
            automatico: true,
            nota: null,
            detalhes: detalhesFaturamento.length > 0
              ? detalhesFaturamento
              : ['O Sankhya concluiu a conferencia, mas nao gerou uma nota de faturamento.']
          }
        : {
            status: 'NAO_CONFIGURADO',
            automatico: false,
            nota: null,
            detalhes: ['Faturamento automatico nao configurado para esta conferencia.']
          };

    res.json({
      ok: true,
      nunota,
      nuconf,
      status: 'CONFERIDO',
      fechamentoOperacionalAplicado,
      cortesAplicados,
      faturamento,
      resultadoFinalizacao
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Erro ao confirmar conferencia',
      detalhesSankhya: [err.message].filter(Boolean)
    });
  }
});

router.get('/fila-conferencia/pedidos/:nunota/documentos', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);

  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido' });
    return;
  }

  try {
    res.json(await obterSituacaoDocumentosPedido(nunota));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar documentos do faturamento', detalhes: err.message });
  }
});

router.get('/fila-conferencia/pedidos/:nunota/pdf', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);

  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido' });
    return;
  }

  try {
    const [pedido] = await executeQuery(`
      SELECT
        CAB.NUNOTA,
        CAB.DTNEG,
        CAB.OBSERVACAO,
        CAB.CODPARC,
        PAR.NOMEPARC,
        PAR.CGC_CPF,
        PAR.IDENTINSCESTAD,
        PAR.TELEFONE AS TELEFONE_CLIENTE,
        PAR.CEP,
        CAB.CODVEND,
        VEN.APELIDO AS VENDEDOR,
        CAB.CODPARCTRANSP,
        TRA.NOMEPARC AS TRANSPORTADORA,
        EMP.RAZAOSOCIAL AS NOME_EMPRESA,
        EMP.TELEFONE AS TELEFONE_EMPRESA,
        EMP.EMAIL AS EMAIL_EMPRESA,
        ENDC.NOMEEND AS ENDERECO_CLIENTE,
        PAR.NUMEND,
        BAI.NOMEBAI AS BAIRRO,
        CID.NOMECID AS CIDADE,
        UFS.UF,
        ENDE.NOMEEND AS LOGRADOURO_EMPRESA,
        EMP.NUMEND AS NUMERO_EMPRESA,
        BAIE.NOMEBAI AS BAIRRO_EMPRESA,
        CIDE.NOMECID AS CIDADE_EMPRESA,
        UFSE.UF AS UF_EMPRESA
      FROM TGFCAB CAB
      LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
      LEFT JOIN TGFPAR TRA ON TRA.CODPARC = CAB.CODPARCTRANSP
      LEFT JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
      LEFT JOIN TSIEND ENDC ON ENDC.CODEND = PAR.CODEND
      LEFT JOIN TSIBAI BAI ON BAI.CODBAI = PAR.CODBAI
      LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
      LEFT JOIN TSIEND ENDE ON ENDE.CODEND = EMP.CODEND
      LEFT JOIN TSIBAI BAIE ON BAIE.CODBAI = EMP.CODBAI
      LEFT JOIN TSICID CIDE ON CIDE.CODCID = EMP.CODCID
      LEFT JOIN TSIUFS UFSE ON UFSE.CODUF = CIDE.UF
      WHERE CAB.NUNOTA = ${nunota}
        AND CAB.TIPMOV = 'P'
        AND CAB.STATUSNOTA = 'L'
    `);

    if (!pedido) {
      res.status(404).json({ erro: 'Pedido confirmado nao encontrado' });
      return;
    }

    const itens = await executeQuery(`
      SELECT
        ITE.SEQUENCIA,
        ITE.CODPROD,
        PRO.DESCRPROD,
        ITE.CODVOL,
        CAST(NVL(ITE.QTDNEG, 0) AS NUMBER(15,3)) AS QTDNEG,
        ITE.CONTROLE,
        ITE.CODLOCALORIG AS LOCAL,
        PRO.CODGRUPOPROD,
        GRU.DESCRGRUPOPROD
      FROM TGFITE ITE
      LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
      LEFT JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
      WHERE ITE.NUNOTA = ${nunota}
      ORDER BY PRO.CODGRUPOPROD, ITE.SEQUENCIA
    `);

    pedido.ENDERECO_CLIENTE = [pedido.ENDERECO_CLIENTE, pedido.NUMEND].filter(Boolean).join(' - ');
    pedido.ENDERECO_EMPRESA = [
      [pedido.LOGRADOURO_EMPRESA, pedido.NUMERO_EMPRESA].filter(Boolean).join(', '),
      pedido.BAIRRO_EMPRESA,
      [pedido.CIDADE_EMPRESA, pedido.UF_EMPRESA].filter(Boolean).join('-')
    ].filter(Boolean).join(' - ');

    const pdf = await gerarPedidoVendaPdf({
      pedido,
      itens,
      logoPath: path.join(__dirname, 'frontend', 'favicon.png')
    });
    pedidoPrintStore.registrar(nunota, req.usuario?.codUsu);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="pedido-venda-${nunota}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar PDF do pedido', detalhes: err.message });
  }
});

router.get('/fila-conferencia/notas/:nunota/documentos/:tipo', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  const tipo = String(req.params.tipo || '').toLowerCase();

  if (!nunota || !['danfe', 'boleto'].includes(tipo)) {
    res.status(400).json({ erro: 'Informe uma nota e um tipo de documento validos' });
    return;
  }

  try {
    const [nota] = await executeQuery(`
      SELECT NUNOTA
      FROM TGFCAB
      WHERE NUNOTA = ${nunota}
        AND TIPMOV <> 'P'
        AND STATUSNOTA = 'L'
    `);

    if (!nota) {
      res.status(404).json({ erro: 'Nota faturada e confirmada nao encontrada' });
      return;
    }

    const pdf = await gerarDocumentoFiscalSankhya(nunota, tipo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${tipo}-${nunota}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(409).json({
      erro: `Nao foi possivel abrir ${tipo === 'danfe' ? 'o DANFE' : 'o boleto'}`,
      detalhes: err.message
    });
  }
});

router.post('/fila-conferencia/pedidos/:nunota/etiquetas-volume', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  const volumes = obterNumeroInteiro(req.body?.volumes);

  if (!nunota || !volumes) {
    res.status(400).json({ erro: 'Informe pedido e quantidade de volumes' });
    return;
  }

  try {
    const [pedido] = await executeQuery(`
      SELECT
        CAB.NUNOTA,
        CAB.NUCONFATUAL,
        CAB.CODPARC,
        PAR.RAZAOSOCIAL,
        PAR.NOMEPARC,
        CAB.CODPARCTRANSP,
        TRANSP.RAZAOSOCIAL AS TRANSPORTADORA,
        ENDE.TIPO AS TIPO_ENDERECO,
        ENDE.NOMEEND AS ENDERECO,
        PAR.NUMEND,
        BAI.NOMEBAI AS BAIRRO,
        CID.NOMECID AS CIDADE,
        UFS.UF
      FROM TGFCAB CAB
      LEFT JOIN TGFPAR PAR
        ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TGFPAR TRANSP
        ON TRANSP.CODPARC = CAB.CODPARCTRANSP
      LEFT JOIN TSIEND ENDE
        ON ENDE.CODEND = PAR.CODEND
      LEFT JOIN TSIBAI BAI
        ON BAI.CODBAI = PAR.CODBAI
      LEFT JOIN TSICID CID
        ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS
        ON UFS.CODUF = CID.UF
      WHERE CAB.NUNOTA = ${nunota}
    `);

    if (!pedido) {
      res.status(404).json({ erro: 'Pedido nao encontrado' });
      return;
    }

    await atualizarRegistroApi(
      'CabecalhoNota',
      { NUNOTA: nunota },
      { QTDVOL: volumes }
    );

    if (pedido.NUCONFATUAL) {
      await atualizarRegistroApi(
        'CabecalhoConferencia',
        { NUCONF: pedido.NUCONFATUAL },
        { QTDVOL: volumes }
      );
    }

    res.json({
      ok: true,
      volumes,
      etiqueta: {
        nunota: pedido.NUNOTA,
        codParc: pedido.CODPARC,
        nomeParc: pedido.NOMEPARC || pedido.RAZAOSOCIAL || `Parceiro ${pedido.CODPARC}`,
        razaoSocial: pedido.RAZAOSOCIAL || pedido.NOMEPARC || `Parceiro ${pedido.CODPARC}`,
        cidade: pedido.CIDADE || '',
        uf: pedido.UF || '',
        endereco: [
          [pedido.TIPO_ENDERECO, pedido.ENDERECO].filter(Boolean).join(' '),
          pedido.NUMEND ? `Nº:${pedido.NUMEND}` : '',
          pedido.BAIRRO
        ].filter(Boolean).join(' - '),
        transportadora: pedido.TRANSPORTADORA || 'TRANSPORTADORA NAO INFORMADA'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: 'Erro ao gerar etiqueta de volume',
      detalhesSankhya: [err.message].filter(Boolean)
    });
  }
});

router._internals = {
  normalizarDataSankhya,
  obterIntervaloDatas,
  extrairAvisosDocumento,
  extrairChaveDocumento,
  gerarDocumentoFiscalSankhya,
  obterDanfeArmazenado,
  obterSituacaoDocumentosPedido
};

module.exports = router;
