const express = require('express');
const multer = require('multer');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const router = express.Router();
const {
  downloadDirectFile,
  downloadGatewayFile,
  executeDirectService,
  executeQuery,
  executeRest,
  executeService
} = require('./api/sankhyaApi');
const { criarConferenciaTimerStore } = require('./api/conferenciaTimerStore');
const { criarConferenciaProgressStore } = require('./api/conferenciaProgressStore');
const {
  consolidarLeiturasEntrada,
  distribuirQuantidadeProporcional,
  distribuirValorProporcional,
  planejarControlesItensEntrada,
  planejarDesmembramentoLotesEntrada,
  planejarSincronizacaoDetalhesEntrada,
  validarDetalhesConferenciaEntrada,
  deveAplicarDivergenciaEntrada,
  conferenciaEntradaPodeSerReaberta,
  statusVisualConferencia,
  documentosAuxiliaresConferencia,
  retornoPossuiDocumentosAuxiliares
} = require('./api/conferenciaEntrada');
const { criarContatoStatusStore } = require('./api/contatoStatusStore');
const { gerarPedidoVendaPdf } = require('./api/pedidoVendaPdf');
const { gerarRomaneioCargaPdf } = require('./api/romaneioPdf');
const { criarPedidoPrintStore } = require('./api/pedidoPrintStore');
const { criarGuiaFaseStore } = require('./api/guiaFaseStore');
const { criarSeparacaoStore } = require('./api/separacaoStore');
const {
  criarEstoqueContagemStore,
  obterContagemAtual
} = require('./api/estoqueContagemStore');
const {
  montarSqlFiltrosCopiaEstoque,
  normalizarFiltrosCopiaEstoque
} = require('./api/estoqueContagemFiltros');
const {
  dividirEmLotes,
  extrairNunotaAjuste,
  montarPayloadNotaAjuste,
  planejarAjustesEstoque
} = require('./api/estoqueAjuste');
const bitrixService = require('./api/bitrixService');

const conferenciaTimerStore = criarConferenciaTimerStore();
const conferenciaProgressStore = criarConferenciaProgressStore();
const finalizacoesConferenciaEmAndamento = new Set();
const contatoStatusStore = criarContatoStatusStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const pedidoPrintStore = criarPedidoPrintStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const guiaFaseStore = criarGuiaFaseStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const separacaoStore = criarSeparacaoStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const estoqueContagemStore = criarEstoqueContagemStore({
  namespace: process.env.SANKHYA_API_BASE_URL || 'padrao'
});
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Cuiaba';
const SANKHYA_TIMEZONE = process.env.SANKHYA_TIMEZONE || 'America/Sao_Paulo';
const TOPS_CONFERENCIA = Object.freeze({
  saida: [5, 6, 237],
  entrada: [13, 21]
});
const TOPS_ROMANEIO = Object.freeze([10, 35]);
const TOPS_AJUSTE_ESTOQUE = Object.freeze({
  ENTRADA: 156,
  SAIDA: 157
});
const ajustesEstoqueEmAndamento = new Set();
const uploadGuiasFase = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, arquivo, callback) => {
    const permitidos = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!permitidos.has(String(arquivo.mimetype || '').toLowerCase())) {
      callback(new Error('Envie a Guia FASE em PDF, JPG, PNG ou WEBP.'));
      return;
    }
    callback(null, true);
  }
});

function ambienteSankhyaTeste() {
  const baseUrl = String(process.env.SANKHYA_API_BASE_URL || '').toLowerCase();
  return /sandbox|treinamento|teste/.test(baseUrl);
}

function obterModoConferencia(valor) {
  return String(valor || '').trim().toLowerCase() === 'entrada' ? 'entrada' : 'saida';
}

function obterTopsConferencia(modo) {
  return TOPS_CONFERENCIA[obterModoConferencia(modo)];
}

function sqlTopsConferencia(modo) {
  return obterTopsConferencia(modo).join(', ');
}

function tipoMovimentoConferencia(modo) {
  return obterModoConferencia(modo) === 'entrada' ? 'C' : 'P';
}

function condicaoStatusConferencia(modo, alias = 'CAB') {
  return obterModoConferencia(modo) === 'entrada'
    ? `${alias}.STATUSNOTA IN ('A', 'P', 'L')`
    : `${alias}.STATUSNOTA = 'L'`;
}

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

function formatarDataOrdemCarga(dataIso) {
  const match = String(dataIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

async function obterProximoCodigoOrdemCarga() {
  const [registro] = await executeQuery(`
    SELECT NVL(MAX(ORDEMCARGA), 0) + 1 AS PROXIMO_CODIGO
    FROM TGFORD
  `);
  const codigo = obterNumeroInteiro(registro?.PROXIMO_CODIGO);

  if (!codigo) {
    throw new Error('Não foi possível determinar o próximo código da Ordem de Carga.');
  }

  return codigo;
}

function erroCodigoOrdemCargaEmUso(error) {
  const mensagem = String(error?.message || '').toUpperCase();
  return error?.status === 409
    || mensagem.includes('ORA-00001')
    || mensagem.includes('UNIQUE')
    || mensagem.includes('JA EXISTE')
    || mensagem.includes('JÁ EXISTE');
}

async function criarOrdemCargaSankhya({ empresa, transportadora }) {
  const maxTentativas = 3;
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    const codigoSolicitado = await obterProximoCodigoOrdemCarga();

    try {
      const ordem = await executeRest('POST', 'v1/logistica/ordens-carga', {
        body: {
          codigoOrdemCarga: codigoSolicitado,
          codigoEmpresa: Number(empresa),
          dataInicio: formatarDataOrdemCarga(obterDataHoje()),
          codigoTransportadora: transportadora,
          tipo: 3,
          situacao: 1,
          observacoes: 'Gerado pela Fila de Conferência'
        }
      });
      const codigoRetornado = obterNumeroInteiro(
        ordem?.codigoOrdemCarga || ordem?.ordemCarga?.codigoOrdemCarga || ordem?.id
      );

      if (codigoRetornado !== codigoSolicitado) {
        throw new Error(
          `O Sankhya retornou a Ordem de Carga ${codigoRetornado || 'sem codigo'}, `
          + `mas o codigo solicitado foi ${codigoSolicitado}.`
        );
      }

      return codigoRetornado;
    } catch (error) {
      ultimoErro = error;
      if (!erroCodigoOrdemCargaEmUso(error) || tentativa === maxTentativas) {
        throw error;
      }
    }
  }

  throw ultimoErro || new Error('Não foi possível criar a Ordem de Carga.');
}

function obterTransportadorasRomaneio(valor, legado = null) {
  const origem = Array.isArray(valor)
    ? valor
    : String(valor ?? legado ?? '').split(',');
  return [...new Set(origem.map(obterNumeroInteiro).filter(Boolean))];
}

async function buscarNotasPendentesCarga({ empresa, transportadora, transportadoras, intervalo }) {
  const codigosTransportadoras = obterTransportadorasRomaneio(transportadoras, transportadora);
  const filtroTransportadora = codigosTransportadoras.length > 0
    ? `AND CAB.CODPARCTRANSP IN (${codigosTransportadoras.join(', ')})`
    : '';

  return executeQuery(`
    SELECT
      CAB.NUNOTA,
      CAB.NUMNOTA,
      CAB.DTNEG,
      CAB.CODEMP,
      CAB.CODTIPOPER,
      CASE
        WHEN CAB.CODTIPOPER = 10 THEN 'BONIFICACAO'
        ELSE 'VENDA'
      END AS TIPO_DOCUMENTO,
      CAB.CODPARC,
      PAR.RAZAOSOCIAL AS CLIENTE,
      CAB.CODPARCTRANSP,
      TRP.NOMEPARC AS TRANSPORTADORA,
      CAST(NVL(CAB.VLRNOTA, 0) AS NUMBER(15,2)) AS VLRNOTA,
      CAST(NVL(CAB.QTDVOL, 0) AS NUMBER(15,0)) AS QTDVOL,
      COUNT(ITE.SEQUENCIA) AS QTD_ITENS,
      SUM(NVL(ITE.QTDNEG, 0)) AS QTD_UNIDADES
    FROM TGFCAB CAB
    JOIN TGFPAR PAR
      ON PAR.CODPARC = CAB.CODPARC
    JOIN TGFPAR TRP
      ON TRP.CODPARC = CAB.CODPARCTRANSP
    LEFT JOIN TGFITE ITE
      ON ITE.NUNOTA = CAB.NUNOTA
    WHERE CAB.CODEMP = ${empresa}
      AND CAB.DTNEG >= TO_DATE('${intervalo.inicio}', 'YYYY-MM-DD')
      AND CAB.DTNEG < TO_DATE('${intervalo.fim}', 'YYYY-MM-DD') + 1
      AND CAB.CODTIPOPER IN (${TOPS_ROMANEIO.join(', ')})
      AND CAB.TIPMOV = 'V'
      AND CAB.STATUSNOTA = 'L'
      AND CAB.PENDENTE = 'N'
      AND NVL(CAB.ORDEMCARGA, 0) = 0
      AND NVL(CAB.CODPARCTRANSP, 0) > 0
      ${filtroTransportadora}
    GROUP BY CAB.NUNOTA, CAB.NUMNOTA, CAB.DTNEG, CAB.CODEMP, CAB.CODTIPOPER, CAB.CODPARC,
      PAR.RAZAOSOCIAL, CAB.CODPARCTRANSP, TRP.NOMEPARC, CAB.VLRNOTA, CAB.QTDVOL
    ORDER BY CAB.DTNEG, CAB.NUNOTA
  `);
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

function sqlListaNumerosContato(valores) {
  const numeros = valores.map(Number).filter((valor) => Number.isInteger(valor) && valor > 0);
  if (!numeros.length) return null;
  const grupos = [];
  for (let indice = 0; indice < numeros.length; indice += 900) {
    grupos.push(numeros.slice(indice, indice + 900).join(', '));
  }
  return grupos;
}

function sqlFiltroStatusContato(statusSelecionados) {
  if (statusSelecionados === null) return '';
  if (!statusSelecionados.length) return 'AND 1 = 0';

  const aguardando = Object.values(contatoStatusStore.state)
    .filter((registro) => registro?.status === 'aguardando')
    .map((registro) => registro.codParc);
  const atualizados = Object.values(contatoStatusStore.state)
    .filter((registro) => registro?.status === 'atualizado')
    .map((registro) => registro.codParc);
  const todosComStatus = [...new Set([...aguardando, ...atualizados])];
  const gruposAguardando = sqlListaNumerosContato(aguardando);
  const gruposAtualizados = sqlListaNumerosContato(atualizados);
  const gruposComStatus = sqlListaNumerosContato(todosComStatus);
  const emLista = (grupos) => grupos ? `(${grupos.map((grupo) => `PAR.CODPARC IN (${grupo})`).join(' OR ')})` : '1 = 0';
  const foraLista = gruposComStatus ? `(${gruposComStatus.map((grupo) => `PAR.CODPARC NOT IN (${grupo})`).join(' AND ')})` : '1 = 1';
  const condicoes = [];

  statusSelecionados.map((status) => status.toLocaleLowerCase('pt-BR')).forEach((status) => {
    if (status === 'aguardando') condicoes.push(emLista(gruposAguardando));
    if (status === 'atualizado') {
      condicoes.push(`(${emLista(gruposAtualizados)} OR (${foraLista} AND PAR.AD_DTATUCONTATO IS NOT NULL))`);
    }
    if (status === 'pendente') {
      condicoes.push(`(${foraLista} AND PAR.AD_DTATUCONTATO IS NULL)`);
    }
  });

  return condicoes.length ? `AND (${condicoes.join(' OR ')})` : 'AND 1 = 0';
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

function normalizarNomeBitrix(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function escaparHtmlBitrix(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function localizarFunilEtapaBitrix() {
  const nomeFunil = normalizarNomeBitrix(process.env.BITRIX_FUNNEL_NAME || 'Atualização Cadastral');
  const nomeEtapa = normalizarNomeBitrix(process.env.BITRIX_FUNNEL_STAGE || 'Aguardando Contato');
  const funis = await bitrixService.consultarFunisEtapas();
  const funil = funis.find(({ funil: item }) => {
    const nome = normalizarNomeBitrix(item.name ?? item.NAME);
    return nome === nomeFunil || nome.replace(/s$/, '') === nomeFunil.replace(/s$/, '');
  });
  if (!funil) throw new Error(`Funil Bitrix "${process.env.BITRIX_FUNNEL_NAME || 'Atualização Cadastral'}" não encontrado.`);
  const etapa = funil.etapas.find((item) => normalizarNomeBitrix(item.NAME ?? item.name) === nomeEtapa);
  if (!etapa) throw new Error(`Etapa Bitrix "${process.env.BITRIX_FUNNEL_STAGE || 'Aguardando Contato'}" nao encontrada.`);
  return { funil: funil.funil, etapa };
}

function obterMapaUsuariosBitrix() {
  try {
    const mapa = JSON.parse(process.env.BITRIX_USER_MAP || '{}');
    return mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? mapa : {};
  } catch {
    throw new Error('BITRIX_USER_MAP possui JSON invalido.');
  }
}

async function resolverResponsavelBitrix(usuarioSessao = {}) {
  const codUsu = obterNumeroInteiro(usuarioSessao.codUsu);
  const [usuarioSankhya] = codUsu ? await executeQuery(`
    SELECT CODUSU, NOMEUSU
    FROM TSIUSU
    WHERE CODUSU = ${codUsu}
  `) : [];
  const nomeSankhya = String(usuarioSankhya?.NOMEUSU || usuarioSessao.nome || '').trim();
  if (!nomeSankhya) throw new Error('Não foi possível identificar o usuário logado no Sankhya.');

  try {
    const usuarioBitrix = await bitrixService.buscarUsuarioPorNome(nomeSankhya);
    const id = obterNumeroInteiro(usuarioBitrix.ID ?? usuarioBitrix.id);
    if (id) {
      return {
        id,
        nomeSankhya,
        nomeBitrix: [usuarioBitrix.NAME, usuarioBitrix.SECOND_NAME, usuarioBitrix.LAST_NAME].filter(Boolean).join(' '),
        origem: 'nome'
      };
    }
  } catch (error) {
    console.warn(`[Bitrix24] Nao foi possivel localizar o responsavel por nome: ${error.message}`);
  }

  const mapa = obterMapaUsuariosBitrix();
  const idMapeado = obterNumeroInteiro(mapa[String(codUsu)] ?? mapa[normalizarNomeBitrix(nomeSankhya)] ?? mapa[nomeSankhya]);
  if (idMapeado) return { id: idMapeado, nomeSankhya, origem: 'configuracao' };

  const idPadrao = obterNumeroInteiro(process.env.BITRIX_DEFAULT_ASSIGNED_BY_ID) || 132;
  return {
    id: idPadrao,
    nomeSankhya,
    origem: 'responsavel-padrao'
  };
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

function adicionarCodigoConferencia(lista, codigo, tipo, multiplicador = 1, descricao = '', metadados = {}) {
  if (!valorPreenchido(codigo)) return;

  const codigoNormalizado = String(codigo).trim();
  const fator = normalizarNumero(multiplicador) || 1;
  const jaExiste = lista.some((item) => String(item.codigo).trim().toUpperCase() === codigoNormalizado.toUpperCase());

  if (!jaExiste) {
    lista.push({
      codigo: codigoNormalizado,
      tipo,
      multiplicador: fator,
      descricao,
      codVol: metadados.codVol || ''
    });
  }
}

function obterPartesDataHoraNoFuso(data, timeZone = APP_TIMEZONE) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(data);

  return Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
}

function formatarDataHoraSankhya(data = new Date(), timeZone = APP_TIMEZONE) {
  const mapa = obterPartesDataHoraNoFuso(data, timeZone);
  return `${mapa.day}/${mapa.month}/${mapa.year} ${mapa.hour}:${mapa.minute}:${mapa.second}`;
}

function formatarDataHoraLocalISO(data) {
  const mapa = obterPartesDataHoraNoFuso(data);
  return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}:${mapa.second}`;
}

function criarDataNoFuso({ ano, mes, dia, hora = '00', minuto = '00', segundo = '00' }, timeZone) {
  const horarioDesejadoUtc = Date.UTC(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo)
  );
  let data = new Date(horarioDesejadoUtc);

  // Converte um horário civil sem offset para o instante real do fuso informado.
  // A segunda passagem também cobre eventuais transições históricas de horário de verão.
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const partes = obterPartesDataHoraNoFuso(data, timeZone);
    const horarioObtidoUtc = Date.UTC(
      Number(partes.year),
      Number(partes.month) - 1,
      Number(partes.day),
      Number(partes.hour),
      Number(partes.minute),
      Number(partes.second)
    );
    data = new Date(data.getTime() + horarioDesejadoUtc - horarioObtidoUtc);
  }

  return data;
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

async function aplicarDivergenciaEntradaNativa(nunota, qtdVol = 0) {
  return executeService(
    'ConferenciaSP.cortar',
    {
      params: {
        nuNota: nunota,
        peso: 0,
        qtdVol: Math.max(0, normalizarNumero(qtdVol))
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
          DEST.CODEMP,
          NVL(DEST.ORDEMCARGA, 0) AS ORDEMCARGA,
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
          CAB.CODEMP,
          NVL(CAB.ORDEMCARGA, 0) AS ORDEMCARGA,
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
      danfe: { disponivel: false, motivo: 'Pedido ainda não faturado.' },
      boleto: { disponivel: false, motivo: 'Pedido ainda não faturado.' }
    };
  }

  const [situacao] = await executeQuery(`
    SELECT
      CAB.NUNOTA,
      CAB.NUMNOTA,
      CAB.CODEMP,
      NVL(CAB.ORDEMCARGA, 0) AS ORDEMCARGA,
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
      NUMNOTA: situacao?.NUMNOTA ?? nota.NUMNOTA,
      CODEMP: situacao?.CODEMP ?? nota.CODEMP,
      ORDEMCARGA: normalizarNumero(situacao?.ORDEMCARGA ?? nota.ORDEMCARGA)
    },
    danfe: {
      disponivel: nfeAutorizada,
      motivo: nfeAutorizada ? null : 'DANFE aguardando autorizacao da NF-e.'
    },
    boleto: {
      disponivel: possuiFinanceiro,
      motivo: possuiFinanceiro ? null : 'A nota não possui título financeiro para boleto.'
    }
  };
}

async function pedidoNecessitaGuiaFase(nunotaPedido) {
  const [registro] = await executeQuery(`
    SELECT COUNT(*) AS QUANTIDADE
    FROM TGFITE ITE
    INNER JOIN TGFPRO PRO
      ON PRO.CODPROD = ITE.CODPROD
    WHERE ITE.NUNOTA = ${nunotaPedido}
      AND PRO.CODGRUPOPROD IN (
        SELECT GRU.CODGRUPOPROD
        FROM TGFGRU GRU
        START WITH
          UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%WINNER%'
          OR UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%COMODIT%'
          OR UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%COMMODIT%'
        CONNECT BY NOCYCLE PRIOR GRU.CODGRUPOPROD = GRU.CODGRUPAI
      )
  `);
  return normalizarNumero(registro?.QUANTIDADE) > 0;
}

function receberGuiasFase(req, res, next) {
  uploadGuiasFase.array('arquivos', 10)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const limite = error.code === 'LIMIT_FILE_SIZE'
      ? 'Cada Guia FASE pode ter no maximo 10 MB.'
      : error.code === 'LIMIT_FILE_COUNT'
        ? 'Envie no maximo 10 arquivos por vez.'
        : error.message;
    res.status(400).json({ erro: limite || 'Nao foi possivel receber os arquivos.' });
  });
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
    throw new Error('A nota faturada não possui títulos financeiros para gerar boleto.');
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
    throw new Error('A conta bancária do título não possui banco ou modelo de boleto configurado no Sankhya.');
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
    throw new Error(extrairAvisosDocumento(resultado).join(' ') || 'O Sankhya não retornou a chave de visualização do boleto.');
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
      ? `${process.env.SANKHYA_OM_BASE_URL ? '' : ' Configure SANKHYA_OM_BASE_URL com o endereço direto do ambiente Sankhya.'} Confira também o parâmetro VERPDFBOLPORTAL e a configuração de impressão da TOP, negociação, parceiro e conta.`
      : '';
    throw new Error(`${avisos.join(' ') || `O Sankhya nao gerou o PDF de ${tipo.toUpperCase()}.`}${complemento}`);
  }

  if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error(`O Sankhya retornou um arquivo invalido para ${tipo.toUpperCase()}.`);
  }

  return pdf;
}

async function gerarDocumentosFiscaisCombinados(nunota) {
  const resultados = await Promise.allSettled([
    gerarDocumentoFiscalSankhya(nunota, 'danfe'),
    gerarDocumentoFiscalSankhya(nunota, 'boleto')
  ]);
  const arquivos = resultados
    .filter((resultado) => resultado.status === 'fulfilled')
    .map((resultado) => resultado.value);

  if (arquivos.length === 0) {
    const detalhes = resultados
      .filter((resultado) => resultado.status === 'rejected')
      .map((resultado) => resultado.reason?.message)
      .filter(Boolean)
      .join(' ');
    throw new Error(detalhes || 'O Sankhya não retornou DANFE nem boleto.');
  }

  if (arquivos.length === 1) {
    return arquivos[0];
  }

  const destino = await PDFDocument.create();

  for (const arquivo of arquivos) {
    const origem = await PDFDocument.load(arquivo);
    const paginas = await destino.copyPages(origem, origem.getPageIndices());
    paginas.forEach((pagina) => destino.addPage(pagina));
  }

  return Buffer.from(await destino.save());
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
    return 'Status D: o Sankhya classificou a conferência como divergente/não finalizada.';
  }

  if (statusNormalizado === 'A') {
    return 'Status A: a conferência continua em andamento no Sankhya.';
  }

  if (statusNormalizado === 'F') {
    return 'Status F: conferência finalizada.';
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

function numeroApiPreciso(valor) {
  const numero = normalizarNumero(valor);
  return numero.toFixed(10).replace(/0+$/, '').replace(/\.$/, '') || '0';
}

async function salvarQuantidadeLoteItemNotaApi(nunota, item, dados, incluir = false) {
  return executeService(
    'CACSP.incluirAlterarItemNota',
    {
      nota: {
        NUNOTA: String(nunota),
        itens: {
          item: {
            CODPROD: campoApi(item.CODPROD),
            NUNOTA: campoApi(nunota),
            SEQUENCIA: campoApi(incluir ? '' : item.SEQUENCIA),
            QTDNEG: campoApi(numeroApiPreciso(dados.quantidade)),
            VLRUNIT: campoApi(numeroApiPreciso(item.VLRUNIT)),
            VLRTOT: campoApi(numeroApiPreciso(dados.vlrTot)),
            CODVOL: campoApi(item.CODVOL || 'UN'),
            CODLOCALORIG: campoApi(item.CODLOCALORIG || 0),
            CONTROLE: campoApi(dados.controle || ''),
            VLRDESC: campoApi(numeroApiPreciso(dados.vlrDesc)),
            PERCDESC: campoApi(numeroApiPreciso(item.PERCDESC || 0))
          }
        }
      }
    },
    { modulePath: 'mgecom', forceAccessSession: true }
  );
}

async function excluirItemNotaApi(nunota, sequencia) {
  return executeService(
    'CACSP.excluirItemNota',
    {
      nota: {
        itens: {
          item: {
            NUNOTA: campoApi(nunota),
            SEQUENCIA: campoApi(sequencia)
          }
        }
      }
    },
    { modulePath: 'mgecom', forceAccessSession: true }
  );
}

async function consultarSequenciasNota(nunota) {
  const linhas = await executeQuery(`
    SELECT SEQUENCIA
    FROM TGFITE
    WHERE NUNOTA = ${nunota}
    ORDER BY SEQUENCIA
  `);
  return new Set(linhas.map((linha) => Number(linha.SEQUENCIA)));
}

async function consultarVinculosAtendimentoItem(nunota, sequencia) {
  return executeQuery(`
    SELECT *
    FROM TGFVAR
    WHERE NUNOTA = ${nunota}
      AND SEQUENCIA = ${sequencia}
    ORDER BY NUNOTAORIG, SEQUENCIAORIG
  `);
}

function chaveVinculoAtendimento(vinculo) {
  return [
    Number(vinculo.NUNOTAORIG),
    Number(vinculo.SEQUENCIAORIG)
  ].join('|');
}

async function atualizarQuantidadeVinculoAtendimento(vinculo, quantidade) {
  await atualizarRegistroApi(
    'CompraVendavariosPedido',
    {
      NUNOTA: vinculo.NUNOTA,
      SEQUENCIA: vinculo.SEQUENCIA,
      NUNOTAORIG: vinculo.NUNOTAORIG,
      SEQUENCIAORIG: vinculo.SEQUENCIAORIG
    },
    {
      QTDATENDIDA: numeroApiPreciso(quantidade),
      STATUSNOTA: vinculo.STATUSNOTA || 'P'
    }
  );
}

async function aplicarVinculosAtendimentoDesmembramento({
  nunota,
  vinculosOriginais,
  gruposAplicados
}) {
  if (vinculosOriginais.length === 0) return;

  const quantidadesLotes = gruposAplicados.map((grupo) => grupo.quantidade);
  for (const vinculoOriginal of vinculosOriginais) {
    const quantidadesAtendidas = distribuirQuantidadeProporcional(
      vinculoOriginal.QTDATENDIDA,
      quantidadesLotes
    );

    for (let indice = 0; indice < gruposAplicados.length; indice += 1) {
      const grupo = gruposAplicados[indice];
      const quantidadeAtendida = quantidadesAtendidas[indice];
      if (indice === 0) {
        await atualizarQuantidadeVinculoAtendimento({
          ...vinculoOriginal,
          NUNOTA: nunota,
          SEQUENCIA: grupo.sequencia
        }, quantidadeAtendida);
        continue;
      }

      const vinculosLinha = await consultarVinculosAtendimentoItem(nunota, grupo.sequencia);
      const vinculoExistente = vinculosLinha.find(
        (vinculo) => chaveVinculoAtendimento(vinculo) === chaveVinculoAtendimento(vinculoOriginal)
      );
      if (vinculoExistente) {
        await atualizarQuantidadeVinculoAtendimento(vinculoExistente, quantidadeAtendida);
      } else {
        await salvarRegistroApi('CompraVendavariosPedido', {
          NUNOTA: nunota,
          SEQUENCIA: grupo.sequencia,
          NUNOTAORIG: vinculoOriginal.NUNOTAORIG,
          SEQUENCIAORIG: vinculoOriginal.SEQUENCIAORIG,
          QTDATENDIDA: numeroApiPreciso(quantidadeAtendida),
          STATUSNOTA: vinculoOriginal.STATUSNOTA || 'P'
        });
      }
    }
  }
}

async function validarVinculosAtendimentoDesmembramento({
  nunota,
  itemOriginal,
  vinculosOriginais,
  gruposAplicados
}) {
  if (vinculosOriginais.length === 0) return;

  const sequencias = gruposAplicados.map((grupo) => Number(grupo.sequencia));
  const vinculosAtuais = await executeQuery(`
    SELECT NUNOTA, SEQUENCIA, NUNOTAORIG, SEQUENCIAORIG, QTDATENDIDA, STATUSNOTA
    FROM TGFVAR
    WHERE NUNOTA = ${nunota}
      AND SEQUENCIA IN (${sequencias.join(',')})
    ORDER BY SEQUENCIA, NUNOTAORIG, SEQUENCIAORIG
  `);
  const originaisPorChave = new Map(
    vinculosOriginais.map((vinculo) => [chaveVinculoAtendimento(vinculo), vinculo])
  );

  for (const [chave, original] of originaisPorChave) {
    const totalAtual = vinculosAtuais
      .filter((vinculo) => chaveVinculoAtendimento(vinculo) === chave)
      .reduce((total, vinculo) => total + normalizarNumero(vinculo.QTDATENDIDA), 0);
    if (Math.abs(totalAtual - normalizarNumero(original.QTDATENDIDA)) > 0.0001) {
      throw new Error(
        `O atendimento do pedido de origem do produto ${itemOriginal.CODPROD} nao foi preservado.`
      );
    }
  }

  const totalOriginal = vinculosOriginais
    .reduce((total, vinculo) => total + normalizarNumero(vinculo.QTDATENDIDA), 0);
  if (Math.abs(totalOriginal - normalizarNumero(itemOriginal.QTDNEG)) <= 0.0001) {
    for (const grupo of gruposAplicados) {
      const totalLinha = vinculosAtuais
        .filter((vinculo) => Number(vinculo.SEQUENCIA) === Number(grupo.sequencia))
        .reduce((total, vinculo) => total + normalizarNumero(vinculo.QTDATENDIDA), 0);
      if (Math.abs(totalLinha - normalizarNumero(grupo.quantidade)) > 0.0001) {
        throw new Error(`A linha do lote ${grupo.controle} ficou sem atendimento completo do pedido.`);
      }
    }
  }
}

function camposCabecalhoAlteradosPeloDesmembramento(antes, depois) {
  return Object.keys(antes || {}).filter((campo) => {
    if (!/^(BASE|VLR)/.test(campo)) return false;
    const valorAntes = Number(antes[campo]);
    const valorDepois = Number(depois?.[campo]);
    return Number.isFinite(valorAntes)
      && Number.isFinite(valorDepois)
      && Math.abs(valorAntes - valorDepois) > 0.000001;
  });
}

async function reconciliarTotaisDesmembramento({
  nunota,
  sequenciaOriginal,
  itemOriginal,
  cabecalhoOriginal,
  sequenciasCriadas
}) {
  const [cabecalhoAtual] = await executeQuery(`SELECT * FROM TGFCAB WHERE NUNOTA = ${nunota}`);
  const [itemAtual] = await executeQuery(`
    SELECT *
    FROM TGFITE
    WHERE NUNOTA = ${nunota}
      AND SEQUENCIA = ${sequenciaOriginal}
  `);
  const camposAlterados = camposCabecalhoAlteradosPeloDesmembramento(cabecalhoOriginal, cabecalhoAtual);
  const camposItem = {};
  const camposCabecalho = {};

  for (const campo of camposAlterados) {
    camposCabecalho[campo] = cabecalhoOriginal[campo];
    if (!Object.prototype.hasOwnProperty.call(itemOriginal, campo)) continue;

    const valorOriginal = Number(itemOriginal[campo]);
    const valorAtual = Number(itemAtual?.[campo]);
    const acrescimoCabecalho = Number(cabecalhoAtual[campo]) - Number(cabecalhoOriginal[campo]);
    if (Number.isFinite(valorOriginal) && Number.isFinite(valorAtual) && Number.isFinite(acrescimoCabecalho)) {
      camposItem[campo] = numeroApiPreciso(valorAtual - acrescimoCabecalho);
    }
  }

  if (sequenciasCriadas.length > 0 && Object.prototype.hasOwnProperty.call(itemOriginal, 'ALIQICMSRED')) {
    const [itemCriado] = await executeQuery(`
      SELECT ALIQICMSRED
      FROM TGFITE
      WHERE NUNOTA = ${nunota}
        AND SEQUENCIA = ${sequenciasCriadas[0]}
    `);
    if (itemCriado?.ALIQICMSRED !== null && itemCriado?.ALIQICMSRED !== undefined) {
      camposItem.ALIQICMSRED = itemCriado.ALIQICMSRED;
    }
  }

  if (Object.keys(camposItem).length > 0) {
    await atualizarRegistroApi(
      'ItemNota',
      { NUNOTA: nunota, SEQUENCIA: sequenciaOriginal },
      camposItem
    );
  }
  if (Object.keys(camposCabecalho).length > 0) {
    await atualizarRegistroApi('CabecalhoNota', { NUNOTA: nunota }, camposCabecalho);
  }

  return {
    camposItem,
    camposCabecalho
  };
}

async function validarDesmembramentoLotes({
  nunota,
  itemOriginal,
  cabecalhoOriginal,
  gruposAplicados,
  camposItemCorrigidos = []
}) {
  const sequencias = gruposAplicados.map((grupo) => Number(grupo.sequencia));
  const camposFinanceiros = camposItemCorrigidos.filter(
    (campo) => /^(BASE|VLR)/.test(campo) && !['VLRTOT', 'VLRDESC'].includes(campo)
  );
  const camposExtrasSql = camposFinanceiros.length > 0 ? `, ${camposFinanceiros.join(', ')}` : '';
  const linhas = await executeQuery(`
    SELECT SEQUENCIA, CONTROLE, QTDNEG, VLRTOT, VLRDESC${camposExtrasSql}
    FROM TGFITE
    WHERE NUNOTA = ${nunota}
      AND SEQUENCIA IN (${sequencias.join(',')})
    ORDER BY SEQUENCIA
  `);
  const linhasPorSequencia = new Map(linhas.map((linha) => [Number(linha.SEQUENCIA), linha]));

  for (const grupo of gruposAplicados) {
    const linha = linhasPorSequencia.get(Number(grupo.sequencia));
    if (!linha) throw new Error(`A linha do lote ${grupo.controle} nao foi gravada no Sankhya.`);
    if (String(linha.CONTROLE ?? '').trim() !== String(grupo.controle ?? '').trim()) {
      throw new Error(`O lote ${grupo.controle} nao foi aplicado corretamente na nota.`);
    }
    if (Math.abs(normalizarNumero(linha.QTDNEG) - normalizarNumero(grupo.quantidade)) > 0.0001) {
      throw new Error(`A quantidade do lote ${grupo.controle} nao foi aplicada corretamente na nota.`);
    }
  }

  const soma = (campo) => linhas.reduce((total, linha) => total + normalizarNumero(linha[campo]), 0);
  if (Math.abs(soma('QTDNEG') - normalizarNumero(itemOriginal.QTDNEG)) > 0.0001) {
    throw new Error(`A quantidade total do produto ${itemOriginal.CODPROD} mudou ao separar os lotes.`);
  }
  if (Math.abs(soma('VLRTOT') - normalizarNumero(itemOriginal.VLRTOT)) > 0.01) {
    throw new Error(`O valor total do produto ${itemOriginal.CODPROD} mudou ao separar os lotes.`);
  }
  if (Math.abs(soma('VLRDESC') - normalizarNumero(itemOriginal.VLRDESC)) > 0.01) {
    throw new Error(`O desconto do produto ${itemOriginal.CODPROD} mudou ao separar os lotes.`);
  }
  for (const campo of camposFinanceiros) {
    if (Math.abs(soma(campo) - normalizarNumero(itemOriginal[campo])) > 0.01) {
      throw new Error(`O total ${campo} do produto ${itemOriginal.CODPROD} mudou ao separar os lotes.`);
    }
  }

  const [cabecalhoAtual] = await executeQuery(`SELECT * FROM TGFCAB WHERE NUNOTA = ${nunota}`);
  const totaisAlterados = camposCabecalhoAlteradosPeloDesmembramento(cabecalhoOriginal, cabecalhoAtual);
  if (totaisAlterados.length > 0) {
    throw new Error(
      `Os totalizadores da nota mudaram ao separar os lotes (${totaisAlterados.slice(0, 5).join(', ')}).`
    );
  }
}

async function desmembrarItensEntradaPorLote({ nunota, itensPedido, itensInformados }) {
  const planos = planejarDesmembramentoLotesEntrada(itensPedido, itensInformados);
  if (planos.length === 0) {
    return { separacoes: [], itensPedido };
  }

  const operacoes = [];

  try {
    for (const plano of planos) {
      const itemOriginal = itensPedido.find(
        (item) => Number(item.SEQUENCIA) === Number(plano.sequencia)
      );
      if (!itemOriginal) throw new Error(`Item ${plano.sequencia} nao encontrado para separar os lotes.`);

      const [cabecalhoOriginal] = await executeQuery(`SELECT * FROM TGFCAB WHERE NUNOTA = ${nunota}`);
      const vinculosOriginais = await consultarVinculosAtendimentoItem(
        nunota,
        Number(itemOriginal.SEQUENCIA)
      );
      const quantidades = plano.grupos.map((grupo) => grupo.quantidade);
      const totais = distribuirValorProporcional(itemOriginal.VLRTOT, quantidades);
      const descontos = distribuirValorProporcional(itemOriginal.VLRDESC, quantidades);
      const sequenciasCriadas = [];
      const gruposAplicados = [];
      const operacao = {
        itemOriginal: { ...itemOriginal },
        cabecalhoOriginal: { ...cabecalhoOriginal },
        vinculosOriginais: vinculosOriginais.map((vinculo) => ({ ...vinculo })),
        sequenciasCriadas,
        camposItemCorrigidos: []
      };
      operacoes.push(operacao);

      for (let indice = 0; indice < plano.grupos.length; indice += 1) {
        const grupo = plano.grupos[indice];
        const dados = {
          quantidade: grupo.quantidade,
          controle: grupo.controle,
          vlrTot: totais[indice],
          vlrDesc: descontos[indice]
        };

        if (indice === 0) {
          await salvarQuantidadeLoteItemNotaApi(nunota, itemOriginal, dados, false);
          gruposAplicados.push({ ...grupo, sequencia: Number(itemOriginal.SEQUENCIA) });
          continue;
        }

        const antesInclusao = await consultarSequenciasNota(nunota);
        await salvarQuantidadeLoteItemNotaApi(nunota, itemOriginal, dados, true);
        const depoisInclusao = await consultarSequenciasNota(nunota);
        const novas = [...depoisInclusao].filter((sequencia) => !antesInclusao.has(sequencia));
        if (novas.length !== 1) {
          throw new Error(`O Sankhya nao retornou uma nova linha unica para o lote ${grupo.controle}.`);
        }
        sequenciasCriadas.push(novas[0]);
        gruposAplicados.push({ ...grupo, sequencia: novas[0] });
      }

      const reconciliacao = await reconciliarTotaisDesmembramento({
        nunota,
        sequenciaOriginal: Number(itemOriginal.SEQUENCIA),
        itemOriginal,
        cabecalhoOriginal,
        sequenciasCriadas
      });
      operacao.camposItemCorrigidos = Object.keys(reconciliacao.camposItem);
      await aplicarVinculosAtendimentoDesmembramento({
        nunota,
        vinculosOriginais,
        gruposAplicados
      });
      await validarDesmembramentoLotes({
        nunota,
        itemOriginal,
        cabecalhoOriginal,
        gruposAplicados,
        camposItemCorrigidos: Object.keys(reconciliacao.camposItem)
      });
      await validarVinculosAtendimentoDesmembramento({
        nunota,
        itemOriginal,
        vinculosOriginais,
        gruposAplicados
      });

      const indiceInformado = itensInformados.findIndex(
        (item) => Number(item.sequencia) === Number(plano.sequencia)
      );
      const itemInformado = itensInformados[indiceInformado];
      const itensDesmembrados = gruposAplicados.map((grupo) => ({
        ...itemInformado,
        sequencia: grupo.sequencia,
        qtdConferida: grupo.quantidade,
        qtdCortada: 0,
        leituras: grupo.leituras
      }));
      itensInformados.splice(indiceInformado, 1, ...itensDesmembrados);

      operacao.resultado = {
        sequenciaOriginal: Number(itemOriginal.SEQUENCIA),
        codProd: Number(itemOriginal.CODPROD),
        lotes: gruposAplicados.map((grupo) => ({
          sequencia: grupo.sequencia,
          controle: grupo.controle,
          quantidade: grupo.quantidade
        }))
      };
    }
  } catch (erro) {
    for (const operacao of [...operacoes].reverse()) {
      for (const sequencia of [...operacao.sequenciasCriadas].reverse()) {
        try {
          await excluirItemNotaApi(nunota, sequencia);
        } catch (erroExclusao) {
          console.error('Falha ao desfazer item criado na separacao por lote:', erroExclusao);
        }
      }

      try {
        await salvarQuantidadeLoteItemNotaApi(nunota, operacao.itemOriginal, {
          quantidade: operacao.itemOriginal.QTDNEG,
          controle: operacao.itemOriginal.CONTROLE,
          vlrTot: operacao.itemOriginal.VLRTOT,
          vlrDesc: operacao.itemOriginal.VLRDESC
        }, false);

        const camposItem = Object.fromEntries(
          operacao.camposItemCorrigidos
            .filter((campo) => Object.prototype.hasOwnProperty.call(operacao.itemOriginal, campo))
            .map((campo) => [campo, operacao.itemOriginal[campo]])
        );
        if (Object.keys(camposItem).length > 0) {
          await atualizarRegistroApi(
            'ItemNota',
            { NUNOTA: nunota, SEQUENCIA: operacao.itemOriginal.SEQUENCIA },
            camposItem
          );
        }

        for (const vinculoOriginal of operacao.vinculosOriginais) {
          await atualizarQuantidadeVinculoAtendimento(vinculoOriginal, vinculoOriginal.QTDATENDIDA);
        }

        const [cabecalhoAtual] = await executeQuery(`SELECT * FROM TGFCAB WHERE NUNOTA = ${nunota}`);
        const camposCabecalho = Object.fromEntries(
          camposCabecalhoAlteradosPeloDesmembramento(operacao.cabecalhoOriginal, cabecalhoAtual)
            .map((campo) => [campo, operacao.cabecalhoOriginal[campo]])
        );
        if (Object.keys(camposCabecalho).length > 0) {
          await atualizarRegistroApi('CabecalhoNota', { NUNOTA: nunota }, camposCabecalho);
        }
      } catch (erroRestauracao) {
        console.error('Falha ao restaurar item apos erro na separacao por lote:', erroRestauracao);
      }
    }
    throw erro;
  }

  const itensAtualizados = await executeQuery(`
    SELECT CAB.CODEMP, ITE.*
    FROM TGFITE ITE
    JOIN TGFCAB CAB ON CAB.NUNOTA = ITE.NUNOTA
    WHERE ITE.NUNOTA = ${nunota}
    ORDER BY ITE.SEQUENCIA
  `);

  return {
    separacoes: operacoes.map((operacao) => operacao.resultado),
    itensPedido: itensAtualizados
  };
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
      DHFINCONF: formatarDataHoraSankhya(new Date(), SANKHYA_TIMEZONE),
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
    campos.DHFINCONF = formatarDataHoraSankhya(new Date(), SANKHYA_TIMEZONE);
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

const filasSincronizacaoEntrada = new Map();
let filaCriacaoConferenciaEntrada = Promise.resolve();

function enfileirarSincronizacaoEntrada(nunota, tarefa) {
  const chave = String(nunota);
  const anterior = filasSincronizacaoEntrada.get(chave) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(tarefa);
  filasSincronizacaoEntrada.set(chave, atual);
  return atual.finally(() => {
    if (filasSincronizacaoEntrada.get(chave) === atual) filasSincronizacaoEntrada.delete(chave);
  });
}

function criarConferenciaEntradaNativa({ nunota, codUsu, qtdVol }) {
  const tarefa = filaCriacaoConferenciaEntrada.catch(() => {}).then(async () => {
    const [existente] = await executeQuery(`
      SELECT C2.NUCONF
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 C2 ON C2.NUCONF = CAB.NUCONFATUAL
      WHERE CAB.NUNOTA = ${nunota}
        AND C2.STATUS = 'A'
    `);
    if (existente?.NUCONF) return Number(existente.NUCONF);

    const [proximo] = await executeQuery(`
      SELECT NVL(MAX(NUCONF), 0) + 1 AS NUCONF
      FROM (
        SELECT NUCONF FROM TGFCON2
        UNION ALL
        SELECT NUCONF FROM TGFCON
      )
    `);
    const nuconf = Number(proximo.NUCONF);
    await salvarRegistroApi('CabecalhoConferencia', {
      NUCONF: nuconf,
      NUNOTAORIG: nunota,
      STATUS: 'A',
      DHINICONF: formatarDataHoraSankhya(),
      CODUSUCONF: codUsu,
      QTDVOL: Math.max(0, normalizarNumero(qtdVol))
    });
    await atualizarRegistroApi('CabecalhoNota', { NUNOTA: nunota }, { NUCONFATUAL: nuconf });
    return nuconf;
  });
  filaCriacaoConferenciaEntrada = tarefa;
  return tarefa;
}

async function sincronizarDetalhesConferenciaEntrada({ nuconf, nunota, itens }) {
  const itensNota = await executeQuery(`
    SELECT
      ITE.SEQUENCIA,
      ITE.CODPROD,
      ITE.CODVOL,
      NVL(PRO.CODVOL, ITE.CODVOL) AS CODVOLPADRAO,
      NVL(TRIM(ITE.CONTROLE), ' ') AS CONTROLE,
      NVL(ITE.QTDNEG, 0) AS QTDNEG,
      NVL(ITE.GTINNFE, ITE.PRODUTONFE) AS CODBARRA
    FROM TGFITE ITE
    LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
    WHERE ITE.NUNOTA = ${nunota}
    ORDER BY ITE.SEQUENCIA
  `);
  const detalhesDesejados = consolidarLeiturasEntrada(itensNota, itens);
  const detalhesExistentes = await executeQuery(`
    SELECT
      SEQCONF,
      CODPROD,
      CODVOL,
      NVL(TRIM(CONTROLE), ' ') AS CONTROLE,
      CODBARRA,
      NVL(QTDCONF, 0) AS QTDCONF,
      NVL(QTDCONFVOLPAD, 0) AS QTDCONFVOLPAD
    FROM TGFCOI2
    WHERE NUCONF = ${nuconf}
    ORDER BY SEQCONF
  `);
  const plano = planejarSincronizacaoDetalhesEntrada(detalhesExistentes, detalhesDesejados);
  const dhAlter = formatarDataHoraSankhya();

  for (const atribuicao of plano.atribuicoes) {
    const { detalhe, seqConf } = atribuicao;
    const campos = {
      ...detalhe,
      QTDCONF: numeroApi(detalhe.QTDCONF),
      QTDCONFVOLPAD: numeroApi(detalhe.QTDCONFVOLPAD),
      DHALTER: dhAlter
    };
    if (atribuicao.existente) {
      await atualizarRegistroApi('DetalhesConferencia', { NUCONF: nuconf, SEQCONF: seqConf }, campos);
    } else {
      await salvarRegistroApi('DetalhesConferencia', { NUCONF: nuconf, SEQCONF: seqConf, ...campos });
    }
  }

  for (const seqConf of plano.sequenciasObsoletas) {
    await atualizarRegistroApi(
      'DetalhesConferencia',
      { NUCONF: nuconf, SEQCONF: seqConf },
      { QTDCONF: 0, QTDCONFVOLPAD: 0, DHALTER: dhAlter }
    );
  }

  const detalhesGravados = await executeQuery(`
    SELECT
      SEQCONF,
      CODPROD,
      CODVOL,
      NVL(TRIM(CONTROLE), ' ') AS CONTROLE,
      CODBARRA,
      NVL(QTDCONF, 0) AS QTDCONF,
      NVL(QTDCONFVOLPAD, 0) AS QTDCONFVOLPAD
    FROM TGFCOI2
    WHERE NUCONF = ${nuconf}
    ORDER BY SEQCONF
  `);
  const validacao = validarDetalhesConferenciaEntrada(detalhesDesejados, detalhesGravados);
  if (!validacao.valido) {
    throw new Error(
      `A conferencia de entrada nao foi gravada integralmente no Sankhya. ${validacao.erros.slice(0, 5).join('; ')}`
    );
  }

  return detalhesDesejados;
}

async function aplicarControlesEntradaNaNota({ nunota, itensPedido, itensInformados }) {
  const alteracoes = planejarControlesItensEntrada(itensPedido, itensInformados);

  for (const alteracao of alteracoes) {
    await atualizarRegistroApi(
      'ItemNota',
      { NUNOTA: nunota, SEQUENCIA: alteracao.sequencia },
      { CONTROLE: alteracao.controle }
    );

    const itemPedido = itensPedido.find(
      (item) => Number(item.SEQUENCIA) === Number(alteracao.sequencia)
    );
    if (itemPedido) itemPedido.CONTROLE = alteracao.controle;
  }

  return alteracoes;
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

function normalizarDataHoraConferencia(valor, timeZone) {
  if (!valor) return null;

  const texto = valor instanceof Date
    ? [
        String(valor.getUTCDate()).padStart(2, '0'),
        String(valor.getUTCMonth() + 1).padStart(2, '0'),
        valor.getUTCFullYear(),
        String(valor.getUTCHours()).padStart(2, '0'),
        String(valor.getUTCMinutes()).padStart(2, '0'),
        String(valor.getUTCSeconds()).padStart(2, '0')
      ].join('|')
    : String(valor).trim();

  if (!(valor instanceof Date) && /[zZ]$|[+-]\d{2}:?\d{2}$/.test(texto)) {
    const dataComFuso = new Date(texto);
    return Number.isNaN(dataComFuso.getTime()) ? texto : dataComFuso.toISOString();
  }

  const partesDate = valor instanceof Date ? ['', ...texto.split('|')] : null;
  const sankhyaMatch = partesDate || texto.match(
    /^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  const brMatch = partesDate ? null : texto.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  const isoMatch = partesDate ? null : texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  let componentes;
  if (sankhyaMatch || brMatch) {
    const [, dia, mes, ano, hora = '00', minuto = '00', segundo = '00'] = sankhyaMatch || brMatch;
    componentes = { ano, mes, dia, hora, minuto, segundo };
  } else if (isoMatch) {
    const [, ano, mes, dia, hora, minuto, segundo = '00'] = isoMatch;
    componentes = { ano, mes, dia, hora, minuto, segundo };
  } else {
    return texto;
  }

  const data = criarDataNoFuso(componentes, timeZone);
  return Number.isNaN(data.getTime()) ? texto : data.toISOString();
}

function normalizarInicioConferencia(valor) {
  return normalizarDataHoraConferencia(valor, APP_TIMEZONE);
}

function normalizarFimConferencia(valor) {
  return normalizarDataHoraConferencia(valor, SANKHYA_TIMEZONE);
}

function formatarDataCampoSankhya(valor) {
  if (!valor) return null;

  const texto = String(valor).trim();
  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    return `${dia}/${mes}/${ano}`;
  }

  const brMatch = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    return `${dia}/${mes}/${ano}`;
  }

  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})/);
  if (sankhyaMatch) {
    const [, dia, mes, ano] = sankhyaMatch;
    return `${dia}/${mes}/${ano}`;
  }

  return texto;
}

async function atualizarDatasEstoqueEntrada({ itensPedido, itensInformados }) {
  const itensPorSequencia = new Map(itensPedido.map((item) => [Number(item.SEQUENCIA), item]));
  const atualizacoes = [];
  const chavesAtualizadas = new Set();

  for (const itemInformado of itensInformados) {
    const itemPedido = itensPorSequencia.get(Number(itemInformado.sequencia));
    if (!itemPedido || !Array.isArray(itemInformado.leituras)) continue;

    for (const leitura of itemInformado.leituras) {
      const dtValidade = formatarDataCampoSankhya(leitura.dtValidade);
      const dtFabricacao = formatarDataCampoSankhya(leitura.dtFabricacao);
      if (!dtValidade && !dtFabricacao) continue;

      const controle = normalizarControleConferencia(leitura.controle || itemPedido.CONTROLE);
      const chave = [
        itemPedido.CODEMP,
        itemPedido.CODPROD,
        itemPedido.CODLOCALORIG || 0,
        controle,
        dtFabricacao || '',
        dtValidade || ''
      ].join('|');
      if (chavesAtualizadas.has(chave)) continue;
      chavesAtualizadas.add(chave);

      const estoques = await executeQuery(`
        SELECT
          CODEMP,
          CODPROD,
          CODLOCAL,
          NVL(TRIM(CONTROLE), ' ') AS CONTROLE,
          CODPARC,
          TIPO
        FROM TGFEST
        WHERE CODEMP = ${Number(itemPedido.CODEMP)}
          AND CODPROD = ${Number(itemPedido.CODPROD)}
          AND CODLOCAL = ${Number(itemPedido.CODLOCALORIG || 0)}
          AND NVL(TRIM(CONTROLE), ' ') = '${textoSql(controle)}'
      `);

      for (const estoque of estoques) {
        const campos = {};
        if (dtValidade) campos.DTVAL = dtValidade;
        if (dtFabricacao) campos.DTFABRICACAO = dtFabricacao;

        await atualizarRegistroApi(
          'Estoque',
          {
            CODEMP: estoque.CODEMP,
            CODPROD: estoque.CODPROD,
            CODLOCAL: estoque.CODLOCAL,
            CONTROLE: normalizarControleConferencia(estoque.CONTROLE),
            CODPARC: estoque.CODPARC,
            TIPO: estoque.TIPO
          },
          campos
        );
        atualizacoes.push({
          codProd: estoque.CODPROD,
          controle: normalizarControleConferencia(estoque.CONTROLE).trim(),
          dtValidade,
          dtFabricacao
        });
      }
    }
  }

  return atualizacoes;
}

function normalizarLinhaConferencia(row) {
  return {
    ...row,
    DTNEG: normalizarDataSankhya(row.DTNEG),
    DT_INICIO_CONFERENCIA: normalizarInicioConferencia(row.DT_INICIO_CONFERENCIA),
    DT_FIM_CONFERENCIA: normalizarFimConferencia(row.DT_FIM_CONFERENCIA)
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
      WHERE (
        (CAB.CODTIPOPER IN (${TOPS_CONFERENCIA.saida.join(', ')}) AND CAB.TIPMOV = 'P' AND CAB.STATUSNOTA = 'L')
        OR
        (CAB.CODTIPOPER IN (${TOPS_CONFERENCIA.entrada.join(', ')}) AND CAB.TIPMOV = 'C' AND CAB.STATUSNOTA = 'A')
      )
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
    res.status(500).json({ erro: 'Erro ao buscar conferências' });
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

router.get('/fila-conferencia/separacao/:nunota', (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  res.json({ separacao: separacaoStore.obter(nunota) });
});

router.get('/fila-conferencia/separacao/:nunota/produtos/:codprod/lotes', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  const codProd = obterNumeroInteiro(req.params.codprod);
  if (!nunota || !codProd) {
    res.status(400).json({ erro: 'Informe um pedido e produto validos.' });
    return;
  }

  try {
    const lotes = await executeQuery(`
      SELECT
        TRIM(EST.CONTROLE) AS CONTROLE,
        TO_CHAR(MAX(EST.DTVAL), 'YYYY-MM-DD') AS DTVALID,
        SUM(NVL(EST.ESTOQUE, 0)) AS ESTOQUE,
        SUM(NVL(EST.RESERVADO, 0)) AS RESERVADO,
        SUM(NVL(EST.ESTOQUE, 0) - NVL(EST.RESERVADO, 0)) AS DISPONIVEL
      FROM TGFCAB CAB
      JOIN TGFEST EST
        ON EST.CODEMP = CAB.CODEMP
       AND EST.CODPROD = ${codProd}
      WHERE CAB.NUNOTA = ${nunota}
        AND NVL(EST.ATIVO, 'S') = 'S'
        AND NVL(EST.ESTOQUE, 0) > 0
        AND TRIM(EST.CONTROLE) IS NOT NULL
      GROUP BY TRIM(EST.CONTROLE)
      HAVING SUM(NVL(EST.ESTOQUE, 0)) > 0
      ORDER BY TRIM(EST.CONTROLE)
    `);

    res.json({
      lotes: lotes.map((lote) => ({
        controle: String(lote.CONTROLE || '').trim(),
        dtValidade: String(lote.DTVALID || '').trim() || null,
        estoque: Number(lote.ESTOQUE || 0),
        reservado: Number(lote.RESERVADO || 0),
        disponivel: Number(lote.DISPONIVEL || 0)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Não foi possível consultar os lotes do produto.' });
  }
});

async function garantirPedidoNaoConferidoParaSeparacao(nunota) {
  const rows = await executeQuery(`
    SELECT CONF.STATUS
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
     WHERE CAB.NUNOTA = ${nunota}
  `);
  if (rows.length === 0) {
    const erro = new Error('Pedido não encontrado.');
    erro.statusCode = 404;
    throw erro;
  }
  if (String(rows[0].STATUS || '').trim().toUpperCase() === 'F') {
    const erro = new Error('Pedido já conferido não pode ser enviado para separação.');
    erro.statusCode = 409;
    throw erro;
  }
}

router.post('/fila-conferencia/separacao/:nunota/iniciar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  try {
    await garantirPedidoNaoConferidoParaSeparacao(nunota);
    const separacao = separacaoStore.iniciar({
      nunota,
      codUsu: req.usuario?.codUsu,
      itens: Array.isArray(req.body?.itens) ? req.body.itens : []
    });
    res.json({ separacao });
  } catch (err) {
    res.status(err.statusCode || 400).json({ erro: err.message });
  }
});

router.patch('/fila-conferencia/separacao/:nunota/item', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  try {
    await garantirPedidoNaoConferidoParaSeparacao(nunota);
    const separacao = separacaoStore.atualizarItem({
      nunota,
      codUsu: req.usuario?.codUsu,
      item: req.body?.item
    });
    res.json({ separacao });
  } catch (err) {
    res.status(err.statusCode || (/ja foi concluida/i.test(err.message) ? 409 : 400)).json({ erro: err.message });
  }
});

router.post('/fila-conferencia/separacao/:nunota/finalizar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  try {
    await garantirPedidoNaoConferidoParaSeparacao(nunota);
    const separacao = separacaoStore.concluir({ nunota, codUsu: req.usuario?.codUsu });
    res.json({ separacao });
  } catch (err) {
    res.status(err.statusCode || 400).json({ erro: err.message });
  }
});

router.get('/fila-conferencia/pedidos', async (req, res) => {
  try {
    const modo = obterModoConferencia(req.query.modo);
    const tops = sqlTopsConferencia(modo);
    const tipMov = tipoMovimentoConferencia(modo);
    const intervalo = obterIntervaloDatas(req.query.dataInicial, req.query.dataFinal);
    const empresa = obterFiltroEmpresa(req.query.empresa);
    const pedidoBusca = obterNumeroInteiro(req.query.pedido);
    const filtroBusca = pedidoBusca
      ? (modo === 'entrada'
        ? `(CAB.NUNOTA = ${pedidoBusca} OR CAB.NUMNOTA = ${pedidoBusca})`
        : `(CAB.NUNOTA = ${pedidoBusca}
          OR EXISTS (
            SELECT 1
            FROM TGFVAR VAR_BUSCA
            JOIN TGFCAB NOTA_BUSCA
              ON NOTA_BUSCA.NUNOTA = VAR_BUSCA.NUNOTA
            WHERE VAR_BUSCA.NUNOTAORIG = CAB.NUNOTA
              AND NOTA_BUSCA.NUMNOTA = ${pedidoBusca}
              AND NOTA_BUSCA.TIPMOV <> 'P'
          ))`)
      : `CAB.DTNEG >= TO_DATE('${intervalo.inicio}', 'YYYY-MM-DD')
        AND CAB.DTNEG < TO_DATE('${intervalo.fim}', 'YYYY-MM-DD') + 1
        AND (CAB.NUCONFATUAL IS NULL OR CONF.STATUS IN (${modo === 'entrada' ? "'A', 'D', 'F'" : "'A', 'F'"}))
        ${modo === 'saida' ? `AND NVL(CAB.AD_STATUSINTPED, '0') = '1'
        AND NVL(CAB.AD_STATUSCOMERCIAL, '0') = '1'` : ''}
        ${modo === 'entrada' ? `AND (CAB.LIBCONF = 'S' OR CONF.STATUS = 'D')
        ` : ''}
        ${sqlFiltroEmpresa(empresa)}`;

    const rows = await executeQuery(`
      SELECT
        CAB.DTNEG,
        CAB.NUNOTA,
        CAB.NUMNOTA,
        CAB.CODEMP,
        CAB.CODTIPOPER,
        CAB.TIPMOV,
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
          WHEN CONF.STATUS = 'D' THEN 'FINALIZADO DIVERGENTE'
        WHEN CONF.STATUS = 'F' THEN 'CONFERIDO'
        ELSE 'STATUS DESCONHECIDO'
        END AS STATUS_CONFERENCIA,
        CONF.DHINICONF AS DT_INICIO_CONFERENCIA,
        CONF.DHFINCONF AS DT_FIM_CONFERENCIA,
        COUNT(ITE.SEQUENCIA) AS QTD_ITENS,
        SUM(NVL(ITE.QTDNEG, 0)) AS QTD_TOTAL,
        MAX(CASE WHEN GRU_FASE.CODGRUPOPROD IS NOT NULL THEN 1 ELSE 0 END) AS NECESSITA_GUIA_FASE,
        MAX(CASE WHEN FAT.NUNOTA_FATURADA IS NOT NULL THEN 1 ELSE 0 END) AS FATURADO
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      LEFT JOIN TGFPAR PAR
        ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TSIUSU USU
        ON USU.CODUSU = CONF.CODUSUCONF
      LEFT JOIN TGFITE ITE
        ON ITE.NUNOTA = CAB.NUNOTA
      LEFT JOIN TGFPRO PRO
        ON PRO.CODPROD = ITE.CODPROD
      LEFT JOIN (
        SELECT DISTINCT GRU.CODGRUPOPROD
        FROM TGFGRU GRU
        START WITH
          UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%WINNER%'
          OR UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%COMODIT%'
          OR UPPER(NVL(GRU.DESCRGRUPOPROD, '')) LIKE '%COMMODIT%'
        CONNECT BY NOCYCLE PRIOR GRU.CODGRUPOPROD = GRU.CODGRUPAI
      ) GRU_FASE
        ON GRU_FASE.CODGRUPOPROD = PRO.CODGRUPOPROD
      LEFT JOIN (
        SELECT
          VAR.NUNOTAORIG,
          MAX(NOTA.NUNOTA) AS NUNOTA_FATURADA
        FROM TGFVAR VAR
        INNER JOIN TGFCAB NOTA
          ON NOTA.NUNOTA = VAR.NUNOTA
         AND NOTA.TIPMOV <> 'P'
        GROUP BY VAR.NUNOTAORIG
      ) FAT
        ON FAT.NUNOTAORIG = CAB.NUNOTA
      LEFT JOIN TGFTOP TOP_ATUAL
        ON TOP_ATUAL.CODTIPOPER = CAB.CODTIPOPER
       AND TOP_ATUAL.DHALTER = CAB.DHTIPOPER
      LEFT JOIN TGFCCO CCO_ATUAL
        ON CCO_ATUAL.NUCCO = TOP_ATUAL.NUCCO
      WHERE ${filtroBusca}
        AND CAB.CODTIPOPER IN (${tops})
        AND CAB.TIPMOV = '${tipMov}'
        AND ${condicaoStatusConferencia(modo)}
        ${modo === 'entrada' ? `AND TOP_ATUAL.NUCCO IS NOT NULL
        AND NVL(CCO_ATUAL.EXPLODIRLOTE, 'N') = 'N'` : ''}
      GROUP BY CAB.DTNEG, CAB.NUNOTA, CAB.NUMNOTA, CAB.CODEMP, CAB.CODTIPOPER, CAB.TIPMOV, PAR.RAZAOSOCIAL, CAB.CODPARC, CAB.VLRNOTA, CAB.QTDVOL,
        CAB.NUCONFATUAL, CONF.STATUS, CONF.DHINICONF, CONF.DHFINCONF, USU.NOMEUSU
      ORDER BY
        CASE
          WHEN CONF.STATUS = 'A' THEN 0
          WHEN CONF.STATUS = 'D' THEN 1
          WHEN CAB.NUCONFATUAL IS NULL THEN 2
          WHEN CONF.STATUS = 'F' THEN 3
          ELSE 4
        END,
        CAB.DTNEG,
        CAB.NUNOTA
    `);

    res.json({
      dataInicial: intervalo.inicio,
      dataFinal: intervalo.fim,
      empresa,
      pedido: pedidoBusca,
      modo,
      itens: rows.map((row) => {
        const separacao = modo === 'saida' ? separacaoStore.obter(row.NUNOTA) : null;
        return {
          ...row,
          DTNEG: normalizarDataSankhya(row.DTNEG),
          DT_INICIO_CONFERENCIA: normalizarInicioConferencia(row.DT_INICIO_CONFERENCIA),
          DT_FIM_CONFERENCIA: normalizarFimConferencia(row.DT_FIM_CONFERENCIA),
          NUMNOTA: normalizarNumero(row.NUMNOTA),
          NUCONFATUAL: row.NUCONFATUAL ? Number(row.NUCONFATUAL) : null,
          STATUS_CONF: row.STATUS_CONF || null,
          STATUS_CONFERENCIA: modo === 'entrada'
            ? statusVisualConferencia(row.STATUS_CONF, Boolean(row.NUCONFATUAL))
            : row.STATUS_CONFERENCIA,
          STATUS_SEPARACAO: separacao?.status || null,
          SEPARACAO_ATUALIZADA_EM: separacao?.atualizadoEm || null,
          NOME_CONFERENTE: row.NOME_CONFERENTE || null,
          QTDVOL: normalizarNumero(row.QTDVOL),
          QTD_ITENS: normalizarNumero(row.QTD_ITENS),
          QTD_TOTAL: normalizarNumero(row.QTD_TOTAL),
          NECESSITA_GUIA_FASE: modo === 'saida' && Number(row.NECESSITA_GUIA_FASE) === 1,
          FATURADO: modo === 'saida' && Number(row.FATURADO) === 1,
          GUIAS_FASE_QTD: modo === 'saida' ? guiaFaseStore.quantidade(row.NUNOTA) : 0,
          PEDIDO_IMPRESSO: Boolean(pedidoPrintStore.obter(row.NUNOTA)),
          IMPRESSAO_PEDIDO: pedidoPrintStore.obter(row.NUNOTA)
        };
      })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar fila de conferência' });
  }
});

router.get('/fila-conferencia/romaneio/transportadoras', async (req, res) => {
  try {
    const empresa = obterFiltroEmpresa(req.query.empresa);
    if (!empresa) {
      res.status(400).json({ erro: 'Selecione a empresa para consultar as cargas.' });
      return;
    }

    const intervalo = obterIntervaloDatas(req.query.dataInicial, req.query.dataFinal);
    const notas = await buscarNotasPendentesCarga({ empresa, intervalo });
    const transportadoras = new Map();

    notas.forEach((nota) => {
      const codigo = Number(nota.CODPARCTRANSP);
      const atual = transportadoras.get(codigo) || {
        codigo,
        nome: nota.TRANSPORTADORA || `Transportadora ${codigo}`,
        notas: 0,
        valorTotal: 0
      };
      atual.notas += 1;
      atual.valorTotal += Number(nota.VLRNOTA || 0);
      transportadoras.set(codigo, atual);
    });

    res.json({
      dataInicial: intervalo.inicio,
      dataFinal: intervalo.fim,
      itens: [...transportadoras.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar transportadoras com notas faturadas pendentes de carga.' });
  }
});

router.get('/fila-conferencia/romaneio/pedidos', async (req, res) => {
  try {
    const empresa = obterFiltroEmpresa(req.query.empresa);
    const transportadoras = obterTransportadorasRomaneio(req.query.transportadoras, req.query.transportadora);
    if (!empresa || transportadoras.length === 0) {
      res.status(400).json({ erro: 'Empresa e ao menos uma transportadora sao obrigatorias.' });
      return;
    }

    const intervalo = obterIntervaloDatas(req.query.dataInicial, req.query.dataFinal);
    const rows = await buscarNotasPendentesCarga({ empresa, transportadoras, intervalo });
    res.json({
      transportadoras,
      itens: rows.map((row) => ({
        ...row,
        NUNOTA: Number(row.NUNOTA),
        NUMNOTA: Number(row.NUMNOTA || 0),
        DTNEG: normalizarDataSankhya(row.DTNEG),
        VLRNOTA: Number(row.VLRNOTA || 0),
        QTDVOL: Number(row.QTDVOL || 0),
        QTD_ITENS: Number(row.QTD_ITENS || 0),
        QTD_UNIDADES: Number(row.QTD_UNIDADES || 0)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar notas faturadas pendentes de carga.' });
  }
});

router.post('/fila-conferencia/romaneio', async (req, res) => {
  try {
    const empresa = obterFiltroEmpresa(req.body?.empresa);
    const transportadoras = obterTransportadorasRomaneio(req.body?.transportadoras, req.body?.transportadora);
    const transportadoraPrincipal = transportadoras[0];
    const listaSolicitada = Array.isArray(req.body?.notas) ? req.body.notas : req.body?.pedidos;
    const notasSolicitadas = Array.isArray(listaSolicitada)
      ? [...new Set(listaSolicitada.map(obterNumeroInteiro).filter(Boolean))]
      : [];

    if (!empresa || transportadoras.length === 0 || notasSolicitadas.length === 0) {
      res.status(400).json({ erro: 'Empresa, ao menos uma transportadora e notas faturadas sao obrigatorios.' });
      return;
    }

    const intervalo = obterIntervaloDatas(req.body?.dataInicial, req.body?.dataFinal);
    const elegiveis = await buscarNotasPendentesCarga({ empresa, transportadoras, intervalo });
    const elegiveisPorNumero = new Map(elegiveis.map((nota) => [Number(nota.NUNOTA), nota]));
    const indisponiveis = notasSolicitadas.filter((nunota) => !elegiveisPorNumero.has(nunota));

    if (indisponiveis.length > 0) {
      res.status(409).json({
        erro: 'A lista mudou antes da geracao. Atualize o romaneio e tente novamente.',
        notasIndisponiveis: indisponiveis
      });
      return;
    }

    const codigoOrdemCarga = await criarOrdemCargaSankhya({
      empresa,
      transportadora: transportadoraPrincipal
    });

    if (!codigoOrdemCarga) {
      throw new Error('O Sankhya criou a carga, mas não retornou o código da Ordem de Carga.');
    }

    await executeDirectService('FormacaoCargaSP.confirmaAlteracoesNotasOC', {
      notas: {
        nota: notasSolicitadas.map((nunota) => ({
          NUNOTA: { $: String(nunota) },
          ORDEMCARGA: { $: String(codigoOrdemCarga) }
        }))
      },
      clientEventList: {
        clientEvent: [
          { $: 'br.com.sankhya.mgewms.expedicao.validarPedidos' },
          { $: 'br.com.sankhya.mgewms.expedicao.cortePedidos' },
          { $: 'br.com.sankhya.mgewms.expedicao.selecaoDocas' },
          { $: 'br.com.sankhya.mgewms.expedicao.encerrarOC' },
          { $: 'br.com.sankhya.actionbutton.clientconfirm' }
        ]
      }
    }, { modulePath: 'mgecom' });

    const verificacao = await executeQuery(`
      SELECT NUNOTA, NVL(ORDEMCARGA, 0) AS ORDEMCARGA
      FROM TGFCAB
      WHERE NUNOTA IN (${notasSolicitadas.join(', ')})
    `);
    const vinculados = verificacao
      .filter((nota) => Number(nota.ORDEMCARGA) === codigoOrdemCarga)
      .map((nota) => Number(nota.NUNOTA));
    const vinculadosSet = new Set(vinculados);
    const falhas = notasSolicitadas
      .filter((nunota) => !vinculadosSet.has(nunota))
      .map((nunota) => ({ nunota, erro: 'A nota não ficou vinculada à Ordem de Carga.' }));

    const resultado = {
      codigoOrdemCarga,
      transportadoraPrincipal,
      transportadoras: transportadoras.map((codigo) => {
        const nota = elegiveis.find((item) => Number(item.CODPARCTRANSP) === codigo);
        return { codigo, nome: nota?.TRANSPORTADORA || String(codigo) };
      }),
      notasVinculadas: vinculados,
      falhas,
      parcial: falhas.length > 0
    };

    if (vinculados.length === 0) {
      res.status(422).json({
        ...resultado,
        erro: `A Ordem de Carga ${codigoOrdemCarga} foi criada, mas nenhuma nota faturada foi vinculada.`
      });
      return;
    }

    res.status(falhas.length > 0 ? 207 : 201).json(resultado);
  } catch (err) {
    console.error(err);
    res.status(err.status && err.status < 500 ? err.status : 500).json({
      erro: err.message || 'Erro ao gerar o romaneio de cargas.'
    });
  }
});

router.get('/fila-conferencia/romaneio/:ordemCarga/pdf', async (req, res) => {
  try {
    const empresa = obterFiltroEmpresa(req.query.empresa);
    const ordemCarga = obterNumeroInteiro(req.params.ordemCarga);
    if (!empresa || !ordemCarga) {
      res.status(400).json({ erro: 'Empresa e Ordem de Carga sao obrigatorias para imprimir o romaneio.' });
      return;
    }

    const notas = await executeQuery(`
      SELECT
        CAB.NUNOTA,
        CAB.NUMNOTA,
        CAB.DTNEG,
        CAB.QTDVOL,
        CAB.VLRNOTA,
        NVL(CAB.PESO, 0) AS PESO,
        CASE WHEN CAB.CODTIPOPER = 10 THEN 'BONIFICACAO' ELSE 'VENDA' END AS TIPO_DOCUMENTO,
        PAR.RAZAOSOCIAL AS CLIENTE,
        CID.NOMECID AS CIDADE,
        UFS.UF AS UF,
        CAB.CODPARCTRANSP,
        TRP.NOMEPARC AS TRANSPORTADORA,
        EMP.RAZAOSOCIAL AS EMPRESA
      FROM TGFCAB CAB
      LEFT JOIN TGFPAR PAR
        ON PAR.CODPARC = CAB.CODPARC
      LEFT JOIN TGFPAR TRP
        ON TRP.CODPARC = CAB.CODPARCTRANSP
      LEFT JOIN TSICID CID
        ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS
        ON UFS.CODUF = CID.UF
      LEFT JOIN TSIEMP EMP
        ON EMP.CODEMP = CAB.CODEMP
      WHERE CAB.CODEMP = ${empresa}
        AND CAB.ORDEMCARGA = ${ordemCarga}
        AND CAB.TIPMOV = 'V'
      ORDER BY CAB.DTNEG, CAB.NUMNOTA, CAB.NUNOTA
    `);

    if (notas.length === 0) {
      res.status(404).json({ erro: `Nenhuma nota foi encontrada na Ordem de Carga ${ordemCarga}.` });
      return;
    }

    const pdf = await gerarRomaneioCargaPdf({
      ordemCarga,
      transportadora: `${notas[0].CODPARCTRANSP || '-'} - ${notas[0].TRANSPORTADORA || '-'}`,
      empresa: notas[0].EMPRESA,
      notas
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="romaneio-carga-${ordemCarga}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar o romaneio de carga.' });
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
        PRO.CODGRUPOPROD,
        GRU.DESCRGRUPOPROD,
        ITE.CONTROLE,
        ITE.CODVOL,
        PRO.CODVOL AS CODVOLPADRAO,
        CAST(NVL(ITE.QTDNEG, 0) AS NUMBER(15,3)) AS QTDNEG,
        CAST(NVL(ITE.VLRUNIT, 0) AS NUMBER(15,2)) AS VLRUNIT,
        NVL(ITE.GTINNFE, PRO.REFERENCIA) AS CODIGO_BARRAS,
        ITE.GTINNFE,
        ITE.GTINTRIBNFE,
        ITE.PRODUTONFE,
        PRO.REFERENCIA,
        PRO.AD_CODBAR,
        PRO.AD_CBARANT,
        (
          SELECT TO_CHAR(MAX(EST.DTVAL), 'YYYY-MM-DD')
          FROM TGFEST EST
          WHERE EST.CODPROD = ITE.CODPROD
            AND EST.CODEMP = CAB.CODEMP
            AND NVL(TRIM(EST.CONTROLE), ' ') = NVL(TRIM(ITE.CONTROLE), ' ')
            AND EST.DTVAL IS NOT NULL
        ) AS DTVAL,
        (
          SELECT TO_CHAR(MAX(EST.DTFABRICACAO), 'YYYY-MM-DD')
          FROM TGFEST EST
          WHERE EST.CODPROD = ITE.CODPROD
            AND EST.CODEMP = CAB.CODEMP
            AND NVL(TRIM(EST.CONTROLE), ' ') = NVL(TRIM(ITE.CONTROLE), ' ')
            AND EST.DTFABRICACAO IS NOT NULL
        ) AS DTFABRICACAO
      FROM TGFITE ITE
      LEFT JOIN TGFCAB CAB
        ON CAB.NUNOTA = ITE.NUNOTA
      LEFT JOIN TGFPRO PRO
        ON PRO.CODPROD = ITE.CODPROD
      LEFT JOIN TGFGRU GRU
        ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
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
    const detalhesNativos = progresso ? [] : await executeQuery(`
      SELECT
        COI.CODPROD,
        NVL(TRIM(COI.CONTROLE), ' ') AS CONTROLE,
        COI.CODBARRA,
        COI.CODVOL,
        NVL(COI.QTDCONF, 0) AS QTDCONF,
        NVL(COI.QTDCONFVOLPAD, 0) AS QTDCONFVOLPAD
      FROM TGFCAB CAB
      JOIN TGFCOI2 COI
        ON COI.NUCONF = CAB.NUCONFATUAL
      WHERE CAB.NUNOTA = ${nunota}
        AND (
          ABS(NVL(COI.QTDCONF, 0)) > 0.0001
          OR ABS(NVL(COI.QTDCONFVOLPAD, 0)) > 0.0001
        )
      ORDER BY COI.SEQCONF
    `);
    const detalhesNativosPorItem = new Map();
    const detalhesNativosPorProduto = new Map();
    detalhesNativos.forEach((detalhe) => {
      const chave = `${Number(detalhe.CODPROD)}|${normalizarControleConferencia(detalhe.CONTROLE)}`;
      if (!detalhesNativosPorItem.has(chave)) detalhesNativosPorItem.set(chave, []);
      detalhesNativosPorItem.get(chave).push(detalhe);
      const codProd = Number(detalhe.CODPROD);
      if (!detalhesNativosPorProduto.has(codProd)) detalhesNativosPorProduto.set(codProd, []);
      detalhesNativosPorProduto.get(codProd).push(detalhe);
    });
    const quantidadeItensPorProduto = rows.reduce((mapa, row) => {
      const codProd = Number(row.CODPROD);
      mapa.set(codProd, (mapa.get(codProd) || 0) + 1);
      return mapa;
    }, new Map());

    res.json({
      nunota,
      itens: rows.map((row) => {
        const codigosConferencia = [];
        const progressoItem = progressoPorSequencia.get(Number(row.SEQUENCIA)) || {};
        const chaveDetalheNativo = `${Number(row.CODPROD)}|${normalizarControleConferencia(row.CONTROLE)}`;
        const detalhesDoItem = quantidadeItensPorProduto.get(Number(row.CODPROD)) === 1
          ? (detalhesNativosPorProduto.get(Number(row.CODPROD)) || [])
          : (detalhesNativosPorItem.get(chaveDetalheNativo) || []);
        const leiturasNativas = detalhesDoItem.map((detalhe) => ({
          codigo: String(detalhe.CODBARRA || row.CODPROD),
          tipo: 'CODIGO_BARRAS',
          codVol: detalhe.CODVOL || row.CODVOL || 'UN',
          controle: normalizarControleConferencia(detalhe.CONTROLE).trim(),
          multiplicador: normalizarNumero(detalhe.QTDCONF) > 0
            ? normalizarNumero(detalhe.QTDCONFVOLPAD) / normalizarNumero(detalhe.QTDCONF)
            : 1,
          quantidade: normalizarNumero(detalhe.QTDCONF),
          quantidadeConvertida: normalizarNumero(detalhe.QTDCONFVOLPAD)
        }));
        const quantidadeNativa = leiturasNativas.reduce((total, leitura) => total + leitura.quantidadeConvertida, 0);

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
            unidade.CODVOL ? `Unidade alternativa ${unidade.CODVOL}` : 'Unidade alternativa',
            { codVol: unidade.CODVOL || row.CODVOL || 'UN' }
          );
        });

        const metadadosUnidadeItem = { codVol: row.CODVOLPADRAO || row.CODVOL || 'UN' };
        adicionarCodigoConferencia(codigosConferencia, row.REFERENCIA, 'REFERENCIA', 1, 'Referencia', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.GTINNFE, 'CODIGO_BARRAS', 1, 'Código de barras', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.GTINTRIBNFE, 'CODIGO_BARRAS', 1, 'Código de barras tributável', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.PRODUTONFE, 'CODIGO_BARRAS', 1, 'Código do produto na NFe', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.AD_CODBAR, 'CODIGO_BARRAS', 1, 'Código de barras adicional', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.AD_CBARANT, 'CODIGO_BARRAS', 1, 'Código de barras anterior', metadadosUnidadeItem);
        adicionarCodigoConferencia(codigosConferencia, row.CODPROD, 'CODIGO_PRODUTO', 1, 'Código do produto', metadadosUnidadeItem);

        return {
          nunota: row.NUNOTA,
          sequencia: row.SEQUENCIA,
          codProd: row.CODPROD,
          descrProd: row.DESCRPROD || `Produto ${row.CODPROD}`,
          codGrupoProd: row.CODGRUPOPROD || '',
          descrGrupoProd: row.DESCRGRUPOPROD || 'Sem grupo',
          controle: row.CONTROLE || '',
          codVol: row.CODVOL || 'UN',
          codVolPadrao: row.CODVOLPADRAO || row.CODVOL || 'UN',
          qtdNeg: normalizarNumero(row.QTDNEG),
          vlrUnit: normalizarNumero(row.VLRUNIT),
          codigoBarras: row.CODIGO_BARRAS || '',
          dtValidade: row.DTVAL || '',
          dtFabricacao: row.DTFABRICACAO || '',
          codigos: codigosConferencia.map((item) => item.codigo),
          codigosConferencia,
          qtdConferida: progresso
            ? normalizarNumero(progressoItem.qtdConferida)
            : quantidadeNativa,
          qtdCortada: normalizarNumero(progressoItem.qtdCortada),
          leituras: progresso
            ? (Array.isArray(progressoItem.leituras) ? progressoItem.leituras : [])
            : leiturasNativas
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
      res.status(404).json({ erro: 'Produto não encontrado' });
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
      res.status(404).json({ erro: 'Foto do produto não encontrada' });
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
      res.status(400).json({ erro: 'Informe o código do produto' });
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

function serializarSessaoContagemEstoque(sessao) {
  const emRecontagem = sessao.status === 'EM_RECONTAGEM';
  let resumo = estoqueContagemStore.resumir(sessao);

  if (emRecontagem) {
    const itensRecontagem = (sessao.itens || []).filter((item) => {
      const primeira = item.contagens?.['1'];
      return primeira !== null
        && primeira !== undefined
        && Math.abs(Number(primeira) - Number(item.estoqueSistema)) > 0.000001;
    });
    const itensRecontados = itensRecontagem.filter((item) => {
      const segunda = item.contagens?.['2'];
      return segunda !== null && segunda !== undefined;
    });
    resumo = {
      ...resumo,
      totalItens: itensRecontagem.length,
      itensContados: itensRecontados.length,
      itensPendentes: itensRecontagem.length - itensRecontados.length
    };
  }

  return {
    ...sessao,
    resumo,
    itens: (sessao.itens || []).map((item) => {
      const primeiraContagem = item.contagens?.['1'];
      const divergentePrimeira = primeiraContagem !== null
        && primeiraContagem !== undefined
        && Math.abs(Number(primeiraContagem) - Number(item.estoqueSistema)) > 0.000001;
      const contagemRodadaAtual = item.contagens?.[String(sessao.rodadaAtual)];
      const segundaContagem = item.contagens?.['2'];
      const contagemAtual = emRecontagem
        ? contagemRodadaAtual
        : obterContagemAtual(sessao, item);
      const possuiContagemAtual = contagemAtual !== null && contagemAtual !== undefined;
      const divergenteDaContagem = Number(sessao.rodadaAtual) >= 2
        && primeiraContagem !== null
        && primeiraContagem !== undefined
        && segundaContagem !== null
        && segundaContagem !== undefined
        ? Math.abs(Number(segundaContagem) - Number(primeiraContagem)) > 0.000001
        : null;

      return {
        chave: item.chave,
        codProd: item.codProd,
        descrProd: item.descrProd,
        referencia: item.referencia,
        codVol: item.codVol,
        codGrupoProd: item.codGrupoProd,
        descrGrupoProd: item.descrGrupoProd,
        codLocal: item.codLocal,
        descrLocal: item.descrLocal,
        controle: item.controle,
        dtVal: item.dtVal,
        contagemAtual: !possuiContagemAtual
          ? null
          : Number(contagemAtual),
        estoqueSistema: Number(item.estoqueSistema),
        primeiraContagem: primeiraContagem !== null && primeiraContagem !== undefined
          ? Number(primeiraContagem)
          : null,
        divergenteDaContagem,
        divergente: !possuiContagemAtual
          ? null
          : Math.abs(Number(contagemAtual) - Number(item.estoqueSistema)) > 0.000001,
        podeContar: ['EM_CONTAGEM', 'EM_RECONTAGEM'].includes(sessao.status)
          && (sessao.status !== 'EM_RECONTAGEM' || divergentePrimeira)
      };
    })
  };
}

function dataNegociacaoAjusteEstoque() {
  const [ano, mes, dia] = obterDataHoje().split('-');
  return `${dia}/${mes}/${ano}`;
}

async function obterTemplateNotaAjusteEstoque(empresa, tipo) {
  const codTipOper = TOPS_AJUSTE_ESTOQUE[tipo];
  const linhas = await executeQuery(`
    SELECT * FROM (
      SELECT
        CAB.CODPARC,
        CAB.CODTIPVENDA,
        CAB.CODVEND,
        CAB.CODNAT,
        CAB.CODCENCUS,
        TOP.CODTIPOPER,
        TOP.TIPMOV,
        TOP.ATUALEST,
        TOP.ATUALFIN
      FROM TGFCAB CAB
      JOIN TGFTOP TOP
        ON TOP.CODTIPOPER = CAB.CODTIPOPER
       AND TOP.DHALTER = (
         SELECT MAX(T2.DHALTER)
         FROM TGFTOP T2
         WHERE T2.CODTIPOPER = TOP.CODTIPOPER
       )
      WHERE CAB.CODEMP = ${Number(empresa)}
        AND CAB.CODTIPOPER = ${codTipOper}
      ORDER BY CAB.NUNOTA DESC
    )
    WHERE ROWNUM = 1
  `);

  const template = linhas[0];
  if (!template) {
    throw new Error(`Nao existe nota modelo recente da TOP ${codTipOper} para a empresa ${empresa}.`);
  }

  const atualizaEstoqueEsperado = tipo === 'ENTRADA' ? 'E' : 'B';
  if (String(template.ATUALEST || '').toUpperCase() !== atualizaEstoqueEsperado) {
    throw new Error(`A TOP ${codTipOper} nao esta configurada para ${tipo === 'ENTRADA' ? 'entrada' : 'baixa'} de estoque.`);
  }
  if (Number(template.ATUALFIN || 0) !== 0) {
    throw new Error(`A TOP ${codTipOper} esta configurada para atualizar financeiro.`);
  }
  if (!Number(template.CODPARC) || !Number(template.CODTIPVENDA)) {
    throw new Error(`A nota modelo da TOP ${codTipOper} nao possui parceiro ou tipo de negociacao.`);
  }

  return template;
}

async function obterCustosReposicaoAjuste(empresa, itens) {
  const produtos = [...new Set(itens.map((item) => Number(item.codProd)).filter(Boolean))];
  if (!produtos.length) return new Map();

  const linhas = await executeQuery(`
    SELECT
      CUS.CODPROD,
      NVL(CUS.CUSREP, 0) AS VLRUNIT
    FROM TGFCUS CUS
    WHERE CUS.CODEMP = ${Number(empresa)}
      AND CUS.CODPROD IN (${produtos.join(', ')})
      AND CUS.DTATUAL = (
        SELECT MAX(C2.DTATUAL)
        FROM TGFCUS C2
        WHERE C2.CODEMP = CUS.CODEMP
          AND C2.CODPROD = CUS.CODPROD
      )
  `);

  return new Map(linhas.map((item) => [Number(item.CODPROD), Number(item.VLRUNIT)]));
}

async function localizarNotaAjustePorObservacao(empresa, codTipOper, observacao) {
  const linhas = await executeQuery(`
    SELECT NUNOTA, STATUSNOTA
    FROM TGFCAB
    WHERE CODEMP = ${Number(empresa)}
      AND CODTIPOPER = ${Number(codTipOper)}
      AND OBSERVACAO = '${textoSql(observacao)}'
    ORDER BY NUNOTA DESC
  `);
  return linhas[0] || null;
}

async function gerarNotaPendenteAjuste({
  sessao,
  tipo,
  itens,
  template,
  custos,
  indice,
  total
}) {
  const observacao = `Contagem app ${sessao.id} - ${tipo} ${indice}/${total}`;
  const existente = await localizarNotaAjustePorObservacao(
    sessao.empresa,
    template.CODTIPOPER,
    observacao
  );
  if (existente) {
    return {
      nunota: Number(existente.NUNOTA),
      tipo,
      codTipOper: Number(template.CODTIPOPER),
      quantidadeItens: itens.length,
      observacao,
      status: String(existente.STATUSNOTA || '').toUpperCase() === 'L'
        ? 'CONFIRMADA_NO_SANKHYA'
        : 'PENDENTE_CONFIRMACAO',
      reutilizada: true
    };
  }

  const payload = montarPayloadNotaAjuste({
    sessao,
    itens,
    template,
    custos,
    dataNegociacao: dataNegociacaoAjusteEstoque(),
    observacao
  });
  const resposta = await executeService(
    'CACSP.incluirNota',
    payload,
    { modulePath: 'mgecom', forceAccessSession: true }
  );

  return {
    nunota: extrairNunotaAjuste(resposta),
    tipo,
    codTipOper: Number(template.CODTIPOPER),
    quantidadeItens: itens.length,
    observacao,
    status: 'PENDENTE_CONFIRMACAO',
    reutilizada: false
  };
}

router.get('/estoque-contagem/disponibilidade', (req, res) => {
  const ambienteTeste = ambienteSankhyaTeste();
  res.json({
    disponivel: true,
    ambiente: ambienteTeste ? 'TESTE' : 'PRODUCAO'
  });
});

router.get('/estoque-contagem/config', async (req, res) => {
  try {
    const empresas = await executeQuery(`
      SELECT
        EST.CODEMP,
        NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL) AS EMPRESA,
        COUNT(DISTINCT EST.CODPROD) AS PRODUTOS
      FROM TGFEST EST
      LEFT JOIN TSIEMP EMP ON EMP.CODEMP = EST.CODEMP
      WHERE NVL(EST.ATIVO, 'S') = 'S'
        AND NVL(EST.TIPO, 'P') = 'P'
        AND NVL(EST.CODPARC, 0) = 0
        AND ABS(NVL(EST.ESTOQUE, 0)) > 0.000001
      GROUP BY EST.CODEMP, NVL(EMP.NOMEFANTASIA, EMP.RAZAOSOCIAL)
      ORDER BY EST.CODEMP
    `);

    const ambienteTeste = ambienteSankhyaTeste();
    res.json({
      ambienteTeste,
      ambiente: ambienteTeste ? 'Sankhya Sandbox' : 'Sankhya Produção',
      empresas: empresas.map((item) => ({
        codEmp: Number(item.CODEMP),
        empresa: item.EMPRESA || `Empresa ${item.CODEMP}`,
        produtos: Number(item.PRODUTOS || 0)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel preparar a contagem de estoque.' });
  }
});

router.get('/estoque-contagem/locais', async (req, res) => {
  try {
    const empresa = obterNumeroInteiro(req.query.empresa);
    if (!empresa) {
      res.status(400).json({ erro: 'Informe a empresa.' });
      return;
    }

    const locais = await executeQuery(`
      SELECT
        EST.CODLOCAL,
        NVL(LOC.DESCRLOCAL, 'Local ' || EST.CODLOCAL) AS DESCRLOCAL,
        COUNT(DISTINCT EST.CODPROD) AS PRODUTOS
      FROM TGFEST EST
      LEFT JOIN TGFLOC LOC ON LOC.CODLOCAL = EST.CODLOCAL
      WHERE EST.CODEMP = ${empresa}
        AND NVL(EST.ATIVO, 'S') = 'S'
        AND NVL(EST.TIPO, 'P') = 'P'
        AND NVL(EST.CODPARC, 0) = 0
        AND ABS(NVL(EST.ESTOQUE, 0)) > 0.000001
      GROUP BY EST.CODLOCAL, NVL(LOC.DESCRLOCAL, 'Local ' || EST.CODLOCAL)
      ORDER BY EST.CODLOCAL
    `);

    res.json({
      itens: locais.map((item) => ({
        codLocal: Number(item.CODLOCAL),
        descrLocal: item.DESCRLOCAL,
        produtos: Number(item.PRODUTOS || 0)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel consultar os locais de estoque.' });
  }
});

router.get('/estoque-contagem/filtros', async (req, res) => {
  try {
    const empresa = obterNumeroInteiro(req.query.empresa);
    const localTexto = String(req.query.local ?? '').trim();
    const local = localTexto === '' ? null : Number(localTexto);
    const marca = String(req.query.marca || '').trim().slice(0, 100);
    if (!empresa || (local !== null && (!Number.isInteger(local) || local < 0))) {
      res.status(400).json({ erro: 'Informe empresa e local validos.' });
      return;
    }

    const filtroLocal = local === null ? '' : `AND EST.CODLOCAL = ${local}`;
    const filtroMarcaGrupos = marca
      ? `AND TRIM(PRO.MARCA) = '${textoSql(marca)}'`
      : '';
    const baseEstoque = `
      EST.CODEMP = ${empresa}
      ${filtroLocal}
      AND NVL(EST.ATIVO, 'S') = 'S'
      AND NVL(EST.TIPO, 'P') = 'P'
      AND NVL(EST.CODPARC, 0) = 0
      AND ABS(NVL(EST.ESTOQUE, 0)) > 0.000001
    `;
    const [grupos, marcas] = await Promise.all([
      executeQuery(`
        SELECT DISTINCT
          PRO.CODGRUPOPROD,
          NVL(GRU.DESCRGRUPOPROD, 'Grupo ' || PRO.CODGRUPOPROD) AS DESCRGRUPOPROD,
          GRU.CODGRUPAI
        FROM TGFEST EST
        INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
        LEFT JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
        WHERE ${baseEstoque}
          ${filtroMarcaGrupos}
        ORDER BY PRO.CODGRUPOPROD
      `),
      executeQuery(`
        SELECT DISTINCT TRIM(PRO.MARCA) AS MARCA
        FROM TGFEST EST
        INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
        WHERE ${baseEstoque}
          AND TRIM(PRO.MARCA) IS NOT NULL
        ORDER BY TRIM(PRO.MARCA)
      `)
    ]);

    res.json({
      grupos: grupos.map((item) => ({
        codigo: Number(item.CODGRUPOPROD),
        descricao: item.DESCRGRUPOPROD,
        grupoPai: item.CODGRUPAI === null ? null : Number(item.CODGRUPAI)
      })),
      marcas: marcas.map((item) => item.MARCA).filter(Boolean)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel carregar os filtros da copia.' });
  }
});

router.post('/estoque-contagem/previa', async (req, res) => {
  try {
    const filtros = normalizarFiltrosCopiaEstoque(req.body);
    if (!filtros.empresa) {
      res.status(400).json({ erro: 'Informe a empresa.' });
      return;
    }

    const [previa] = await executeQuery(`
      SELECT
        COUNT(*) AS LINHAS,
        COUNT(DISTINCT EST.CODPROD) AS PRODUTOS,
        COUNT(DISTINCT EST.CODLOCAL) AS LOCAIS,
        SUM(NVL(EST.ESTOQUE, 0)) AS UNIDADES
      FROM TGFEST EST
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
      WHERE ${montarSqlFiltrosCopiaEstoque(filtros)}
    `);

    res.json({
      filtros,
      previa: {
        linhas: Number(previa?.LINHAS || 0),
        produtos: Number(previa?.PRODUTOS || 0),
        locais: Number(previa?.LOCAIS || 0),
        unidades: Number(previa?.UNIDADES || 0)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel calcular a previa da copia.' });
  }
});

router.get('/estoque-contagem/sessoes', (req, res) => {
  res.json({ itens: estoqueContagemStore.listar() });
});

router.delete('/estoque-contagem/sessoes/:id', (req, res) => {
  try {
    const sessao = estoqueContagemStore.excluir({ id: req.params.id });
    res.json({
      removida: {
        id: sessao.id,
        status: sessao.status,
        notasAjuste: sessao.ajuste?.notas || []
      }
    });
  } catch (err) {
    res.status(404).json({ erro: err.message });
  }
});

router.post('/estoque-contagem/sessoes', async (req, res) => {
  try {
    const filtros = normalizarFiltrosCopiaEstoque(req.body);
    const { empresa, local } = filtros;
    if (!empresa) {
      res.status(400).json({ erro: 'Informe uma empresa valida.' });
      return;
    }

    const itens = await executeQuery(`
      SELECT
        EST.CODEMP,
        EST.CODLOCAL,
        NVL(LOC.DESCRLOCAL, 'Local ' || EST.CODLOCAL) AS DESCRLOCAL,
        EST.CODPROD,
        PRO.DESCRPROD,
        PRO.REFERENCIA,
        PRO.CODVOL,
        PRO.CODGRUPOPROD,
        NVL(GRU.DESCRGRUPOPROD, 'Sem grupo') AS DESCRGRUPOPROD,
        NVL(TRIM(EST.CONTROLE), '') AS CONTROLE,
        EST.DTVAL,
        NVL(EST.ESTOQUE, 0) AS ESTOQUE
      FROM TGFEST EST
      INNER JOIN TGFPRO PRO ON PRO.CODPROD = EST.CODPROD
      LEFT JOIN TGFGRU GRU ON GRU.CODGRUPOPROD = PRO.CODGRUPOPROD
      LEFT JOIN TGFLOC LOC ON LOC.CODLOCAL = EST.CODLOCAL
      WHERE ${montarSqlFiltrosCopiaEstoque(filtros)}
      ORDER BY NVL(GRU.DESCRGRUPOPROD, 'Sem grupo'), PRO.DESCRPROD, EST.CODLOCAL, EST.CONTROLE
    `);

    if (!itens.length) {
      res.status(422).json({ erro: 'Nenhum saldo de estoque foi encontrado para gerar a copia.' });
      return;
    }

    const [empresaRegistro, grupoRegistro] = await Promise.all([
      executeQuery(`
        SELECT
          NVL(NOMEFANTASIA, RAZAOSOCIAL) AS NOMEEMPRESA,
          NOMEFANTASIA,
          RAZAOSOCIAL
        FROM TSIEMP
        WHERE CODEMP = ${empresa}
      `),
      filtros.grupo
        ? executeQuery(`
            SELECT DESCRGRUPOPROD
            FROM TGFGRU
            WHERE CODGRUPOPROD = ${filtros.grupo}
          `)
        : Promise.resolve([])
    ]);
    const nomeLocal = local === null
      ? 'Todos os locais'
      : (itens.find((item) => Number(item.CODLOCAL) === local)?.DESCRLOCAL || `Local ${local}`);
    const sessao = estoqueContagemStore.criar({
      empresa,
      nomeEmpresa: empresaRegistro?.NOMEEMPRESA
        || empresaRegistro?.EMPRESA
        || empresaRegistro?.NOMEFANTASIA
        || empresaRegistro?.RAZAOSOCIAL,
      nomeGrupo: grupoRegistro?.[0]?.DESCRGRUPOPROD || null,
      local,
      nomeLocal,
      filtros,
      usuario: req.usuario,
      itens
    });

    res.status(201).json({ sessao: serializarSessaoContagemEstoque(sessao) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message || 'Nao foi possivel criar a copia de estoque.' });
  }
});

router.get('/estoque-contagem/sessoes/:id', (req, res) => {
  const sessao = estoqueContagemStore.obter(req.params.id);
  if (!sessao) {
    res.status(404).json({ erro: 'Contagem de estoque nao encontrada.' });
    return;
  }
  res.json({ sessao: serializarSessaoContagemEstoque(sessao) });
});

router.get('/estoque-contagem/sessoes/:id/localizar', async (req, res) => {
  try {
    const sessao = estoqueContagemStore.obter(req.params.id);
    const codigo = String(req.query.codigo || '').trim();
    if (!sessao || !codigo) {
      res.status(400).json({ erro: 'Informe uma contagem e um codigo validos.' });
      return;
    }

    const codigoSql = textoSql(codigo);
    const codigoNumero = obterNumeroInteiro(codigo);
    const filtroNumero = codigoNumero ? `OR PRO.CODPROD = ${codigoNumero}` : '';
    const produtos = await executeQuery(`
      SELECT DISTINCT PRO.CODPROD
      FROM TGFPRO PRO
      WHERE (
        PRO.REFERENCIA = '${codigoSql}'
        OR PRO.AD_CODBAR = '${codigoSql}'
        OR PRO.AD_CBARANT = '${codigoSql}'
        ${filtroNumero}
        OR EXISTS (
          SELECT 1 FROM TGFVOA VOA
          WHERE VOA.CODPROD = PRO.CODPROD
            AND VOA.CODBARRA = '${codigoSql}'
            AND NVL(VOA.ATIVO, 'S') = 'S'
        )
        OR EXISTS (
          SELECT 1 FROM TGFEST EST
          WHERE EST.CODPROD = PRO.CODPROD
            AND EST.CODBARRA = '${codigoSql}'
        )
      )
    `);
    const codigos = new Set(produtos.map((item) => Number(item.CODPROD)));
    const serializada = serializarSessaoContagemEstoque(sessao);
    const itens = serializada.itens.filter((item) => codigos.has(Number(item.codProd)) && item.podeContar);

    if (!itens.length) {
      res.status(404).json({ erro: 'Produto nao encontrado ou fora do escopo desta contagem.' });
      return;
    }
    res.json({ itens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel localizar o produto.' });
  }
});

router.put('/estoque-contagem/sessoes/:id/itens/:chave', (req, res) => {
  try {
    const sessao = estoqueContagemStore.registrar({
      id: req.params.id,
      chave: decodeURIComponent(req.params.chave),
      quantidade: req.body?.quantidade,
      usuario: req.usuario
    });
    res.json({ sessao: serializarSessaoContagemEstoque(sessao) });
  } catch (err) {
    res.status(422).json({ erro: err.message });
  }
});

router.post('/estoque-contagem/sessoes/:id/finalizar', (req, res) => {
  try {
    const sessao = estoqueContagemStore.finalizarRodada({ id: req.params.id, usuario: req.usuario });
    res.json({ sessao: serializarSessaoContagemEstoque(sessao) });
  } catch (err) {
    res.status(422).json({ erro: err.message });
  }
});

router.post('/estoque-contagem/sessoes/:id/recontar', (req, res) => {
  try {
    const sessao = estoqueContagemStore.iniciarRecontagem({ id: req.params.id, usuario: req.usuario });
    res.json({ sessao: serializarSessaoContagemEstoque(sessao) });
  } catch (err) {
    res.status(422).json({ erro: err.message });
  }
});

router.post('/estoque-contagem/sessoes/:id/concluir-analise', (req, res) => {
  try {
    const sessao = estoqueContagemStore.concluirAnalise({ id: req.params.id, usuario: req.usuario });
    res.json({ sessao: serializarSessaoContagemEstoque(sessao) });
  } catch (err) {
    res.status(422).json({ erro: err.message });
  }
});

router.post('/estoque-contagem/sessoes/:id/aplicar-ajuste', async (req, res) => {
  const id = String(req.params.id);
  if (ajustesEstoqueEmAndamento.has(id)) {
    res.status(409).json({ erro: 'A geracao das notas de ajuste ja esta em andamento.' });
    return;
  }

  ajustesEstoqueEmAndamento.add(id);
  try {
    const sessao = estoqueContagemStore.obter(id);
    if (!sessao) {
      res.status(404).json({ erro: 'Contagem de estoque nao encontrada.' });
      return;
    }
    if (sessao.status === 'AJUSTE_GERADO' && sessao.ajuste?.notas?.length) {
      res.json({
        sessao: serializarSessaoContagemEstoque(sessao),
        notas: sessao.ajuste.notas,
        reutilizada: true
      });
      return;
    }
    if (sessao.status !== 'PRONTA_PARA_AJUSTE') {
      res.status(422).json({ erro: 'A contagem precisa estar pronta para ajuste.' });
      return;
    }

    const plano = planejarAjustesEstoque(sessao);
    if (!plano.itens.length) {
      res.status(422).json({ erro: 'Nao existem divergencias contadas para gerar ajuste.' });
      return;
    }

    const custos = await obterCustosReposicaoAjuste(sessao.empresa, plano.itens);
    const notas = [];
    for (const tipo of ['ENTRADA', 'SAIDA']) {
      const itensTipo = tipo === 'ENTRADA' ? plano.entrada : plano.saida;
      if (!itensTipo.length) continue;

      const template = await obterTemplateNotaAjusteEstoque(sessao.empresa, tipo);
      const lotes = dividirEmLotes(itensTipo);
      for (let indice = 0; indice < lotes.length; indice += 1) {
        notas.push(await gerarNotaPendenteAjuste({
          sessao,
          tipo,
          itens: lotes[indice],
          template,
          custos,
          indice: indice + 1,
          total: lotes.length
        }));
      }
    }

    const atualizada = estoqueContagemStore.registrarAjustes({
      id,
      notas,
      usuario: req.usuario
    });
    res.json({
      sessao: serializarSessaoContagemEstoque(atualizada),
      notas: atualizada.ajuste.notas,
      reutilizada: false
    });
  } catch (err) {
    console.error('Erro ao gerar notas de ajuste da contagem:', err);
    const mensagem = String(err.message || 'Nao foi possivel gerar as notas de ajuste no Sankhya.')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    res.status(422).json({
      erro: mensagem
    });
  } finally {
    ajustesEstoqueEmAndamento.delete(id);
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
    const statusGrade = obterListaFiltroContato(req.query.statusGrade);
    const filtroPerfilGrade = sqlFiltroListaTexto("NVL(TPP.DESCRTIPPARC, 'Sem perfil')", perfisGrade);
    const filtroVendedorGrade = sqlFiltroListaTexto("NVL(VEN.APELIDO, 'Sem vendedor')", vendedoresGrade);
    const filtroStatusGrade = sqlFiltroStatusContato(statusGrade);
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

    const filtrosGrade = `${filtroPerfilGrade}\n${filtroVendedorGrade}\n${filtroStatusGrade}\n${filtroPeriodo}`;
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
        vendedores: facetasVendedor.map((item) => item.VALOR).filter(Boolean),
        status: ['Pendente', 'Aguardando', 'Atualizado']
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

router.post('/contatos/clientes/:codParc/bitrix', async (req, res) => {
  try {
    const codParc = obterNumeroInteiro(req.params.codParc);
    if (!codParc) {
      res.status(400).json({ erro: 'Informe o cliente' });
      return;
    }

    const tituloInformado = String(req.body?.tituloCard || '').trim().slice(0, 255);

    const [parceiro] = await executeQuery(`
      SELECT
        PAR.CODPARC,
        PAR.NOMEPARC,
        PAR.RAZAOSOCIAL,
        PAR.CGC_CPF,
        PAR.TELEFONE,
        PAR.FAX,
        PAR.EMAIL,
        PAR.EMAILNFE,
        PAR.EMAILNOTIFENTREGA,
        NVL(TPP.DESCRTIPPARC, 'Sem perfil') AS PERFIL,
        VEN.APELIDO AS VENDEDOR,
        TRIM(NVL(ENDR.TIPO || ' ', '') || NVL(ENDR.NOMEEND, '')) AS ENDERECO,
        PAR.NUMEND,
        PAR.COMPLEMENTO,
        BAI.NOMEBAI AS BAIRRO,
        CID.NOMECID AS CIDADE,
        UFS.UF,
        PAR.CEP
      FROM TGFPAR PAR
      LEFT JOIN TGFTPP TPP ON TPP.CODTIPPARC = PAR.CODTIPPARC
      LEFT JOIN TGFVEN VEN ON VEN.CODVEND = PAR.CODVEND
      LEFT JOIN TSIEND ENDR ON ENDR.CODEND = PAR.CODEND
      LEFT JOIN TSIBAI BAI ON BAI.CODBAI = PAR.CODBAI
      LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
      LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
      WHERE PAR.CODPARC = ${codParc}
    `);
    if (!parceiro) {
      res.status(404).json({ erro: 'Cliente nao encontrado no Sankhya' });
      return;
    }

    const responsavel = await resolverResponsavelBitrix(req.usuario);

    const contatosSankhya = await executeQuery(`
      SELECT NOMECONTATO, CARGO, TELEFONE, CELULAR, TELRESID, EMAIL
      FROM TGFCTT
      WHERE CODPARC = ${codParc}
        AND NVL(ATIVO, 'S') = 'S'
      ORDER BY NVL(PRIORIDADE, 999), NOMECONTATO
    `);
    const telefones = [
      { value: parceiro.TELEFONE, valueType: 'WORK' },
      { value: parceiro.FAX, valueType: 'MOBILE' },
      ...contatosSankhya.flatMap((contato) => [
        { value: contato.CELULAR, valueType: 'MOBILE' },
        { value: contato.TELEFONE, valueType: 'WORK' },
        { value: contato.TELRESID, valueType: 'HOME' }
      ])
    ].filter((item) => valorPreenchido(item.value));
    const emails = [
      parceiro.EMAIL,
      parceiro.EMAILNFE,
      parceiro.EMAILNOTIFENTREGA,
      ...contatosSankhya.map((contato) => contato.EMAIL)
    ].filter(valorPreenchido);
    const endereco = [parceiro.ENDERECO, parceiro.NUMEND, parceiro.COMPLEMENTO].filter(valorPreenchido).join(' - ');
    const resumoContatos = contatosSankhya.map((contato) => [
      contato.NOMECONTATO,
      contato.CARGO,
      contato.CELULAR || contato.TELEFONE || contato.TELRESID,
      contato.EMAIL
    ].filter(valorPreenchido).join(' | '));
    const camposContatoBitrix = {
      COMPANY_TITLE: parceiro.RAZAOSOCIAL || parceiro.NOMEPARC,
      ADDRESS: endereco,
      ADDRESS_CITY: parceiro.CIDADE || '',
      ADDRESS_REGION: parceiro.UF || '',
      ADDRESS_POSTAL_CODE: parceiro.CEP || '',
      COMMENTS: [
        `Razao social: ${escaparHtmlBitrix(parceiro.RAZAOSOCIAL || '-')}`,
        `CNPJ/CPF: ${escaparHtmlBitrix(parceiro.CGC_CPF || '-')}`,
        `Perfil: ${escaparHtmlBitrix(parceiro.PERFIL || '-')}`,
        `Vendedor: ${escaparHtmlBitrix(parceiro.VENDEDOR || '-')}`,
        ...resumoContatos.map((contato) => `Contato: ${escaparHtmlBitrix(contato)}`)
      ].join('<br>')
    };
    const contatoBitrix = await bitrixService.criarContato({
      codigo: parceiro.CODPARC,
      nome: parceiro.NOMEPARC,
      telefone: telefones,
      email: emails,
      fields: camposContatoBitrix
    });
    const contactId = contatoBitrix.id || contatoBitrix.contato?.ID;
    if (!contactId) throw new Error('O Bitrix nao retornou o ID do contato.');
    if (!contatoBitrix.criado) {
      await bitrixService.sincronizarContato(contactId, {
        telefone: telefones,
        email: emails,
        fields: {
          ...camposContatoBitrix,
          NAME: `${parceiro.CODPARC} - ${parceiro.NOMEPARC}`,
          ORIGINATOR_ID: 'SANKHYA',
          ORIGIN_ID: `SANKHYA:${parceiro.CODPARC}`
        }
      });
    }

    const { funil, etapa } = await localizarFunilEtapaBitrix();
    const categoryId = funil.id ?? funil.ID;
    const stageId = etapa.STATUS_ID ?? etapa.id ?? etapa.ID;
    const titulo = tituloInformado || `${parceiro.CODPARC} - ${parceiro.NOMEPARC}`;
    const negociosExistentes = await bitrixService.consultarNegocios({
      filter: { '=CONTACT_ID': contactId, '=CATEGORY_ID': categoryId },
      select: ['ID', 'TITLE', 'CATEGORY_ID', 'STAGE_ID', 'CONTACT_ID']
    });
    let negocioId = negociosExistentes[0]?.ID || null;
    let negocioCriado = false;

    if (!negocioId) {
      const negocio = await bitrixService.criarNegocio({
        contactId,
        fields: {
          TITLE: titulo,
          CATEGORY_ID: categoryId,
          STAGE_ID: stageId,
          ASSIGNED_BY_ID: responsavel.id,
          COMMENTS: [
            `Cliente Sankhya: ${parceiro.CODPARC} - ${escaparHtmlBitrix(parceiro.NOMEPARC)}`,
            `Razao social: ${escaparHtmlBitrix(parceiro.RAZAOSOCIAL || '-')}`,
            `CNPJ/CPF: ${escaparHtmlBitrix(parceiro.CGC_CPF || '-')}`,
            `Perfil: ${escaparHtmlBitrix(parceiro.PERFIL || '-')}`,
            `Vendedor: ${escaparHtmlBitrix(parceiro.VENDEDOR || '-')}`,
            `Endereco: ${escaparHtmlBitrix([endereco, parceiro.BAIRRO, parceiro.CIDADE, parceiro.UF].filter(valorPreenchido).join(' - '))}`
          ].join('<br>')
        }
      });
      negocioId = negocio.result;
      negocioCriado = true;
    } else {
      await bitrixService.atualizarNegocio(negocioId, {
        TITLE: titulo,
        ASSIGNED_BY_ID: responsavel.id
      });
    }
    await bitrixService.vincularContatoNegocio(negocioId, contactId);

    res.json({
      ok: true,
      contato: { id: contactId, criado: contatoBitrix.criado },
      negocio: { id: negocioId, criado: negocioCriado },
      responsavel: { id: responsavel.id, nome: responsavel.nomeBitrix || responsavel.nomeSankhya },
      funil: { id: categoryId, nome: funil.name ?? funil.NAME },
      etapa: { id: stageId, nome: etapa.NAME ?? etapa.name }
    });
  } catch (err) {
    console.error(`Falha ao criar card Bitrix para cliente ${req.params.codParc}:`, err.message);
    res.status(502).json({ erro: 'Nao foi possivel criar o card no Bitrix24', detalhes: err.message });
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
      campos.TELEFONE = valorTextoContato(req.body?.telefonePrincipal, 30);
      campos.FAX = valorTextoContato(req.body?.celularPrincipal, 30);
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
      if (!valorPreenchido(req.body?.telefonePrincipal) && !valorPreenchido(req.body?.celularPrincipal)) {
        faltando.push('telefone ou celular principal');
      }
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
  const modo = obterModoConferencia(req.body?.modo);
  const tops = sqlTopsConferencia(modo);
  const tipMov = tipoMovimentoConferencia(modo);

  if (!nunota || codUsu === null) {
    res.status(400).json({ erro: 'Informe pedido e usuário logado' });
    return;
  }

  try {
    const pedidoRows = await executeQuery(`
      SELECT CAB.NUNOTA, CAB.NUCONFATUAL, CAB.QTDVOL, CONF.STATUS,
             TOP.NUCCO, NVL(CCO.EXPLODIRLOTE, 'N') AS EXPLODIRLOTE
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      LEFT JOIN TGFTOP TOP
        ON TOP.CODTIPOPER = CAB.CODTIPOPER
       AND TOP.DHALTER = CAB.DHTIPOPER
      LEFT JOIN TGFCCO CCO
        ON CCO.NUCCO = TOP.NUCCO
      WHERE CAB.NUNOTA = ${nunota}
        AND CAB.CODTIPOPER IN (${tops})
        AND CAB.TIPMOV = '${tipMov}'
        AND ${condicaoStatusConferencia(modo)}
    `);

    const pedido = pedidoRows[0];
    if (!pedido) {
      res.status(404).json({ erro: 'Pedido nao encontrado ou nao esta liberado para conferencia' });
      return;
    }

    if (modo === 'entrada' && !pedido.NUCCO) {
      res.status(409).json({ erro: 'A TOP desta nota de entrada nao possui Configuracao p/ conferencia no Sankhya.' });
      return;
    }

    if (modo === 'entrada' && pedido.EXPLODIRLOTE === 'S') {
      res.status(409).json({ erro: 'A configuracao da conferencia de entrada nao pode usar Detalhar lote pela conferencia.' });
      return;
    }

    if (pedido.NUCONFATUAL) {
      const [conferenciaAtual] = await executeQuery(`
        SELECT NUCONF, STATUS
        FROM TGFCON2
        WHERE NUCONF = ${Number(pedido.NUCONFATUAL)}
      `);

      const statusConferenciaAtual = String(conferenciaAtual?.STATUS || '').toUpperCase();
      const reabrindoDivergente = modo === 'entrada'
        && conferenciaEntradaPodeSerReaberta(statusConferenciaAtual)
        && statusConferenciaAtual === 'D';

      if (conferenciaAtual?.STATUS === 'A' || reabrindoDivergente) {
        await atualizarRegistroApi(
          'CabecalhoConferencia',
          { NUCONF: pedido.NUCONFATUAL },
          {
            CODUSUCONF: codUsu,
            QTDVOL: modo === 'entrada'
              ? Math.max(0, normalizarNumero(pedido.QTDVOL))
              : Math.max(1, normalizarNumero(pedido.QTDVOL)),
            ...(reabrindoDivergente ? { STATUS: 'A', DHFINCONF: '' } : {})
          }
        );

        res.json({
          ok: true,
          nunota,
          nuconf: Number(pedido.NUCONFATUAL),
          status: 'EM ANDAMENTO',
          reabertaDivergente: reabrindoDivergente
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
          QTDVOL: modo === 'entrada'
            ? Math.max(0, normalizarNumero(pedido.QTDVOL))
            : Math.max(1, normalizarNumero(pedido.QTDVOL))
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

    let nuconf;
    if (modo === 'entrada') {
      nuconf = await criarConferenciaEntradaNativa({
        nunota,
        codUsu,
        qtdVol: pedido.QTDVOL
      });
    } else {
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
        DHINICONF: formatarDataHoraSankhya(),
        CODUSUCONF: codUsu,
        QTDVOL: Math.max(1, normalizarNumero(pedido.QTDVOL))
      });

      await atualizarRegistroApi('CabecalhoNota', { NUNOTA: nunota }, { NUCONFATUAL: nuconf });
    }

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

router.get('/fila-conferencia/progresso', (req, res) => {
  const nunota = obterNumeroInteiro(req.query?.nunota);

  if (!nunota) {
    res.status(400).json({ erro: 'Informe pedido ou nota da conferencia' });
    return;
  }

  const progresso = conferenciaProgressStore.obter(nunota);
  res.json({
    ok: true,
    progresso,
    resumoCaixas: conferenciaProgressStore.resumoCaixas(nunota)
  });
});

router.post('/fila-conferencia/progresso', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const nuconf = obterNumeroInteiro(req.body?.nuconf);
  const codUsu = obterCodigoUsuario(req.usuario?.codUsu);
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const modo = obterModoConferencia(req.body?.modo);
  // O progresso da caixa precisa ser compartilhado entre dispositivos, mas nao deve
  // reaplicar os detalhes nativos da conferencia a cada impressao ou encerramento.
  const sincronizarSankhya = req.body?.sincronizarSankhya !== false;

  if (!nunota || codUsu === null) {
    res.status(400).json({ erro: 'Informe pedido e usuário logado' });
    return;
  }

  try {
    const [pedido] = await executeQuery(`
      SELECT CAB.NUNOTA, CAB.NUCONFATUAL, CAB.CODTIPOPER, CAB.TIPMOV,
             CAB.STATUSNOTA, CAB.LIBCONF, CONF.STATUS
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      WHERE CAB.NUNOTA = ${nunota}
    `);

    if (!pedido) {
      res.status(404).json({ erro: 'Pedido não encontrado' });
      return;
    }

    if (modo === 'entrada' && (
      !TOPS_CONFERENCIA.entrada.includes(Number(pedido.CODTIPOPER))
      || pedido.TIPMOV !== 'C'
      || !['A', 'P', 'L'].includes(String(pedido.STATUSNOTA || '').toUpperCase())
    )) {
      res.status(409).json({ erro: 'A nota não está liberada para conferência de entrada no Sankhya' });
      return;
    }

    const statusProgressoPermitido = modo === 'entrada'
      ? ['A', 'D'].includes(String(pedido.STATUS || '').toUpperCase())
      : pedido.STATUS === 'A';
    if (pedido.NUCONFATUAL && pedido.STATUS && !statusProgressoPermitido) {
      conferenciaProgressStore.remover(nunota);
      res.status(409).json({ erro: 'Conferência já finalizada ou em outro status no Sankhya' });
      return;
    }

    const progresso = conferenciaProgressStore.salvar({
      nunota,
      nuconf: nuconf || pedido.NUCONFATUAL || null,
      codUsu,
      itens
    });

    if (modo === 'entrada' && sincronizarSankhya) {
      const nuconfEntrada = Number(pedido.NUCONFATUAL || nuconf || 0);
      if (!nuconfEntrada) {
        res.status(409).json({ erro: 'A conferência de entrada ainda não foi iniciada no Sankhya' });
        return;
      }
      await enfileirarSincronizacaoEntrada(nunota, () => sincronizarDetalhesConferenciaEntrada({
        nuconf: nuconfEntrada,
        nunota,
        itens
      }));
    }

    res.json({ ok: true, progresso, sincronizadoSankhya: modo !== 'entrada' || sincronizarSankhya });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar o progresso da conferência' });
  }
});

router.get('/fila-conferencia/progresso/caixas', (req, res) => {
  const nunota = obterNumeroInteiro(req.query?.nunota);

  if (!nunota) {
    res.status(400).json({ erro: 'Informe a nota da conferência' });
    return;
  }

  const resumo = conferenciaProgressStore.resumoCaixas(nunota);
  res.json({ ok: true, resumo });
});

router.post('/fila-conferencia/progresso/caixas/encerrar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const caixaId = obterNumeroInteiro(req.body?.caixaId);
  const modo = obterModoConferencia(req.body?.modo);

  if (!nunota || !caixaId) {
    res.status(400).json({ erro: 'Informe a nota e a caixa' });
    return;
  }

  if (modo !== 'entrada') {
    res.status(409).json({ erro: 'O fechamento de caixa está disponível somente na conferência de entrada' });
    return;
  }

  const resultado = conferenciaProgressStore.encerrarCaixa({ nunota, caixaId });
  if (!resultado.encontrado) {
    res.status(404).json({ erro: 'A caixa não possui leituras salvas para esta nota' });
    return;
  }

  if (!resultado.alterado) {
    res.status(409).json({
      erro: 'Esta caixa ja foi encerrada em outro dispositivo',
      resumo: conferenciaProgressStore.resumoCaixas(nunota)
    });
    return;
  }

  res.json({
    ok: true,
    resumo: conferenciaProgressStore.resumoCaixas(nunota)
  });
});

router.post('/fila-conferencia/confirmar', async (req, res) => {
  const nunota = obterNumeroInteiro(req.body?.nunota);
  const nuconfInformado = obterNumeroInteiro(req.body?.nuconf);
  const codUsu = obterCodigoUsuario(req.usuario?.codUsu);
  const numeroVolumes = Number(req.body?.volumes);
  const volumes = Number.isInteger(numeroVolumes) && numeroVolumes >= 0 ? numeroVolumes : null;
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const modo = obterModoConferencia(req.body?.modo);
  const tops = sqlTopsConferencia(modo);
  const tipMov = tipoMovimentoConferencia(modo);

  const volumesInvalidos = modo === 'saida' ? !volumes : volumes === null;
  if (!nunota || codUsu === null || volumesInvalidos || itens.length === 0) {
    res.status(400).json({ erro: 'Informe pedido, usuário logado, quantidade de volumes e itens conferidos' });
    return;
  }

  let finalizacaoRegistrada = false;
  try {
    if (finalizacoesConferenciaEmAndamento.has(nunota)) {
      res.status(409).json({
        erro: 'Esta conferência já está sendo finalizada. Aguarde a conclusão antes de tentar novamente.'
      });
      return;
    }
    finalizacoesConferenciaEmAndamento.add(nunota);
    finalizacaoRegistrada = true;

    const pedidoRows = await executeQuery(`
      SELECT
        CAB.NUNOTA,
        CAB.NUCONFATUAL,
        CAB.QTDVOL,
        CAB.TIPMOV,
        TOP.NUCCO,
        NVL(CCO.EXPLODIRLOTE, 'N') AS EXPLODIRLOTE,
        CONF.STATUS,
        NVL(CCO.FATAOCONCLUIR, 'N') AS FATAOCONCLUIR,
        NVL(CCO.GERARPEDCOMPL, 'N') AS GERARPEDCOMPL
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      LEFT JOIN TGFTOP TOP
        ON TOP.CODTIPOPER = CAB.CODTIPOPER
       AND TOP.DHALTER = CAB.DHTIPOPER
      LEFT JOIN TGFCCO CCO
        ON CCO.NUCCO = TOP.NUCCO
      WHERE CAB.NUNOTA = ${nunota}
        AND CAB.CODTIPOPER IN (${tops})
        AND CAB.TIPMOV = '${tipMov}'
        AND ${condicaoStatusConferencia(modo)}
    `);

    const pedido = pedidoRows[0];
    if (!pedido) {
      res.status(404).json({ erro: 'Pedido não encontrado ou não está liberado para conferência' });
      return;
    }

    if (modo === 'entrada' && !pedido.NUCCO) {
      res.status(409).json({ erro: 'A TOP desta nota de entrada não possui configuração para conferência no Sankhya.' });
      return;
    }

    if (modo === 'entrada' && pedido.EXPLODIRLOTE === 'S') {
      res.status(409).json({ erro: 'A configuração da conferência de entrada não pode usar detalhamento de lote pela conferência.' });
      return;
    }

    const statusPermitido = modo === 'entrada'
      ? ['A', 'D'].includes(String(pedido.STATUS || '').toUpperCase())
      : pedido.STATUS === 'A';
    if (pedido.NUCONFATUAL && !statusPermitido) {
      res.status(409).json({ erro: 'Pedido já possui conferência finalizada ou está em outro status no Sankhya' });
      return;
    }

    const usuarioRows = await executeQuery(`
      SELECT CODUSU
      FROM TSIUSU
      WHERE CODUSU = ${codUsu}
    `);

    if (usuarioRows.length === 0) {
      res.status(400).json({ erro: 'Conferente não encontrado no Sankhya' });
      return;
    }

    let itensPedido = await executeQuery(`
      SELECT
        CAB.CODEMP,
        ITE.*
      FROM TGFITE ITE
      JOIN TGFCAB CAB
        ON CAB.NUNOTA = ITE.NUNOTA
      WHERE ITE.NUNOTA = ${nunota}
      ORDER BY ITE.SEQUENCIA
    `);

    const conferidosPorSequencia = new Map(
      itens.map((item) => [Number(item.sequencia), normalizarNumero(item.qtdConferida)])
    );
    const cortadosPorSequencia = new Map(
      itens.map((item) => [Number(item.sequencia), normalizarNumero(item.qtdCortada)])
    );
    const possuiQuantidadeMaiorEntrada = modo === 'entrada' && itensPedido.some((item) => {
      const qtdEsperada = normalizarNumero(item.QTDNEG);
      const qtdConferida = conferidosPorSequencia.get(Number(item.SEQUENCIA)) ?? 0;
      return qtdConferida > qtdEsperada + 0.0001;
    });

    const divergencias = itensPedido
      .map((item) => {
        const qtdEsperada = normalizarNumero(item.QTDNEG);
        const qtdConferida = conferidosPorSequencia.get(Number(item.SEQUENCIA)) ?? 0;
        const qtdCortada = cortadosPorSequencia.get(Number(item.SEQUENCIA)) ?? 0;
        const quantidadeExcedenteEntrada = modo === 'entrada' && qtdConferida > qtdEsperada + 0.0001;

        return {
          sequencia: item.SEQUENCIA,
          codProd: item.CODPROD,
          qtdEsperada,
          qtdConferida,
          qtdCortada,
          ok: quantidadeExcedenteEntrada
            || Math.abs(qtdEsperada - (qtdConferida + qtdCortada)) < 0.0001
        };
      })
      .filter((item) => !item.ok);

    if (divergencias.length > 0) {
      res.status(409).json({
        erro: 'Existem divergências na conferência',
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
        res.status(409).json({ erro: 'A conferência iniciada não pertence a este pedido no Sankhya' });
        return;
      }

      const statusAtualPermitido = modo === 'entrada'
        ? ['A', 'D'].includes(String(conferenciaAtual.STATUS || '').toUpperCase())
        : conferenciaAtual.STATUS === 'A';
      if (conferenciaAtual.STATUS && !statusAtualPermitido) {
        res.status(409).json({ erro: 'A conferência já está finalizada ou em outro status no Sankhya' });
        return;
      }

      dhInicioConferencia = conferenciaAtual.DHINICONF || null;
    }

    if (!conferenciaJaIniciada) {
      if (modo === 'entrada') {
        nuconf = await criarConferenciaEntradaNativa({
          nunota,
          codUsu,
          qtdVol: pedido.QTDVOL
        });
      } else {
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
          QTDVOL: modo === 'entrada'
            ? Math.max(0, normalizarNumero(pedido.QTDVOL))
            : Math.max(1, normalizarNumero(pedido.QTDVOL))
        });
      }
      dhInicioConferencia = agoraSankhya;
    } else {
      await atualizarRegistroApi(
        'CabecalhoConferencia',
        { NUCONF: nuconf },
        {
          CODUSUCONF: codUsu,
          QTDVOL: modo === 'entrada'
            ? Math.max(0, normalizarNumero(pedido.QTDVOL))
            : Math.max(1, normalizarNumero(pedido.QTDVOL))
        }
      );
    }

    const cortesAplicados = modo === 'saida'
      ? await aplicarCortesNoPedido({
          nunota,
          itensPedido,
          conferidosPorSequencia,
          cortadosPorSequencia
        })
      : [];

    let lotesSeparados = [];
    if (modo === 'entrada') {
      const desmembramento = await desmembrarItensEntradaPorLote({
        nunota,
        itensPedido,
        itensInformados: itens
      });
      lotesSeparados = desmembramento.separacoes;
      itensPedido = desmembramento.itensPedido;

      if (lotesSeparados.length > 0) {
        conferenciaProgressStore.salvar({
          nunota,
          nuconf,
          codUsu,
          itens
        });
      }
    }

    const controlesAplicados = modo === 'entrada'
      ? await aplicarControlesEntradaNaNota({
          nunota,
          itensPedido,
          itensInformados: itens
        })
      : [];

    if (modo === 'entrada') {
      await enfileirarSincronizacaoEntrada(nunota, () => sincronizarDetalhesConferenciaEntrada({
        nuconf,
        nunota,
        itens
      }));
    } else {
      await salvarDetalhesConferenciaSankhya({ nuconf, nunota });
    }

    if (modo === 'entrada' && String(pedido.STATUS || '').trim().toUpperCase() === 'D') {
      await atualizarRegistroApi(
        'CabecalhoConferencia',
        { NUCONF: nuconf },
        { STATUS: 'A', DHFINCONF: '' }
      );
    }

    let resultadoFinalizacao = null;
    let resultadoDivergenciaEntrada = null;
    let erroFinalizacaoNativa = null;

    try {
      resultadoFinalizacao = await finalizarConferenciaNativa(nuconf, nunota);

      if (modo === 'entrada' && deveAplicarDivergenciaEntrada(resultadoFinalizacao, {
        possuiQuantidadeMaior: possuiQuantidadeMaiorEntrada,
        gerarPedidoComplementar: String(pedido.GERARPEDCOMPL || '').toUpperCase() === 'S'
      })) {
        resultadoDivergenciaEntrada = await aplicarDivergenciaEntradaNativa(nunota, pedido.QTDVOL);
        if (!retornoPossuiDocumentosAuxiliares(resultadoDivergenciaEntrada)) {
          resultadoFinalizacao = await finalizarConferenciaNativa(nuconf, nunota);
        }
      }
    } catch (err) {
      erroFinalizacaoNativa = err;
    }

    const [conferenciaFinal] = await executeQuery(`
      SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF, NUPEDCOMP, NUNOTADEV
      FROM TGFCON2
      WHERE NUCONF = ${nuconf}
    `);

    let conferenciaConferida = conferenciaFinal;
    let fechamentoOperacionalAplicado = false;

    if (
      modo === 'saida'
      && conferenciaConferida?.STATUS !== 'F'
      && finalizacaoPermiteFechamentoOperacional(resultadoFinalizacao)
    ) {
      await finalizarConferenciaOperacional(nuconf, nunota, codUsu, pedido.QTDVOL);
      fechamentoOperacionalAplicado = true;
      [conferenciaConferida] = await executeQuery(`
        SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF, NUPEDCOMP, NUNOTADEV
        FROM TGFCON2
        WHERE NUCONF = ${nuconf}
      `);
    }

    if (conferenciaConferida?.STATUS !== 'F') {
      const finalizadoDivergente = modo === 'entrada'
        && String(conferenciaConferida?.STATUS || '').toUpperCase() === 'D';
      if (finalizadoDivergente) {
        conferenciaProgressStore.salvar({
          nunota,
          nuconf,
          codUsu,
          itens
        });
      }

      if (erroFinalizacaoNativa && !finalizadoDivergente) {
        throw erroFinalizacaoNativa;
      }

      const detalhesSankhya = [
        traduzirStatusConferencia(conferenciaConferida?.STATUS),
        erroFinalizacaoNativa?.message,
        ...coletarDetalhesSankhya(resultadoFinalizacao)
      ].filter(Boolean);

      res.status(409).json({
        erro: 'O Sankhya recebeu a conferência, mas não finalizou como conferido',
        statusSankhya: conferenciaConferida?.STATUS || null,
        progressoPreservado: finalizadoDivergente,
        detalhesSankhya,
        resultadoFinalizacao
      });
      return;
    }

    await preservarConferenteFinalizacao(nuconf, codUsu, dhInicioConferencia, conferenciaConferida.DHFINCONF);
    [conferenciaConferida] = await executeQuery(`
      SELECT NUCONF, NUNOTAORIG, STATUS, CODUSUCONF, DHFINCONF, NUPEDCOMP, NUNOTADEV
      FROM TGFCON2
      WHERE NUCONF = ${nuconf}
    `);

    const datasEstoqueAtualizadas = modo === 'entrada'
      ? await atualizarDatasEstoqueEntrada({ itensPedido, itensInformados: itens })
      : [];

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
              : ['O Sankhya concluiu a conferência, mas não gerou uma nota de faturamento.']
          }
        : {
            status: 'NAO_CONFIGURADO',
            automatico: false,
            nota: null,
            detalhes: ['Faturamento automático não configurado para esta conferência.']
          };

    res.json({
      ok: true,
      nunota,
      nuconf,
      status: 'CONFERIDO',
      fechamentoOperacionalAplicado,
      cortesAplicados,
      lotesSeparados,
      controlesAplicados,
      documentosAuxiliares: modo === 'entrada'
        ? documentosAuxiliaresConferencia(conferenciaConferida)
        : null,
      datasEstoqueAtualizadas,
      faturamento,
      resultadoFinalizacao,
      resultadoDivergenciaEntrada
    });
  } catch (err) {
    console.error(err);
    const erroRevisavel = ['LOTES_LEITURAS_DIVERGENTES', 'LOTES_QUANTIDADE_DIVERGENTE']
      .includes(err.tipo);
    res.status(erroRevisavel ? 409 : 500).json({
      erro: erroRevisavel ? 'Revise os lotes e as quantidades antes de concluir' : 'Erro ao confirmar conferência',
      codigo: err.tipo || null,
      detalhesSankhya: [err.message].filter(Boolean)
    });
  } finally {
    if (finalizacaoRegistrada) finalizacoesConferenciaEmAndamento.delete(nunota);
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

router.get('/fila-conferencia/pedidos/:nunota/guias-fase', async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }

  try {
    const [faturamento, necessitaGuia] = await Promise.all([
      consultarFaturamentoExistente(nunota),
      pedidoNecessitaGuiaFase(nunota)
    ]);
    res.json({
      pedido: nunota,
      faturado: Boolean(faturamento),
      necessitaGuia,
      guias: guiaFaseStore.listar(nunota)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao consultar as Guias FASE do pedido.' });
  }
});

router.post('/fila-conferencia/pedidos/:nunota/guias-fase', receberGuiasFase, async (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  if (!Array.isArray(req.files) || req.files.length === 0) {
    res.status(400).json({ erro: 'Selecione ao menos uma Guia FASE.' });
    return;
  }

  try {
    const [faturamento, necessitaGuia] = await Promise.all([
      consultarFaturamentoExistente(nunota),
      pedidoNecessitaGuiaFase(nunota)
    ]);
    if (!necessitaGuia) {
      res.status(409).json({ erro: 'Este pedido nao pertence aos grupos que exigem Guia FASE.' });
      return;
    }
    if (!faturamento) {
      res.status(409).json({ erro: 'A Guia FASE so pode ser enviada depois que o pedido for faturado.' });
      return;
    }

    const guias = guiaFaseStore.adicionar({
      nunota,
      arquivos: req.files,
      codUsu: req.usuario?.codUsu
    });
    res.status(201).json({ pedido: nunota, guias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel salvar a Guia FASE.' });
  }
});

router.get('/fila-conferencia/pedidos/:nunota/guias-fase/:id/arquivo', (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  const guia = nunota ? guiaFaseStore.obterArquivo(nunota, req.params.id) : null;
  if (!guia) {
    res.status(404).json({ erro: 'Guia FASE nao encontrada.' });
    return;
  }

  res.setHeader('Content-Type', guia.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(guia.nome)}`);
  res.sendFile(guia.path);
});

router.delete('/fila-conferencia/pedidos/:nunota/guias-fase/:id', (req, res) => {
  const nunota = obterNumeroInteiro(req.params.nunota);
  if (!nunota) {
    res.status(400).json({ erro: 'Informe um pedido valido.' });
    return;
  }
  try {
    const removida = guiaFaseStore.excluir(nunota, req.params.id);
    if (!removida) {
      res.status(404).json({ erro: 'Guia FASE nao encontrada.' });
      return;
    }
    res.json({ pedido: nunota, guias: guiaFaseStore.listar(nunota) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Nao foi possivel excluir a Guia FASE.' });
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
        CAB.CODTIPOPER,
        CAB.TIPMOV,
        CAB.DTNEG,
        CAB.OBSERVACAO,
        CAB.CODPARC,
        PAR.NOMEPARC,
        PAR.RAZAOSOCIAL,
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
        AND (
          (CAB.TIPMOV = 'P' AND CAB.STATUSNOTA = 'L')
          OR
          (CAB.TIPMOV = 'C' AND CAB.STATUSNOTA IN ('A', 'P', 'L'))
        )
    `);

    if (!pedido) {
      res.status(404).json({ erro: 'Documento de conferencia nao encontrado' });
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
      ORDER BY PRO.CODGRUPOPROD, UPPER(PRO.DESCRPROD), ITE.SEQUENCIA
    `);

    pedido.ENDERECO_CLIENTE = [pedido.ENDERECO_CLIENTE, pedido.NUMEND].filter(Boolean).join(' - ');
    pedido.ENDERECO_EMPRESA = [
      [pedido.LOGRADOURO_EMPRESA, pedido.NUMERO_EMPRESA].filter(Boolean).join(', '),
      pedido.BAIRRO_EMPRESA,
      [pedido.CIDADE_EMPRESA, pedido.UF_EMPRESA].filter(Boolean).join('-')
    ].filter(Boolean).join(' - ');

    const separacao = separacaoStore.obter(nunota);
    const itensSeparacao = separacao?.status === 'SEPARADO'
      ? new Map((separacao.itens || []).map((item) => [Number(item.sequencia), item]))
      : null;
    const itensPdf = itens.map((item) => {
      const itemSeparado = itensSeparacao?.get(Number(item.SEQUENCIA));
      return {
        ...item,
        SEPARACAO_CONCLUIDA: Boolean(itemSeparado),
        QTD_SEPARADA: itemSeparado ? Number(itemSeparado.qtdSeparada || 0) : null
      };
    });

    const pdf = await gerarPedidoVendaPdf({
      pedido,
      itens: itensPdf,
      logoPath: path.join(__dirname, 'frontend', 'favicon.png')
    });
    pedidoPrintStore.registrar(nunota, req.usuario?.codUsu);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="documento-conferencia-${nunota}.pdf"`);
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

  if (!nunota || !['danfe', 'boleto', 'completo'].includes(tipo)) {
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

    const pdf = tipo === 'completo'
      ? await gerarDocumentosFiscaisCombinados(nunota)
      : await gerarDocumentoFiscalSankhya(nunota, tipo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${tipo === 'completo' ? 'danfe-boleto' : tipo}-${nunota}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(409).json({
      erro: `Nao foi possivel abrir ${tipo === 'danfe' ? 'o DANFE' : tipo === 'boleto' ? 'o boleto' : 'o DANFE e boleto'}`,
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
  normalizarInicioConferencia,
  normalizarFimConferencia,
  formatarDataHoraSankhya,
  obterIntervaloDatas,
  extrairAvisosDocumento,
  extrairChaveDocumento,
  gerarDocumentoFiscalSankhya,
  obterDanfeArmazenado,
  obterSituacaoDocumentosPedido
};

module.exports = router;
