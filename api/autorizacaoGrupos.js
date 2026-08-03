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

  async function pertenceAAlgumGrupo(codUsu, nomesGrupos) {
    const esperados = new Set(
      (Array.isArray(nomesGrupos) ? nomesGrupos : [nomesGrupos])
        .map((nome) => String(nome || '').trim().toLocaleUpperCase('pt-BR'))
        .filter(Boolean)
    );
    if (!esperados.size) return false;
    const grupos = await consultarGrupos(codUsu);
    return grupos.some((grupo) => esperados.has(grupo.toLocaleUpperCase('pt-BR')));
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

  function exigirAlgumGrupo(nomesGrupos) {
    const nomesSeguros = (Array.isArray(nomesGrupos) ? nomesGrupos : [nomesGrupos])
      .map((nome) => String(nome || '').trim())
      .filter(Boolean);
    return async (req, res, next) => {
      try {
        if (!await pertenceAAlgumGrupo(req.usuario?.codUsu, nomesSeguros)) {
          res.status(403).json({ erro: `Acesso restrito aos grupos ${nomesSeguros.join(' ou ')}.` });
          return;
        }
        next();
      } catch (error) {
        console.error(`Falha ao validar os grupos Sankhya ${nomesSeguros.map(textoSql).join(', ')}:`, error.message);
        res.status(503).json({ erro: 'Nao foi possivel validar a permissao do usuario.' });
      }
    };
  }

  return {
    cache,
    consultarGrupos,
    pertenceAoGrupo,
    pertenceAAlgumGrupo,
    exigirGrupo,
    exigirAlgumGrupo
  };
}

module.exports = { criarAutorizacaoGrupos, numeroUsuario };
