const { TOPS_FATURAMENTO, sqlRotasFrete, sqlSimulacoes, simularTabelas, sqlFretesReais, compararFrete } = require('./analiseFrete');
const { sqlEscopoNotas } = require('./analiseFreteConsulta');
const { validarPeriodoTransporte } = require('./transporteDashboard');

const tamanhoPagina = 30;

function filtrosDefinicaoFrete(query) {
  const cliente = String(query.cliente ?? '').trim();
  const empresa = Number(query.empresa || 0);
  const pagina = Number(query.pagina || 1);
  if (cliente.length > 120 || (/^\d+$/.test(cliente) && (!Number.isSafeInteger(Number(cliente)) || Number(cliente) <= 0))) {
    throw new Error('Informe um código ou nome de parceiro válido.');
  }
  if (!Number.isSafeInteger(empresa) || empresa < 0) throw new Error('Informe uma empresa válida.');
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) throw new Error('Página inválida.');
  return { ...validarPeriodoTransporte(query.dataInicial, query.dataFinal), cliente, empresa, pagina };
}

function sqlNotas(filtros) {
  return `FROM TGFCAB CAB
    LEFT JOIN TGFPAR PAR ON PAR.CODPARC=CAB.CODPARC
    WHERE CAB.TIPMOV='V' AND CAB.STATUSNOTA='L' AND CAB.CODTIPOPER IN (${TOPS_FATURAMENTO.join(',')})
      ${sqlEscopoNotas({ ...filtros, cliente: '' })}
      ${filtros.cliente ? sqlEscopoNotas(filtros) : ''}
      ${filtros.empresa ? `AND CAB.CODEMP=${filtros.empresa}` : ''}`;
}

async function consultarDefinicaoFrete(filtros, executarConsulta) {
  const { pagina } = filtros;
  const registros = await executarConsulta(`WITH NOTAS AS (
    SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.ORDEMCARGA, CAB.CODPARC, CAB.DTNEG, CAB.VLRNOTA, CAB.PESOBRUTO PESO, CAB.QTDVOL,
      COALESCE(PAR.NOMEPARC, PAR.RAZAOSOCIAL) CLIENTE, PAR.CODCID
    ${sqlNotas(filtros)}
    ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC
    OFFSET ${(pagina - 1) * tamanhoPagina} ROWS FETCH NEXT ${tamanhoPagina + 1} ROWS ONLY
  )
  SELECT N.NUNOTA, N.NUMNOTA, N.ORDEMCARGA, N.CODPARC, N.CLIENTE, CID.NOMECID CIDADE, UF.UF,
    N.VLRNOTA, N.PESO, N.QTDVOL, TO_CHAR(N.DTNEG,'DD/MM/YYYY') DATA_NOTA
  FROM NOTAS N LEFT JOIN TSICID CID ON CID.CODCID=N.CODCID
  LEFT JOIN TSIUFS UF ON UF.CODUF=CID.UF
  ORDER BY N.DTNEG DESC, N.NUNOTA DESC`);
  const notas = registros.slice(0, tamanhoPagina);
  if (!notas.length) return { pagina, temMais: false, colunas: [], linhas: [] };

  const [tabelas, rotas] = await Promise.all([
    executarConsulta(`WITH DESTINOS AS (
      SELECT DISTINCT CAB.CODEMP, CAB.CODPARC ${sqlNotas(filtros)}
    )
    SELECT DISTINCT T.NUCFR, T.DESCRCALCFRET
    ${sqlRotasFrete({ porTransportadora: false, porDestinos: true })}
    ORDER BY T.NUCFR`),
    executarConsulta(sqlSimulacoes(notas.map((nota) => Number(nota.NUNOTA)), { porTransportadora: false }))
  ]);
  const rotasPorNota = new Map();
  for (const rota of rotas) {
    const id = Number(rota.NUNOTA);
    if (!rotasPorNota.has(id)) rotasPorNota.set(id, []);
    rotasPorNota.get(id).push(rota);
  }
  const colunas = tabelas.map((tabela) => ({ codigo: tabela.NUCFR, nome: tabela.DESCRCALCFRET }));
  const linhas = notas.map((nota) => ({
    ...nota,
    sugestoes: simularTabelas(rotasPorNota.get(Number(nota.NUNOTA)) || [])
      .map(({ codigo, valor, regiao }) => ({ codigo, valor, regiao }))
  }));
  return { pagina, temMais: registros.length > tamanhoPagina, colunas, linhas };
}

async function consultarHistoricoDefinicaoFrete(nunota, executarConsulta) {
  const pedidos = await executarConsulta(`SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.VLRNOTA,
    COALESCE(TRA.NOMEPARC, TRA.RAZAOSOCIAL) TRANSPORTADORA,
    TO_CHAR(CAB.DTNEG,'DD/MM/YYYY') DATA_NOTA
    FROM TGFCAB ATUAL JOIN TGFCAB CAB ON CAB.CODPARC=ATUAL.CODPARC
    LEFT JOIN TGFPAR TRA ON TRA.CODPARC=CAB.CODPARCTRANSP
    WHERE ATUAL.NUNOTA=${nunota} AND ATUAL.TIPMOV='V' AND ATUAL.STATUSNOTA='L'
      AND ATUAL.CODTIPOPER IN (${TOPS_FATURAMENTO.join(',')})
      AND CAB.TIPMOV='V' AND CAB.STATUSNOTA='L' AND CAB.CODTIPOPER=35
      AND (CAB.DTNEG < ATUAL.DTNEG OR (CAB.DTNEG=ATUAL.DTNEG AND CAB.NUNOTA < ATUAL.NUNOTA))
    ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC
    FETCH FIRST 3 ROWS ONLY`);
  if (!pedidos.length) return [];

  const ids = pedidos.map((pedido) => Number(pedido.NUNOTA));
  const [fretes, rotas] = await Promise.all([
    executarConsulta(sqlFretesReais(ids)),
    executarConsulta(sqlSimulacoes(ids, { porTransportadora: false }))
  ]);
  return pedidos.map((pedido) => {
    const id = Number(pedido.NUNOTA);
    const registros = fretes.filter((frete) => Number(frete.PEDIDO) === id);
    const sugestoes = simularTabelas(rotas.filter((rota) => Number(rota.NUNOTA) === id))
      .map(({ codigo, tabela, valor }) => ({ codigo, nome: tabela, valor }));
    const { real, ctes } = compararFrete(pedido, registros, []);
    const documentosCte = ctes.filter(({ CHAVEACESSO }) => /^\d{44}$/.test(CHAVEACESSO))
      .map(({ CHAVEACESSO, NUM_CTE }) => ({ chave: CHAVEACESSO, numero: NUM_CTE }));
    return { ...pedido, freteReal: real, documentosCte, sugestoes };
  });
}

module.exports = { filtrosDefinicaoFrete, consultarDefinicaoFrete, consultarHistoricoDefinicaoFrete };
