const TAMANHO_LOTE_NOTA = 20;
const LIMITE_DIFERENCA = 0.000001;
const DATA_FABRICACAO_TECNICA = '2000-01-01';
const DATA_VALIDADE_TECNICA = '2099-12-31';

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function obterContagemFinal(sessao, item) {
  const rodada = String(numero(sessao?.rodadaAtual) || 1);
  const atual = item?.contagens?.[rodada];
  if (atual !== null && atual !== undefined) return numero(atual);
  const primeira = item?.contagens?.['1'];
  return primeira === null || primeira === undefined ? null : numero(primeira);
}

function completarDatasTecnicasItemZerado(item = {}) {
  const controle = texto(item.controle);
  const zerado = item.tipo === 'SAIDA' && Math.abs(numero(item.contagem)) <= LIMITE_DIFERENCA;
  let dtFabricacao = texto(item.dtFabricacao);
  let dtValidade = texto(item.dtValidade || item.dtVal);
  const precisavaFabricacao = !dtFabricacao;
  const precisavaValidade = !dtValidade;

  if (!controle || !zerado || (!precisavaFabricacao && !precisavaValidade)) {
    return {
      ...item,
      dtFabricacao,
      dtValidade,
      datasTecnicasAjuste: false
    };
  }

  if (!dtFabricacao && !dtValidade) {
    dtFabricacao = DATA_FABRICACAO_TECNICA;
    dtValidade = DATA_VALIDADE_TECNICA;
  } else if (!dtFabricacao) {
    // Igualar à validade existente garante que a fabricação técnica nunca
    // fique posterior à validade real de um lote antigo que será zerado.
    dtFabricacao = dtValidade;
  } else if (!dtValidade) {
    // Igualar à fabricação existente mantém a ordem cronológica válida sem
    // inventar vida útil para uma posição que deixará de possuir saldo.
    dtValidade = dtFabricacao;
  }

  return {
    ...item,
    dtFabricacao,
    dtValidade,
    datasTecnicasAjuste: true
  };
}

function chaveSaldoAjuste(item = {}) {
  return [
    numero(item.codProd ?? item.CODPROD),
    numero(item.codLocal ?? item.CODLOCAL),
    texto(item.controle ?? item.CONTROLE) || 'SEM_CONTROLE'
  ].join('|');
}

function reconciliarAjustesComEstoqueAtual(itens = [], saldos = []) {
  const saldosPorChave = new Map(
    saldos.map((saldo) => [chaveSaldoAjuste(saldo), saldo])
  );
  const reconciliados = itens.flatMap((item) => {
    const saldo = saldosPorChave.get(chaveSaldoAjuste(item));
    const estoqueAtual = numero(saldo?.estoqueAtual ?? saldo?.ESTOQUE);
    const reservadoAtual = numero(saldo?.reservadoAtual ?? saldo?.RESERVADO);
    const contagem = numero(item.contagem);
    const diferenca = contagem - estoqueAtual;
    if (Math.abs(diferenca) <= LIMITE_DIFERENCA) return [];

    return [completarDatasTecnicasItemZerado({
      ...item,
      estoqueFoto: numero(item.estoqueFoto ?? item.estoqueSistema),
      estoqueSistema: estoqueAtual,
      estoqueAtualAplicacao: estoqueAtual,
      reservadoAtualAplicacao: reservadoAtual,
      diferenca,
      quantidadeAjuste: Math.abs(diferenca),
      tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA'
    })];
  });

  return {
    itens: reconciliados,
    entrada: reconciliados.filter((item) => item.tipo === 'ENTRADA'),
    saida: reconciliados.filter((item) => item.tipo === 'SAIDA')
  };
}

function planejarAjustesEstoque(sessao) {
  const itens = (sessao?.itens || []).flatMap((item) => {
    const contagem = obterContagemFinal(sessao, item);
    if (contagem === null) return [];

    const estoqueSistema = numero(item.estoqueSistema);
    const diferenca = contagem - estoqueSistema;
    if (Math.abs(diferenca) <= LIMITE_DIFERENCA) return [];

    return [completarDatasTecnicasItemZerado({
      chave: texto(item.chave),
      codProd: numero(item.codProd),
      descrProd: texto(item.descrProd),
      codVol: texto(item.codVol) || 'UN',
      codLocal: numero(item.codLocal),
      controle: texto(item.controle),
      dtFabricacao: texto(item.dtFabricacao),
      dtValidade: texto(item.dtVal || item.dtValidade),
      adicionadoManualmente: item.adicionadoManualmente === true,
      estoqueSistema,
      contagem,
      diferenca,
      quantidadeAjuste: Math.abs(diferenca),
      tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA'
    })];
  });

  return {
    itens,
    entrada: itens.filter((item) => item.tipo === 'ENTRADA'),
    saida: itens.filter((item) => item.tipo === 'SAIDA')
  };
}

function dividirEmLotes(itens, tamanho = TAMANHO_LOTE_NOTA) {
  const lotes = [];
  for (let indice = 0; indice < itens.length; indice += tamanho) {
    lotes.push(itens.slice(indice, indice + tamanho));
  }
  return lotes;
}

function campoApi(valor) {
  return { $: valor === null || valor === undefined ? '' : String(valor) };
}

function numeroApi(valor) {
  const resultado = numero(valor);
  return Number.isInteger(resultado)
    ? String(resultado)
    : resultado.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

function montarPayloadNotaAjuste({
  sessao,
  itens,
  template,
  custos,
  dataNegociacao,
  observacao
}) {
  if (!itens?.length) throw new Error('A nota de ajuste precisa possuir itens.');

  const itensPayload = itens.map((item) => {
    const valorUnitario = numero(custos.get(Number(item.codProd)));
    if (valorUnitario <= 0) {
      throw new Error(`Produto ${item.codProd} sem custo de reposicao para gerar o ajuste.`);
    }
    if (texto(item.controle) && (!texto(item.dtFabricacao) || !texto(item.dtValidade))) {
      throw new Error(
        `Produto ${item.codProd}, lote ${item.controle}: informe fabricacao e validade antes de gerar o ajuste.`
      );
    }

    const itemPayload = {
      NUNOTA: {},
      IGNOREDESCPROMOQTD: campoApi('True'),
      CODPROD: campoApi(item.codProd),
      QTDNEG: campoApi(numeroApi(item.quantidadeAjuste)),
      CODLOCALORIG: campoApi(item.codLocal),
      CONTROLE: campoApi(item.controle),
      CODVOL: campoApi(item.codVol),
      PERCDESC: campoApi(0),
      VLRUNIT: campoApi(numeroApi(valorUnitario))
    };
    return itemPayload;
  });

  return {
    nota: {
      cabecalho: {
        NUNOTA: {},
        CODPARC: campoApi(template.CODPARC),
        DTNEG: campoApi(dataNegociacao),
        CODTIPOPER: campoApi(template.CODTIPOPER),
        CODTIPVENDA: campoApi(template.CODTIPVENDA),
        CODVEND: campoApi(template.CODVEND || 0),
        CODEMP: campoApi(sessao.empresa),
        TIPMOV: campoApi(template.TIPMOV),
        CODNAT: campoApi(template.CODNAT || 0),
        CODCENCUS: campoApi(template.CODCENCUS || 0),
        OBSERVACAO: campoApi(observacao)
      },
      itens: {
        INFORMARPRECO: 'True',
        item: itensPayload
      }
    }
  };
}

function extrairNunotaAjuste(resposta) {
  const valor = resposta?.responseBody?.pk?.NUNOTA?.$
    ?? resposta?.responseBody?.pk?.NUNOTA
    ?? resposta?.responseBody?.NUNOTA?.$
    ?? resposta?.responseBody?.NUNOTA;
  const nunota = Number(valor);
  if (!Number.isInteger(nunota) || nunota <= 0) {
    throw new Error('O Sankhya nao retornou o numero unico da nota de ajuste.');
  }
  return nunota;
}

module.exports = {
  DATA_FABRICACAO_TECNICA,
  DATA_VALIDADE_TECNICA,
  TAMANHO_LOTE_NOTA,
  completarDatasTecnicasItemZerado,
  dividirEmLotes,
  extrairNunotaAjuste,
  montarPayloadNotaAjuste,
  obterContagemFinal,
  planejarAjustesEstoque,
  reconciliarAjustesComEstoqueAtual
};
