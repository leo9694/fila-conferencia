const LIMITE_PERIODO_DIAS_TRANSPORTE = 731;
const UFS_POR_NOME = Object.freeze({
  ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA', CEARA: 'CE', DISTRITO_FEDERAL: 'DF',
  ESPIRITO_SANTO: 'ES', GOIAS: 'GO', MARANHAO: 'MA', MATO_GROSSO: 'MT', MATO_GROSSO_DO_SUL: 'MS', MINAS_GERAIS: 'MG',
  PARA: 'PA', PARAIBA: 'PB', PARANA: 'PR', PERNAMBUCO: 'PE', PIAUI: 'PI', RIO_DE_JANEIRO: 'RJ', RIO_GRANDE_DO_NORTE: 'RN',
  RIO_GRANDE_DO_SUL: 'RS', RONDONIA: 'RO', RORAIMA: 'RR', SANTA_CATARINA: 'SC', SAO_PAULO: 'SP', SERGIPE: 'SE', TOCANTINS: 'TO'
});

function dataIsoValida(valor) {
  const texto = String(valor || '').trim();
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, ano, mes, dia] = match.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function validarPeriodoTransporte(dataInicial, dataFinal) {
  if (!dataIsoValida(dataInicial) || !dataIsoValida(dataFinal)) {
    throw new Error('Informe data inicial e data final validas.');
  }
  const inicio = new Date(`${dataInicial}T00:00:00Z`);
  const fim = new Date(`${dataFinal}T00:00:00Z`);
  const dias = Math.round((fim - inicio) / 86400000) + 1;
  if (dias <= 0) throw new Error('A data final deve ser igual ou posterior a data inicial.');
  if (dias > LIMITE_PERIODO_DIAS_TRANSPORTE) throw new Error('O período máximo para o painel de transporte é de 24 meses.');
  return { inicio: dataInicial, fim: dataFinal, dias };
}

function texto(valor, padrao = '') {
  const resultado = String(valor ?? '').trim();
  return resultado && !['0', '<SEM DESCRIÇÃO>', '<SEM DESCRICAO>'].includes(resultado.toUpperCase()) ? resultado : padrao;
}

function normalizarEstado(valor, padrao = '') {
  const estado = texto(valor);
  if (!estado) return padrao;
  const chave = estado.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, '_').replace(/^_|_$/g, '').toUpperCase();
  if (/^[A-Z]{2}$/.test(chave)) return chave;
  return UFS_POR_NOME[chave] || estado.toUpperCase();
}

function numero(valor) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function normalizarLista(valor) {
  return [...new Set(String(valor || '').split('|').map((item) => item.trim()).filter(Boolean))];
}

function normalizarFiltrosTransporte(query = {}) {
  return {
    transportadoras: normalizarLista(query.transportadoras || query.transportadora),
    empresa: texto(query.empresa),
    estado: normalizarEstado(query.estado),
    cidade: texto(query.cidade).toUpperCase()
  };
}

function normalizarLinha(linha = {}) {
  return {
    chaveCte: texto(linha.CHAVE_CTE || linha.chaveCte || linha.NUM_CTE || linha.numCte),
    codEmp: numero(linha.CODEMP ?? linha.codEmp),
    numCte: texto(linha.NUM_CTE || linha.numCte),
    dataEmissao: linha.DATA_EMISSAO || linha.dataEmissao || null,
    transportadora: texto(linha.TRANSPORTADORA || linha.transportadora, 'NÃO INFORMADA'),
    empresa: texto(linha.EMPRESA || linha.empresa, 'NÃO INFORMADA'),
    parceiro: texto(linha.PARCEIRO || linha.parceiro, 'NÃO INFORMADO'),
    cidade: texto(linha.CIDADE || linha.cidade, 'SEM CIDADE'),
    estado: normalizarEstado(linha.ESTADO || linha.estado, 'SEM UF'),
    numNota: texto(linha.NUM_NOTA || linha.numNota),
    valorPedido: numero(linha.VALOR_PEDIDO ?? linha.valorPedido),
    peso: numero(linha.PESO ?? linha.peso),
    volumes: numero(linha.VOLUMES ?? linha.volumes),
    valorFrete: numero(linha.VALOR_FRETE ?? linha.valorFrete)
  };
}

function criarAcumulador(base = {}) {
  return {
    ...base,
    ctes: 0,
    valorFrete: 0,
    valorPedido: 0,
    peso: 0,
    volumes: 0
  };
}

function adicionarLinha(acumulador, linha) {
  acumulador.ctes += 1;
  acumulador.valorFrete += linha.valorFrete;
  acumulador.valorPedido += linha.valorPedido;
  acumulador.peso += linha.peso;
  acumulador.volumes += linha.volumes;
  return acumulador;
}

function indicadores(item, totalFrete = 0) {
  const valorFrete = numero(item.valorFrete);
  const valorPedido = numero(item.valorPedido);
  const ctes = numero(item.ctes);
  const peso = numero(item.peso);
  return {
    ...item,
    freteMedio: ctes ? valorFrete / ctes : 0,
    fretePorKg: peso ? valorFrete / peso : 0,
    percentualFretePedidos: valorPedido ? valorFrete / valorPedido * 100 : 0,
    participacaoFrete: totalFrete ? valorFrete / totalFrete * 100 : 0
  };
}

function ordenarPorFrete(itens) {
  return itens.sort((a, b) => b.valorFrete - a.valorFrete || b.ctes - a.ctes || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function agrupar(linhas, selecionar) {
  const mapa = new Map();
  linhas.forEach((linha) => {
    const dados = selecionar(linha);
    const chave = dados.chave;
    const atual = mapa.get(chave) || criarAcumulador(dados.base);
    adicionarLinha(atual, linha);
    mapa.set(chave, atual);
  });
  return mapa;
}

function opcoes(linhas, campo, selecionados = []) {
  const valores = new Set(linhas.map((linha) => texto(linha[campo])).filter(Boolean));
  selecionados.forEach((valor) => valores.add(valor));
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function filtrarLinhas(linhas, filtros) {
  return linhas.filter((linha) => (
    (!filtros.transportadoras.length || filtros.transportadoras.includes(linha.transportadora))
    && (!filtros.empresa || linha.empresa === filtros.empresa)
    && (!filtros.estado || linha.estado === filtros.estado)
    && (!filtros.cidade || linha.cidade.toUpperCase() === filtros.cidade)
  ));
}

function filtrarLinhasTransporte(linhasBrutas = [], filtros = {}) {
  const filtrosNormalizados = {
    transportadoras: [], empresa: '', estado: '', cidade: '', ...filtros,
    transportadoras: Array.isArray(filtros.transportadoras) ? filtros.transportadoras : normalizarLista(filtros.transportadoras)
  };
  return filtrarLinhas(linhasBrutas.map(normalizarLinha).filter((linha) => linha.chaveCte), filtrosNormalizados);
}

function consolidarDashboardTransporte(linhasBrutas = [], filtros = {}, ordenacao = 'frete') {
  const filtrosNormalizados = {
    transportadoras: [],
    empresa: '',
    estado: '',
    cidade: '',
    ...filtros,
    transportadoras: Array.isArray(filtros.transportadoras) ? filtros.transportadoras : normalizarLista(filtros.transportadoras)
  };
  const linhas = linhasBrutas.map(normalizarLinha).filter((linha) => linha.chaveCte);
  const filtradas = filtrarLinhas(linhas, filtrosNormalizados);
  const resumoBase = filtradas.reduce((acumulador, linha) => adicionarLinha(acumulador, linha), criarAcumulador());
  const resumo = indicadores(resumoBase, resumoBase.valorFrete);

  const porEstado = agrupar(filtradas, (linha) => ({ chave: linha.estado, base: { uf: linha.estado, nome: linha.estado } }));
  const estados = ordenarPorFrete([...porEstado.values()].map((item) => indicadores(item, resumo.valorFrete)));

  const porCidade = agrupar(filtradas, (linha) => ({
    chave: `${linha.estado}|${linha.cidade}`,
    base: { uf: linha.estado, cidade: linha.cidade, nome: linha.cidade }
  }));
  const cidades = ordenarPorFrete([...porCidade.values()].map((item) => {
    const totalEstado = porEstado.get(item.uf)?.valorFrete || 0;
    return {
      ...indicadores(item, resumo.valorFrete),
      participacaoEstado: totalEstado ? item.valorFrete / totalEstado * 100 : 0
    };
  }));

  const porTransportadora = agrupar(filtradas, (linha) => ({ chave: linha.transportadora, base: { transportadora: linha.transportadora, nome: linha.transportadora } }));
  const ordenadores = {
    frete: (a, b) => b.valorFrete - a.valorFrete,
    ctes: (a, b) => b.ctes - a.ctes,
    peso: (a, b) => b.peso - a.peso,
    medio: (a, b) => b.freteMedio - a.freteMedio,
    percentual: (a, b) => b.percentualFretePedidos - a.percentualFretePedidos
  };
  const transportadoras = [...porTransportadora.values()]
    .map((item) => indicadores(item, resumo.valorFrete))
    .sort(ordenadores[ordenacao] || ordenadores.frete);

  const comparacao = filtrosNormalizados.transportadoras.length > 1
    ? transportadoras.filter((item) => filtrosNormalizados.transportadoras.includes(item.transportadora))
    : [];
  const detalhes = filtradas
    .slice()
    .sort((a, b) => b.valorFrete - a.valorFrete || String(b.dataEmissao).localeCompare(String(a.dataEmissao)))
    .slice(0, 500);

  return {
    resumo,
    estados,
    cidades,
    transportadoras,
    comparacao,
    detalhes,
    detalhesLimitados: filtradas.length > detalhes.length,
    opcoes: {
      transportadoras: opcoes(linhas, 'transportadora', filtrosNormalizados.transportadoras),
      empresas: opcoes(linhas, 'empresa', filtrosNormalizados.empresa ? [filtrosNormalizados.empresa] : []),
      estados: opcoes(linhas, 'estado', filtrosNormalizados.estado ? [filtrosNormalizados.estado] : []),
      cidades: opcoes(linhas, 'cidade', filtrosNormalizados.cidade ? [filtrosNormalizados.cidade] : [])
    }
  };
}

module.exports = {
  LIMITE_PERIODO_DIAS_TRANSPORTE,
  consolidarDashboardTransporte,
  filtrarLinhasTransporte,
  normalizarLinhaTransporte: normalizarLinha,
  normalizarFiltrosTransporte,
  validarPeriodoTransporte
};
