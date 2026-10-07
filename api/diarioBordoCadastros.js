const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { executeQuery } = require('./sankhyaApi');

function erro(mensagem, status = 400) { return Object.assign(new Error(mensagem), { status }); }
function texto(valor, campo, obrigatorio = true) {
  const resultado = String(valor ?? '').trim();
  if ((obrigatorio && !resultado) || resultado.length > 1000) throw erro(`Informe ${campo} válido (até 1000 caracteres).`);
  return resultado;
}
function codigoUsuario(valor) {
  if (valor === '' || valor === undefined || valor === null) return null;
  if (!/^\d+$/.test(String(valor)) || !Number.isSafeInteger(Number(valor))) throw erro('Código de usuário inválido.');
  return Number(valor);
}

function criarDiarioBordoCadastros({ filePath = path.join(process.cwd(), 'data', 'diario-bordo-cadastros.json'), executarConsulta = executeQuery } = {}) {
  const tipos = ['rotas', 'carros', 'motoristas'];
  function carregar() {
    if (!fs.existsSync(filePath)) return { rotas: [], carros: [], motoristas: [] };
    const cadastros = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!cadastros || tipos.some((tipo) => !Array.isArray(cadastros[tipo]))) throw new Error('Arquivo de cadastros do diário inválido.');
    return cadastros;
  }
  function listar() {
    const cadastros = carregar();
    return Object.fromEntries(tipos.map((tipo) => [tipo, cadastros[tipo].filter((item) => !item.excluidoEm)]));
  }
  function salvar(cadastros) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(cadastros, null, 2), 'utf8');
    fs.renameSync(`${filePath}.tmp`, filePath);
  }
  async function consultarUsuarios(busca) {
    const pesquisa = texto(busca, 'a busca', false).slice(0, 100);
    const nome = pesquisa.toUpperCase().replace(/'/g, "''").replace(/[\\%_]/g, '\\$&');
    const codigo = /^\d+$/.test(pesquisa) && Number.isSafeInteger(Number(pesquisa)) ? ` OR CODUSU = ${Number(pesquisa)}` : '';
    const rows = await executarConsulta(`SELECT CODUSU, NOMEUSU FROM (SELECT CODUSU, NOMEUSU FROM TSIUSU WHERE NOMEUSU IS NOT NULL AND (UPPER(NOMEUSU) LIKE '%${nome}%' ESCAPE '\\'${codigo}) ORDER BY NOMEUSU) WHERE ROWNUM <= 50`);
    return rows.map((row) => ({ codUsu: Number(row.CODUSU), nome: String(row.NOMEUSU).trim() }));
  }
  async function adicionar(tipo, dados, usuario) {
    if (!tipos.includes(tipo)) throw erro('Tipo de cadastro inválido.');
    const item = { id: randomUUID(), criadoEm: new Date().toISOString(), criadoPor: { codUsu: usuario?.codUsu ?? null, nome: usuario?.nome ?? '' } };
    if (tipo === 'rotas') {
      const distanciaIda = Number(dados.distanciaIda);
      if (!['string', 'number'].includes(typeof dados.distanciaIda) || String(dados.distanciaIda).trim() === '' || !Number.isFinite(distanciaIda) || distanciaIda <= 0 || distanciaIda > 9999999) throw erro('Informe a distância até o destino em km, maior que zero.');
      Object.assign(item, { nome: texto(dados.nome, 'o nome da rota'), origem: 'Norte Sul Sementes MT (Empresa 1)', destino: texto(dados.destino, 'o destino / percurso'), distanciaIda });
    } else if (tipo === 'carros') {
      const placa = texto(dados.placa, 'a placa').toUpperCase().replace(/[\s-]/g, '');
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) throw erro('Placa inválida. Use ABC1234 ou ABC1D23.');
      Object.assign(item, { placa, veiculo: texto(dados.veiculo, 'o veículo / modelo'), empresa: texto(dados.empresa, 'a empresa', false) });
    } else {
      const nome = texto(dados.nome, 'o nome completo do motorista');
      if (nome.split(/\s+/).length < 2) throw erro('Informe o nome completo do motorista.');
      const cnh = texto(dados.cnh, 'a CNH');
      if (!/^\d{11}$/.test(cnh)) throw erro('Informe a CNH com 11 números.');
      const categoriaCnh = texto(dados.categoriaCnh, 'a categoria da CNH').toUpperCase();
      if (!['ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE'].includes(categoriaCnh)) throw erro('Categoria da CNH inválida.');
      const codUsu = codigoUsuario(dados.codUsu);
      let nomeUsuario = null;
      if (codUsu !== null) {
        const [encontrado] = await executarConsulta(`SELECT CODUSU, NOMEUSU FROM TSIUSU WHERE CODUSU = ${codUsu}`);
        if (!encontrado?.NOMEUSU) throw erro('Usuário não encontrado no Sankhya.');
        nomeUsuario = String(encontrado.NOMEUSU).trim();
      }
      Object.assign(item, { nome, cnh, categoriaCnh, codUsu, nomeUsuario });
    }
    // Releitura após a consulta externa preserva cadastros realizados enquanto ela aguardava.
    const cadastros = carregar();
    const ativos = cadastros[tipo].filter((existente) => !existente.excluidoEm);
    if (ativos.some((existente) => tipo === 'carros' ? existente.placa === item.placa : existente.nome.toLocaleLowerCase('pt-BR') === item.nome.toLocaleLowerCase('pt-BR'))) throw erro('Este cadastro já existe.', 409);
    if (tipo === 'motoristas' && ativos.some((motorista) => motorista.cnh === item.cnh)) throw erro('Esta CNH já está cadastrada.', 409);
    if (tipo === 'motoristas' && item.codUsu !== null && ativos.some((motorista) => motorista.codUsu === item.codUsu)) throw erro('Este usuário já está vinculado a um motorista.', 409);
    cadastros[tipo].push(item);
    salvar(cadastros);
    return item;
  }
  function resolverSaida(dados) {
    const cadastros = listar();
    const resultado = { ...dados, distanciaIda: null, carroId: null, motoristaId: null, rotaId: null, codUsuMotorista: null, nomeUsuarioMotorista: null, nomeRota: null };
    for (const [campo, tipo] of [['carroId', 'carros'], ['motoristaId', 'motoristas'], ['rotaId', 'rotas']]) {
      if (!dados[campo]) continue;
      const item = cadastros[tipo].find((cadastro) => cadastro.id === dados[campo]);
      if (!item) throw erro('Cadastro selecionado não encontrado. Atualize a tela.');
      resultado[campo] = item.id;
      if (tipo === 'carros') {
        Object.assign(resultado, { placa: item.placa, veiculo: item.veiculo, empresa: item.empresa });
      }
      if (tipo === 'motoristas') Object.assign(resultado, { motorista: item.nome, codUsuMotorista: item.codUsu, nomeUsuarioMotorista: item.nomeUsuario });
      if (tipo === 'rotas') {
        if (!Number.isFinite(item.distanciaIda) || item.distanciaIda <= 0) throw erro('Este destino ainda não possui distância cadastrada. Cadastre novamente com a distância em km.');
        Object.assign(resultado, { origem: 'Norte Sul Sementes MT (Empresa 1)', destino: item.destino, nomeRota: item.nome, distanciaIda: item.distanciaIda });
      }
    }
    if (!resultado.carroId || !resultado.motoristaId) throw erro('Selecione um carro e um motorista cadastrados.');
    if (!resultado.rotaId) throw erro('Selecione um destino cadastrado com distância em km.');
    return resultado;
  }
  function remover(tipo, id, usuario) {
    if (!tipos.includes(tipo)) throw erro('Tipo de cadastro inválido.');
    const cadastros = carregar();
    const item = cadastros[tipo].find((registro) => registro.id === id && !registro.excluidoEm);
    if (!item) throw erro('Cadastro não encontrado.', 404);
    // Retira das próximas seleções, sem apagar os dados usados pelas viagens anteriores.
    item.excluidoEm = new Date().toISOString();
    item.excluidoPor = { codUsu: usuario?.codUsu ?? null, nome: usuario?.nome ?? '' };
    salvar(cadastros);
    return { id: item.id };
  }
  return { listar, adicionar, consultarUsuarios, resolverSaida, remover };
}
module.exports = { criarDiarioBordoCadastros };
