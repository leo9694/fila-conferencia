async function consultarNotaSaida({ nunota, executeQuery }) {
  if (!Number.isSafeInteger(nunota) || nunota <= 0) throw new Error('Nota inválida.');
  const [nota] = await executeQuery(`
    SELECT CAB.NUNOTA, CAB.NUMNOTA, CAB.CODTIPOPER, CAB.TIPMOV, CAB.STATUSNOTA,
      CAB.LIBCONF, CAB.CODEMP, CAB.VLRNOTA, CAB.ORDEMCARGA, CAB.NUCONFATUAL,
      CONF.STATUS AS STATUS_CONF
    FROM TGFCAB CAB LEFT JOIN TGFCON2 CONF ON CONF.NUCONF = CAB.NUCONFATUAL
    WHERE CAB.NUNOTA = ${nunota} AND CAB.CODTIPOPER IN (35, 10) AND CAB.TIPMOV = 'V'
  `);
  return nota || null;
}

async function confirmarNotaSaidaTeste({ nunota, executeQuery, executeService }) {
  let nota = await consultarNotaSaida({ nunota, executeQuery });
  if (!nota || ![35, 10].includes(Number(nota.CODTIPOPER)) || nota.TIPMOV !== 'V') throw new Error('Nota de venda das TOPs 35 ou 10 não encontrada.');
  if (nota.STATUS_CONF !== 'F') throw new Error('Conclua a conferência da nota antes de confirmá-la.');
  if (nota.STATUSNOTA !== 'L') {
    if (!['A', 'P'].includes(nota.STATUSNOTA) || nota.LIBCONF !== 'S') throw new Error('Nota não aprovada para conferência.');
    await executeService('CACSP.confirmarNota', {
      nota: { NUNOTA: { $: String(nunota) }, confirmacaoCentralNota: true, ehPedidoWeb: false, atualizaPrecoItemPedCompra: false }
    }, { modulePath: 'mgecom', forceAccessSession: true });
    nota = await consultarNotaSaida({ nunota, executeQuery });
    if (nota?.STATUSNOTA !== 'L') throw new Error('O Sankhya ainda não confirmou a nota. A conferência foi preservada; verifique as pendências e tente novamente.');
  }
  return { status: 'CONFIRMADA', automatico: false, nota, detalhes: [] };
}

async function aplicarCortesNotaSaidaTeste({ nunota, itensPedido, conferidosPorSequencia, cortadosPorSequencia, salvarQuantidade, excluirItem, executeQuery }) {
  if (!Number.isSafeInteger(nunota) || nunota <= 0) throw new Error('Nota inválida.');
  const cortes = itensPedido.filter((item) => (cortadosPorSequencia.get(Number(item.SEQUENCIA)) || 0) > 0).map((item) => {
    const sequencia = Number(item.SEQUENCIA);
    const quantidade = conferidosPorSequencia.get(sequencia) ?? 0;
    const qtdCortada = cortadosPorSequencia.get(sequencia);
    const original = Number(item.QTDNEG);
    if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(Number(item.VLRUNIT)) || Number(item.VLRUNIT) < 0
      || !Number.isFinite(quantidade) || quantidade < 0 || !Number.isFinite(qtdCortada) || qtdCortada <= 0
      || (Math.abs(original - quantidade - qtdCortada) > 0.0001 && Math.abs(original - quantidade) > 0.0001)) {
      throw new Error(`Corte inválido no item ${sequencia}. Revise a quantidade conferida.`);
    }
    return { item, sequencia, qtdOriginal: original, qtdConferida: quantidade, qtdCortada, novaQuantidade: quantidade };
  });
  if (!cortes.length) return [];
  if (!itensPedido.some((item) => (conferidosPorSequencia.get(Number(item.SEQUENCIA)) || 0) > 0)) throw new Error('Não é possível confirmar uma nota com todos os produtos cortados.');
  for (const corte of cortes) {
    if (corte.novaQuantidade === 0) {
      await excluirItem(nunota, corte.sequencia);
      continue;
    }
    await salvarQuantidade(nunota, corte.item, {
      quantidade: corte.novaQuantidade, controle: corte.item.CONTROLE,
      vlrTot: corte.novaQuantidade * Number(corte.item.VLRUNIT),
      vlrDesc: Number(corte.item.VLRDESC || 0) * corte.novaQuantidade / corte.qtdOriginal,
      zerarCorte: true
    });
  }
  const gravados = await executeQuery(`SELECT SEQUENCIA, QTDNEG, VLRTOT, QTDCONFERIDA FROM TGFITE WHERE NUNOTA = ${nunota}`);
  for (const corte of cortes) {
    const item = gravados.find((registro) => Number(registro.SEQUENCIA) === corte.sequencia);
    if (corte.novaQuantidade === 0 ? Boolean(item) : !item
      || !(Math.abs(Number(item.QTDNEG) - corte.novaQuantidade) <= 0.0001)
      || !(Math.abs(Number(item.VLRTOT) - corte.novaQuantidade * Number(corte.item.VLRUNIT)) <= 0.01)
      || Number(item.QTDCONFERIDA || 0) !== 0) {
      throw new Error(`O corte do item ${corte.sequencia} não foi aplicado à nota. A confirmação foi interrompida.`);
    }
  }
  return cortes.map(({ item, ...corte }) => corte);
}

function sqlHistoricoPedidosSaida(separacoes = {}) {
  const ids = Object.entries(separacoes)
    .filter(([, registro]) => ['SEPARADO', 'EM_SEPARACAO'].includes(registro?.status))
    .map(([nunota]) => Number(nunota))
    .filter((nunota) => Number.isSafeInteger(nunota) && nunota > 0);
  const grupos = [];
  for (let i = 0; i < ids.length; i += 500) {
    grupos.push(`CAB.NUNOTA IN (${ids.slice(i, i + 500).join(', ')})`);
  }
  return `(CAB.CODTIPOPER IN (5, 6, 237) AND CAB.TIPMOV = 'P' AND CAB.STATUSNOTA = 'L'
    AND (CONF.STATUS = 'F'${grupos.length ? ` OR ${grupos.join(' OR ')}` : ''}))`;
}

module.exports = { consultarNotaSaida, confirmarNotaSaidaTeste, aplicarCortesNotaSaidaTeste, sqlHistoricoPedidosSaida };
