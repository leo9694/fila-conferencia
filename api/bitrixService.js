const axios = require('axios');

const STATUS_RETRY = new Set([429, 502, 503, 504]);
const MAX_TENTATIVAS = 4;
const ESPERA_INICIAL_MS = 500;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarWebhook(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function mensagemSegura(error, webhook) {
  const mensagem = String(
    error?.response?.data?.error_description
    || error?.response?.data?.error
    || error?.message
    || 'Erro desconhecido'
  );
  return webhook ? mensagem.replaceAll(webhook, '[BITRIX_WEBHOOK]') : mensagem;
}

function normalizarTelefoneBrasileiro(telefone) {
  let digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (digitos.startsWith('55') && digitos.length >= 12) digitos = digitos.slice(2);

  // Remove o nono digito adicional logo depois do DDD.
  if (digitos.length === 11 && digitos[2] === '9') {
    digitos = `${digitos.slice(0, 2)}${digitos.slice(3)}`;
  }

  return `+55${digitos}`;
}

function normalizarMultifield(valores, tipo, transformacao = (valor) => String(valor || '').trim()) {
  const lista = Array.isArray(valores) ? valores : [valores];
  const unicos = new Map();
  lista.forEach((item) => {
    const objeto = typeof item === 'object' && item !== null ? item : {};
    const valor = transformacao(objeto.VALUE ?? objeto.value ?? item);
    if (!valor || unicos.has(valor)) return;
    unicos.set(valor, {
      VALUE: valor,
      VALUE_TYPE: objeto.VALUE_TYPE ?? objeto.valueType ?? tipo
    });
  });
  return [...unicos.values()];
}

function mesclarMultifields(existentes = [], desejados = []) {
  const disponiveis = existentes.filter((item) => item?.ID).map((item) => ({ ...item, usado: false }));
  const resultado = desejados.map((desejado) => {
    const igual = disponiveis.find((item) => !item.usado && String(item.VALUE) === String(desejado.VALUE));
    const reutilizado = igual || disponiveis.find((item) => !item.usado);
    if (reutilizado) reutilizado.usado = true;
    return reutilizado?.ID ? { ...desejado, ID: reutilizado.ID } : desejado;
  });
  disponiveis.filter((item) => !item.usado).forEach((item) => resultado.push({ ID: item.ID, DELETE: 'Y' }));
  return resultado;
}

function extrairItensPaginados(payload) {
  const resultado = payload?.result;
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.items)) return resultado.items;
  if (Array.isArray(resultado?.categories)) return resultado.categories;
  return [];
}

function normalizarNomePessoa(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR');
}

function nomeCompletoUsuario(usuario = {}) {
  return [usuario.NAME, usuario.SECOND_NAME, usuario.LAST_NAME].filter(Boolean).join(' ').trim();
}

function criarBitrixService(options = {}) {
  const webhook = normalizarWebhook(options.webhookUrl ?? process.env.BITRIX_WEBHOOK_URL);
  const http = options.httpClient || axios;
  const aguardar = options.sleep || esperar;
  const logger = options.logger || console;

  function validarConfiguracao() {
    if (!webhook) {
      throw new Error('BITRIX_WEBHOOK_URL nao configurada no ambiente.');
    }
  }

  async function callBitrix(method, params = {}) {
    validarConfiguracao();
    const metodo = String(method || '').trim().replace(/^\/+|\.json$/g, '');
    if (!metodo) throw new Error('Informe o metodo Bitrix24.');

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
      try {
        const response = await http.post(`${webhook}/${metodo}.json`, params, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.data?.error) {
          const apiError = new Error(response.data.error_description || response.data.error);
          apiError.response = response;
          throw apiError;
        }
        return response.data;
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        const mensagem = mensagemSegura(error, webhook);
        const deveRepetir = STATUS_RETRY.has(status) && tentativa < MAX_TENTATIVAS;
        logger.error(`[Bitrix24] metodo=${metodo} status=${status || 'sem_status'} mensagem=${mensagem}`);

        if (!deveRepetir) {
          const erro = new Error(`Falha no Bitrix24 em ${metodo}: ${mensagem}`);
          erro.method = metodo;
          erro.status = status || null;
          throw erro;
        }

        const retryAfter = Number(error?.response?.headers?.['retry-after']);
        const espera = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : ESPERA_INICIAL_MS * (2 ** (tentativa - 1));
        await aguardar(espera);
      }
    }

    throw new Error(`Falha no Bitrix24 em ${method}.`);
  }

  async function listarPaginado(method, params = {}) {
    const itens = [];
    let start = 0;
    let paginas = 0;

    do {
      const payload = await callBitrix(method, { ...params, start });
      itens.push(...extrairItensPaginados(payload));
      paginas += 1;
      const proximo = payload?.next ?? payload?.result?.next;
      if (proximo === undefined || proximo === null || proximo === '') break;
      start = Number(proximo);
      if (!Number.isFinite(start) || paginas >= 500) break;
    } while (true);

    return itens;
  }

  async function testarConexao() {
    return callBitrix('profile');
  }

  async function consultarContatos(params = {}) {
    return listarPaginado('crm.contact.list', params);
  }

  async function buscarContatoPorCodigoSankhya(codigo) {
    const codigoTexto = String(codigo || '').trim();
    if (!codigoTexto) throw new Error('Informe o codigo do cliente Sankhya.');
    const originId = `SANKHYA:${codigoTexto}`;
    const porOrigem = await consultarContatos({
      filter: { '=ORIGIN_ID': originId },
      select: ['ID', 'NAME', 'ORIGIN_ID', 'PHONE', 'EMAIL']
    });
    if (porOrigem[0]) return porOrigem[0];

    const porNome = await consultarContatos({
      filter: { '%NAME': `${codigoTexto} -` },
      select: ['ID', 'NAME', 'ORIGIN_ID', 'PHONE', 'EMAIL']
    });
    return porNome.find((contato) => String(contato.NAME || '').startsWith(`${codigoTexto} -`)) || null;
  }

  async function criarContato({ codigo, nome, telefone, email, fields = {} }) {
    const codigoTexto = String(codigo || '').trim();
    const nomeTexto = String(nome || '').trim();
    if (!codigoTexto || !nomeTexto) throw new Error('Codigo e nome do cliente sao obrigatorios.');

    const existente = await buscarContatoPorCodigoSankhya(codigoTexto);
    if (existente) return { criado: false, contato: existente };

    const payload = await callBitrix('crm.contact.add', {
      fields: {
        ...fields,
        NAME: `${codigoTexto} - ${nomeTexto}`,
        ORIGINATOR_ID: 'SANKHYA',
        ORIGIN_ID: `SANKHYA:${codigoTexto}`,
        PHONE: normalizarMultifield(telefone, 'WORK', normalizarTelefoneBrasileiro),
        EMAIL: normalizarMultifield(email, 'WORK', (valor) => String(valor || '').trim().toLowerCase())
      }
    });
    return { criado: true, id: payload.result };
  }

  async function atualizarContato(id, fields) {
    return callBitrix('crm.contact.update', { id, fields });
  }

  async function sincronizarContato(id, { telefone, email, fields = {} }) {
    const atual = await callBitrix('crm.contact.get', { id });
    const telefones = normalizarMultifield(telefone, 'WORK', normalizarTelefoneBrasileiro);
    const emails = normalizarMultifield(email, 'WORK', (valor) => String(valor || '').trim().toLowerCase());
    return atualizarContato(id, {
      ...fields,
      PHONE: mesclarMultifields(atual.result?.PHONE, telefones),
      EMAIL: mesclarMultifields(atual.result?.EMAIL, emails)
    });
  }

  async function consultarNegocios(params = {}) {
    return listarPaginado('crm.deal.list', params);
  }

  async function criarNegocio({ contactId, fields = {} }) {
    if (!contactId) throw new Error('CONTACT_ID e obrigatorio para criar o negocio.');
    return callBitrix('crm.deal.add', {
      fields: { ...fields, CONTACT_ID: contactId, CONTACT_IDS: [contactId] },
      params: { REGISTER_SONET_EVENT: 'Y' }
    });
  }

  async function atualizarNegocio(id, fields) {
    return callBitrix('crm.deal.update', { id, fields });
  }

  async function excluirNegocio(id) {
    return callBitrix('crm.deal.delete', { id });
  }

  async function vincularContatoNegocio(dealId, contactId) {
    return callBitrix('crm.deal.contact.add', {
      id: dealId,
      fields: { CONTACT_ID: contactId, IS_PRIMARY: 'Y', SORT: 10 }
    });
  }

  async function consultarFunis(params = {}) {
    return listarPaginado('crm.category.list', { entityTypeId: 2, ...params });
  }

  async function consultarEtapas(params = {}) {
    return listarPaginado('crm.status.list', params);
  }

  async function consultarUsuariosAtivos() {
    try {
      return await listarPaginado('user.get', { filter: { ACTIVE: true } });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        throw new Error('O webhook Bitrix precisa da permissao de leitura de usuarios para identificar o responsavel.');
      }
      throw error;
    }
  }

  async function buscarUsuarioPorNome(nomeSankhya) {
    const procurado = normalizarNomePessoa(nomeSankhya);
    if (!procurado) throw new Error('O Sankhya nao retornou o nome do usuario logado.');
    const usuarios = await consultarUsuariosAtivos();
    const candidatos = usuarios.map((usuario) => {
      const completo = normalizarNomePessoa(nomeCompletoUsuario(usuario));
      const primeiroNome = normalizarNomePessoa(usuario.NAME);
      let pontos = 0;
      if (completo === procurado) pontos = 100;
      else if (primeiroNome === procurado) pontos = 90;
      else if (completo.startsWith(`${procurado} `)) pontos = 80;
      else if (procurado.split(' ').every((parte) => completo.split(' ').includes(parte))) pontos = 60;
      return { usuario, pontos };
    }).filter((item) => item.pontos > 0).sort((a, b) => b.pontos - a.pontos);
    if (!candidatos.length) throw new Error(`Usuario "${nomeSankhya}" nao encontrado entre os funcionarios ativos do Bitrix.`);
    if (candidatos.length > 1 && candidatos[0].pontos === candidatos[1].pontos) {
      throw new Error(`Mais de um funcionario do Bitrix corresponde ao usuario "${nomeSankhya}".`);
    }
    return candidatos[0].usuario;
  }

  async function consultarFunisEtapas() {
    const funis = await consultarFunis();
    const resultados = [];
    for (const funil of funis) {
      const entityId = Number(funil.id ?? funil.ID) === 0 ? 'DEAL_STAGE' : `DEAL_STAGE_${funil.id ?? funil.ID}`;
      const etapas = await consultarEtapas({ filter: { ENTITY_ID: entityId } });
      resultados.push({ funil, etapas });
    }
    return resultados;
  }

  return {
    callBitrix,
    listarPaginado,
    testarConexao,
    consultarContatos,
    buscarContatoPorCodigoSankhya,
    criarContato,
    atualizarContato,
    sincronizarContato,
    consultarNegocios,
    criarNegocio,
    atualizarNegocio,
    excluirNegocio,
    vincularContatoNegocio,
    consultarFunis,
    consultarEtapas,
    consultarUsuariosAtivos,
    buscarUsuarioPorNome,
    consultarFunisEtapas
  };
}

const bitrixService = criarBitrixService();

module.exports = {
  ...bitrixService,
  criarBitrixService,
  normalizarTelefoneBrasileiro,
  normalizarNomePessoa
};
