const fs = require('node:fs');
const path = require('node:path');
const { atualizarTempoConferencia } = require('./conferenciaTimer');

function reviverRegistro(registro) {
  return {
    iniciadoEm: registro.iniciadoEm ? new Date(registro.iniciadoEm) : null,
    concluidoEm: registro.concluidoEm ? new Date(registro.concluidoEm) : null,
    tempoTotalMinutos: registro.tempoTotalMinutos ?? null,
    status: registro.status || null
  };
}

function serializarEstado(state) {
  return Object.fromEntries(
    Object.entries(state).map(([nunota, registro]) => [
      nunota,
      {
        iniciadoEm: registro.iniciadoEm ? registro.iniciadoEm.toISOString() : null,
        concluidoEm: registro.concluidoEm ? registro.concluidoEm.toISOString() : null,
        tempoTotalMinutos: registro.tempoTotalMinutos ?? null,
        status: registro.status || null
      }
    ])
  );
}

function carregarEstado(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const conteudo = fs.readFileSync(filePath, 'utf8');
    const bruto = JSON.parse(conteudo);
    return Object.fromEntries(
      Object.entries(bruto).map(([nunota, registro]) => [nunota, reviverRegistro(registro)])
    );
  } catch (error) {
    console.error('Falha ao carregar estado do timer de conferencia:', error);
    return {};
  }
}

function criarConferenciaTimerStore(options = {}) {
  const filePath = options.filePath || path.join(process.cwd(), 'data', 'conferencia-timer-state.json');
  const diretorio = path.dirname(filePath);

  fs.mkdirSync(diretorio, { recursive: true });

  const state = carregarEstado(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(serializarEstado(state), null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function atualizarComItens(itens, agora = new Date()) {
    let houveMudanca = false;
    const resultado = itens.map((item) => {
      const tempo = atualizarTempoConferencia(state, item, agora);
      if (tempo.changed) {
        houveMudanca = true;
      }

      return {
        ...item,
        DT_INICIO_CONFERENCIA: tempo.iniciadoEm || null,
        DT_FIM_CONFERENCIA: tempo.concluidoEm || null,
        TEMPO_TOTAL_CONFERENCIA_MIN: tempo.tempoTotalMinutos
      };
    });

    if (houveMudanca) {
      persistir();
    }

    return resultado;
  }

  return {
    filePath,
    state,
    persistir,
    atualizarComItens
  };
}

module.exports = {
  carregarEstado,
  criarConferenciaTimerStore,
  serializarEstado
};
