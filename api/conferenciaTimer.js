function normalizarStatus(status) {
  return String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function calcularMinutos(inicio, fim) {
  const diffMs = fim.getTime() - inicio.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function atualizarTempoConferencia(memoria, item, agora = new Date()) {
  const nunota = item.NUNOTA;
  const status = normalizarStatus(item.STATUS_CONFERENCIA);
  const registroAtual = memoria[nunota];

  if (status === 'EM ANDAMENTO' || status === 'EM CONFERENCIA') {
    const iniciadoEm = registroAtual?.iniciadoEm || agora;
    const mudou =
      !registroAtual ||
      registroAtual.status !== status ||
      registroAtual.concluidoEm !== null ||
      registroAtual.tempoTotalMinutos !== null;

    if (mudou) {
      memoria[nunota] = {
        iniciadoEm,
        concluidoEm: null,
        tempoTotalMinutos: null,
        status
      };
    }

    return {
      iniciadoEm,
      tempoTotalMinutos: null,
      concluidoEm: null,
      changed: mudou
    };
  }

  if (status === 'CONFERIDO') {
    if (registroAtual?.iniciadoEm) {
      const concluidoEm = registroAtual.concluidoEm || agora;
      const tempoTotalMinutos = registroAtual.tempoTotalMinutos ?? calcularMinutos(registroAtual.iniciadoEm, concluidoEm);
      const mudou =
        registroAtual.status !== status ||
        registroAtual.concluidoEm === null ||
        registroAtual.tempoTotalMinutos === null;

      if (mudou) {
        memoria[nunota] = {
          iniciadoEm: registroAtual.iniciadoEm,
          concluidoEm,
          tempoTotalMinutos,
          status
        };
      }

      return {
        iniciadoEm: registroAtual.iniciadoEm,
        tempoTotalMinutos,
        concluidoEm,
        changed: mudou
      };
    }

    return {
      iniciadoEm: null,
      tempoTotalMinutos: registroAtual?.tempoTotalMinutos ?? null,
      concluidoEm: registroAtual?.concluidoEm ?? null,
      changed: false
    };
  }

  const mudou = Boolean(registroAtual);
  delete memoria[nunota];

  return {
    iniciadoEm: null,
    tempoTotalMinutos: null,
    concluidoEm: null,
    changed: mudou
  };
}

module.exports = {
  atualizarTempoConferencia,
  calcularMinutos,
  normalizarStatus
};
