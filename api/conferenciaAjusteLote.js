function planejarAjusteLote({ item, progresso, controle, quantidade, quantidadeOriginal, controleOriginal }) {
  const loteAtual = String(item.CONTROLE || '').trim();
  const novoLote = String(controle || '').trim();
  const total = Number(item.QTDNEG);
  const conferido = Number(progresso?.qtdConferida || 0);
  const cortado = Number(progresso?.qtdCortada || 0);
  const qtd = Number(quantidade);
  if (Number(quantidadeOriginal) !== total || String(controleOriginal || '').trim() !== loteAtual) {
    throw new Error('O item da nota mudou. Atualize os itens antes de ajustar o lote.');
  }
  if (!loteAtual || !novoLote || novoLote === loteAtual) throw new Error('Selecione outro lote do mesmo produto.');
  if (![total, conferido, cortado, qtd].every(Number.isFinite) || conferido < 0 || cortado < 0
    || qtd <= 0 || qtd > total - conferido - cortado + 0.000001) {
    throw new Error('A quantidade a trocar deve ser positiva e não pode ultrapassar o saldo pendente de conferência.');
  }
  const restante = Number((total - qtd).toFixed(10));
  const grupos = [
    ...(restante > 0 ? [{ controle: loteAtual, quantidade: restante, leituras: [] }] : []),
    { controle: novoLote, quantidade: qtd, leituras: [] }
  ];
  return { sequencia: Number(item.SEQUENCIA), codProd: Number(item.CODPROD), quantidadeOriginal: total, grupos };
}

function remapearProgressoAjusteLote(itens, ajuste) {
  const original = itens.find((item) => Number(item.sequencia) === ajuste.sequenciaOriginal);
  if (!original) throw new Error('Salve o progresso da conferência antes de ajustar o lote.');
  return itens.flatMap((item) => Number(item.sequencia) !== ajuste.sequenciaOriginal ? [item]
    : ajuste.lotes.map((lote, indice) => ({
        ...item,
        sequencia: lote.sequencia,
        qtdConferida: indice === 0 ? Number(item.qtdConferida || 0) : 0,
        qtdCortada: indice === 0 ? Number(item.qtdCortada || 0) : 0,
        leituras: indice === 0 ? item.leituras || [] : []
      })));
}

function validarItensPreservados(originais, atuais, sequenciasAlteradas = [], sequenciasNovas = []) {
  const alteradas = new Set(sequenciasAlteradas);
  const esperadas = new Set([...originais.map((item) => Number(item.SEQUENCIA)), ...sequenciasNovas]);
  if (atuais.length !== esperadas.size || atuais.some((item) => !esperadas.has(Number(item.SEQUENCIA)))) {
    throw new Error('A estrutura da nota mudou durante o ajuste. Revise os itens no Sankhya.');
  }
  for (const original of originais) {
    if (alteradas.has(Number(original.SEQUENCIA))) continue;
    const atual = atuais.find((item) => Number(item.SEQUENCIA) === Number(original.SEQUENCIA));
    const campos = ['CODPROD', 'CODLOCALORIG', 'CODVOL', 'CONTROLE', 'QTDNEG', 'VLRTOT', 'VLRDESC'];
    if (!atual || campos.some((campo) => String(atual[campo] ?? '').trim() !== String(original[campo] ?? '').trim())) {
      throw new Error(`O item ${original.SEQUENCIA} mudou fora do ajuste de lote. Revise a nota no Sankhya.`);
    }
  }
}

module.exports = { planejarAjusteLote, remapearProgressoAjusteLote, validarItensPreservados };
