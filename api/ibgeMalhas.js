const axios = require('axios');

const UFS_IBGE = Object.freeze([
  ['11', 'RO', 'Rondônia'], ['12', 'AC', 'Acre'], ['13', 'AM', 'Amazonas'], ['14', 'RR', 'Roraima'], ['15', 'PA', 'Pará'], ['16', 'AP', 'Amapá'], ['17', 'TO', 'Tocantins'],
  ['21', 'MA', 'Maranhão'], ['22', 'PI', 'Piauí'], ['23', 'CE', 'Ceará'], ['24', 'RN', 'Rio Grande do Norte'], ['25', 'PB', 'Paraíba'], ['26', 'PE', 'Pernambuco'], ['27', 'AL', 'Alagoas'],
  ['28', 'SE', 'Sergipe'], ['29', 'BA', 'Bahia'], ['31', 'MG', 'Minas Gerais'], ['32', 'ES', 'Espírito Santo'], ['33', 'RJ', 'Rio de Janeiro'], ['35', 'SP', 'São Paulo'],
  ['41', 'PR', 'Paraná'], ['42', 'SC', 'Santa Catarina'], ['43', 'RS', 'Rio Grande do Sul'], ['50', 'MS', 'Mato Grosso do Sul'], ['51', 'MT', 'Mato Grosso'], ['52', 'GO', 'Goiás'], ['53', 'DF', 'Distrito Federal']
].map(([codigo, uf, nome]) => Object.freeze({ codigo, uf, nome })));

const IBGE_MALHAS = 'https://servicodados.ibge.gov.br/api/v3/malhas';
const IBGE_LOCALIDADES = 'https://servicodados.ibge.gov.br/api/v1/localidades';

function normalizarNomeGeografico(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function obterUf(valor) {
  const chave = String(valor || '').trim().toUpperCase();
  return UFS_IBGE.find((item) => item.uf === chave || item.codigo === chave) || null;
}

function criarCache(ttlMs) {
  const entradas = new Map();
  return {
    obter(chave, carregar) {
      const atual = entradas.get(chave);
      if (atual && atual.expiraEm > Date.now()) return atual.promise;
      const promise = Promise.resolve().then(carregar);
      entradas.set(chave, { promise, expiraEm: Date.now() + ttlMs });
      promise.catch(() => entradas.delete(chave));
      return promise;
    }
  };
}

async function buscarJson(fetchImpl, url) {
  // O serviço do IBGE encerra conexões quando recebe muitas requisições HTTP/2
  // simultâneas. No servidor usamos Axios (HTTP/1.1), mantendo o fetch injetável
  // somente nos testes.
  if (fetchImpl === global.fetch) {
    const resposta = await axios.get(url, {
      timeout: 25000,
      headers: { Accept: 'application/geo+json, application/json' }
    });
    return resposta.data;
  }
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 25000);
  try {
    const resposta = await fetchImpl(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: controlador.signal
    });
    if (!resposta.ok) throw new Error(`IBGE respondeu HTTP ${resposta.status}.`);
    return resposta.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function repetirAoFalhar(operacao, tentativas = 3) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < tentativas) await new Promise((resolve) => setTimeout(resolve, tentativa * 350));
    }
  }
  throw ultimoErro;
}

async function mapearComConcorrencia(itens, limite, iterador) {
  const resultado = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      resultado[indice] = await iterador(itens[indice]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultado;
}

function enriquecerFeature(feature, propriedades) {
  return { ...feature, properties: { ...(feature.properties || {}), ...propriedades } };
}

function criarServicoMalhasIbge({ fetchImpl = global.fetch, cacheTtlMs = 24 * 60 * 60 * 1000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch indisponível para consultar as malhas do IBGE.');
  const cache = criarCache(cacheTtlMs);

  async function malhaUf(uf) {
    const geojson = await buscarJson(fetchImpl, `${IBGE_MALHAS}/estados/${uf.codigo}?formato=application/vnd.geo+json&qualidade=minima`);
    return (geojson.features || []).map((feature) => enriquecerFeature(feature, {
      codigoIbge: uf.codigo,
      uf: uf.uf,
      nome: uf.nome
    }));
  }

  return {
    async obterEstados() {
      return cache.obter('estados', async () => ({
        type: 'FeatureCollection',
        features: (await mapearComConcorrencia(UFS_IBGE, 3, (uf) => repetirAoFalhar(() => malhaUf(uf)))).flat()
      }));
    },

    async obterMunicipios(valorUf) {
      const uf = obterUf(valorUf);
      if (!uf) {
        const erro = new Error('UF inválida para carregar municípios.');
        erro.statusCode = 400;
        throw erro;
      }
      return cache.obter(`municipios:${uf.codigo}`, async () => {
        const [geojson, municipios] = await Promise.all([
          repetirAoFalhar(() => buscarJson(fetchImpl, `${IBGE_MALHAS}/estados/${uf.codigo}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`)),
          repetirAoFalhar(() => buscarJson(fetchImpl, `${IBGE_LOCALIDADES}/estados/${uf.codigo}/municipios`))
        ]);
        const nomes = new Map((municipios || []).map((municipio) => [String(municipio.id), municipio.nome]));
        return {
          type: 'FeatureCollection',
          features: (geojson.features || []).map((feature) => {
            const codigoIbge = String(feature.properties?.codarea || '');
            const nome = nomes.get(codigoIbge) || 'Município não identificado';
            return enriquecerFeature(feature, {
              codigoIbge,
              nome,
              nomeNormalizado: normalizarNomeGeografico(nome),
              uf: uf.uf,
              nomeUf: uf.nome
            });
          })
        };
      });
    }
  };
}

module.exports = { UFS_IBGE, criarServicoMalhasIbge, normalizarNomeGeografico };
