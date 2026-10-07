const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function erro(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

function texto(valor, campo, obrigatorio = true) {
  const resultado = String(valor ?? '').trim();
  if ((obrigatorio && !resultado) || resultado.length > 1000) throw erro(`Informe ${campo} válido (até 1000 caracteres).`);
  return resultado;
}

function km(valor) {
  if (!['number', 'string'].includes(typeof valor) || String(valor).trim() === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0 || Number(valor) > 9999999) throw erro('Informe uma quilometragem válida.');
  return Number(valor);
}

function data(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor) || !Number.isFinite(Date.parse(valor))) throw erro('Informe data e hora válidas.');
  if (Date.parse(valor) > Date.now() + 60000) throw erro('A data não pode estar no futuro.');
  return new Date(valor).toISOString();
}

function criarDiarioBordo({ filePath = path.join(process.cwd(), 'data', 'diario-bordo.json') } = {}) {
  // Falhas de leitura nunca são tratadas como um diário vazio, para não perder registros.
  function carregar() {
    if (!fs.existsSync(filePath)) return [];
    const registros = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(registros)) throw new Error('Arquivo do diário de bordo inválido.');
    return registros;
  }
  function salvar(registros) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(registros, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }
  const autor = (usuario) => ({ codUsu: usuario?.codUsu ?? null, nome: usuario?.nome ?? usuario?.nomeUsu ?? '' });
  return {
    listar() { return carregar().sort((a, b) => b.saida.localeCompare(a.saida)); },
    sair(dados, usuario) {
      const registros = carregar();
      const placa = texto(dados.placa, 'a placa').toUpperCase().replace(/[\s-]/g, '');
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) throw erro('Placa inválida. Use ABC1234 ou ABC1D23.');
      if (registros.some((item) => item.placa === placa && !item.retorno)) throw erro('Este veículo já tem uma saída em andamento.', 409);
      const registro = {
        id: randomUUID(), placa, veiculo: texto(dados.veiculo, 'o modelo do veículo'),
        carroId: dados.carroId ?? null, motoristaId: dados.motoristaId ?? null, rotaId: dados.rotaId ?? null,
        codUsuMotorista: dados.codUsuMotorista ?? null, nomeUsuarioMotorista: dados.nomeUsuarioMotorista ?? null, nomeRota: dados.nomeRota ?? null,
        motorista: texto(dados.motorista, 'o motorista'), empresa: texto(dados.empresa, 'a empresa', false),
        origem: 'Norte Sul Sementes MT (Empresa 1)', destino: texto(dados.destino, 'o destino / rota'),
        finalidade: texto(dados.finalidade, 'a finalidade'), observacoes: texto(dados.observacoes, 'as observações', false),
        saida: data(dados.saida), distanciaIda: km(dados.distanciaIda), retorno: null,
        criadoEm: new Date().toISOString(), criadoPor: autor(usuario)
      };
      if (registro.distanciaIda <= 0) throw erro('Informe distância até o destino maior que zero.');
      registro.kmPrevisto = Math.round(registro.distanciaIda * 2 * 1000000) / 1000000;
      const anteriores = registros.filter((item) => item.placa === placa);
      if (anteriores.some((item) => item.retorno > registro.saida)) throw erro('Saída anterior à última devolução deste veículo.');
      registros.push(registro);
      salvar(registros);
      return registro;
    },
    devolver(id, dados, usuario) {
      const registros = carregar();
      const registro = registros.find((item) => item.id === id);
      if (!registro) throw erro('Registro não encontrado.', 404);
      if (registro.retorno) throw erro('Esta saída já foi encerrada.', 409);
      const retorno = data(dados.retorno);
      if (retorno < registro.saida) throw erro('A devolução deve ser posterior à saída.');
      Object.assign(registro, { retorno, observacoesRetorno: texto(dados.observacoesRetorno, 'as observações', false), devolvidoPor: autor(usuario), encerradoEm: new Date().toISOString() });
      salvar(registros);
      return registro;
    }
  };
}

module.exports = { criarDiarioBordo };
