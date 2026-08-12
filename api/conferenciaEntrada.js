function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function controle(valor) {
  return String(valor ?? '').trim() || ' ';
}

function chaveDetalheEntrada(detalhe) {
  return [
    numero(detalhe?.CODPROD),
    controle(detalhe?.CONTROLE),
    String(detalhe?.CODVOL || '').trim(),
    String(detalhe?.CODBARRA || '').trim()
  ].join('|');
}

function consolidarDetalhesNativosEntrada(detalhes = []) {
  const consolidados = new Map();

  for (const detalhe of detalhes) {
    const chave = chaveDetalheEntrada(detalhe);
    const existente = consolidados.get(chave);
    if (existente) {
      existente.QTDCONF += numero(detalhe?.QTDCONF);
      existente.QTDCONFVOLPAD += numero(detalhe?.QTDCONFVOLPAD);
      continue;
    }

    consolidados.set(chave, {
      ...detalhe,
      QTDCONF: numero(detalhe?.QTDCONF),
      QTDCONFVOLPAD: numero(detalhe?.QTDCONFVOLPAD)
    });
  }

  return [...consolidados.values()];
}

function planejarSincronizacaoDetalhesEntrada(detalhesExistentes, detalhesDesejados) {
  const existentes = [...detalhesExistentes]
    .map((detalhe) => ({ ...detalhe, SEQCONF: numero(detalhe.SEQCONF) }))
    .sort((a, b) => a.SEQCONF - b.SEQCONF);
  const existentesPorChave = new Map();

  for (const existente of existentes) {
    const chave = chaveDetalheEntrada(existente);
    const lista = existentesPorChave.get(chave) || [];
    lista.push(existente);
    existentesPorChave.set(chave, lista);
  }

  const desejadosConsolidados = consolidarDetalhesNativosEntrada(detalhesDesejados);
  const sequenciasUsadas = new Set();
  const atribuicoes = desejadosConsolidados.map((detalhe) => {
    const correspondente = (existentesPorChave.get(chaveDetalheEntrada(detalhe)) || [])
      .find((existente) => !sequenciasUsadas.has(existente.SEQCONF));

    if (correspondente) sequenciasUsadas.add(correspondente.SEQCONF);
    return { detalhe, seqConf: correspondente?.SEQCONF || null, existente: Boolean(correspondente) };
  });

  const sequenciasLivres = existentes
    .filter((existente) => !sequenciasUsadas.has(existente.SEQCONF))
    .map((existente) => existente.SEQCONF);
  let proximaSequencia = Math.max(0, ...existentes.map((existente) => existente.SEQCONF)) + 1;

  for (const atribuicao of atribuicoes) {
    if (atribuicao.seqConf) continue;
    const sequenciaLivre = sequenciasLivres.shift();
    atribuicao.seqConf = sequenciaLivre || proximaSequencia++;
    atribuicao.existente = Boolean(sequenciaLivre);
    sequenciasUsadas.add(atribuicao.seqConf);
  }

  return {
    atribuicoes,
    sequenciasObsoletas: existentes
      .map((existente) => existente.SEQCONF)
      .filter((seqConf) => !sequenciasUsadas.has(seqConf))
  };
}

function validarDetalhesConferenciaEntrada(detalhesDesejados, detalhesGravados) {
  const erros = [];
  const desejadosConsolidados = consolidarDetalhesNativosEntrada(detalhesDesejados);
  const gravadosPorChave = new Map();
  const detalhesAtivos = detalhesGravados.filter((detalhe) => (
    Math.abs(numero(detalhe?.QTDCONF)) > 0.0001
    || Math.abs(numero(detalhe?.QTDCONFVOLPAD)) > 0.0001
  ));

  for (const gravado of detalhesAtivos) {
    const chave = chaveDetalheEntrada(gravado);
    const lista = gravadosPorChave.get(chave) || [];
    lista.push(gravado);
    gravadosPorChave.set(chave, lista);
  }

  if (detalhesAtivos.length !== desejadosConsolidados.length) {
    erros.push(`quantidade de linhas esperada ${desejadosConsolidados.length}, gravada ${detalhesAtivos.length}`);
  }

  for (const desejado of desejadosConsolidados) {
    const chave = chaveDetalheEntrada(desejado);
    const correspondentes = gravadosPorChave.get(chave) || [];
    if (correspondentes.length !== 1) {
      erros.push(`detalhe ${chave} possui ${correspondentes.length} linha(s)`);
      continue;
    }

    const gravado = correspondentes[0];
    if (Math.abs(numero(gravado.QTDCONF) - numero(desejado.QTDCONF)) > 0.0001) {
      erros.push(`quantidade da embalagem divergente em ${chave}`);
    }
    if (Math.abs(numero(gravado.QTDCONFVOLPAD) - numero(desejado.QTDCONFVOLPAD)) > 0.0001) {
      erros.push(`quantidade padrao divergente em ${chave}`);
    }
  }

  const chavesDesejadas = new Set(desejadosConsolidados.map(chaveDetalheEntrada));
  for (const chave of gravadosPorChave.keys()) {
    if (!chavesDesejadas.has(chave)) erros.push(`detalhe inesperado ${chave}`);
  }

  return { valido: erros.length === 0, erros };
}

function consolidarLeiturasEntrada(itensNota, itensInformados) {
  const porSequencia = new Map(itensNota.map((item) => [Number(item.SEQUENCIA), item]));
  const agrupados = new Map();
  const toleranciaResiduoConversao = 0.0001;

  for (const informado of itensInformados) {
    const item = porSequencia.get(Number(informado.sequencia))
      || (informado.extra === true ? {
        SEQUENCIA: Number(informado.sequencia),
        CODPROD: Number(informado.codProd),
        CODVOL: String(informado.codVol || informado.codVolPadrao || 'UN'),
        CODVOLPADRAO: String(informado.codVolPadrao || informado.codVol || 'UN'),
        CONTROLE: ' ',
        QTDNEG: 0,
        CODBARRA: String(informado.codigoBarras || '').trim()
      } : null);
    if (!item) throw new Error(`Item ${informado.sequencia} nao pertence a nota de entrada.`);
    if (!Number.isInteger(Number(item.CODPROD)) || Number(item.CODPROD) <= 0) {
      throw new Error('Produto extra invalido na conferencia de entrada.');
    }

    const qtdConferida = Math.max(0, numero(informado.qtdConferida));

    const leituras = Array.isArray(informado.leituras) && informado.leituras.length > 0
      ? informado.leituras
      : qtdConferida > 0
        ? [{
            codigo: item.CODBARRA || item.CODPROD,
            codVol: item.CODVOLPADRAO || item.CODVOL || 'UN',
            quantidade: qtdConferida,
            quantidadeConvertida: qtdConferida
          }]
        : [];
    const totalConvertido = leituras.reduce(
      (total, leitura) => total + Math.max(0, numero(leitura.quantidadeConvertida)),
      0
    );
    if (Math.abs(totalConvertido - qtdConferida) > 0.0001) {
      throw new Error(`Leituras do produto ${item.CODPROD} nao correspondem a quantidade conferida.`);
    }

    let ultimaChaveLeitura = null;
    let ultimaLeituraUnidadePadrao = false;

    for (const leitura of leituras) {
      const tipoLeitura = String(leitura.tipo || '').trim().toUpperCase();
      const codigoInformado = String(leitura.codigo || item.CODBARRA || item.CODPROD).trim();
      const quantidade = Math.max(0, numero(leitura.quantidade));
      const quantidadeConvertida = Math.max(0, numero(leitura.quantidadeConvertida));
      const leituraUnidadeAlternativa = tipoLeitura === 'UNIDADE_ALTERNATIVA'
        || (!tipoLeitura && Math.abs(quantidadeConvertida - quantidade) > 0.0001);
      // Referencia, codigo do produto e codigos auxiliares servem para localizar o
      // item na tela. Para a conferencia nativa, porem, o Sankhya espera o GTIN da
      // nota ou, quando ele nao existe, o PRODUTONFE. Somente uma unidade
      // alternativa deve preservar o codigo de barras da embalagem lida.
      const leituraNativaDoItem = !leituraUnidadeAlternativa
        && ['REFERENCIA', 'CODIGO_PRODUTO', 'CODIGO_BARRAS'].includes(tipoLeitura);
      const codigo = leituraNativaDoItem
        ? String(item.CODBARRA || codigoInformado).trim()
        : codigoInformado;
      const codVol = String(
        leituraUnidadeAlternativa
          ? (leitura.codVol || item.CODVOL || item.CODVOLPADRAO || 'UN')
          : (item.CODVOLPADRAO || leitura.codVol || item.CODVOL || 'UN')
      ).trim();
      const controleLeitura = String(leitura.controle ?? '').trim();
      const controleItem = controle(controleLeitura || item.CONTROLE);
      if (!codigo || quantidade <= 0 || quantidadeConvertida <= 0) continue;

      const chave = `${item.CODPROD}|${controleItem}|${codVol}|${codigo}`;
      const existente = agrupados.get(chave) || {
        CODBARRA: codigo,
        CODPROD: item.CODPROD,
        CODVOL: codVol,
        CONTROLE: controleItem,
        QTDCONF: 0,
        QTDCONFVOLPAD: 0
      };
      existente.QTDCONF += quantidade;
      existente.QTDCONFVOLPAD += quantidadeConvertida;
      agrupados.set(chave, existente);
      ultimaChaveLeitura = chave;
      ultimaLeituraUnidadePadrao = codVol === String(item.CODVOLPADRAO || item.CODVOL || 'UN').trim();
    }

    // Conversoes de unidade do Sankhya podem deixar residuos como 18,0000036.
    // Quando a leitura fecha a quantidade exibida, preserve o valor exato da nota
    // para que o servico nativo nao classifique a conferencia como "a menor".
    const residuoConversao = numero(item.QTDNEG) - totalConvertido;
    if (
      ultimaChaveLeitura
      && Math.abs(residuoConversao) > Number.EPSILON
      && Math.abs(residuoConversao) <= toleranciaResiduoConversao
    ) {
      const ultimoDetalhe = agrupados.get(ultimaChaveLeitura);
      ultimoDetalhe.QTDCONFVOLPAD += residuoConversao;
      if (ultimaLeituraUnidadePadrao) ultimoDetalhe.QTDCONF += residuoConversao;
    }
  }

  return [...agrupados.values()];
}

function planejarControlesItensEntrada(itensNota, itensInformados) {
  const porSequencia = new Map(itensNota.map((item) => [Number(item.SEQUENCIA), item]));
  const alteracoes = [];

  for (const informado of itensInformados) {
    const item = porSequencia.get(Number(informado.sequencia));
    if (!item && informado.extra === true) continue;
    if (!item) throw new Error(`Item ${informado.sequencia} nao pertence a nota de entrada.`);

    const controles = [...new Set((Array.isArray(informado.leituras) ? informado.leituras : [])
      .map((leitura) => String(leitura?.controle ?? '').trim())
      .filter(Boolean))];

    if (controles.length > 1) {
      throw new Error(
        `O produto ${item.CODPROD} foi conferido com mais de um lote. `
        + 'Separe os lotes em itens distintos na nota antes de finalizar.'
      );
    }

    const controleRecebido = controles[0] || '';
    const controleAtual = String(item.CONTROLE ?? '').trim();
    if (controleRecebido && controleRecebido !== controleAtual) {
      alteracoes.push({
        sequencia: Number(item.SEQUENCIA),
        codProd: Number(item.CODPROD),
        controleAnterior: controleAtual,
        controle: controleRecebido
      });
    }
  }

  return alteracoes;
}

function planejarDesmembramentoLotesEntrada(itensNota, itensInformados) {
  const porSequencia = new Map(itensNota.map((item) => [Number(item.SEQUENCIA), item]));
  const planos = [];

  for (const informado of itensInformados) {
    const item = porSequencia.get(Number(informado.sequencia));
    if (!item && informado.extra === true) continue;
    if (!item) throw new Error(`Item ${informado.sequencia} nao pertence a nota de entrada.`);

    const leituras = Array.isArray(informado.leituras) ? informado.leituras : [];
    const gruposPorControle = new Map();

    for (const leitura of leituras) {
      const controleLeitura = String(leitura?.controle ?? '').trim()
        || String(item.CONTROLE ?? '').trim();
      const quantidadeConvertida = Math.max(0, numero(leitura?.quantidadeConvertida));
      if (!controleLeitura || quantidadeConvertida <= 0) continue;

      const grupo = gruposPorControle.get(controleLeitura) || {
        controle: controleLeitura,
        quantidade: 0,
        leituras: []
      };
      grupo.quantidade += quantidadeConvertida;
      grupo.leituras.push(leitura);
      gruposPorControle.set(controleLeitura, grupo);
    }

    const grupos = [...gruposPorControle.values()];
    if (grupos.length <= 1) continue;

    const quantidadeOriginal = Math.max(0, numero(item.QTDNEG));
    const quantidadeConferida = Math.max(0, numero(informado.qtdConferida));
    const quantidadeLotes = grupos.reduce((total, grupo) => total + grupo.quantidade, 0);

    if (Math.abs(quantidadeLotes - quantidadeConferida) > 0.0001) {
      const erro = new Error(
        `As leituras por lote do produto ${item.CODPROD} nao correspondem a quantidade conferida.`
      );
      erro.tipo = 'LOTES_LEITURAS_DIVERGENTES';
      throw erro;
    }

    if (Math.abs(quantidadeLotes - quantidadeOriginal) > 0.0001) {
      const erro = new Error(
        `O produto ${item.CODPROD} possui mais de um lote e quantidade divergente. `
        + 'Ajuste a quantidade conferida antes de concluir.'
      );
      erro.tipo = 'LOTES_QUANTIDADE_DIVERGENTE';
      throw erro;
    }

    const controleAtual = String(item.CONTROLE ?? '').trim();
    grupos.sort((a, b) => {
      if (a.controle === controleAtual) return -1;
      if (b.controle === controleAtual) return 1;
      return 0;
    });

    planos.push({
      sequencia: Number(item.SEQUENCIA),
      codProd: Number(item.CODPROD),
      quantidadeOriginal,
      grupos
    });
  }

  return planos;
}

function distribuirValorProporcional(valorTotal, quantidades) {
  const total = numero(valorTotal);
  const quantidadeTotal = quantidades.reduce((soma, quantidade) => soma + numero(quantidade), 0);
  let distribuido = 0;

  return quantidades.map((quantidade, indice) => {
    if (indice === quantidades.length - 1) {
      return Number((total - distribuido).toFixed(2));
    }

    const parcela = quantidadeTotal > 0
      ? Number((total * numero(quantidade) / quantidadeTotal).toFixed(2))
      : 0;
    distribuido += parcela;
    return parcela;
  });
}

function distribuirQuantidadeProporcional(quantidadeTotal, quantidades) {
  const total = numero(quantidadeTotal);
  const somaQuantidades = quantidades.reduce((soma, quantidade) => soma + numero(quantidade), 0);
  let distribuido = 0;

  return quantidades.map((quantidade, indice) => {
    if (indice === quantidades.length - 1) {
      return Number((total - distribuido).toFixed(10));
    }

    const parcela = somaQuantidades > 0
      ? Number((total * numero(quantidade) / somaQuantidades).toFixed(10))
      : 0;
    distribuido += parcela;
    return parcela;
  });
}

function deveAplicarDivergenciaEntrada(
  resultadoFinalizacao,
  {
    possuiQuantidadeMaior = false,
    gerarPedidoComplementar = false,
    possuiQuantidadeMenor = false,
    gerarNotaDevolucao = false
  } = {}
) {
  const body = resultadoFinalizacao?.responseBody || {};
  if (String(body.status || '').toUpperCase() !== 'D') return false;

  const possuiCorteNativo = String(body.podeCortar || '').toLowerCase() === 'true';
  const possuiComplementoNativo = possuiQuantidadeMaior && gerarPedidoComplementar;
  const possuiDevolucaoNativa = possuiQuantidadeMenor && gerarNotaDevolucao;
  return possuiCorteNativo || possuiComplementoNativo || possuiDevolucaoNativa;
}

function conferenciaEntradaPodeSerReaberta(status) {
  return ['A', 'D'].includes(String(status || '').trim().toUpperCase());
}

function statusVisualConferencia(status, possuiConferencia = true) {
  if (!possuiConferencia) return 'AGUARDANDO CONFERENCIA';

  const statusNormalizado = String(status || '').trim().toUpperCase();
  if (statusNormalizado === 'A') return 'EM ANDAMENTO';
  if (statusNormalizado === 'D') return 'FINALIZADO DIVERGENTE';
  if (statusNormalizado === 'F') return 'CONFERIDO';
  return 'STATUS DESCONHECIDO';
}

function documentosAuxiliaresConferencia(conferencia) {
  const pedidoComplementar = numero(conferencia?.NUPEDCOMP);
  const notaDevolucao = numero(conferencia?.NUNOTADEV);

  return {
    pedidoComplementar: pedidoComplementar > 0 ? pedidoComplementar : null,
    notaDevolucao: notaDevolucao > 0 ? notaDevolucao : null
  };
}

function retornoPossuiDocumentosAuxiliares(resultado) {
  const notas = resultado?.responseBody?.notas;
  if (!notas) return false;
  if (Array.isArray(notas)) return notas.length > 0;
  if (Array.isArray(notas.nota)) return notas.nota.length > 0;
  return Boolean(notas.nota);
}

module.exports = {
  consolidarDetalhesNativosEntrada,
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
};
