function numeroUsuario(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

function textoSql(valor) {
  return String(valor ?? '').replace(/'/g, "''");
}

function criarAutorizacaoGrupos({ executeQuery, cacheTtlMs = 5 * 60 * 1000 } = {}) {
  if (typeof executeQuery !== 'function') {
    throw new TypeError('executeQuery e obrigatorio para validar grupos Sankhya.');
  }

  const cache = new Map();

  async function consultarGrupos(codUsu) {
    const codigo = numeroUsuario(codUsu);
    if (codigo === null) return [];

    const agora = Date.now();
    const armazenado = cache.get(codigo);
    if (armazenado && armazenado.expiraEm > agora) return armazenado.grupos;

    const rows = await executeQuery(`
      SELECT DISTINCT TRIM(GRU.NOMEGRUPO) AS NOMEGRUPO
      FROM TSIUSU USU
      INNER JOIN TSIGRU GRU ON GRU.CODGRUPO = USU.CODGRUPO
      WHERE USU.CODUSU = ${codigo}
        AND GRU.NOMEGRUPO IS NOT NULL
    `);
    const grupos = rows
      .map((row) => String(row.NOMEGRUPO || '').trim())
      .filter(Boolean);
    cache.set(codigo, { grupos, expiraEm: agora + cacheTtlMs });
    return grupos;
  }

  async function pertenceAoGrupo(codUsu, nomeGrupo) {
    const esperado = String(nomeGrupo || '').trim().toLocaleUpperCase('pt-BR');
    if (!esperado) return false;
    const grupos = await consultarGrupos(codUsu);
    return grupos.some((grupo) => grupo.toLocaleUpperCase('pt-BR') === esperado);
  }

  function exigirGrupo(nomeGrupo) {
    const nomeSeguro = String(nomeGrupo || '').trim();
    return async (req, res, next) => {
      try {
        if (!await pertenceAoGrupo(req.usuario?.codUsu, nomeSeguro)) {
          res.status(403).json({ erro: 'Acesso restrito ao grupo Diretoria.' });
          return;
        }
        next();
      } catch (error) {
        console.error(`Falha ao validar o grupo Sankhya ${textoSql(nomeSeguro)}:`, error.message);
        res.status(503).json({ erro: 'Nao foi possivel validar a permissao do usuario.' });
      }
    };
  }

  return {
    cache,
    consultarGrupos,
    pertenceAoGrupo,
    exigirGrupo
  };
}

module.exports = { criarAutorizacaoGrupos, numeroUsuario };
