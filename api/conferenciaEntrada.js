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

  const sequenciasUsadas = new Set();
  const atribuicoes = detalhesDesejados.map((detalhe) => {
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
  const gravadosPorChave = new Map();

  for (const gravado of detalhesGravados) {
    const chave = chaveDetalheEntrada(gravado);
    const lista = gravadosPorChave.get(chave) || [];
    lista.push(gravado);
    gravadosPorChave.set(chave, lista);
  }

  if (detalhesGravados.length !== detalhesDesejados.length) {
    erros.push(`quantidade de linhas esperada ${detalhesDesejados.length}, gravada ${detalhesGravados.length}`);
  }

  for (const desejado of detalhesDesejados) {
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

  const chavesDesejadas = new Set(detalhesDesejados.map(chaveDetalheEntrada));
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
    const item = porSequencia.get(Number(informado.sequencia));
    if (!item) throw new Error(`Item ${informado.sequencia} nao pertence a nota de entrada.`);

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

function deveAplicarDivergenciaEntrada(resultadoFinalizacao) {
  const body = resultadoFinalizacao?.responseBody || {};
  return String(body.status || '').toUpperCase() === 'D'
    && String(body.podeCortar || '').toLowerCase() === 'true';
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
  consolidarLeiturasEntrada,
  planejarControlesItensEntrada,
  planejarSincronizacaoDetalhesEntrada,
  validarDetalhesConferenciaEntrada,
  deveAplicarDivergenciaEntrada,
  conferenciaEntradaPodeSerReaberta,
  statusVisualConferencia,
  documentosAuxiliaresConferencia,
  retornoPossuiDocumentosAuxiliares
};
