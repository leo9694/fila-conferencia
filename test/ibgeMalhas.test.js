const test = require('node:test');
const assert = require('node:assert/strict');
const { criarServicoMalhasIbge, normalizarNomeGeografico } = require('../api/ibgeMalhas');

function respostaJson(corpo) {
  return { ok: true, json: async () => corpo };
}

test('carrega as UFs e municípios reais do IBGE com cache e nomes normalizados', async () => {
  const urls = [];
  const servico = criarServicoMalhasIbge({
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.includes('/municipios')) {
        return respostaJson([{ id: 5100102, nome: 'Acorizal' }]);
      }
      if (url.includes('estados/51') && url.includes('intrarregiao=municipio')) {
        return respostaJson({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codarea: '5100102' }, geometry: null }] });
      }
      const codigo = url.match(/estados\/(\d+)/)?.[1];
      return respostaJson({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { codarea: codigo }, geometry: null }] });
    }
  });

  const estados = await servico.obterEstados();
  const estadosEmCache = await servico.obterEstados();
  const municipios = await servico.obterMunicipios('MT');

  assert.equal(estados.features.length, 27);
  assert.strictEqual(estadosEmCache, estados);
  assert.equal(estados.features.find((feature) => feature.properties.uf === 'MT').properties.nome, 'Mato Grosso');
  assert.equal(municipios.features[0].properties.nome, 'Acorizal');
  assert.equal(municipios.features[0].properties.nomeNormalizado, 'ACORIZAL');
  assert.equal(urls.filter((url) => /malhas\/estados\/\d+\?/.test(url)).length, 28);
});

test('normaliza nomes geográficos para cruzar cidades com a malha do IBGE', () => {
  assert.equal(normalizarNomeGeografico('São Félix do Araguaia - MT'), 'SAO FELIX DO ARAGUAIA MT');
});
