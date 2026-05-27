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

function normalizarData(valor) {
  if (!valor) {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function datasDiferentes(a, b) {
  const dataA = normalizarData(a);
  const dataB = normalizarData(b);

  if (!dataA && !dataB) {
    return false;
  }

  if (!dataA || !dataB) {
    return true;
  }

  return dataA.getTime() !== dataB.getTime();
}

function atualizarTempoConferencia(memoria, item, agora = new Date()) {
  const nunota = item.NUNOTA;
  const status = normalizarStatus(item.STATUS_CONFERENCIA);
  const registroAtual = memoria[nunota];
  const inicioSankhya = normalizarData(item.DT_INICIO_CONFERENCIA);
  const fimSankhya = normalizarData(item.DT_FIM_CONFERENCIA);

  if (status === 'EM ANDAMENTO' || status === 'EM CONFERENCIA') {
    const iniciadoEm = inicioSankhya || registroAtual?.iniciadoEm || agora;
    const mudou =
      !registroAtual ||
      registroAtual.status !== status ||
      registroAtual.concluidoEm !== null ||
      registroAtual.tempoTotalMinutos !== null ||
      datasDiferentes(registroAtual.iniciadoEm, iniciadoEm);

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
    const iniciadoEm = inicioSankhya || registroAtual?.iniciadoEm || null;

    if (iniciadoEm) {
      const concluidoEm = fimSankhya || registroAtual?.concluidoEm || agora;
      const tempoTotalMinutos = calcularMinutos(iniciadoEm, concluidoEm);
      const mudou =
        !registroAtual ||
        registroAtual.status !== status ||
        registroAtual.tempoTotalMinutos !== tempoTotalMinutos ||
        datasDiferentes(registroAtual.iniciadoEm, iniciadoEm) ||
        datasDiferentes(registroAtual.concluidoEm, concluidoEm);

      if (mudou) {
        memoria[nunota] = {
          iniciadoEm,
          concluidoEm,
          tempoTotalMinutos,
          status
        };
      }

      return {
        iniciadoEm,
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
