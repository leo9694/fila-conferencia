const { gerarPlanilhaGrade } = require('./relatorioCtes');

function texto(valor) {
  return ['texto', valor ?? '—'];
}

function numerico(valor, estilo) {
  const numero = Number(valor);
  return valor != null && valor !== '' && Number.isFinite(numero)
    ? ['numero', numero, estilo] : texto('—');
}

function moeda(valor) {
  return valor == null ? '—' : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function simulacoesMoeda(simulacoes, campo) {
  if (simulacoes.length === 1 && !(campo === 'valor' && simulacoes[0].erro)) {
    return numerico(simulacoes[0][campo], 2);
  }
  return texto(simulacoes.map((s) => campo === 'valor' && s.erro
    ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(s[campo])).join('\n') || '—');
}

function gerarAnaliseFreteExcel(grupos) {
  const linhas = grupos.flatMap((grupo) => grupo.notasDetalhes.map((nota, i) => {
    const linha = [
      texto(nota.NUMNOTA || '—'),
      texto(String(nota.DATA_PEDIDO || '—').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')),
      texto(`${nota.CODPARC || '—'} - ${nota.CLIENTE || 'Cliente sem nome'}`),
      texto(nota.CIDADE || '—'), texto(nota.TRANSPORTADORA || '—'),
      numerico(nota.VLRNOTA, 2), numerico(nota.PESO || 0, 3), numerico(nota.QTDVOL || 0, 4)
    ];
    // Como na grade, os valores compartilhados aparecem uma vez por CT-e.
    return linha.concat(i > 0 ? Array.from({ length: 6 }, () => texto('')) : [
      texto(grupo.simulacoes.map((s) => s.regiao || 'Rota direta').join('\n') || '—'),
      simulacoesMoeda(grupo.simulacoes, 'valor'),
      texto(grupo.ctes.length ? grupo.ctes.map((c) => c.NUM_CTE || '—').join('\n') : 'Sem CT-e emitido vinculado'),
      numerico(grupo.valorTde, 2),
      numerico(grupo.real, 2),
      grupo.grupoIncompleto ? texto('CT-e com notas fora do período') : simulacoesMoeda(grupo.simulacoes, 'diferenca')
    ]);
  }));
  return gerarPlanilhaGrade({
    titulo: 'Análise de frete',
    cabecalhos: ['Nota', 'Data', 'Cliente', 'Destino', 'Transportadora', 'Valor da venda', 'Peso (kg)', 'Volumes',
      'Região', 'Frete sugerido', 'CT-e', 'TDE', 'Frete real / rateio', 'Diferença'],
    larguras: [12, 14, 45, 26, 32, 18, 14, 12, 28, 24, 30, 15, 20, 25],
    linhas
  });
}

module.exports = { gerarAnaliseFreteExcel };
