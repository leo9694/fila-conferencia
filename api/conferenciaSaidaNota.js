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
    let erroConfirmacao = null;
    let respostaConfirmacao = null;
    try {
      respostaConfirmacao = await executeService('CACSP.confirmarNota', {
        nota: {
          NUNOTA: { $: String(nunota) }, confirmacaoCentralNota: true, ehPedidoWeb: false, atualizaPrecoItemPedCompra: false,
          // Mesmo TXProperties usado pela Central de Vendas ao escolher manter a data original.
          txProperties: { prop: [{ name: 'br.com.utiliza.dtneg.servidor', value: false }] }
        },
        clientEventList: { clientEvent: [{ $: 'br.com.utiliza.dtneg.servidor' }] }
      }, { modulePath: 'mgecom', forceAccessSession: true });
    } catch (error) {
      erroConfirmacao = error;
    }
    // O retorno pode falhar depois de o ERP confirmar. Consulte antes de repetir qualquer escrita.
    nota = await consultarNotaSaida({ nunota, executeQuery });
    if (nota?.STATUSNOTA !== 'L') {
      if (String(respostaConfirmacao?.status) === '4') {
        const eventos = Array.isArray(respostaConfirmacao.clientEvents) ? respostaConfirmacao.clientEvents : [];
        throw new Error(`A conferência foi preservada, mas o Sankhya exige uma confirmação adicional: ${eventos.map((evento) => evento.id).filter(Boolean).join(', ') || 'consulte a Central de Vendas'}. A nota ainda não foi confirmada.`);
      }
      throw new Error(`O Sankhya ainda não confirmou a nota. A conferência foi preservada; verifique as pendências e tente novamente.${erroConfirmacao ? ` Motivo: ${erroConfirmacao.message}` : ''}`);
    }
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
    // QTDCONFERIDA só é considerado para recuperar a versão que gravou o corte
    // nos dois lugares. Após salvar, apenas AD_CORTE conserva esse histórico.
    const corteAnterior = Number(item.AD_CORTE || item.QTDCONFERIDA || 0);
    if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(Number(item.VLRUNIT)) || Number(item.VLRUNIT) < 0
      || !Number.isFinite(corteAnterior) || corteAnterior < 0
      || !Number.isFinite(quantidade) || quantidade < 0 || !Number.isFinite(qtdCortada) || qtdCortada <= 0
      || (Math.abs(original - quantidade - qtdCortada) > 0.0001 && Math.abs(original - quantidade) > 0.0001)) {
      throw new Error(`Corte inválido no item ${sequencia}. Revise a quantidade conferida.`);
    }
    // QTDNEG já reduzida identifica uma repetição após falha parcial. Nesse caso,
    // não acumule o mesmo corte de novo; preencha também cortes do fluxo antigo.
    const corteAcumulado = Math.abs(original - quantidade) <= 0.0001
      ? Math.max(corteAnterior, qtdCortada)
      : corteAnterior + qtdCortada;
    let icms = null;
    // Calcula e digita / Não calcula e digita preservam o imposto já informado.
    // Proporcione os valores existentes, sem mudar alíquotas ou regras da TOP.
    if (['B', 'D'].includes(String(item.CALCICMS || '')) && quantidade > 0) {
      const base = Number(item.BASEICMS || 0);
      const valor = Number(item.VLRICMS || 0);
      if (!Number.isFinite(base) || base < 0 || !Number.isFinite(valor) || valor < 0) throw new Error(`ICMS inválido no item ${sequencia}.`);
      let quantidadeBase = original;
      // Recupera a falha do fluxo antigo: quantidade já reduzida, corte zerado
      // e base ainda igual ao valor original integral (ex.: 100 -> 50 unidades).
      const totalOriginal = (quantidade + qtdCortada) * Number(item.VLRUNIT);
      if (Math.abs(original - quantidade) <= 0.0001 && Number(item.QTDCONFERIDA || 0) === 0
        && Number(item.VLRDESC || 0) === 0 && Math.abs(base - totalOriginal) <= 0.01) {
        quantidadeBase = quantidade + qtdCortada;
      }
      const fator = quantidade / quantidadeBase;
      icms = { base: Math.round((base * fator + Number.EPSILON) * 100) / 100,
        valor: Math.round((valor * fator + Number.EPSILON) * 100) / 100 };
    }
    return { item, sequencia, qtdOriginal: original, qtdConferida: quantidade, qtdCortada, corteAcumulado, novaQuantidade: quantidade, icms };
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
      qtdCortada: corte.corteAcumulado, zerarCorte: true,
      ...(corte.icms ? { baseIcms: corte.icms.base, valorIcms: corte.icms.valor } : {})
    });
  }
  const gravados = await executeQuery(`SELECT SEQUENCIA, QTDNEG, VLRTOT, QTDCONFERIDA, AD_CORTE, BASEICMS, VLRICMS FROM TGFITE WHERE NUNOTA = ${nunota}`);
  for (const corte of cortes) {
    const item = gravados.find((registro) => Number(registro.SEQUENCIA) === corte.sequencia);
    if (corte.novaQuantidade === 0 ? Boolean(item) : !item
      || !(Math.abs(Number(item.QTDNEG) - corte.novaQuantidade) <= 0.0001)
      || !(Math.abs(Number(item.VLRTOT) - corte.novaQuantidade * Number(corte.item.VLRUNIT)) <= 0.01)
      || Number(item.QTDCONFERIDA || 0) !== 0
      || !(Math.abs(Number(item.AD_CORTE) - corte.corteAcumulado) <= 0.0001)
      || (corte.icms && (!(Math.abs(Number(item.BASEICMS) - corte.icms.base) <= 0.01)
        || !(Math.abs(Number(item.VLRICMS) - corte.icms.valor) <= 0.01)))) {
      throw new Error(`O corte do item ${corte.sequencia} não foi aplicado integralmente à nota (quantidade, histórico de corte ou ICMS). A confirmação foi interrompida.`);
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
