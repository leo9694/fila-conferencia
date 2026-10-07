const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function criarChatSetoresStore({ filePath = path.join(process.cwd(), 'data', 'chat-setores.json') } = {}) {
  function carregar() {
    if (!fs.existsSync(filePath)) return { canais: {} };
    const estado = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!estado || !estado.canais || typeof estado.canais !== 'object' || Array.isArray(estado.canais)) {
      throw new Error('Arquivo de setores do chat inválido.');
    }
    return estado;
  }

  function listar(channelId) {
    return carregar().canais[String(channelId)] || { setores: [], revisao: null };
  }

  function salvar(channelId, dados, usuariosSankhya, codUsu, { persistir = true } = {}) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(channelId)) || ['__proto__', 'constructor', 'prototype'].includes(String(channelId))) {
      throw erro('Número de atendimento inválido.');
    }
    if (!Array.isArray(dados.setores) || dados.setores.length > 100) throw erro('Informe até 100 setores.');
    const estado = carregar();
    const anterior = estado.canais[channelId] || { setores: [], revisao: null };
    if ((dados.revisao ?? null) !== anterior.revisao) throw erro('A configuração foi alterada por outra pessoa. Reabra a tela.', 409);
    const usuariosExistentes = new Set(usuariosSankhya.map((usuario) => String(usuario.codUsu)));
    const ids = new Set();
    const nomes = new Set();
    const setores = dados.setores.map((setor) => {
      if (!setor || typeof setor !== 'object') throw erro('Setor inválido.');
      const nome = String(setor.nome || '').trim();
      const chave = nome.toLocaleLowerCase('pt-BR');
      if (!nome || nome.length > 80 || nomes.has(chave)) throw erro('Informe nomes de setores distintos, com até 80 caracteres.');
      nomes.add(chave);
      const id = setor.id || randomUUID();
      if (ids.has(id) || (setor.id && !anterior.setores.some((item) => item.id === setor.id))) throw erro('Identificador de setor inválido.');
      ids.add(id);
      if (!Array.isArray(setor.atendentes)) throw erro('Informe os atendentes do setor.');
      const atendentes = [...new Set(setor.atendentes.map(String))];
      if (atendentes.some((codigo) => !usuariosExistentes.has(codigo))) throw erro('Um dos usuários selecionados não foi encontrado no Sankhya.');
      return { id, nome, atendentes };
    });
    const registro = { setores, revisao: randomUUID(), atualizadoEm: new Date().toISOString(), atualizadoPor: codUsu };
    if (!persistir) return registro;
    estado.canais[channelId] = registro;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(estado, null, 2), 'utf8');
    fs.renameSync(`${filePath}.tmp`, filePath);
    return registro;
  }

  return { listar, salvar };
}

module.exports = { criarChatSetoresStore };
