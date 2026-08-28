const express = require('express');
const multer = require('multer');
const { EventEmitter } = require('node:events');
const whatsappApi = require('./whatsappApi');
const bitrixService = require('./bitrixService');
const { executeQuery, executeService } = require('./sankhyaApi');
const { criarChatAtendenteStore } = require('./chatAtendenteStore');

const router = express.Router();
const realtime = whatsappApi.createRealtimeBridge();
const atendentes = criarChatAtendenteStore();
const eventosAtendimento = new EventEmitter();
const CONTROLE_CHAMADA_TTL_MS = 4 * 60 * 60 * 1000;
const ATRIBUICAO_SEM_INTERACAO_MS = 24 * 60 * 60 * 1000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 }
});
const MEDIA_LIMITS = {
  image: 40 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024
};
const gruposConversaPorId = new Map();
const conversaCanonicaPorTelefone = new Map();
const cacheConversaCanonica = new Map();
const cacheCadastroSankhyaPorTelefone = new Map();
const CADASTRO_SANKHYA_CACHE_MS = 10 * 60 * 1000;
let cachePipelinesBitrix = { expiresAt: 0, data: [] };
const PIPELINES_BITRIX_CACHE_MS = 10 * 60 * 1000;
const STATUS_NEGOCIO_BITRIX_CACHE_MS = 60 * 1000;
const cacheStatusNegociosBitrix = new Map();

function erroPosseChamada(atendente = {}) {
  const error = new Error(`Chamada já atendida por ${atendente.userName || 'outro atendente'}.`);
  error.status = 409;
  error.localAuthorization = true;
  return error;
}

function criarControleChamadas({ ttlMs = CONTROLE_CHAMADA_TTL_MS } = {}) {
  const chamadas = new Map();
  const mesmoCliente = (atual, atendente = {}) => String(atual?.userId) === String(atendente.id)
    && String(atual?.clientId || '') === String(atendente.clientId || '');
  const obter = (callId) => {
    const atual = chamadas.get(callId) || null;
    if (atual && Date.now() - atual.claimedAt >= ttlMs) {
      chamadas.delete(callId);
      return null;
    }
    return atual;
  };
  return {
    obter,
    reivindicar(callId, conversationId, atendente = {}) {
      const atual = obter(callId);
      if (atual && !mesmoCliente(atual, atendente)) throw erroPosseChamada(atual);
      if (atual) return { atendimento: atual, criado: false };
      const atendimento = {
        callId,
        conversationId: Number(conversationId),
        userId: String(atendente.id),
        userName: String(atendente.name || 'Atendente'),
        clientId: String(atendente.clientId || ''),
        claimedAt: Date.now()
      };
      chamadas.set(callId, atendimento);
      return { atendimento, criado: true };
    },
    exigir(callId, atendente = {}) {
      const atual = obter(callId);
      if (atual && !mesmoCliente(atual, atendente)) throw erroPosseChamada(atual);
      return atual;
    },
    liberar(callId, atendente = {}) {
      const atual = obter(callId);
      if (!atual || (atendente.id && !mesmoCliente(atual, atendente))) return false;
      return chamadas.delete(callId);
    }
  };
}

const controleChamadas = criarControleChamadas();

function id(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error('Conversa inválida.');
    error.status = 400;
    throw error;
  }
  return number;
}

function pertenceDiretoria(usuario = {}) {
  return Array.isArray(usuario.grupos)
    && usuario.grupos.some((grupo) => String(grupo || '').trim().toLocaleUpperCase('pt-BR') === 'DIRETORIA');
}

function perfilAtendente(usuario = {}) {
  const salvo = atendentes.obter(usuario.codUsu) || {};
  return {
    id: String(usuario.codUsu),
    codUsu: Number(usuario.codUsu),
    name: salvo.nomeExibicao || usuario.nome || `Usuario ${usuario.codUsu}`,
    signature: salvo.assinatura || salvo.nomeExibicao || usuario.nome || '',
    director: pertenceDiretoria(usuario),
    channelIds: Array.isArray(salvo.canaisPermitidos) ? salvo.canaisPermitidos : null
  };
}

function idCanalConversa(conversa = {}) {
  const canal = conversa.channel || conversa.Channel || {};
  return String(canal.id ?? conversa.channelId ?? '').trim();
}

function atendentePodeAcessarCanal(atendente = {}, channelId) {
  if (atendente.director === true) return true;
  const permitidos = atendente.channelIds;
  // Registros anteriores à configuração por número mantêm o acesso já existente.
  if (!Array.isArray(permitidos)) return true;
  return permitidos.includes(String(channelId || '').trim());
}

function atendentePodeAcessarConversa(atendente = {}, conversa = {}) {
  return atendentePodeAcessarCanal(atendente, idCanalConversa(conversa));
}

function erroCanalNaoPermitido() {
  const error = new Error('Você não possui acesso a este número de atendimento.');
  error.status = 403;
  error.localAuthorization = true;
  return error;
}

function acessoPermitido(usuario = {}) {
  return pertenceDiretoria(usuario) || atendentes.permitido(usuario.codUsu);
}

function conversaCorrespondeFiltroAtendente(conversa = {}, filtros = {}) {
  const agentId = String(filtros.agentId || '').trim();
  const assignedId = String(conversa.assignment?.userId || '');
  if (agentId) return assignedId === agentId;
  const assignment = String(filtros.assignment || 'ALL').toUpperCase();
  if (assignment === 'ALL') return true;
  if (assignment === 'UNASSIGNED') return !assignedId;
  return assignedId === String(filtros.currentAgentId || '');
}

function atribuicaoExpirada(atribuicao = {}, conversa = {}, agora = Date.now()) {
  if (!atribuicao?.userId) return false;
  const momentos = [atribuicao.assignedAt, atribuicao.lastInteractionAt, instanteUltimaMensagem(conversa)]
    .map((value) => new Date(value || 0).getTime())
    .filter(Number.isFinite);
  const ultimaInteracao = Math.max(...momentos, 0);
  return ultimaInteracao > 0 && agora - ultimaInteracao >= ATRIBUICAO_SEM_INTERACAO_MS;
}

function idsRelacionadosConversa(conversa = {}) {
  const referencia = typeof conversa === 'object' ? conversa : { id: conversa };
  const informados = [referencia.id, referencia.conversationId, ...(referencia.relatedConversationIds || [])]
    .map(Number)
    .filter(Number.isInteger);
  const ids = new Set(informados);
  informados.forEach((conversationId) => {
    grupoConversa(conversationId).ids.forEach((relatedId) => ids.add(Number(relatedId)));
  });
  return [...ids].filter(Number.isInteger);
}

function obterAtribuicaoConversa(conversa = {}) {
  return obterAtribuicaoMaisRecente(idsRelacionadosConversa(conversa)
    .map((conversationId) => atendentes.obterConversa(conversationId))
    .filter(Boolean));
}

function instanteEstadoAtribuicao(atribuicao = {}) {
  const historico = Array.isArray(atribuicao.historico) ? atribuicao.historico : [];
  const ultimoEvento = historico[historico.length - 1]?.em;
  const instante = new Date(ultimoEvento || atribuicao.assignedAt || 0).getTime();
  return Number.isFinite(instante) ? instante : 0;
}

function obterAtribuicaoMaisRecente(atribuicoes = []) {
  return [...atribuicoes]
    .filter(Boolean)
    .sort((a, b) => instanteEstadoAtribuicao(b) - instanteEstadoAtribuicao(a))[0] || null;
}

function atribuirGrupoConversa(conversa = {}, dados = {}) {
  const ids = idsRelacionadosConversa(conversa);
  if (!ids.length) throw new TypeError('Conversa inválida.');
  let resultado = null;
  ids.forEach((conversationId) => {
    const atribuicao = atendentes.atribuirConversa(conversationId, dados);
    if (conversationId === Number(conversa?.id ?? conversa)) resultado = atribuicao;
  });
  return resultado || atendentes.obterConversa(ids[0]);
}

function liberarAtribuicaoExpirada(conversa = {}) {
  const atribuicao = obterAtribuicaoConversa(conversa);
  if (!atribuicaoExpirada(atribuicao, conversa)) return atribuicao;
  return atribuirGrupoConversa(conversa, {
    acao: 'EXPIRE',
    ator: { id: 'SISTEMA', name: 'Sistema' }
  });
}

function comAtribuicao(conversa = {}) {
  const atribuicao = liberarAtribuicaoExpirada(conversa);
  const pipelines = Array.isArray(atribuicao?.bitrixPipelines) ? atribuicao.bitrixPipelines : [];
  const pipelineHistory = Array.isArray(atribuicao?.bitrixPipelineHistory) ? atribuicao.bitrixPipelineHistory : [];
  return {
    ...conversa,
    displayName: atribuicao?.nomeExibicao || null,
    assignment: atribuicao?.userId ? {
      userId: String(atribuicao.userId),
      userName: atribuicao.userName || 'Atendente',
      assignedAt: atribuicao.assignedAt || null
    } : null,
    bitrix: {
      pipelines,
      history: pipelineHistory,
      pending: atribuicao?.bitrixPending === true || (!pipelines.length && !pipelineHistory.length),
      pendingReason: atribuicao?.bitrixPendingReason || '',
      updatedAt: atribuicao?.bitrixUpdatedAt || null
    }
  };
}

function comAtribuicoes(payload = {}) {
  return {
    ...payload,
    data: Array.isArray(payload.data) ? payload.data.map(comAtribuicao) : []
  };
}

function podeAtender(conversa, atendente, permitirDiretoria = false) {
  const atribuicao = liberarAtribuicaoExpirada(conversa);
  if (!atribuicao?.userId) {
    const error = new Error('Esta conversa está sem atendente. Assuma o atendimento antes de enviar mensagens.');
    error.status = 409;
    throw error;
  }
  if (String(atribuicao.userId) !== String(atendente.id) && !(permitirDiretoria && atendente.director)) {
    const error = new Error(`Conversa em atendimento por ${atribuicao.userName || 'outro atendente'}.`);
    error.status = 403;
    error.localAuthorization = true;
    throw error;
  }
}

function textoAssinado(texto, atendente) {
  const assinatura = String(atendente?.signature || '').trim();
  return assinatura ? `*${assinatura}:*\n${texto}` : texto;
}

function reacaoValida(emoji) {
  const value = String(emoji || '').trim();
  // Reações da Meta aceitam somente um emoji. O limite evita que texto ou
  // payloads indevidos sejam enviados ao serviço de atendimento.
  return value && value.length <= 16 && !/[\r\n]/.test(value) ? value : '';
}

function idMensagemWhatsapp(value) {
  const messageId = String(value || '').trim();
  // WAMIDs podem terminar com "="; por isso não usamos uma validação apenas
  // numérica nem interpolamos o identificador em SQL.
  return /^[A-Za-z0-9._:+=/-]{3,512}$/.test(messageId) ? messageId : '';
}

function idChamadaWhatsapp(value) {
  const callId = String(value || '').trim();
  return /^[A-Za-z0-9._:+=/-]{3,512}$/.test(callId) ? callId : '';
}

function idClienteChamada(value, atendente = {}) {
  const clientId = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(clientId)
    ? clientId
    : `legacy:${String(atendente.id || '')}`;
}

function atendenteChamada(atendente = {}, clientId) {
  return { ...atendente, clientId: idClienteChamada(clientId, atendente) };
}

function agenteChamada(atendente = {}) {
  return {
    id: String(atendente.id || ''),
    name: String(atendente.name || 'Atendente'),
    director: atendente.director === true
  };
}

function filtroAcessoAtivo(alias = 'USU') {
  // A data limite é válida durante todo o dia informado no Sankhya.
  return `(${alias}.DTLIMACESSO IS NULL OR ${alias}.DTLIMACESSO >= TRUNC(SYSDATE))`;
}

function textoSql(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength).replace(/'/g, "''");
}

function normalizarTelefoneWhatsapp(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) return `55${digits}`;
  return digits;
}

function identidadeTelefoneWhatsapp(value) {
  const digits = normalizarTelefoneWhatsapp(value);
  // A Meta pode devolver celulares brasileiros antigos sem o nono dígito,
  // embora o cadastro e o envio tenham usado esse dígito.
  if (/^55\d{2}9\d{8}$/.test(digits)) return `${digits.slice(0, 4)}${digits.slice(5)}`;
  return digits;
}

function variantesTelefoneWhatsapp(value) {
  const original = normalizarTelefoneWhatsapp(value);
  const canonical = identidadeTelefoneWhatsapp(original);
  const values = new Set([original, canonical].filter(Boolean));
  if (/^55\d{2}9\d{7}$/.test(canonical)) values.add(`${canonical.slice(0, 4)}9${canonical.slice(4)}`);
  return [...values];
}

function variantesTelefoneSankhya(value) {
  const values = new Set();
  variantesTelefoneWhatsapp(value).forEach((telefone) => {
    if (!telefone) return;
    values.add(telefone);
    if (telefone.startsWith('55') && (telefone.length === 12 || telefone.length === 13)) {
      values.add(telefone.slice(2));
    }
  });
  return [...values];
}

function telefoneDaConversa(conversa = {}) {
  const contato = conversa.contact || conversa.Contact || {};
  return contato.waId || contato.phone || conversa.waId || conversa.phone || '';
}

function identidadeCanalConversa(conversa = {}) {
  const channel = conversa.channel || conversa.Channel || {};
  const id = String(channel.id ?? conversa.channelId ?? '').trim();
  if (id) return `id:${id}`;
  const phoneNumberId = String(channel.phoneNumberId ?? conversa.phoneNumberId ?? '').trim();
  return phoneNumberId ? `phone-number:${phoneNumberId}` : 'legacy';
}

function chaveCanalTelefoneConversa(conversa = {}) {
  if (identidadeCanalConversa(conversa) === 'legacy') return '';
  const phone = identidadeTelefoneWhatsapp(telefoneDaConversa(conversa));
  return phone ? `channel:${identidadeCanalConversa(conversa)}:phone:${phone}` : '';
}

function chavesIdentidadeConversa(conversa = {}) {
  const ids = [conversa.id, conversa.conversationId, ...(conversa.relatedConversationIds || [])]
    .map(Number)
    .filter(Number.isInteger)
    .map((item) => `id:${item}`);
  const channelPhone = chaveCanalTelefoneConversa(conversa);
  return [...new Set([...ids, ...(channelPhone ? [channelPhone] : [])])];
}

function instanteUltimaMensagem(conversa = {}) {
  const value = conversa.lastMessageAt || conversa.lastMessage?.messageTimestamp
    || conversa.message?.messageTimestamp || 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function conversaOcultaParaUsuario(codUsu, conversa = {}) {
  const chaves = chavesIdentidadeConversa(conversa);
  const ocultacaoGlobal = atendentes.obterOcultacaoGlobal(chaves);
  if (ocultacaoGlobal) {
    const ocultadaEm = new Date(ocultacaoGlobal.ocultadaEm || 0).getTime();
    const novaAtividade = instanteUltimaMensagem(conversa);
    if (novaAtividade > ocultadaEm) {
      atendentes.revelarConversaGlobal(chaves);
      return false;
    }
    return true;
  }
  const ocultacao = atendentes.obterOcultacao(codUsu, chaves);
  if (!ocultacao) return false;
  const ocultadaEm = new Date(ocultacao.ocultadaEm || 0).getTime();
  const novaAtividade = instanteUltimaMensagem(conversa);
  if (novaAtividade > ocultadaEm) {
    atendentes.revelarConversa(codUsu, chaves);
    return false;
  }
  return true;
}

function instanteConversa(conversa = {}) {
  const value = conversa.lastMessageAt || conversa.updatedAt || conversa.createdAt || 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function cadastroSankhyaSelecionado(parceiros = []) {
  const unicos = new Map();
  parceiros.forEach((item) => {
    const key = `${item.codParc}:${item.codContato || 0}:${item.telefone || ''}`;
    if (!unicos.has(key)) unicos.set(key, item);
  });
  const lista = [...unicos.values()].sort((a, b) => {
    const parceiro = Number(a.codParc) - Number(b.codParc);
    return parceiro || String(a.nomeContato || '').localeCompare(String(b.nomeContato || ''), 'pt-BR');
  });
  if (!lista.length) return null;
  return {
    verificado: true,
    codParc: lista[0].codParc,
    nomeParc: lista[0].nomeParc,
    nomeContato: lista[0].nomeContato || '',
    origem: lista[0].origem,
    parceiros: lista
  };
}

function textoContatoChat(value, maxLength = 40) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function campoSankhya(valor) {
  return { $: valor === null || valor === undefined ? '' : String(valor) };
}

function nomeDaConversa(conversa = {}) {
  const contato = conversa.contact || conversa.Contact || {};
  return contato.name || contato.fullName || conversa.contactName || 'Contato WhatsApp';
}

async function criarContatoWhatsappNoSankhya({ codParc, nomeContato, cargo, telefone }) {
  const [sequencia] = await executeQuery(`
    SELECT NVL(MAX(CODCONTATO), 0) AS ULTIMO
    FROM TGFCTT
    WHERE CODPARC = ${codParc}
  `);
  const codContato = Number(sequencia?.ULTIMO || 0) + 1;
  const nome = textoContatoChat(nomeContato, 40) || 'Contato WhatsApp';
  const cargoContato = textoContatoChat(cargo, 40);
  await executeService('CRUDServiceProvider.saveRecord', {
    dataSet: {
      rootEntity: 'Contato',
      includePresentationFields: 'N',
      entity: { path: '', fieldset: { list: 'CODPARC,CODCONTATO,NOMECONTATO,APELIDO,CARGO,CELULAR,ATIVO' } },
      dataRow: {
        localFields: {
          CODPARC: campoSankhya(codParc),
          CODCONTATO: campoSankhya(codContato),
          NOMECONTATO: campoSankhya(nome),
          APELIDO: campoSankhya(textoContatoChat(nome, 15)),
          CARGO: campoSankhya(cargoContato),
          CELULAR: campoSankhya(telefone),
          ATIVO: campoSankhya('S')
        }
      }
    }
  }, { forceAccessSession: true });
  return { codContato, nomeContato: nome, cargo: cargoContato };
}

async function buscarCadastrosSankhyaPorTelefones(conversas = [], { force = false } = {}) {
  const identities = [...new Set(conversas.map((item) => identidadeTelefoneWhatsapp(telefoneDaConversa(item))).filter(Boolean))];
  const now = Date.now();
  const missing = identities.filter((identity) => {
    if (force) return true;
    const cached = cacheCadastroSankhyaPorTelefone.get(identity);
    return !cached || cached.expiresAt <= now;
  });
  if (missing.length) {
    const variants = [...new Set(missing.flatMap(variantesTelefoneSankhya))];
    const inList = variants.map((item) => `'${item}'`).join(', ');
    const rows = inList ? await executeQuery(`
      SELECT CAD.CODPARC, CAD.NOMEPARC, CAD.CODCONTATO, CAD.NOMECONTATO,
             CAD.ORIGEM, CAD.TELEFONE
      FROM (
        SELECT PAR.CODPARC, TRIM(PAR.NOMEPARC) AS NOMEPARC,
               CAST(NULL AS NUMBER) AS CODCONTATO, CAST(NULL AS VARCHAR2(160)) AS NOMECONTATO,
               'PARCEIRO' AS ORIGEM,
               REGEXP_REPLACE(NVL(PAR.TELEFONE, ''), '[^0-9]', '') AS TELEFONE
        FROM TGFPAR PAR
        WHERE NVL(PAR.ATIVO, 'S') = 'S'
        UNION ALL
        SELECT PAR.CODPARC, TRIM(PAR.NOMEPARC),
               CAST(NULL AS NUMBER), CAST(NULL AS VARCHAR2(160)), 'PARCEIRO',
               REGEXP_REPLACE(NVL(PAR.FAX, ''), '[^0-9]', '')
        FROM TGFPAR PAR
        WHERE NVL(PAR.ATIVO, 'S') = 'S'
        UNION ALL
        SELECT CTT.CODPARC, TRIM(PAR.NOMEPARC), CTT.CODCONTATO,
               TRIM(CTT.NOMECONTATO), 'CONTATO',
               REGEXP_REPLACE(NVL(CTT.TELEFONE, ''), '[^0-9]', '')
        FROM TGFCTT CTT
        JOIN TGFPAR PAR ON PAR.CODPARC = CTT.CODPARC
        WHERE NVL(CTT.ATIVO, 'S') = 'S' AND NVL(PAR.ATIVO, 'S') = 'S'
        UNION ALL
        SELECT CTT.CODPARC, TRIM(PAR.NOMEPARC), CTT.CODCONTATO,
               TRIM(CTT.NOMECONTATO), 'CONTATO',
               REGEXP_REPLACE(NVL(CTT.CELULAR, ''), '[^0-9]', '')
        FROM TGFCTT CTT
        JOIN TGFPAR PAR ON PAR.CODPARC = CTT.CODPARC
        WHERE NVL(CTT.ATIVO, 'S') = 'S' AND NVL(PAR.ATIVO, 'S') = 'S'
        UNION ALL
        SELECT CTT.CODPARC, TRIM(PAR.NOMEPARC), CTT.CODCONTATO,
               TRIM(CTT.NOMECONTATO), 'CONTATO',
               REGEXP_REPLACE(NVL(CTT.TELRESID, ''), '[^0-9]', '')
        FROM TGFCTT CTT
        JOIN TGFPAR PAR ON PAR.CODPARC = CTT.CODPARC
        WHERE NVL(CTT.ATIVO, 'S') = 'S' AND NVL(PAR.ATIVO, 'S') = 'S'
      ) CAD
      WHERE CAD.TELEFONE IN (${inList})
    `) : [];
    const byIdentity = new Map(missing.map((identity) => [identity, []]));
    rows.forEach((row) => {
      const identity = identidadeTelefoneWhatsapp(row.TELEFONE);
      if (!byIdentity.has(identity)) return;
      byIdentity.get(identity).push({
        codParc: Number(row.CODPARC),
        nomeParc: String(row.NOMEPARC || '').trim(),
        codContato: Number.isInteger(Number(row.CODCONTATO)) ? Number(row.CODCONTATO) : null,
        nomeContato: String(row.NOMECONTATO || '').trim(),
        origem: String(row.ORIGEM || '').trim(),
        telefone: normalizarTelefoneWhatsapp(row.TELEFONE)
      });
    });
    missing.forEach((identity) => {
      cacheCadastroSankhyaPorTelefone.set(identity, {
        expiresAt: now + CADASTRO_SANKHYA_CACHE_MS,
        cadastro: cadastroSankhyaSelecionado(byIdentity.get(identity) || [])
      });
    });
    if (cacheCadastroSankhyaPorTelefone.size > 5000) {
      [...cacheCadastroSankhyaPorTelefone.entries()]
        .filter(([, item]) => item.expiresAt <= now)
        .forEach(([key]) => cacheCadastroSankhyaPorTelefone.delete(key));
    }
  }
  return conversas.map((conversa) => {
    const identity = identidadeTelefoneWhatsapp(telefoneDaConversa(conversa));
    const cadastroSankhya = cacheCadastroSankhyaPorTelefone.get(identity)?.cadastro || null;
    return { ...conversa, cadastroSankhya };
  });
}

async function vincularCadastrosSankhya(conversas = [], options = {}) {
  try {
    return await buscarCadastrosSankhyaPorTelefones(conversas, options);
  } catch (error) {
    console.error('Falha ao vincular telefones do chat aos parceiros Sankhya:', error.message);
    return conversas.map((conversa) => ({ ...conversa, cadastroSankhya: null }));
  }
}

function vincularCadastrosSankhyaDoCache(conversas = []) {
  const now = Date.now();
  return conversas.map((conversa) => {
    const identity = identidadeTelefoneWhatsapp(telefoneDaConversa(conversa));
    const cached = cacheCadastroSankhyaPorTelefone.get(identity);
    if (cached?.expiresAt <= now) cacheCadastroSankhyaPorTelefone.delete(identity);
    return {
      ...conversa,
      cadastroSankhya: cached?.expiresAt > now ? cached.cadastro : null
    };
  });
}

async function enriquecerConversasEmSegundoPlano(conversas = []) {
  const [, vinculadas] = await Promise.all([
    sincronizarPipelinesBitrix(conversas),
    vincularCadastrosSankhya(conversas)
  ]);
  vinculadas.forEach((conversa) => {
    eventosAtendimento.emit('updated', { conversation: comAtribuicao(conversa) });
  });
}

function registrarGrupoConversa(canonica, itens) {
  const ids = [...new Set(itens.map((item) => Number(item.id)).filter(Number.isInteger))];
  if (!ids.length || !Number.isInteger(Number(canonica?.id))) return;
  const canonicalId = Number(canonica.id);
  ids.forEach((conversationId) => gruposConversaPorId.set(conversationId, { canonicalId, ids }));
  gruposConversaPorId.set(canonicalId, { canonicalId, ids });
  const channelPhone = chaveCanalTelefoneConversa(canonica);
  if (channelPhone) conversaCanonicaPorTelefone.set(channelPhone, canonicalId);
  cacheConversaCanonica.set(canonicalId, canonica);
}

function consolidarConversas(conversas = []) {
  const groups = new Map();
  conversas.map(comAtribuicao).forEach((conversa) => {
    const channelPhone = chaveCanalTelefoneConversa(conversa);
    const key = channelPhone || `id:${conversa.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(conversa);
  });
  return [...groups.values()].map((itens) => {
    const ordered = [...itens].sort((a, b) => {
      const assignment = Number(Boolean(b.assignment)) - Number(Boolean(a.assignment));
      return assignment || Number(a.id) - Number(b.id);
    });
    const canonical = ordered[0];
    const recent = [...itens].sort((a, b) => instanteConversa(b) - instanteConversa(a))[0];
    const serviceSource = [...itens].sort((a, b) => {
      const open = Number(Boolean(b.serviceWindow?.canSendFreeform)) - Number(Boolean(a.serviceWindow?.canSendFreeform));
      return open || instanteConversa(b) - instanteConversa(a);
    })[0];
    const merged = {
      ...canonical,
      lastMessage: recent.lastMessage || canonical.lastMessage,
      lastMessageAt: recent.lastMessageAt || canonical.lastMessageAt,
      updatedAt: recent.updatedAt || canonical.updatedAt,
      unreadCount: itens.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
      serviceWindow: serviceSource.serviceWindow || canonical.serviceWindow,
      relatedConversationIds: itens.map((item) => Number(item.id)).filter(Number.isInteger)
    };
    registrarGrupoConversa(merged, itens);
    return merged;
  });
}

function grupoConversa(conversationId) {
  const numericId = Number(conversationId);
  return gruposConversaPorId.get(numericId) || { canonicalId: numericId, ids: [numericId] };
}

async function mensagensConsolidadas(conversationId, params = {}) {
  const group = grupoConversa(conversationId);
  const respostas = await Promise.all(group.ids.map((itemId) => whatsappApi.getMessages(itemId, params)));
  const messages = respostas.flatMap((resposta) => Array.isArray(resposta?.data) ? resposta.data : []);
  const unique = new Map();
  messages.forEach((message) => unique.set(String(message.id ?? message.wamid), message));
  const data = [...unique.values()].sort((a, b) => {
    const left = new Date(a.messageTimestamp || a.createdAt || 0).getTime();
    const right = new Date(b.messageTimestamp || b.createdAt || 0).getTime();
    return left - right;
  });
  return {
    data,
    pagination: {
      page: Number(params.page || 1),
      limit: Number(params.limit || 20),
      total: respostas.reduce((total, item) => total + Number(item?.pagination?.total || item?.data?.length || 0), 0),
      totalPages: Math.max(1, ...respostas.map((item) => Number(item?.pagination?.totalPages || 1)))
    }
  };
}

async function obterConversaConsolidada(conversationId) {
  const group = grupoConversa(conversationId);
  const conversas = await Promise.all(group.ids.map((itemId) => whatsappApi.getConversation(itemId)));
  return consolidarConversas(conversas)[0];
}

async function idConversaParaMensagem(conversationId) {
  const group = grupoConversa(conversationId);
  if (group.ids.length === 1) return group.ids[0];
  const conversas = await Promise.all(group.ids.map((itemId) => whatsappApi.getConversation(itemId)));
  return (conversas.find((item) => item.serviceWindow?.canSendFreeform) || conversas[0]).id;
}

async function buscarConversasPorTelefone(telefone, channelId = '') {
  const identity = identidadeTelefoneWhatsapp(telefone);
  if (!identity) return [];
  const respostas = await Promise.all(variantesTelefoneWhatsapp(telefone).map((search) => (
    whatsappApi.getConversations({ page: 1, limit: 30, search, assignment: 'ALL', channelId })
  )));
  const unique = new Map();
  respostas.flatMap((item) => item?.data || []).forEach((conversa) => {
    const sameChannel = !channelId || String(conversa.channel?.id ?? conversa.channelId ?? '') === String(channelId);
    if (sameChannel && identidadeTelefoneWhatsapp(telefoneDaConversa(conversa)) === identity) unique.set(String(conversa.id), conversa);
  });
  return consolidarConversas([...unique.values()]);
}

async function buscarConversaPorTelefone(telefone, channelId = '') {
  const conversas = await buscarConversasPorTelefone(telefone, channelId);
  return conversas[0] || null;
}

async function buscarConversasPorCodigoParceiro(codParc) {
  const resultado = await contatosDoParceiro(codParc);
  if (!resultado?.contatos?.length) return [];
  const identidades = new Set(resultado.contatos
    .map((contato) => identidadeTelefoneWhatsapp(contato.telefone))
    .filter(Boolean));
  const encontradas = new Map();
  const encontradasPorTelefone = new Set();
  const registrar = (conversa) => {
    const identidade = identidadeTelefoneWhatsapp(telefoneDaConversa(conversa));
    if (!identidades.has(identidade)) return;
    encontradas.set(String(conversa.id), conversa);
    encontradasPorTelefone.add(identidade);
  };

  // A conversa atual já pode estar consolidada no processo, mesmo quando a
  // integração externa não aplica corretamente o filtro por telefone.
  cacheConversaCanonica.forEach(registrar);

  const tamanhoLote = 5;
  for (let inicio = 0; inicio < resultado.contatos.length; inicio += tamanhoLote) {
    const lote = resultado.contatos.slice(inicio, inicio + tamanhoLote);
    const conversas = await Promise.all(lote.map((contato) => (
      buscarConversasPorTelefone(contato.telefone).catch(() => [])
    )));
    conversas.flat().forEach(registrar);
  }

  const pendentes = [...identidades].filter((identidade) => !encontradasPorTelefone.has(identidade));
  if (!pendentes.length) return consolidarConversas([...encontradas.values()]);

  // Fallback para integrações que ignoram o parâmetro de busca por telefone.
  // A varredura só acontece em uma pesquisa explícita por código de parceiro.
  const primeiraPagina = await whatsappApi.getConversations({ page: 1, limit: 100, assignment: 'ALL' });
  const paginas = Math.max(1, Number(primeiraPagina.pagination?.totalPages || 1));
  const examinar = (lista = []) => lista.forEach(registrar);
  examinar(primeiraPagina.data || []);
  for (let page = 2; page <= paginas && encontradasPorTelefone.size < identidades.size; page += 1) {
    const proxima = await whatsappApi.getConversations({ page, limit: 100, assignment: 'ALL' });
    examinar(proxima.data || []);
  }
  return consolidarConversas([...encontradas.values()]);
}

async function normalizarEventoAtendimento(event, payload = {}) {
  if (event === 'conversation:new' || event === 'conversation:updated') {
    const incoming = payload.conversation || payload;
    const channelPhone = chaveCanalTelefoneConversa(incoming);
    const knownId = channelPhone ? conversaCanonicaPorTelefone.get(channelPhone) : null;
    const cached = knownId ? cacheConversaCanonica.get(knownId) : null;
    const conversation = consolidarConversas(cached ? [cached, incoming] : [incoming])[0];
    return { ...payload, conversationId: conversation.id, conversation: comAtribuicao(conversation) };
  }
  const rawId = Number(payload.conversationId || payload.message?.conversationId || payload.conversation?.id);
  if (!Number.isInteger(rawId)) return payload;
  let group = grupoConversa(rawId);
  if (group.ids.length === 1 && !cacheConversaCanonica.has(rawId) && event === 'message:new') {
    try {
      const incoming = await whatsappApi.getConversation(rawId);
      const channelPhone = chaveCanalTelefoneConversa(incoming);
      const knownId = channelPhone ? conversaCanonicaPorTelefone.get(channelPhone) : null;
      const cached = knownId ? cacheConversaCanonica.get(knownId) : null;
      consolidarConversas(cached ? [cached, incoming] : [incoming]);
      group = grupoConversa(rawId);
    } catch {}
  }
  const canonicalId = group.canonicalId;
  return {
    ...payload,
    conversationId: canonicalId,
    ...(payload.message ? { message: { ...payload.message, conversationId: canonicalId } } : {}),
    ...(payload.conversation ? { conversation: { ...payload.conversation, id: canonicalId } } : {})
  };
}

async function contatosDoParceiro(codParc) {
  const [parceiro] = await executeQuery(`
    SELECT CODPARC, NOMEPARC, CGC_CPF, TELEFONE, FAX
    FROM TGFPAR
    WHERE CODPARC = ${codParc}
      AND NVL(ATIVO, 'S') = 'S'
  `);
  if (!parceiro) return null;

  const contatos = await executeQuery(`
    SELECT CODCONTATO, NOMECONTATO, APELIDO, CARGO, TELEFONE, CELULAR, TELRESID
    FROM TGFCTT
    WHERE CODPARC = ${codParc}
      AND NVL(ATIVO, 'S') = 'S'
    ORDER BY NVL(PRIORIDADE, 999), NOMECONTATO
  `);
  const opcoes = [];
  const telefones = new Set();
  const adicionar = (key, nome, tipo, telefone) => {
    const phone = normalizarTelefoneWhatsapp(telefone);
    if (!phone || telefones.has(phone)) return;
    telefones.add(phone);
    opcoes.push({ key, nome: String(nome || parceiro.NOMEPARC || 'Contato').trim(), tipo, telefone: phone });
  };
  adicionar('PAR:TELEFONE', parceiro.NOMEPARC, 'Telefone principal', parceiro.TELEFONE);
  adicionar('PAR:FAX', parceiro.NOMEPARC, 'Celular principal', parceiro.FAX);
  contatos.forEach((contato) => {
    const nome = contato.NOMECONTATO || contato.APELIDO || parceiro.NOMEPARC;
    adicionar(`CTT:${contato.CODCONTATO}:CELULAR`, nome, contato.CARGO || 'Celular', contato.CELULAR);
    adicionar(`CTT:${contato.CODCONTATO}:TELEFONE`, nome, contato.CARGO || 'Telefone', contato.TELEFONE);
    adicionar(`CTT:${contato.CODCONTATO}:TELRESID`, nome, contato.CARGO || 'Telefone residencial', contato.TELRESID);
  });
  return {
    parceiro: {
      codParc: Number(parceiro.CODPARC),
      nome: String(parceiro.NOMEPARC || '').trim(),
      cnpjCpf: String(parceiro.CGC_CPF || '').trim()
    },
    contatos: opcoes
  };
}

function idPipelineBitrix(value) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function primeiraEtapaAberta(etapas = []) {
  return [...etapas]
    .filter((etapa) => !['S', 'F'].includes(String(etapa.SEMANTICS ?? etapa.semantics ?? '').toUpperCase()))
    .sort((a, b) => Number(a.SORT ?? a.sort ?? 9999) - Number(b.SORT ?? b.sort ?? 9999))[0] || null;
}

function textoNormalizadoBitrix(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR');
}

function dadosEtapaBitrix(etapa = {}) {
  return {
    id: String(etapa.STATUS_ID ?? etapa.id ?? etapa.ID ?? '').trim(),
    name: String(etapa.NAME ?? etapa.name ?? 'Etapa não informada').trim(),
    sort: Number(etapa.SORT ?? etapa.sort ?? 0),
    semantics: String(etapa.SEMANTICS ?? etapa.semantics ?? '').trim().toUpperCase()
  };
}

function etapaEmAndamento(etapas = []) {
  return etapas
    .map(dadosEtapaBitrix)
    .filter((etapa) => etapa.id && /\bEM\s+ANDAMENTO\b/.test(textoNormalizadoBitrix(etapa.name)))
    .sort((a, b) => a.sort - b.sort)[0] || null;
}

function etapaEncerradaCobranca(pipeline = {}, etapa = {}) {
  const ehCobranca = /\bCOBRANCA\b/.test(textoNormalizadoBitrix(pipeline.name));
  if (!ehCobranca) return false;
  const nome = textoNormalizadoBitrix(etapa.name);
  return ['RENEGOCIADO', 'CLIENTE BLOQUEOU', 'ANALISAR FALHA', 'PAGO'].includes(nome);
}

function statusCardConcluido(link = {}, pipeline = {}, deal = {}) {
  const stageId = String(deal.STAGE_ID || link.stageId || '').trim();
  const etapas = Array.isArray(pipeline.stages) ? pipeline.stages : [];
  const etapa = etapas.map(dadosEtapaBitrix).find((item) => item.id === stageId) || {
    id: stageId,
    name: String(link.stageName || 'Etapa não informada'),
    sort: Number(link.stageSort || 0),
    semantics: ''
  };
  const marco = etapaEmAndamento(etapas);
  const concluido = ['S', 'F'].includes(etapa.semantics)
    || etapaEncerradaCobranca(pipeline, etapa)
    || Boolean(marco && Number.isFinite(etapa.sort) && etapa.sort > marco.sort);
  return { concluido, stageId: etapa.id, stageName: etapa.name, stageSort: etapa.sort, stageSemantics: etapa.semantics };
}

async function listarPipelinesBitrix(force = false) {
  if (!force && cachePipelinesBitrix.expiresAt > Date.now() && cachePipelinesBitrix.data.length) {
    return cachePipelinesBitrix.data;
  }
  const funis = await bitrixService.consultarFunisEtapas();
  const pipelines = funis.map(({ funil, etapas }) => {
    const categoryId = idPipelineBitrix(funil.id ?? funil.ID);
    const etapa = primeiraEtapaAberta(etapas);
    return {
      categoryId,
      name: String(funil.name ?? funil.NAME ?? `Pipeline ${categoryId}`).trim(),
      stageId: String(etapa?.STATUS_ID ?? etapa?.id ?? etapa?.ID ?? '').trim(),
      stageName: String(etapa?.NAME ?? etapa?.name ?? 'Etapa inicial').trim(),
      stages: etapas.map(dadosEtapaBitrix).filter((item) => item.id)
    };
  }).filter((pipeline) => pipeline.categoryId !== null && pipeline.stageId);
  cachePipelinesBitrix = { expiresAt: Date.now() + PIPELINES_BITRIX_CACHE_MS, data: pipelines };
  return pipelines;
}

async function consultarStatusNegociosBitrix(dealIds = [], force = false) {
  const ids = [...new Set(dealIds.map((item) => String(item || '').trim()).filter(Boolean))];
  const agora = Date.now();
  const encontrados = new Map();
  const pendentes = ids.filter((dealId) => {
    const cache = cacheStatusNegociosBitrix.get(dealId);
    if (!force && cache?.expiresAt > agora) {
      encontrados.set(dealId, cache.deal);
      return false;
    }
    return true;
  });
  for (let index = 0; index < pendentes.length; index += 50) {
    const lote = pendentes.slice(index, index + 50);
    const negocios = await bitrixService.consultarNegocios({
      filter: { '@ID': lote },
      select: ['ID', 'TITLE', 'CATEGORY_ID', 'STAGE_ID']
    });
    const porId = new Map(negocios.map((item) => [String(item.ID), item]));
    lote.forEach((dealId) => {
      const deal = porId.get(dealId) || null;
      cacheStatusNegociosBitrix.set(dealId, { expiresAt: agora + STATUS_NEGOCIO_BITRIX_CACHE_MS, deal });
      encontrados.set(dealId, deal);
    });
  }
  if (cacheStatusNegociosBitrix.size > 5000) {
    [...cacheStatusNegociosBitrix.entries()]
      .filter(([, item]) => item.expiresAt <= agora)
      .forEach(([dealId]) => cacheStatusNegociosBitrix.delete(dealId));
  }
  return encontrados;
}

async function sincronizarPipelinesBitrix(conversas = [], force = false) {
  const comVinculos = conversas.map((conversa) => ({
    conversa,
    registro: atendentes.obterConversa(conversa.id),
    pipelines: atendentes.obterConversa(conversa.id)?.bitrixPipelines || []
  })).filter((item) => item.pipelines.length);
  if (!comVinculos.length) return;
  try {
    const pipelines = await listarPipelinesBitrix();
    const porCategoria = new Map(pipelines.map((item) => [Number(item.categoryId), item]));
    const statusPorDeal = await consultarStatusNegociosBitrix(
      comVinculos.flatMap((item) => item.pipelines.map((link) => link.dealId)),
      force
    );
    comVinculos.forEach(({ conversa, pipelines: links }) => {
      const concluidos = links.flatMap((link) => {
        const status = statusCardConcluido(link, porCategoria.get(Number(link.categoryId)), statusPorDeal.get(String(link.dealId)) || {});
        if (!status.concluido) return [];
        return [{
          ...link,
          ...status,
          completedAt: new Date().toISOString()
        }];
      });
      if (concluidos.length) atendentes.arquivarPipelinesConcluidos(conversa.id, concluidos);
    });
  } catch (error) {
    console.error('Falha ao atualizar status dos cards Bitrix do chat:', error.message);
  }
}

async function historicoPipelinesBitrix(conversationId) {
  const registro = atendentes.obterConversa(conversationId);
  const historico = Array.isArray(registro?.bitrixPipelineHistory) ? registro.bitrixPipelineHistory : [];
  if (!historico.length) return [];
  try {
    const [pipelines, statusPorDeal] = await Promise.all([
      listarPipelinesBitrix(),
      consultarStatusNegociosBitrix(historico.map((item) => item.dealId))
    ]);
    const porCategoria = new Map(pipelines.map((item) => [Number(item.categoryId), item]));
    return historico.map((link) => ({
      ...link,
      ...statusCardConcluido(link, porCategoria.get(Number(link.categoryId)), statusPorDeal.get(String(link.dealId)) || {})
    }));
  } catch (error) {
    console.error('Falha ao obter histórico dos cards Bitrix do chat:', error.message);
    return historico;
  }
}

async function contatoBitrixDaConversa(conversa = {}) {
  const telefone = identidadeTelefoneWhatsapp(telefoneDaConversa(conversa));
  const nome = nomeDaConversa(conversa);
  const cadastro = conversa.cadastroSankhya?.verificado ? conversa.cadastroSankhya : null;
  const resposta = cadastro?.codParc
    ? await bitrixService.criarContato({
      codigo: cadastro.codParc,
      nome: cadastro.nomeParc || nome,
      telefone
    })
    : await bitrixService.criarContatoPorOrigem({
      originId: `WHATSAPP:${telefone}`,
      nome,
      telefone
    });
  const contactId = resposta.id || resposta.contato?.ID;
  if (!contactId) throw new Error('O Bitrix nao retornou o ID do contato do atendimento.');
  return { contactId, cadastro, telefone, nome };
}

async function vincularPipelineBitrix(conversa, categoryId) {
  const pipelineId = idPipelineBitrix(categoryId);
  if (pipelineId === null) throw new Error('Selecione um pipeline valido.');
  const conversationId = id(conversa.id);
  await sincronizarPipelinesBitrix([{ id: conversationId }], true);
  const registro = atendentes.obterConversa(conversationId);
  const vinculoExistente = registro?.bitrixPipelines?.find((item) => Number(item.categoryId) === pipelineId);
  if (vinculoExistente?.dealId) return { ...vinculoExistente, reused: true };

  const pipeline = (await listarPipelinesBitrix()).find((item) => item.categoryId === pipelineId);
  if (!pipeline) throw new Error('Pipeline nao encontrado ou sem etapa inicial no Bitrix.');
  const [conversaVinculada] = await vincularCadastrosSankhya([conversa]);
  const contato = await contatoBitrixDaConversa(conversaVinculada);
  const vinculosDoPipeline = [
    ...(registro?.bitrixPipelines || []),
    ...(registro?.bitrixPipelineHistory || [])
  ].filter((item) => Number(item.categoryId) === pipelineId);
  const originId = `CHAT:${conversationId}:PIPELINE:${pipelineId}:CYCLE:${vinculosDoPipeline.length + 1}`;
  const existentes = await bitrixService.consultarNegocios({
    filter: { '=ORIGIN_ID': originId },
    select: ['ID', 'TITLE', 'CATEGORY_ID', 'STAGE_ID', 'ORIGIN_ID']
  });
  let dealId = existentes[0]?.ID || null;
  const dealTitle = `WhatsApp - ${contato.nome}`.slice(0, 255);
  if (!dealId) {
    const negocio = await bitrixService.criarNegocio({
      contactId: contato.contactId,
      fields: {
        TITLE: dealTitle,
        CATEGORY_ID: pipeline.categoryId,
        STAGE_ID: pipeline.stageId,
        ORIGINATOR_ID: 'CHAT_APP',
        ORIGIN_ID: originId,
        COMMENTS: [
          `Atendimento WhatsApp: ${conversationId}`,
          `Telefone: ${contato.telefone || '-'}`,
          contato.cadastro?.codParc ? `Parceiro Sankhya: ${contato.cadastro.codParc} - ${contato.cadastro.nomeParc || ''}` : ''
        ].filter(Boolean).join('<br>')
      }
    });
    dealId = negocio.result;
  }
  if (!dealId) throw new Error('O Bitrix nao retornou o ID do card criado.');
  const salvo = atendentes.vincularPipeline(conversationId, {
    categoryId: pipeline.categoryId,
    categoryName: pipeline.name,
    stageId: pipeline.stageId,
    stageName: pipeline.stageName,
    dealId,
    dealTitle
  });
  return { ...salvo.bitrixPipelines.find((item) => Number(item.categoryId) === pipelineId), reused: Boolean(existentes[0]) };
}

function exigirAcessoChat(req, res, next) {
  if (!acessoPermitido(req.usuario)) {
    res.status(403).json({ erro: 'Seu usuario nao possui acesso ao atendimento.' });
    return;
  }
  req.atendente = perfilAtendente(req.usuario);
  next();
}

function exigirDiretoria(req, res, next) {
  if (!pertenceDiretoria(req.usuario)) {
    res.status(403).json({ erro: 'Configuracao restrita ao grupo Diretoria.' });
    return;
  }
  next();
}

function responseStatus(error) {
  const status = Number(error?.status) || 502;
  // A autenticação do usuário local já foi validada antes deste router.
  // 401/403 aqui pertencem à integração servidor-servidor com o WhatsApp.
  if (status === 401 || status === 403) return 502;
  return status >= 400 && status <= 599 ? status : 502;
}

function isMetaAuthError(error) {
  return error?.integrationCode === 'META_API_ERROR'
    || /API da Meta/i.test(String(error?.message || ''));
}

function sendError(res, error) {
  const upstreamStatus = Number(error?.status) || 0;
  const integrationCode = String(error?.integrationCode || error?.code || '').trim();
  if (error?.configurationError === true) {
    const code = error.integrationCode || 'INTEGRATION_NOT_CONFIGURED';
    if (!sendError.reportedConfigurationErrors.has(code)) {
      sendError.reportedConfigurationErrors.add(code);
      console.warn('Integração opcional não configurada:', error?.message || error);
    }
    res.status(upstreamStatus >= 500 && upstreamStatus <= 599 ? upstreamStatus : 503)
      .json({ erro: error.message, codigo: code });
    return;
  }
  if (error?.localAuthorization === true) {
    res.status(upstreamStatus >= 400 && upstreamStatus <= 499 ? upstreamStatus : 403)
      .json({ erro: error.message || 'Ação não permitida para este atendente.', ...(integrationCode ? { codigo: integrationCode } : {}) });
    return;
  }
  const status = responseStatus(error);
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    if (isMetaAuthError(error)) {
      console.error('A Meta recusou a credencial do WhatsApp:', error?.message || error);
      res.status(status).json({
        erro: 'O token da Meta expirou ou foi invalidado. Atualize a credencial do WhatsApp.',
        ...(integrationCode ? { codigo: integrationCode } : {})
      });
      return;
    }
    console.error('Falha de autenticação entre a fila e o atendimento:', error?.message || error);
    res.status(status).json({
      erro: 'A integração do atendimento não está autorizada no servidor.',
      ...(integrationCode ? { codigo: integrationCode } : {})
    });
    return;
  }
  if (status >= 500) {
    console.error('Falha na integração com o atendimento:', error?.message || error);
    res.status(status).json({
      erro: 'O atendimento está temporariamente indisponível.',
      ...(integrationCode ? { codigo: integrationCode } : {})
    });
    return;
  }
  res.status(status).json({
    erro: error?.message || 'Falha na integração com o atendimento.',
    ...(integrationCode ? { codigo: integrationCode } : {})
  });
}

sendError.reportedConfigurationErrors = new Set();

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      sendError(res, error);
    }
  };
}

router.get('/access', (req, res) => {
  const permitido = acessoPermitido(req.usuario);
  res.json({
    permitido,
    diretor: pertenceDiretoria(req.usuario),
    perfil: permitido ? perfilAtendente(req.usuario) : null
  });
});

router.get('/settings/users', exigirDiretoria, asyncRoute(async (_req, res) => {
  const [rows, respostaCanais] = await Promise.all([
    executeQuery(`
    SELECT USU.CODUSU, TRIM(USU.NOMEUSU) AS NOMEUSU,
           TRIM(GRU.NOMEGRUPO) AS NOMEGRUPO
    FROM TSIUSU USU
    LEFT JOIN TSIGRU GRU ON GRU.CODGRUPO = USU.CODGRUPO
    WHERE ${filtroAcessoAtivo('USU')}
    ORDER BY USU.NOMEUSU
  `),
    whatsappApi.getChannels()
  ]);
  const canais = Array.isArray(respostaCanais?.data) ? respostaCanais.data : [];
  res.json({
    canais,
    usuarios: rows.map((row) => {
      const salvo = atendentes.obter(row.CODUSU);
      const diretor = String(row.NOMEGRUPO || '').trim().toLocaleUpperCase('pt-BR') === 'DIRETORIA';
      return {
        codUsu: Number(row.CODUSU),
        nome: String(row.NOMEUSU || '').trim(),
        grupo: String(row.NOMEGRUPO || '').trim(),
        habilitado: diretor || salvo?.habilitado === true,
        diretor,
        nomeExibicao: salvo?.nomeExibicao || String(row.NOMEUSU || '').trim(),
        assinatura: salvo?.assinatura || '',
        canaisPermitidos: diretor ? canais.map((canal) => String(canal.id)) : (salvo?.canaisPermitidos ?? null)
      };
    })
  });
}));

router.put('/settings/users/:codUsu', exigirDiretoria, asyncRoute(async (req, res) => {
  const codUsu = Number(req.params.codUsu);
  if (!Number.isInteger(codUsu) || codUsu < 0) return res.status(400).json({ erro: 'Usuario invalido.' });
  const [usuario] = await executeQuery(`
    SELECT CODUSU, TRIM(NOMEUSU) AS NOMEUSU
    FROM TSIUSU USU
    WHERE USU.CODUSU = ${codUsu}
      AND ${filtroAcessoAtivo('USU')}
  `);
  if (!usuario) return res.status(404).json({ erro: 'Usuario Sankhya nao encontrado.' });
  const respostaCanais = await whatsappApi.getChannels();
  const canaisDisponiveis = new Set((respostaCanais?.data || []).map((canal) => String(canal.id)));
  const canaisInformados = Array.isArray(req.body?.canaisPermitidos)
    ? [...new Set(req.body.canaisPermitidos.map((canal) => String(canal || '').trim()).filter(Boolean))]
    : [];
  if (canaisInformados.some((canal) => !canaisDisponiveis.has(canal))) {
    return res.status(400).json({ erro: 'Um dos números selecionados não está disponível.' });
  }
  const perfil = atendentes.salvar(codUsu, {
    habilitado: req.body?.habilitado === true,
    nome: usuario.NOMEUSU,
    nomeExibicao: req.body?.nomeExibicao || usuario.NOMEUSU,
    assinatura: req.body?.assinatura || '',
    canaisPermitidos: canaisInformados
  }, req.usuario.codUsu);
  res.json({ perfil });
}));

router.use(exigirAcessoChat);

router.get('/profile', (req, res) => {
  res.json({ perfil: req.atendente });
});

router.put('/profile', (req, res) => {
  const perfil = atendentes.salvar(req.usuario.codUsu, {
    habilitado: true,
    nome: req.usuario.nome,
    nomeExibicao: req.body?.nomeExibicao || req.usuario.nome,
    assinatura: req.body?.assinatura || ''
  }, req.usuario.codUsu);
  res.json({ perfil: perfilAtendente({ ...req.usuario, nome: perfil.nomeExibicao }) });
});

router.get('/agents', asyncRoute(async (_req, res) => {
  const rows = await executeQuery(`
    SELECT USU.CODUSU, TRIM(USU.NOMEUSU) AS NOMEUSU,
           TRIM(GRU.NOMEGRUPO) AS NOMEGRUPO
    FROM TSIUSU USU
    LEFT JOIN TSIGRU GRU ON GRU.CODGRUPO = USU.CODGRUPO
    WHERE ${filtroAcessoAtivo('USU')}
    ORDER BY USU.NOMEUSU
  `);
  const agentes = rows.flatMap((row) => {
    const salvo = atendentes.obter(row.CODUSU);
    const diretor = String(row.NOMEGRUPO || '').trim().toLocaleUpperCase('pt-BR') === 'DIRETORIA';
    if (!diretor && salvo?.habilitado !== true) return [];
    return [{
      id: String(row.CODUSU), codUsu: Number(row.CODUSU),
      name: salvo?.nomeExibicao || String(row.NOMEUSU || '').trim(),
      signature: salvo?.assinatura || '', director: diretor
    }];
  });
  res.json({ agentes });
}));

router.get('/bitrix/pipelines', asyncRoute(async (req, res) => {
  const pipelines = await listarPipelinesBitrix(req.query.refresh === '1');
  res.json({ pipelines });
}));

router.get('/partners', asyncRoute(async (req, res) => {
  const original = String(req.query.q || '').trim();
  const numeric = original.replace(/\D/g, '');
  if ((!/^\d+$/.test(original) && original.length < 2) || (!original && !numeric)) {
    return res.json({ parceiros: [] });
  }
  const term = textoSql(original.toUpperCase());
  const numericTerm = textoSql(numeric, 30);
  const numericFilters = numericTerm
    ? `OR TO_CHAR(PAR.CODPARC) LIKE '${numericTerm}%' OR REGEXP_REPLACE(NVL(PAR.CGC_CPF, ''), '[^0-9]', '') LIKE '%${numericTerm}%'`
    : '';
  const rows = await executeQuery(`
    SELECT * FROM (
      SELECT PAR.CODPARC, PAR.NOMEPARC, PAR.RAZAOSOCIAL, PAR.CGC_CPF
      FROM TGFPAR PAR
      WHERE NVL(PAR.ATIVO, 'S') = 'S'
        AND (
          UPPER(PAR.NOMEPARC) LIKE '%${term}%'
          OR UPPER(NVL(PAR.RAZAOSOCIAL, '')) LIKE '%${term}%'
          ${numericFilters}
        )
      ORDER BY CASE
        WHEN TO_CHAR(PAR.CODPARC) = '${numericTerm}' THEN 0
        WHEN UPPER(PAR.NOMEPARC) LIKE '${term}%' THEN 1
        ELSE 2
      END, PAR.NOMEPARC
    ) WHERE ROWNUM <= 30
  `);
  res.json({
    parceiros: rows.map((row) => ({
      codParc: Number(row.CODPARC),
      nome: String(row.NOMEPARC || '').trim(),
      razaoSocial: String(row.RAZAOSOCIAL || '').trim(),
      cnpjCpf: String(row.CGC_CPF || '').trim()
    }))
  });
}));

router.get('/partners/:codParc/contacts', asyncRoute(async (req, res) => {
  const codParc = Number(req.params.codParc);
  if (!Number.isInteger(codParc) || codParc <= 0) return res.status(400).json({ erro: 'Parceiro inválido.' });
  const resultado = await contatosDoParceiro(codParc);
  if (!resultado) return res.status(404).json({ erro: 'Parceiro ativo não encontrado no Sankhya.' });
  res.json(resultado);
}));

router.post('/partners/:codParc/contacts', asyncRoute(async (req, res) => {
  const codParc = Number(req.params.codParc);
  const nomeContato = textoContatoChat(req.body?.nomeContato, 40);
  const cargo = textoContatoChat(req.body?.cargo, 40);
  const telefone = normalizarTelefoneWhatsapp(req.body?.telefone);
  if (!Number.isInteger(codParc) || codParc <= 0) return res.status(400).json({ erro: 'Parceiro inválido.' });
  if (!nomeContato) return res.status(400).json({ erro: 'Informe o nome do contato.' });
  if (!telefone) return res.status(400).json({ erro: 'Informe um telefone válido com DDD.' });

  const resultado = await contatosDoParceiro(codParc);
  if (!resultado) return res.status(404).json({ erro: 'Parceiro ativo não encontrado no Sankhya.' });
  const identidade = identidadeTelefoneWhatsapp(telefone);
  if (resultado.contatos.some((contato) => identidadeTelefoneWhatsapp(contato.telefone) === identidade)) {
    return res.status(409).json({ erro: 'Este telefone já está cadastrado neste parceiro.' });
  }

  const criado = await criarContatoWhatsappNoSankhya({ codParc, nomeContato, cargo, telefone });
  res.status(201).json({
    parceiro: resultado.parceiro,
    contato: {
      ...criado,
      key: `CTT:${criado.codContato}:CELULAR`,
      telefone,
      nome: criado.nomeContato,
      tipo: criado.cargo || 'Contato'
    }
  });
}));

router.get('/conversations', asyncRoute(async (req, res) => {
  // A fila inicial precisa exibir os atendimentos existentes. A posse só limita
  // ações de atendimento, não a visualização da conversa.
  const assignment = String(req.query.assignment || 'ALL').toUpperCase();
  const agentId = pertenceDiretoria(req.usuario) && /^\d+$/.test(String(req.query.agentId || ''))
    ? String(req.query.agentId)
    : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
  const busca = String(req.query.search || '').trim();
  const codParcBusca = /^\d+$/.test(busca) ? Number(busca) : null;
  const filtroLocalAtivo = Boolean(agentId || assignment !== 'ALL' || codParcBusca);
  const parametros = {
    page: filtroLocalAtivo ? 1 : page,
    limit: filtroLocalAtivo ? 100 : limit,
    search: req.query.search,
    status: req.query.status,
    channelId: req.query.channelId,
    phoneNumberId: req.query.phoneNumberId,
    // A distribuição é local ao aplicativo; a API externa sempre entrega a fila completa.
    assignment: 'ALL'
  };
  const resposta = await whatsappApi.getConversations(parametros);
  if (filtroLocalAtivo) {
    const totalPages = Math.max(1, Number(resposta.pagination?.totalPages || 1));
    for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
      const next = await whatsappApi.getConversations({ ...parametros, page: currentPage });
      resposta.data = [...(resposta.data || []), ...(next.data || [])];
    }
  }
  if (Number.isInteger(codParcBusca) && codParcBusca > 0) {
    const conversasDoParceiro = await buscarConversasPorCodigoParceiro(codParcBusca);
    resposta.data = [...(resposta.data || []), ...conversasDoParceiro];
  }
  const consolidadasBase = consolidarConversas(resposta.data || []);
  // Bitrix e Sankhya enriquecem a fila, mas não podem bloquear o acesso ao chat.
  // Entregue imediatamente o estado local/cacheado e atualize os cards via SSE.
  const consolidadas = vincularCadastrosSankhyaDoCache(consolidadasBase.map(comAtribuicao));
  void enriquecerConversasEmSegundoPlano(consolidadasBase).catch((error) => {
    console.error('Falha ao enriquecer a fila do chat em segundo plano:', error.message);
  });
  const filtradas = consolidadas.filter((conversa) => {
    if (!atendentePodeAcessarConversa(req.atendente, conversa)) return false;
    if (req.query.channelId && String(conversa.channel?.id ?? conversa.channelId ?? '') !== String(req.query.channelId)) return false;
    if (req.query.phoneNumberId && String(conversa.channel?.phoneNumberId ?? conversa.phoneNumberId ?? '') !== String(req.query.phoneNumberId)) return false;
    if (conversaOcultaParaUsuario(req.usuario.codUsu, conversa)) return false;
    return conversaCorrespondeFiltroAtendente(conversa, {
      assignment,
      agentId,
      currentAgentId: req.atendente.id
    });
  });
  const data = filtroLocalAtivo ? filtradas.slice((page - 1) * limit, page * limit) : filtradas;
  const pagination = resposta.pagination || {};
  res.json({
    ...resposta,
    data,
    pagination: {
      ...pagination,
      page,
      limit,
      total: filtroLocalAtivo ? filtradas.length : Number(pagination.total || data.length),
      totalPages: filtroLocalAtivo
        ? Math.max(1, Math.ceil(filtradas.length / limit))
        : Math.max(1, Number(pagination.totalPages || 1))
    }
  });
}));

router.get('/channels', asyncRoute(async (req, res) => {
  const resposta = await whatsappApi.getChannels();
  const canais = Array.isArray(resposta?.data) ? resposta.data : [];
  res.json({ success: true, data: canais.filter((canal) => atendentePodeAcessarCanal(req.atendente, canal.id)) });
}));

router.post('/conversations', asyncRoute(async (req, res) => {
  const codParc = Number(req.body?.codParc);
  const contactKey = String(req.body?.contactKey || '').trim();
  const pipelineId = idPipelineBitrix(req.body?.pipelineId);
  const requestedChannelId = String(req.body?.channelId ?? '').trim();
  if (!Number.isInteger(codParc) || codParc <= 0 || !contactKey || pipelineId === null) {
    return res.status(400).json({ erro: 'Selecione um parceiro, um contato e um pipeline do Bitrix.' });
  }
  const respostaCanais = await whatsappApi.getChannels();
  const canais = Array.isArray(respostaCanais?.data) ? respostaCanais.data : [];
  const canal = requestedChannelId
    ? canais.find((item) => String(item.id) === requestedChannelId)
    : canais.find((item) => item.isDefault === true);
  if (!canal) {
    return res.status(409).json({ erro: 'Este número de atendimento não está disponível no momento.' });
  }
  if (!atendentePodeAcessarCanal(req.atendente, canal.id)) throw erroCanalNaoPermitido();
  const channelId = Number(canal.id);
  const resultado = await contatosDoParceiro(codParc);
  if (!resultado) return res.status(404).json({ erro: 'Parceiro ativo não encontrado no Sankhya.' });
  const contato = resultado.contatos.find((item) => item.key === contactKey);
  if (!contato) return res.status(400).json({ erro: 'O contato selecionado não possui um telefone ativo no Sankhya.' });
  const existente = await buscarConversaPorTelefone(contato.telefone, channelId);
  const resposta = existente
    ? { conversation: existente, reused: true }
    : await whatsappApi.createConversation({ name: contato.nome, phone: identidadeTelefoneWhatsapp(contato.telefone), channelId });
  const conversationBase = consolidarConversas([resposta.conversation])[0];
  const contactMatch = contactKey.match(/^CTT:(\d+):/);
  const conversation = {
    ...conversationBase,
    cadastroSankhya: cadastroSankhyaSelecionado([{
      codParc,
      nomeParc: resultado.parceiro.nome,
      codContato: contactMatch ? Number(contactMatch[1]) : null,
      nomeContato: contato.nome,
      origem: contactKey.startsWith('CTT:') ? 'CONTATO' : 'PARCEIRO',
      telefone: contato.telefone
    }])
  };
  atendentes.revelarConversa(req.usuario.codUsu, chavesIdentidadeConversa(conversation));
  const atribuicaoAtual = comAtribuicao(conversation).assignment;
  let atribuicaoCriada = null;
  if (!atribuicaoAtual) {
    atribuicaoCriada = atendentes.atribuirConversa(conversation.id, {
      acao: 'START',
      ator: req.atendente,
      destino: req.atendente
    });
  }
  let bitrixError = '';
  try {
    await vincularPipelineBitrix(conversation, pipelineId);
  } catch (error) {
    bitrixError = error.message || 'Não foi possível criar o card no Bitrix.';
    atendentes.marcarPipelinePendente(conversation.id, bitrixError);
  }
  const conversationWithAssignment = comAtribuicao(conversation);
  if (atribuicaoCriada) {
    eventosAtendimento.emit('assignment', {
      conversationId: conversation.id,
      conversation: conversationWithAssignment,
      assignment: atribuicaoCriada
    });
  }
  res.status(existente ? 200 : 201).json({
    ...resposta,
    conversation: conversationWithAssignment,
    bitrixError,
    selectedContact: { ...contato, codParc, parceiro: resultado.parceiro.nome }
  });
}));

router.use('/conversations/:id', asyncRoute(async (req, _res, next) => {
  const conversation = await obterConversaConsolidada(id(req.params.id));
  if (!atendentePodeAcessarConversa(req.atendente, conversation)) throw erroCanalNaoPermitido();
  req.conversaAutorizada = conversation;
  next();
}));

router.get('/conversations/:id', asyncRoute(async (req, res) => {
  const conversation = await obterConversaConsolidada(id(req.params.id));
  await sincronizarPipelinesBitrix([conversation]);
  const atualizado = comAtribuicao(conversation);
  const [vinculada] = await vincularCadastrosSankhya([atualizado], { force: true });
  res.json(vinculada);
}));

router.patch('/conversations/:id/display-name', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const nomeExibicao = String(req.body?.nomeExibicao || '').trim();
  if (!nomeExibicao) return res.status(400).json({ erro: 'Informe o nome do cliente.' });
  const conversation = await obterConversaConsolidada(conversationId);
  const relatedIds = new Set([conversation.id, ...(conversation.relatedConversationIds || [])]
    .map(Number)
    .filter(Number.isInteger));
  relatedIds.forEach((relatedId) => atendentes.renomearConversa(relatedId, nomeExibicao));
  const atualizado = comAtribuicao(conversation);
  eventosAtendimento.emit('updated', { conversation: atualizado });
  res.json(atualizado);
}));

router.get('/conversations/:id/bitrix-history', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  await sincronizarPipelinesBitrix([{ id: conversationId }]);
  res.json({ history: await historicoPipelinesBitrix(conversationId) });
}));

router.post('/conversations/:id/sankhya-link', asyncRoute(async (req, res) => {
  const codParc = Number(req.body?.codParc);
  if (!Number.isInteger(codParc) || codParc <= 0) return res.status(400).json({ erro: 'Selecione um parceiro válido.' });
  const conversation = await obterConversaConsolidada(id(req.params.id));
  const nomeContato = textoContatoChat(req.body?.nomeContato, 40) || nomeDaConversa(conversation);
  const cargo = textoContatoChat(req.body?.cargo, 40);
  const telefone = normalizarTelefoneWhatsapp(telefoneDaConversa(conversation));
  if (!telefone) return res.status(400).json({ erro: 'Esta conversa não possui um telefone válido para vincular.' });
  const resultado = await contatosDoParceiro(codParc);
  if (!resultado) return res.status(404).json({ erro: 'Parceiro ativo não encontrado no Sankhya.' });

  const identidade = identidadeTelefoneWhatsapp(telefone);
  const existente = resultado.contatos.find((contato) =>
    String(contato.key || '').startsWith('CTT:')
      && identidadeTelefoneWhatsapp(contato.telefone) === identidade
  );
  const contactKey = existente?.key || '';
  const match = contactKey.match(/^CTT:(\d+):/);
  const vinculo = existente
    ? {
      codContato: match ? Number(match[1]) : null,
      nomeContato: existente.nome,
      origem: contactKey.startsWith('CTT:') ? 'CONTATO' : 'PARCEIRO',
      criado: false
    }
    : {
      ...(await criarContatoWhatsappNoSankhya({
        codParc,
        nomeContato,
        cargo,
        telefone
      })),
      origem: 'CONTATO',
      criado: true
    };
  const cadastroSankhya = cadastroSankhyaSelecionado([{
    codParc,
    nomeParc: resultado.parceiro.nome,
    codContato: vinculo.codContato,
    nomeContato: vinculo.nomeContato,
    origem: vinculo.origem,
    telefone
  }]);
  cacheCadastroSankhyaPorTelefone.set(identidade, {
    expiresAt: Date.now() + CADASTRO_SANKHYA_CACHE_MS,
    cadastro: cadastroSankhya
  });
  res.json({
    conversation: { ...conversation, cadastroSankhya },
    vinculo: { ...vinculo, codParc, nomeParc: resultado.parceiro.nome }
  });
}));

router.get('/conversations/:id/messages', asyncRoute(async (req, res) => {
  res.json(await mensagensConsolidadas(id(req.params.id), {
    page: req.query.page,
    limit: req.query.limit
  }));
}));

router.post('/conversations/:id/messages', asyncRoute(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ erro: 'Digite uma mensagem.' });
  const replyToMessageId = req.body?.replyToMessageId
    ? idMensagemWhatsapp(req.body.replyToMessageId)
    : '';
  if (req.body?.replyToMessageId && !replyToMessageId) {
    return res.status(400).json({ erro: 'A mensagem selecionada para resposta é inválida.' });
  }
  const conversation = await obterConversaConsolidada(id(req.params.id));
  podeAtender(conversation, req.atendente);
  const messageConversationId = await idConversaParaMensagem(id(req.params.id));
  const resposta = await whatsappApi.sendTextMessage(
    messageConversationId,
    textoAssinado(text, req.atendente),
    replyToMessageId
  );
  atendentes.registrarInteracao(conversation.id);
  res.status(201).json(resposta);
}));

router.post('/conversations/:id/messages/reaction', asyncRoute(async (req, res) => {
  const messageId = idMensagemWhatsapp(req.body?.messageId);
  const emoji = reacaoValida(req.body?.emoji);
  if (!messageId || !emoji) return res.status(400).json({ erro: 'Reação inválida.' });
  const conversation = await obterConversaConsolidada(id(req.params.id));
  podeAtender(conversation, req.atendente);
  const messageConversationId = await idConversaParaMensagem(id(req.params.id));
  const resposta = await whatsappApi.sendReaction(messageConversationId, messageId, emoji);
  atendentes.registrarInteracao(conversation.id);
  res.status(201).json(resposta);
}));

router.post('/conversations/:id/claim', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  const pipelineId = idPipelineBitrix(req.body?.pipelineId);
  const withoutPipeline = req.body?.withoutPipeline === true;
  const atual = obterAtribuicaoConversa(conversation);
  if (atual?.userId && String(atual.userId) !== req.atendente.id) {
    return res.status(409).json({ erro: `Conversa em atendimento por ${atual.userName || 'outro atendente'}.` });
  }
  const assignment = atribuirGrupoConversa(conversation, { acao: 'CLAIM', ator: req.atendente, destino: req.atendente });
  let bitrixError = '';
  if (pipelineId !== null) {
    try {
      await vincularPipelineBitrix(conversation, pipelineId);
    } catch (error) {
      bitrixError = error.message || 'Não foi possível criar o card no Bitrix.';
      atendentes.marcarPipelinePendente(conversationId, bitrixError);
    }
  } else if (withoutPipeline || !(atual?.bitrixPipelines || []).length) {
    atendentes.marcarPipelinePendente(conversationId, 'Atendimento assumido sem pipeline.');
  }
  let readConfirmed = false;
  try {
    const messageConversationId = await idConversaParaMensagem(conversationId);
    await whatsappApi.markConversationRead(messageConversationId);
    readConfirmed = true;
  } catch {
    // A atribuição local continua válida mesmo se a Meta não confirmar a leitura.
  }
  const resultado = {
    ...comAtribuicao(conversation),
    readConfirmed,
    ...(bitrixError ? { bitrixError } : {})
  };
  eventosAtendimento.emit('assignment', { conversationId, conversation: resultado, assignment });
  res.json(resultado);
}));

router.post('/conversations/:id/bitrix-pipelines', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const pipelineId = idPipelineBitrix(req.body?.pipelineId);
  if (pipelineId === null) return res.status(400).json({ erro: 'Selecione um pipeline válido.' });
  const conversation = await obterConversaConsolidada(conversationId);
  try {
    const link = await vincularPipelineBitrix(conversation, pipelineId);
    res.status(link.reused ? 200 : 201).json({ conversation: comAtribuicao(conversation), link });
  } catch (error) {
    atendentes.marcarPipelinePendente(conversationId, error.message);
    res.status(502).json({ erro: 'Não foi possível vincular o pipeline no Bitrix.', detalhes: error.message });
  }
}));

router.post('/conversations/:id/release', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente, true);
  const assignment = atribuirGrupoConversa(conversation, { acao: 'RELEASE', ator: req.atendente });
  const resultado = comAtribuicao(conversation);
  eventosAtendimento.emit('assignment', { conversationId, conversation: resultado, assignment });
  res.json(resultado);
}));

router.post('/conversations/:id/transfer', asyncRoute(async (req, res) => {
  const codUsu = Number(req.body?.codUsu);
  const destino = atendentes.obter(codUsu);
  const [usuario] = Number.isInteger(codUsu) ? await executeQuery(`
    SELECT USU.CODUSU, TRIM(USU.NOMEUSU) AS NOMEUSU, TRIM(GRU.NOMEGRUPO) AS NOMEGRUPO
    FROM TSIUSU USU LEFT JOIN TSIGRU GRU ON GRU.CODGRUPO = USU.CODGRUPO
    WHERE USU.CODUSU = ${codUsu}
      AND ${filtroAcessoAtivo('USU')}
  `) : [];
  const diretor = String(usuario?.NOMEGRUPO || '').trim().toLocaleUpperCase('pt-BR') === 'DIRETORIA';
  if (!usuario || (!diretor && destino?.habilitado !== true)) return res.status(400).json({ erro: 'Selecione um atendente habilitado.' });
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente, true);
  const assignment = atribuirGrupoConversa(conversation, {
    acao: 'TRANSFER', ator: req.atendente,
    destino: { id: String(codUsu), name: destino?.nomeExibicao || usuario.NOMEUSU }
  });
  const resultado = comAtribuicao(conversation);
  eventosAtendimento.emit('assignment', { conversationId, conversation: resultado, assignment });
  res.json(resultado);
}));

router.post('/conversations/:id/read', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente);
  const messageConversationId = await idConversaParaMensagem(conversationId);
  res.json(await whatsappApi.markConversationRead(messageConversationId));
}));

router.patch('/conversations/:id/status', asyncRoute(async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['OPEN', 'CLOSED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ erro: 'Status de conversa inválido.' });
  }
  const conversation = await whatsappApi.getConversation(id(req.params.id));
  podeAtender(conversation, req.atendente, true);
  res.json(await whatsappApi.updateConversationStatus(id(req.params.id), status));
}));

router.delete('/conversations/:id', asyncRoute(async (req, res) => {
  const conversation = await obterConversaConsolidada(id(req.params.id));
  const contact = conversation.contact || conversation.Contact || {};
  const ocultacao = atendentes.ocultarConversaGlobal(
    chavesIdentidadeConversa(conversation),
    {
      nome: contact.name || contact.profileName || '',
      telefone: telefoneDaConversa(conversation)
    }
  );
  eventosAtendimento.emit('deleted', {
    conversationId: Number(conversation.id),
    relatedConversationIds: conversation.relatedConversationIds || [],
    global: true
  });
  res.json({ ocultada: true, global: true, conversationId: Number(conversation.id), ocultacao });
}));

router.get('/templates', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.getTemplates(req.query));
}));

router.get('/templates/:name', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.getTemplate(req.params.name, req.query.language));
}));

router.post('/templates/preview', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.previewTemplate(req.body || {}));
}));

router.post('/conversations/:id/messages/template', asyncRoute(async (req, res) => {
  const conversation = await obterConversaConsolidada(id(req.params.id));
  podeAtender(conversation, req.atendente);
  const resposta = await whatsappApi.sendTemplate(Number(conversation.id), req.body || {});
  atendentes.registrarInteracao(conversation.id);
  res.status(201).json(resposta);
}));

router.get('/calls', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.getCalls({
    page: req.query.page,
    limit: req.query.limit,
    conversationId: req.query.conversationId
  }));
}));

router.get('/conversations/:id/calls', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.getConversationCalls(id(req.params.id), {
    page: req.query.page,
    limit: req.query.limit
  }));
}));

async function consultarPermissaoLigacao(req, res) {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente, true);
  res.json(await whatsappApi.getCallPermission(conversationId, agenteChamada(req.atendente), req.atendente));
}

router.get('/conversations/:id/call-permission', asyncRoute(consultarPermissaoLigacao));
router.get('/conversations/:id/calls/permission', asyncRoute(consultarPermissaoLigacao));

router.post('/conversations/:id/calls/permission', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente, true);
  res.json(await whatsappApi.requestCallPermission(conversationId, {
    body: String(req.body?.body || '').trim(),
    agent: agenteChamada(req.atendente)
  }, req.atendente));
}));

router.post('/conversations/:id/calls/media', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente);
  res.status(201).json(await whatsappApi.createOutboundMedia(conversationId, {
    session: req.body?.session
  }, req.atendente));
}));

router.post('/conversations/:id/calls', asyncRoute(async (req, res) => {
  const conversationId = id(req.params.id);
  const conversation = await obterConversaConsolidada(conversationId);
  podeAtender(conversation, req.atendente);
  res.status(201).json(await whatsappApi.createCall(conversationId, {
    ...(req.body?.mediaSessionId ? { mediaSessionId: req.body.mediaSessionId } : { session: req.body?.session }),
    agent: agenteChamada(req.atendente)
  }, req.atendente));
}));

router.get('/call-agents', asyncRoute(async (req, res) => {
  res.json(await whatsappApi.getCallAgents(req.atendente));
}));

router.post('/calls/:callId/media', asyncRoute(async (req, res) => {
  const callId = idChamadaWhatsapp(req.params.callId);
  if (!callId) return res.status(400).json({ erro: 'Chamada inválida.' });
  res.status(201).json(await whatsappApi.joinCallMedia(callId, {
    session: req.body?.session,
    ...(req.body?.transferId ? { transferId: req.body.transferId } : {})
  }, req.atendente));
}));

router.post('/calls/:callId/media-ready', asyncRoute(async (req, res) => {
  const callId = idChamadaWhatsapp(req.params.callId);
  if (!callId) return res.status(400).json({ erro: 'Chamada inválida.' });
  res.json(await whatsappApi.callMediaReady(callId, {
    ...(req.body?.transferId ? { transferId: req.body.transferId } : {})
  }, req.atendente));
}));

router.post('/calls/:callId/transfer', asyncRoute(async (req, res) => {
  const callId = idChamadaWhatsapp(req.params.callId);
  if (!callId) return res.status(400).json({ erro: 'Chamada inválida.' });
  res.status(201).json(await whatsappApi.requestCallTransfer(
    callId, String(req.body?.targetAgentId || ''), req.atendente
  ));
}));

for (const action of ['accept', 'reject', 'cancel']) {
  router.post(`/calls/:callId/transfer/:transferId/${action}`, asyncRoute(async (req, res) => {
    const callId = idChamadaWhatsapp(req.params.callId);
    if (!callId || !/^[0-9a-f-]{36}$/i.test(String(req.params.transferId || ''))) {
      return res.status(400).json({ erro: 'Transferência inválida.' });
    }
    res.json(await whatsappApi.updateCallTransfer(
      callId, req.params.transferId, action, req.atendente
    ));
  }));
}

function reivindicarChamada(callId, conversation, atendente) {
  const resultado = controleChamadas.reivindicar(callId, conversation.id, atendente);
  if (!resultado.criado) return resultado.atendimento;

  const atribuicao = liberarAtribuicaoExpirada(conversation);
  if (String(atribuicao?.userId || '') !== String(atendente.id)) {
    try {
      const assignment = atribuirGrupoConversa(conversation, {
        acao: 'CALL_ACCEPT', ator: atendente, destino: atendente
      });
      eventosAtendimento.emit('assignment', {
        conversationId: conversation.id,
        conversation: comAtribuicao(conversation),
        assignment
      });
    } catch (error) {
      controleChamadas.liberar(callId, atendente);
      throw error;
    }
  }
  eventosAtendimento.emit('call', {
    event: 'call:claimed',
    payload: {
      callId,
      conversationId: Number(conversation.id),
      attendant: { id: String(atendente.id), name: atendente.name || 'Atendente' },
      clientId: atendente.clientId,
      claimedAt: resultado.atendimento.claimedAt
    }
  });
  return resultado.atendimento;
}

router.post('/calls/:callId/claim', asyncRoute(async (req, res) => {
  const callId = idChamadaWhatsapp(req.params.callId);
  if (!callId) return res.status(400).json({ erro: 'Chamada inválida.' });
  const conversationId = id(req.body?.conversationId);
  const conversation = await obterConversaConsolidada(conversationId);
  const atendente = atendenteChamada(req.atendente, req.body?.clientId);
  res.json({ atendimento: reivindicarChamada(callId, conversation, atendente) });
}));

for (const action of ['pre-accept', 'accept', 'reject', 'terminate']) {
  router.post(`/calls/:callId/${action}`, asyncRoute(async (req, res) => {
    const callId = idChamadaWhatsapp(req.params.callId);
    if (!callId) return res.status(400).json({ erro: 'Chamada inválida.' });
    const conversationId = id(req.body?.conversationId);
    const conversation = await obterConversaConsolidada(conversationId);
    const atendente = atendenteChamada(req.atendente, req.body?.clientId);
    if (['pre-accept', 'accept'].includes(action)) reivindicarChamada(callId, conversation, atendente);
    else if (action === 'terminate') {
      const atendimento = controleChamadas.exigir(callId, atendente);
      if (!atendimento) podeAtender(conversation, req.atendente);
    } else {
      const atendimento = controleChamadas.exigir(callId, atendente);
      const atribuicao = liberarAtribuicaoExpirada(conversation);
      if (!atendimento && atribuicao?.userId && String(atribuicao.userId) !== String(req.atendente.id)) {
        throw erroPosseChamada(atribuicao);
      }
    }
    const resposta = await whatsappApi.updateCall(callId, action, {
      ...(req.body?.session ? { session: req.body.session } : {}),
      agent: agenteChamada(req.atendente)
    }, req.atendente);
    if (['reject', 'terminate'].includes(action)) controleChamadas.liberar(callId, atendente);
    res.json(resposta);
  }));
}

for (const kind of ['image', 'document', 'video', 'audio']) {
  router.post(`/conversations/:id/messages/${kind}`, upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Selecione um arquivo.' });
    if (req.file.size > MEDIA_LIMITS[kind]) {
      return res.status(413).json({ erro: `Arquivo excede o limite de ${Math.round(MEDIA_LIMITS[kind] / 1024 / 1024)} MB.` });
    }
    const conversation = await obterConversaConsolidada(id(req.params.id));
    podeAtender(conversation, req.atendente);
    const messageConversationId = await idConversaParaMensagem(id(req.params.id));
    const resposta = await whatsappApi.sendMedia(messageConversationId, kind, req.file, req.body || {});
    atendentes.registrarInteracao(conversation.id);
    res.status(201).json(resposta);
  }));
}

router.get('/media/:mediaId', asyncRoute(async (req, res) => {
  const mediaId = String(req.params.mediaId || '');
  if (!/^[A-Za-z0-9._:-]{3,512}$/.test(mediaId)) {
    return res.status(400).json({ erro: 'Mídia inválida.' });
  }
  const media = await whatsappApi.getMedia(mediaId);
  res.setHeader('Content-Type', media.contentType);
  // O identificador aponta para uma mídia imutável. O cache privado evita baixar
  // novamente o mesmo arquivo ao alternar conversas ou recarregar a página.
  res.setHeader('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800');
  if (media.contentLength) res.setHeader('Content-Length', media.contentLength);
  if (!media.body) return res.end();
  media.body.on('error', () => res.destroy());
  media.body.pipe(res);
}));

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const write = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const onAssignment = (payload) => {
    if (atendentePodeAcessarConversa(req.atendente, payload?.conversation || {})) write('conversation:assignment', payload);
  };
  const onCall = ({ event, payload }) => {
    const attendantId = payload?.attendant?.id;
    if (!attendantId || String(attendantId) === String(req.atendente.id)) write(event, payload);
  };
  const onDeleted = (payload) => write('conversation:deleted', payload);
  const onUpdated = (payload) => {
    const conversation = payload?.conversation || payload || {};
    if (atendentePodeAcessarConversa(req.atendente, conversation)
      && !conversaOcultaParaUsuario(req.usuario.codUsu, conversation)) write('conversation:updated', payload);
  };
  eventosAtendimento.on('assignment', onAssignment);
  eventosAtendimento.on('call', onCall);
  eventosAtendimento.on('deleted', onDeleted);
  eventosAtendimento.on('updated', onUpdated);
  const unsubscribe = realtime.subscribe(
    ({ event, payload }) => {
      if (String(event).startsWith('call:')) {
        return;
      }
      normalizarEventoAtendimento(event, payload)
        .then(async (normalizado) => {
          if (normalizado.conversation) {
            const [vinculada] = await vincularCadastrosSankhya([normalizado.conversation]);
            normalizado = { ...normalizado, conversation: vinculada };
          }
          const conversation = normalizado.conversation || {
            id: normalizado.conversationId,
            ...(normalizado.message ? { lastMessage: normalizado.message, lastMessageAt: normalizado.message.messageTimestamp } : {})
          };
          if (atendentePodeAcessarConversa(req.atendente, conversation)
            && !conversaOcultaParaUsuario(req.usuario.codUsu, conversation)) write(event, normalizado);
        })
        // Sem a conversa normalizada não é possível confirmar o número de origem.
        // O evento é descartado para não expor uma conversa de canal não liberado.
        .catch(() => {});
    },
    (payload) => write('connection', payload)
  );
  const agentRealtime = whatsappApi.createRealtimeBridge({ agent: req.atendente });
  const unsubscribeAgent = agentRealtime.subscribe(({ event, payload }) => {
    if (!String(event).startsWith('call:')) return;
    if (event === 'call:transfer:completed' && payload?.conversationId
      && String(payload?.toAgent?.id || '') === String(req.atendente.id)) {
      const current = atendentes.obterConversa(payload.conversationId);
      if (String(current?.userId || '') !== String(req.atendente.id)) {
        const assignment = atribuirGrupoConversa({ id: Number(payload.conversationId) }, {
          acao: 'CALL_TRANSFER',
          ator: payload.fromAgent || { id: 'SISTEMA', name: 'Sistema' },
          destino: req.atendente
        });
        eventosAtendimento.emit('assignment', {
          conversationId: Number(payload.conversationId),
          conversation: comAtribuicao({ id: Number(payload.conversationId) }),
          assignment
        });
      }
    }
    if (['call:ended', 'call:failed', 'call:rejected', 'call:transferred:away'].includes(String(event))) {
      controleChamadas.liberar(idChamadaWhatsapp(payload?.callId || payload?.call?.id || payload?.id));
    }
    write(event, payload);
  });
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    eventosAtendimento.off('assignment', onAssignment);
    eventosAtendimento.off('call', onCall);
    eventosAtendimento.off('deleted', onDeleted);
    eventosAtendimento.off('updated', onUpdated);
    unsubscribe();
    unsubscribeAgent();
  });
});

router.use((error, _req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);
  res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
    erro: error.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite permitido.' : 'Upload inválido.'
  });
});

router._internals = {
  asyncRoute,
  acessoPermitido,
  atribuicaoExpirada,
  buscarCadastrosSankhyaPorTelefones,
  cadastroSankhyaSelecionado,
  chavesIdentidadeConversa,
  consolidarConversas,
  conversaCorrespondeFiltroAtendente,
  conversaOcultaParaUsuario,
  filtroAcessoAtivo,
  idPipelineBitrix,
  identidadeTelefoneWhatsapp,
  isMetaAuthError,
  normalizarTelefoneWhatsapp,
  perfilAtendente,
  primeiraEtapaAberta,
  statusCardConcluido,
  etapaEncerradaCobranca,
  textoNormalizadoBitrix,
  pertenceDiretoria,
  responseStatus,
  reacaoValida,
  idMensagemWhatsapp,
  idChamadaWhatsapp,
  idClienteChamada,
  atendenteChamada,
  agenteChamada,
  atendentePodeAcessarCanal,
  atendentePodeAcessarConversa,
  criarControleChamadas,
  idsRelacionadosConversa,
  obterAtribuicaoMaisRecente,
  textoContatoChat,
  textoSql,
  variantesTelefoneSankhya,
  variantesTelefoneWhatsapp
};
module.exports = router;
