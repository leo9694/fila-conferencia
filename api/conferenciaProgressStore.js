const fs = require('node:fs');
const path = require('node:path');

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function carregarEstado(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Falha ao carregar progresso de conferencia:', error);
    return {};
  }
}

function criarConferenciaProgressStore(options = {}) {
  const filePath = options.filePath || path.join(process.cwd(), 'data', 'conferencia-progress-state.json');
  const diretorio = path.dirname(filePath);

  fs.mkdirSync(diretorio, { recursive: true });

  const state = carregarEstado(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function obter(nunota) {
    return state[String(nunota)] || null;
  }

  function normalizarItens(itens) {
    return (Array.isArray(itens) ? itens : []).map((item) => ({
      sequencia: Number(item.sequencia),
      qtdConferida: normalizarNumero(item.qtdConferida),
      qtdCortada: normalizarNumero(item.qtdCortada),
      leituras: Array.isArray(item.leituras) ? item.leituras.map((leitura) => {
        const dtValidade = String(leitura.dtValidade ?? '').trim();
        const dtFabricacao = String(leitura.dtFabricacao ?? '').trim();
        const caixaId = normalizarNumero(leitura.caixaId);
        return {
          codigo: String(leitura.codigo || '').trim(),
          tipo: String(leitura.tipo || 'CODIGO_BARRAS').trim(),
          codVol: String(leitura.codVol || '').trim(),
          controle: String(leitura.controle ?? '').trim(),
          ...(dtValidade ? { dtValidade } : {}),
          ...(dtFabricacao ? { dtFabricacao } : {}),
          multiplicador: normalizarNumero(leitura.multiplicador) || 1,
          quantidade: normalizarNumero(leitura.quantidade),
          quantidadeConvertida: normalizarNumero(leitura.quantidadeConvertida),
          ...(caixaId > 0 ? { caixaId } : {}),
          ...(caixaId > 0 ? { caixaFechada: leitura.caixaFechada === true } : {})
        };
      }).filter((leitura) => leitura.codigo && leitura.quantidade > 0 && leitura.quantidadeConvertida > 0) : []
    })).filter((item) => Number.isInteger(item.sequencia) && item.sequencia > 0);
  }

  function caixasEncerradas(progresso) {
    return new Set((progresso?.itens || []).flatMap((item) => item.leituras || [])
      .filter((leitura) => leitura.caixaFechada === true && normalizarNumero(leitura.caixaId) > 0)
      .map((leitura) => normalizarNumero(leitura.caixaId)));
  }

  function salvar({ nunota, nuconf, codUsu, itens }) {
    const chave = String(nunota);
    const caixasJaEncerradas = caixasEncerradas(state[chave]);
    const itensNormalizados = normalizarItens(itens).map((item) => ({
      ...item,
      // Uma sincronizacao atrasada de outro dispositivo nunca pode reabrir uma caixa ja impressa/zerada.
      leituras: item.leituras.map((leitura) => ({
        ...leitura,
        ...(caixasJaEncerradas.has(normalizarNumero(leitura.caixaId)) ? { caixaFechada: true } : {})
      }))
    }));

    state[chave] = {
      nunota: Number(nunota),
      nuconf: nuconf ? Number(nuconf) : null,
      codUsu: codUsu === null || codUsu === undefined ? null : Number(codUsu),
      atualizadoEm: new Date().toISOString(),
      itens: itensNormalizados
    };
    persistir();
    return state[chave];
  }

  function resumoCaixas(nunota) {
    const progresso = obter(nunota);
    if (!progresso) return null;

    const caixas = new Map();
    (progresso.itens || []).forEach((item) => {
      (item.leituras || []).forEach((leitura) => {
        const caixaId = normalizarNumero(leitura.caixaId);
        if (caixaId <= 0) return;
        const caixa = caixas.get(caixaId) || { caixaId, fechada: true, leituras: 0 };
        caixa.fechada = caixa.fechada && leitura.caixaFechada === true;
        caixa.leituras += 1;
        caixas.set(caixaId, caixa);
      });
    });

    return {
      nunota: progresso.nunota,
      atualizadoEm: progresso.atualizadoEm,
      maiorCaixaId: Math.max(0, ...caixas.keys()),
      caixas: [...caixas.values()].sort((a, b) => a.caixaId - b.caixaId)
    };
  }

  function encerrarCaixa({ nunota, caixaId }) {
    const progresso = obter(nunota);
    const numeroCaixa = normalizarNumero(caixaId);
    if (!progresso || numeroCaixa <= 0) return { encontrado: false, alterado: false, progresso: null };

    let encontrouLeitura = false;
    let alterado = false;
    (progresso.itens || []).forEach((item) => {
      (item.leituras || []).forEach((leitura) => {
        if (normalizarNumero(leitura.caixaId) !== numeroCaixa) return;
        encontrouLeitura = true;
        if (leitura.caixaFechada !== true) {
          leitura.caixaFechada = true;
          alterado = true;
        }
      });
    });

    if (alterado) {
      progresso.atualizadoEm = new Date().toISOString();
      persistir();
    }

    return { encontrado: encontrouLeitura, alterado, progresso };
  }

  function remover(nunota) {
    const chave = String(nunota);
    if (!state[chave]) {
      return false;
    }

    delete state[chave];
    persistir();
    return true;
  }

  return {
    filePath,
    state,
    obter,
    salvar,
    resumoCaixas,
    encerrarCaixa,
    remover
  };
}

module.exports = {
  criarConferenciaProgressStore
};
