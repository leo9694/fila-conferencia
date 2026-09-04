const EMPRESA_MS = 8;
const CONTA_ITAU_MS = 71;
const BANCO_ITAU = 341;
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

async function garantirContaItauEmpresa8({ nunota, executeQuery, atualizarRegistro }) {
  const numeroNota = numeroInteiro(nunota);
  if (!numeroNota) {
    throw new TypeError('NUNOTA inválido para validar a conta bancária do faturamento.');
  }

  const [cabecalho] = await executeQuery(`
    SELECT NUNOTA, CODEMP, AD_BANCO
    FROM TGFCAB
    WHERE NUNOTA = ${numeroNota}
  `);

  if (
    numeroInteiro(cabecalho?.CODEMP) !== EMPRESA_MS
    || numeroInteiro(cabecalho?.AD_BANCO) !== CONTA_ITAU_MS
  ) {
    return { aplicavel: false, corrigidos: 0 };
  }

  const titulos = await executeQuery(`
    SELECT NUFIN, CODCTABCOINT, CODBCO, CODTIPTIT, RECDESP, DHBAIXA
    FROM TGFFIN
    WHERE NUNOTA = ${numeroNota}
    ORDER BY NUFIN
  `);
  const divergentes = titulos.filter((titulo) => (
    tituloElegivelParaCorrecao(titulo)
    && (
      numeroInteiro(titulo.CODCTABCOINT) !== CONTA_ITAU_MS
      || numeroInteiro(titulo.CODBCO) !== BANCO_ITAU
    )
  ));

  for (const titulo of divergentes) {
    await atualizarRegistro(
      'Financeiro',
      { NUFIN: numeroInteiro(titulo.NUFIN) },
      { CODCTABCOINT: CONTA_ITAU_MS, CODBCO: BANCO_ITAU }
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
      numeroInteiro(titulo.CODCTABCOINT) !== CONTA_ITAU_MS
      || numeroInteiro(titulo.CODBCO) !== BANCO_ITAU
    )
  ));

  if (aindaDivergentes.length > 0) {
    const erro = new Error('O faturamento da empresa 8 não confirmou a conta Itaú nos títulos financeiros.');
    erro.codigo = 'CONTA_BANCARIA_FATURAMENTO_DIVERGENTE';
    erro.nufins = aindaDivergentes.map((titulo) => numeroInteiro(titulo.NUFIN));
    throw erro;
  }

  return { aplicavel: true, corrigidos: divergentes.length };
}

module.exports = {
  garantirContaItauEmpresa8,
  tituloElegivelParaCorrecao
};
