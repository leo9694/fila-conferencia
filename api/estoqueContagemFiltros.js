function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function inteiroNaoNegativoOuNulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

function textoSql(valor) {
  return String(valor ?? '').replace(/'/g, "''");
}

function opcao(valor, permitidos, padrao) {
  const normalizado = String(valor || '').trim().toUpperCase();
  return permitidos.includes(normalizado) ? normalizado : padrao;
}

function inteirosPositivosUnicos(valor) {
  const entradas = Array.isArray(valor) ? valor : [valor];
  return [...new Set(entradas.map(inteiroPositivo).filter(Boolean))].slice(0, 100);
}

function normalizarFiltrosCopiaEstoque(payload = {}) {
  let produtoInicial = inteiroPositivo(payload.produtoInicial);
  let produtoFinal = inteiroPositivo(payload.produtoFinal);
  if (produtoInicial && produtoFinal && produtoInicial > produtoFinal) {
    [produtoInicial, produtoFinal] = [produtoFinal, produtoInicial];
  }

  const grupos = inteirosPositivosUnicos(
    Array.isArray(payload.grupos) && payload.grupos.length ? payload.grupos : payload.grupo
  );

  return {
    empresa: inteiroPositivo(payload.empresa),
    local: inteiroNaoNegativoOuNulo(payload.local),
    grupo: grupos[0] || null,
    grupos,
    incluirSubgrupos: payload.incluirSubgrupos !== false,
    marca: String(payload.marca || '').trim().slice(0, 100) || null,
    produtoInicial,
    produtoFinal,
    situacao: opcao(payload.situacao, ['ATIVOS', 'INATIVOS', 'TODOS'], 'ATIVOS'),
    controle: opcao(payload.controle, ['TODOS', 'COM_CONTROLE', 'SEM_CONTROLE'], 'TODOS'),
    saldo: opcao(payload.saldo, ['POSITIVO', 'NEGATIVO', 'NAO_ZERO'], 'POSITIVO')
  };
}

function montarSqlFiltrosCopiaEstoque(filtros, aliases = {}) {
  const est = aliases.estoque || 'EST';
  const pro = aliases.produto || 'PRO';
  const condicoes = [
    `${est}.CODEMP = ${filtros.empresa}`,
    `NVL(${est}.ATIVO, 'S') = 'S'`,
    `NVL(${est}.TIPO, 'P') = 'P'`,
    `NVL(${est}.CODPARC, 0) = 0`
  ];

  if (filtros.local !== null) condicoes.push(`${est}.CODLOCAL = ${filtros.local}`);
  const grupos = inteirosPositivosUnicos(
    Array.isArray(filtros.grupos) && filtros.grupos.length ? filtros.grupos : filtros.grupo
  );
  if (grupos.length) {
    const listaGrupos = grupos.join(', ');
    condicoes.push(filtros.incluirSubgrupos
      ? `${pro}.CODGRUPOPROD IN (
          SELECT GRU.CODGRUPOPROD
          FROM TGFGRU GRU
          START WITH GRU.CODGRUPOPROD IN (${listaGrupos})
          CONNECT BY PRIOR GRU.CODGRUPOPROD = GRU.CODGRUPAI
        )`
      : `${pro}.CODGRUPOPROD IN (${listaGrupos})`);
  }
  if (filtros.marca) {
    condicoes.push(`UPPER(TRIM(${pro}.MARCA)) = UPPER('${textoSql(filtros.marca)}')`);
  }
  if (filtros.produtoInicial) condicoes.push(`${pro}.CODPROD >= ${filtros.produtoInicial}`);
  if (filtros.produtoFinal) condicoes.push(`${pro}.CODPROD <= ${filtros.produtoFinal}`);
  if (filtros.situacao === 'ATIVOS') condicoes.push(`NVL(${pro}.ATIVO, 'S') = 'S'`);
  if (filtros.situacao === 'INATIVOS') condicoes.push(`NVL(${pro}.ATIVO, 'S') <> 'S'`);
  if (filtros.controle === 'COM_CONTROLE') {
    condicoes.push(`TRIM(${est}.CONTROLE) IS NOT NULL`);
  }
  if (filtros.controle === 'SEM_CONTROLE') {
    condicoes.push(`TRIM(${est}.CONTROLE) IS NULL`);
  }
  if (filtros.saldo === 'POSITIVO') condicoes.push(`NVL(${est}.ESTOQUE, 0) > 0.000001`);
  if (filtros.saldo === 'NEGATIVO') condicoes.push(`NVL(${est}.ESTOQUE, 0) < -0.000001`);
  if (filtros.saldo === 'NAO_ZERO') condicoes.push(`ABS(NVL(${est}.ESTOQUE, 0)) > 0.000001`);

  return condicoes.join('\n        AND ');
}

module.exports = {
  montarSqlFiltrosCopiaEstoque,
  normalizarFiltrosCopiaEstoque
};
