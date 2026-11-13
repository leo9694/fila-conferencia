const { consultarTdePorCte } = require('./tdeCte');
const { TOPS_FATURAMENTO, sqlRotasFrete, sqlSimulacoes, simularTabelas, sqlFretesReais, compararFrete } = require('./analiseFrete');
const { sqlEscopoNotas } = require('./analiseFreteConsulta');
const { validarPeriodoTransporte } = require('./transporteDashboard');

const tamanhoPagina = 30;
const statusNotas = "'A','P','L'";
const alteracoesPorParceiro = new Set();

function podeAlterarTransportadora(nota) {
  return ['A', 'P'].includes(nota.STATUSNOTA) && !(Number(nota.ORDEMCARGA) > 0);
}

function sqlTransportadoras() {
  return `JOIN TGFCFP CFP ON CFP.NUCFR=T.NUCFR
    JOIN TGFPAR TRA ON TRA.CODPARC=CFP.CODPARC AND TRA.ATIVO='S' AND TRA.TRANSPORTADORA='S'`;
}

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
    WHERE CAB.TIPMOV='V' AND CAB.STATUSNOTA IN (${statusNotas}) AND CAB.CODTIPOPER IN (${TOPS_FATURAMENTO.join(',')})
      ${sqlEscopoNotas({ ...filtros, cliente: '' })}
      ${filtros.cliente ? sqlEscopoNotas(filtros) : ''}
      ${filtros.empresa ? `AND CAB.CODEMP=${filtros.empresa}` : ''}`;
}

async function consultarDefinicaoFrete(filtros, executarConsulta) {
  const { pagina } = filtros;
  const registros = await executarConsulta(`WITH NOTAS AS (
    SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.CODEMP, CAB.ORDEMCARGA, CAB.CODPARC, CAB.DTNEG, CAB.DTFATUR,
      CAB.VLRNOTA, CAB.PESOBRUTO PESO, CAB.QTDVOL, CAB.STATUSNOTA, CAB.CODPARCTRANSP,
      COALESCE(PAR.NOMEPARC, PAR.RAZAOSOCIAL) CLIENTE, PAR.CODCID, COUNT(*) OVER () TOTAL_NOTAS
    ${sqlNotas(filtros)}
    ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC
    OFFSET ${(pagina - 1) * tamanhoPagina} ROWS FETCH NEXT ${tamanhoPagina + 1} ROWS ONLY
  )
  SELECT N.NUNOTA, N.NUMNOTA, N.ORDEMCARGA, N.CODPARC, N.CLIENTE, CID.NOMECID CIDADE, UF.UF,
    N.VLRNOTA, N.PESO, N.QTDVOL, TO_CHAR(N.DTNEG,'DD/MM/YYYY') DATA_NOTA,
    TO_CHAR(N.DTFATUR,'DD/MM/YYYY') DATA_FATURAMENTO,
    N.TOTAL_NOTAS, N.STATUSNOTA, N.CODPARCTRANSP, COALESCE(TRN.NOMEPARC, TRN.RAZAOSOCIAL) TRANSPORTADORA_NOTA,
    COALESCE(TRA.NOMEPARC, TRA.RAZAOSOCIAL) TRANSPORTADORA_CARGA
  FROM NOTAS N LEFT JOIN TSICID CID ON CID.CODCID=N.CODCID
  LEFT JOIN TSIUFS UF ON UF.CODUF=CID.UF
  LEFT JOIN TGFORD ORD ON ORD.CODEMP=N.CODEMP AND ORD.ORDEMCARGA=N.ORDEMCARGA AND N.ORDEMCARGA>0
  LEFT JOIN TGFPAR TRA ON TRA.CODPARC=ORD.CODPARCTRANSP
  LEFT JOIN TGFPAR TRN ON TRN.CODPARC=N.CODPARCTRANSP
  ORDER BY N.DTNEG DESC, N.NUNOTA DESC`);
  const notas = registros.slice(0, tamanhoPagina);
  if (!notas.length) {
    const totais = pagina > 1 ? await executarConsulta(`SELECT COUNT(*) TOTAL_NOTAS ${sqlNotas(filtros)}`) : [];
    return { pagina, total: Number(totais[0]?.TOTAL_NOTAS || 0), temMais: false, colunas: [], linhas: [] };
  }
  const total = Number(notas[0].TOTAL_NOTAS);

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
  const linhas = notas.map(({ TOTAL_NOTAS, ...nota }) => ({
    ...nota,
    sugestoes: simularTabelas(rotasPorNota.get(Number(nota.NUNOTA)) || [])
      .map(({ codigo, valor, regiao }) => ({ codigo, valor, regiao }))
  }));
  const codigos = [...new Set(linhas.filter(podeAlterarTransportadora).flatMap((nota) =>
    nota.sugestoes.filter((sugestao) => sugestao.valor != null).map((sugestao) => Number(sugestao.codigo))))];
  const transportadoras = codigos.length ? await executarConsulta(`SELECT DISTINCT T.NUCFR, TRA.CODPARC,
    COALESCE(TRA.NOMEPARC, TRA.RAZAOSOCIAL) TRANSPORTADORA
    FROM TGFCFR T ${sqlTransportadoras()}
    WHERE T.NUCFR IN (${codigos.join(',')}) ORDER BY T.NUCFR, TRA.CODPARC`) : [];
  return { pagina, total, temMais: registros.length > tamanhoPagina, colunas, linhas, transportadoras };
}

async function alterarTransportadoraDefinicaoFrete(dados, { executarConsulta, atualizarRegistro, salvarRegistro }) {
  const ids = [dados.nunota, dados.tabela, dados.transportadora].map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw Object.assign(new Error('Nota, tabela ou transportadora inválida.'), { statusCode: 400 });
  }
  const [nunota, tabela, transportadora] = ids;
  const consultarNota = async () => (await executarConsulta(`SELECT CAB.CODPARC, CAB.STATUSNOTA, CAB.ORDEMCARGA,
    CAB.CODPARCTRANSP, CPL.CODPARC COMPLEMENTO, CPL.CODPARCTRANSP PREFERENCIAL
    FROM TGFCAB CAB LEFT JOIN TGFCPL CPL ON CPL.CODPARC=CAB.CODPARC
    WHERE CAB.NUNOTA=${nunota} AND CAB.TIPMOV='V' AND CAB.CODTIPOPER IN (${TOPS_FATURAMENTO.join(',')})`))[0];
  const nota = await consultarNota();
  if (!nota || !podeAlterarTransportadora(nota)) {
    throw Object.assign(new Error('A nota precisa estar sem confirmação e sem ordem de carga.'), { statusCode: 409 });
  }
  const parceiro = Number(nota.CODPARC);
  if (alteracoesPorParceiro.has(parceiro)) {
    throw Object.assign(new Error('Já existe uma alteração de transportadora para este parceiro.'), { statusCode: 409 });
  }
  alteracoesPorParceiro.add(parceiro);
  try {
    const [rotas, opcoes] = await Promise.all([
      executarConsulta(sqlSimulacoes([nunota], { porTransportadora: false })),
      executarConsulta(`SELECT COALESCE(TRA.NOMEPARC, TRA.RAZAOSOCIAL) TRANSPORTADORA
        FROM TGFCFR T ${sqlTransportadoras()} WHERE T.NUCFR=${tabela} AND TRA.CODPARC=${transportadora}`)
    ]);
    if (!opcoes.length || !simularTabelas(rotas).some((opcao) => Number(opcao.codigo) === tabela && opcao.valor != null)) {
      throw Object.assign(new Error('A transportadora não está disponível para esta sugestão.'), { statusCode: 409 });
    }
    const atual = await consultarNota();
    if (!atual || !podeAlterarTransportadora(atual) || Number(atual.CODPARC) !== parceiro) {
      throw Object.assign(new Error('A nota mudou no Sankhya. Atualize a consulta.'), { statusCode: 409 });
    }
    const campos = { CODPARCTRANSP: transportadora };
    if (Number(atual.CODPARCTRANSP) !== transportadora) {
      await atualizarRegistro('CabecalhoNota', { NUNOTA: nunota }, campos);
    }
    try {
      if (Number(atual.PREFERENCIAL) !== transportadora) {
        if (atual.COMPLEMENTO != null) await atualizarRegistro('ComplementoParc', { CODPARC: parceiro }, campos);
        else await salvarRegistro('ComplementoParc', { CODPARC: parceiro, ...campos });
      }
    } catch (erro) {
      console.error('Erro ao salvar transportadora preferencial:', erro.message);
      return { codigo: transportadora, nome: opcoes[0].TRANSPORTADORA, preferencialAtualizada: false };
    }
    return { codigo: transportadora, nome: opcoes[0].TRANSPORTADORA, preferencialAtualizada: true };
  } finally {
    alteracoesPorParceiro.delete(parceiro);
  }
}

async function consultarHistoricoDefinicaoFrete(nunota, executarConsulta) {
  const pedidos = await executarConsulta(`SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.VLRNOTA,
    COALESCE(TRA.NOMEPARC, TRA.RAZAOSOCIAL) TRANSPORTADORA,
    TO_CHAR(CAB.DTNEG,'DD/MM/YYYY') DATA_NOTA
    FROM TGFCAB ATUAL JOIN TGFCAB CAB ON CAB.CODPARC=ATUAL.CODPARC
    LEFT JOIN TGFPAR TRA ON TRA.CODPARC=CAB.CODPARCTRANSP
    WHERE ATUAL.NUNOTA=${nunota} AND ATUAL.TIPMOV='V' AND ATUAL.STATUSNOTA IN (${statusNotas})
      AND ATUAL.CODTIPOPER IN (${TOPS_FATURAMENTO.join(',')})
      AND CAB.TIPMOV='V' AND CAB.STATUSNOTA='L' AND CAB.CODTIPOPER=35
      AND (CAB.DTNEG < ATUAL.DTNEG OR (CAB.DTNEG=ATUAL.DTNEG AND CAB.NUNOTA < ATUAL.NUNOTA))
    ORDER BY CAB.DTNEG DESC, CAB.NUNOTA DESC
    FETCH FIRST 3 ROWS ONLY`);
  if (!pedidos.length) return [];

  const ids = pedidos.map((pedido) => Number(pedido.NUNOTA));
  const [{ fretes, tdePorCte }, rotas] = await Promise.all([
    executarConsulta(sqlFretesReais(ids)).then(async (fretes) => ({
      fretes, tdePorCte: await consultarTdePorCte(fretes, executarConsulta)
    })),
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
    const todosDetalhados = ctes.length > 0 && ctes.every((cte) => tdePorCte.has(cte.CHAVEACESSO));
    const totalTde = ctes.reduce((total, cte) => total + (tdePorCte.get(cte.CHAVEACESSO) || 0), 0);
    return { ...pedido, freteReal: real, documentosCte, sugestoes,
      temTde: totalTde > 0 ? true : todosDetalhados ? false : null,
      valorTde: todosDetalhados && totalTde > 0 ? totalTde / 100 : null };
  });
}

module.exports = { filtrosDefinicaoFrete, consultarDefinicaoFrete, consultarHistoricoDefinicaoFrete, alterarTransportadoraDefinicaoFrete };
