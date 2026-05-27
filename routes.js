const express = require('express');
const router = express.Router();
const { executeQuery, executeService } = require('./api/sankhyaApi');
const { criarConferenciaTimerStore } = require('./api/conferenciaTimerStore');
const { criarConferenciaProgressStore } = require('./api/conferenciaProgressStore');

const conferenciaTimerStore = criarConferenciaTimerStore();
const conferenciaProgressStore = criarConferenciaProgressStore();
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

function obterCodigoUsuario(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
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
      AND CAB.CODTIPOPER IN (5, 6)
      AND CAB.STATUSNOTA = 'L'
      ${sqlFiltroEmpresa(empresa)}
    GROUP BY CAB.DTNEG, CAB.NUNOTA, CAB.CODEMP, PAR.RAZAOSOCIAL, CAB.CODPARC, CAB.VLRNOTA,
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
      WHERE CAB.CODTIPOPER IN (5, 6)
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
        AND (CAB.NUCONFATUAL IS NULL OR CONF.STATUS = 'A')
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
        AND CAB.CODTIPOPER IN (5, 6)
        AND CAB.STATUSNOTA = 'L'
      GROUP BY CAB.DTNEG, CAB.NUNOTA, CAB.CODEMP, PAR.RAZAOSOCIAL, CAB.CODPARC, CAB.VLRNOTA, CAB.QTDVOL,
        CAB.NUCONFATUAL, CONF.STATUS, USU.NOMEUSU
      ORDER BY
        CASE WHEN CONF.STATUS = 'A' THEN 0 ELSE 1 END,
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
        QTD_TOTAL: normalizarNumero(row.QTD_TOTAL)
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
        AND CODTIPOPER IN (5, 6)
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
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

  if (!nunota || codUsu === null || itens.length === 0) {
    res.status(400).json({ erro: 'Informe pedido, usuario logado e itens conferidos' });
    return;
  }

  try {
    const pedidoRows = await executeQuery(`
      SELECT CAB.NUNOTA, CAB.NUCONFATUAL, CAB.QTDVOL, CONF.STATUS
      FROM TGFCAB CAB
      LEFT JOIN TGFCON2 CONF
        ON CONF.NUCONF = CAB.NUCONFATUAL
      WHERE CAB.NUNOTA = ${nunota}
        AND CAB.CODTIPOPER IN (5, 6)
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

    const resultadoFinalizacao = await finalizarConferenciaNativa(nuconf, nunota);

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

    res.json({
      ok: true,
      nunota,
      nuconf,
      status: 'CONFERIDO',
      fechamentoOperacionalAplicado,
      cortesAplicados,
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
  obterIntervaloDatas
};

module.exports = router;
