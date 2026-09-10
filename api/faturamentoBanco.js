const EMPRESA_MS = 8;
const CONTA_ITAU_MS = 71;
const BANCO_ITAU = 341;
const CONTA_SICREDI = 82;
const BANCO_SICREDI = 748;
const TIPOS_TITULO_BOLETO = new Set([4, 19]);

function numeroInteiro(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : null;
}

function tituloElegivelParaCorrecao(titulo) {
  return TIPOS_TITULO_BOLETO.has(numeroInteiro(titulo.CODTIPTIT))
    && numeroInteiro(titulo.RECDESP) === 1
    && !titulo.DHBAIXA;
}

async function garantirContaFaturamento({ nunota, executeQuery, atualizarRegistro }) {
  const numeroNota = numeroInteiro(nunota);
  if (!numeroNota) {
    throw new TypeError('NUNOTA inválido para validar a conta bancária do faturamento.');
  }

  const [cabecalho] = await executeQuery(`
    SELECT CAB.NUNOTA, CAB.CODEMP, CAB.AD_BANCO, CTA.CODBCO AS BANCO_SELECIONADO,
           DEST.CODBCO AS BANCO_CONTA_SICREDI
    FROM TGFCAB CAB
    LEFT JOIN TSICTA CTA ON CTA.CODCTABCOINT = CAB.AD_BANCO
    LEFT JOIN TSICTA DEST ON DEST.CODCTABCOINT = ${CONTA_SICREDI}
    WHERE CAB.NUNOTA = ${numeroNota}
  `);

  const sicredi = numeroInteiro(cabecalho?.BANCO_SELECIONADO) === BANCO_SICREDI
    || numeroInteiro(cabecalho?.AD_BANCO) === CONTA_SICREDI;
  const itau = numeroInteiro(cabecalho?.CODEMP) === EMPRESA_MS
    && numeroInteiro(cabecalho?.AD_BANCO) === CONTA_ITAU_MS;
  if (!sicredi && !itau) {
    return { aplicavel: false, corrigidos: 0 };
  }
  if (sicredi && numeroInteiro(cabecalho?.BANCO_CONTA_SICREDI) !== BANCO_SICREDI) {
    throw new Error('A conta 82 não está cadastrada como Sicredi no Sankhya. Revise a conta antes de faturar.');
  }
  const contaDestino = sicredi ? CONTA_SICREDI : CONTA_ITAU_MS;
  const bancoDestino = sicredi ? BANCO_SICREDI : BANCO_ITAU;

  const titulos = await executeQuery(`
    SELECT NUFIN, CODCTABCOINT, CODBCO, CODTIPTIT, RECDESP, DHBAIXA
    FROM TGFFIN
    WHERE NUNOTA = ${numeroNota}
    ORDER BY NUFIN
  `);
  const divergentes = titulos.filter((titulo) => (
    tituloElegivelParaCorrecao(titulo)
    && (
      numeroInteiro(titulo.CODCTABCOINT) !== contaDestino
      || numeroInteiro(titulo.CODBCO) !== bancoDestino
    )
  ));

  for (const titulo of divergentes) {
    await atualizarRegistro(
      'Financeiro',
      { NUFIN: numeroInteiro(titulo.NUFIN) },
      { CODCTABCOINT: contaDestino, CODBCO: bancoDestino }
    );
  }

  const confirmacao = await executeQuery(`
    SELECT NUFIN, CODCTABCOINT, CODBCO, CODTIPTIT, RECDESP, DHBAIXA
    FROM TGFFIN
    WHERE NUNOTA = ${numeroNota}
    ORDER BY NUFIN
  `);
  const aindaDivergentes = confirmacao.filter((titulo) => (
    tituloElegivelParaCorrecao(titulo)
    && (
      numeroInteiro(titulo.CODCTABCOINT) !== contaDestino
      || numeroInteiro(titulo.CODBCO) !== bancoDestino
    )
  ));

  if (aindaDivergentes.length > 0) {
    const erro = new Error(`O faturamento não confirmou a conta ${contaDestino} (${sicredi ? 'Sicredi' : 'Itaú'}) nos títulos financeiros.`);
    erro.codigo = 'CONTA_BANCARIA_FATURAMENTO_DIVERGENTE';
    erro.nufins = aindaDivergentes.map((titulo) => numeroInteiro(titulo.NUFIN));
    throw erro;
  }

  return { aplicavel: true, corrigidos: divergentes.length, ...(sicredi ? { relatorioBoleto: 12 } : {}) };
}

module.exports = {
  garantirContaFaturamento,
  garantirContaItauEmpresa8: garantirContaFaturamento,
  tituloElegivelParaCorrecao
};
