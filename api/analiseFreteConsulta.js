const { randomUUID } = require('node:crypto');
const caches = new WeakMap();
const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function sqlBase(f, offset) {
  return `WITH NOTAS AS (
    SELECT CAB.NUNOTA,CAB.NUMNOTA,CAB.CODTIPOPER,CAB.CODEMP,
      NVL(EMP.NOMEFANTASIA,EMP.RAZAOSOCIAL) NOMEEMP,
      TO_CHAR(CAB.DTNEG,'YYYY-MM-DD') DATA_PEDIDO,
      CAB.CODPARC,PAR.NOMEPARC CLIENTE,CID.NOMECID CIDADE,
      CAB.CODPARCTRANSP,TRA.NOMEPARC TRANSPORTADORA,CAB.CIF_FOB,
      CAB.VLRNOTA,CAB.VLRFRETE,CAB.PESOBRUTO PESO,CAB.M3,CAB.QTDVOL,NFE.CHAVENFE
    FROM TGFCAB CAB
    LEFT JOIN TGFPAR PAR ON PAR.CODPARC=CAB.CODPARC
    LEFT JOIN TSICID CID ON CID.CODCID=PAR.CODCID
    LEFT JOIN TGFPAR TRA ON TRA.CODPARC=CAB.CODPARCTRANSP
    LEFT JOIN TSIEMP EMP ON EMP.CODEMP=CAB.CODEMP
    LEFT JOIN TGFNFE NFE ON NFE.NUNOTA=CAB.NUNOTA
    WHERE CAB.CODTIPOPER IN (35,10) AND CAB.TIPMOV='V' AND CAB.STATUSNOTA='L'
      AND CAB.DTNEG>=TO_DATE('${f.inicio}','YYYY-MM-DD')
      AND CAB.DTNEG<TO_DATE('${f.fim}','YYYY-MM-DD')+1
  ), ARQUIVOS AS (
    SELECT IX.CHAVEACESSO,IX.NUMNOTA NUM_CTE,IX.XNOMEEMIT TRANSPORTADORA_CTE,
      IX.VLRNOTA FRETE_CTE_TOTAL,IX.STATUS STATUS_IMPORTACAO,IX.DOCSREF,
      ROW_NUMBER() OVER(PARTITION BY IX.CHAVEACESSO ORDER BY IX.NUARQUIVO DESC) RN
    FROM TGFIXN IX WHERE IX.TIPO='C' AND IX.CHAVEACESSO IS NOT NULL AND IX.DOCSREF IS NOT NULL
  ), REFERENCIAS AS (
    SELECT /*+ MATERIALIZE */ DISTINCT A.CHAVEACESSO,A.NUM_CTE,A.TRANSPORTADORA_CTE,
      A.FRETE_CTE_TOTAL,A.STATUS_IMPORTACAO,X.CHAVE,
      COUNT(*) OVER(PARTITION BY A.CHAVEACESSO) REFERENCIAS_TOTAL
    FROM ARQUIVOS A, XMLTABLE('/docsRef/chaveAcesso' PASSING XMLTYPE(A.DOCSREF)
      COLUMNS CHAVE VARCHAR2(44) PATH '.') X WHERE A.RN=1
  )
  SELECT N.*,R.CHAVEACESSO,R.NUM_CTE,R.TRANSPORTADORA_CTE,R.FRETE_CTE_TOTAL,
    R.STATUS_IMPORTACAO,R.REFERENCIAS_TOTAL
  FROM NOTAS N LEFT JOIN REFERENCIAS R ON R.CHAVE=N.CHAVENFE
  ORDER BY N.NUNOTA DESC,R.CHAVEACESSO
  OFFSET ${offset} ROWS FETCH NEXT 1000 ROWS ONLY`;
}

function agrupar(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const chave = r.CHAVEACESSO || `nota:${r.NUNOTA}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, cte: r.CHAVEACESSO ? r : null, notas: new Map() });
    grupos.get(chave).notas.set(Number(r.NUNOTA), r);
  }
  return [...grupos.values()].map((g) => ({ ...g, notas: [...g.notas.values()] }));
}

function filtrar(grupos, f) {
  const termo = normalizar(f.busca).trim();
  return grupos.filter((g) => {
    if (f.transportadoras.length && !g.notas.some((n) => f.transportadoras.includes(Number(n.CODPARCTRANSP)))) return false;
    if (f.cteEmitido === 'com' && !g.cte || f.cteEmitido === 'sem' && g.cte) return false;
    if (f.statusCte === 'importado' && (!g.cte || Number(g.cte.STATUS_IMPORTACAO) !== 2)) return false;
    if (f.statusCte === 'pendente' && (!g.cte || Number(g.cte.STATUS_IMPORTACAO) === 2)) return false;
    return !termo || g.notas.some((n) => [n.CODPARC,n.CLIENTE,n.CIDADE,n.NUMNOTA,n.NUNOTA,g.cte?.NUM_CTE]
      .some((v) => normalizar(v).includes(termo)));
  });
}

function simularCargaConsolidada(notas, simulacoes, simularTabelas) {
  if (notas.length === 1) return simularTabelas(simulacoes.get(Number(notas[0].NUNOTA)) || []);
  const registrosPorNota = notas.map((nota) => simulacoes.get(Number(nota.NUNOTA)) || []);
  const tabelasComuns = [...new Set(registrosPorNota[0].map((r) => String(r.NUCFR)))]
    .filter((codigo) => registrosPorNota.every((registros) => registros.some((r) => String(r.NUCFR) === codigo)));
  const campoSomado = (campo) => notas.reduce((total, nota, indice) => {
    const valor = nota[campo] ?? registrosPorNota[indice][0]?.[campo];
    return total + Number(valor || 0);
  }, 0);
  const totais = { VLRNOTA: campoSomado('VLRNOTA'), PESO: campoSomado('PESO'), M3: campoSomado('M3') };
  const resultado = [];
  const camposConfiguracao = ['CODEVENTO','FORMULA','VALOR','PERCENTUAL','VLRMIN','DISTANCIA','TEMPO','REGIAO'];
  for (const codigo of tabelasComuns) {
    const rotas = registrosPorNota.map((registros) => registros.filter((r) => String(r.NUCFR) === codigo)
      .sort((a, b) => Number(a.CODEVENTO) - Number(b.CODEVENTO)));
    const assinatura = (lista) => JSON.stringify(lista.map((r) => camposConfiguracao.map((campo) => r[campo] ?? null)));
    if (rotas.some((lista) => assinatura(lista) !== assinatura(rotas[0]))) {
      const base = rotas[0][0];
      resultado.push({ codigo: base.NUCFR, tabela: base.DESCRCALCFRET, regiao: base.REGIAO, valor: null, eventos: [], erro: true });
      continue;
    }
    resultado.push(...simularTabelas(rotas[0].map((r) => ({ ...r, ...totais }))));
  }
  return resultado;
}

function consolidar(g, simulacoes, simularTabelas) {
  const notas = g.notas;
  const notasDetalhes = [...notas].sort((a, b) => Number(b.NUNOTA) - Number(a.NUNOTA));
  const lista = (campo) => [...new Set(notas.map((n) => n[campo]).filter((v) => v != null))].join(' · ');
  const soma = (campo) => notas.reduce((s,n) => s + Number(n[campo] || 0),0);
  const c = g.cte;
  // Não comparar o custo integral de um CT-e com apenas parte das notas selecionadas pelo período.
  const incompleto = c && new Set(notas.map((n) => n.CHAVENFE)).size < Number(c.REFERENCIAS_TOTAL);
  const real = c?.FRETE_CTE_TOTAL == null ? null : Number(c.FRETE_CTE_TOTAL);
  const sugestoes = simularCargaConsolidada(notas, simulacoes, simularTabelas).map((s) => ({ ...s,
    diferenca: !incompleto && real != null && s.valor != null ? Math.round((real-s.valor)*100)/100 : null }));
  return { ...notas[0], agrupadoCte: notas.length > 1,
    NUNOTA: lista('NUNOTA'), NUMNOTA: lista('NUMNOTA'), CODEMP: lista('CODEMP'), NOMEEMP: lista('NOMEEMP'),
    CODPARC: lista('CODPARC'), CLIENTE: lista('CLIENTE'), CIDADE: lista('CIDADE'), CIF_FOB: lista('CIF_FOB'),
    VLRNOTA: soma('VLRNOTA'), VLRFRETE: soma('VLRFRETE'), PESO: soma('PESO'), QTDVOL: soma('QTDVOL'),
    notasDetalhes,
    real, compartilhado: false, grupoIncompleto: Boolean(incompleto),
    ctes: c ? [{ ...c, FRETE_REAL: real }] : [], simulacoes: sugestoes };
}

async function consultar(f, query, executeQuery, sqlSimulacoes, simularTabelas) {
  if (!caches.has(executeQuery)) caches.set(executeQuery, new Map());
  const cache = caches.get(executeQuery);
  const chave = `${f.inicio}:${f.fim}`;
  const agora = Date.now();
  for (const [k,v] of cache) if (agora-v.criado > 600000) cache.delete(k);
  let entrada = cache.get(chave);
  if (query.consultaId && (!entrada || entrada.id !== query.consultaId)) {
    throw new Error('Consulta expirada. Clique em Consultar para atualizar os dados.');
  }
  if (!entrada || (!query.consultaId && agora-entrada.criado > 60000)) {
    entrada = { id: randomUUID(), criado: agora, simulacoes: new Map() };
    entrada.promise = (async () => {
      const registros = [];
      for (let offset = 0; ; offset += 1000) {
        const lote = await executeQuery(sqlBase(f,offset));
        registros.push(...lote);
        if (lote.length < 1000) break;
      }
      return agrupar(registros);
    })();
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(chave,entrada);
  }
  let grupos;
  try { grupos = await entrada.promise; } catch (e) { if (cache.get(chave) === entrada) cache.delete(chave); throw e; }
  const selecionados = filtrar(grupos,f);
  const pagina = Math.min(f.pagina,Math.max(1,Math.ceil(selecionados.length/10)));
  const lote = selecionados.slice((pagina-1)*10,pagina*10);
  const ids = [...new Set(lote.flatMap((g) => g.notas.map((n) => Number(n.NUNOTA))))];
  const faltam = ids.filter((id) => !entrada.simulacoes.has(id));
  for (let i=0; i<faltam.length; i+=500) {
    const bloco = faltam.slice(i,i+500);
    const dados = await executeQuery(sqlSimulacoes(bloco));
    for (const id of bloco) entrada.simulacoes.set(id,dados.filter((r) => Number(r.NUNOTA) === id));
  }
  const transportadoras = [...new Map(grupos.flatMap((g) => g.notas).filter((n) => n.CODPARCTRANSP)
    .map((n) => [n.CODPARCTRANSP,{ CODPARC:n.CODPARCTRANSP,NOMEPARC:n.TRANSPORTADORA }])).values()]
    .sort((a,b) => String(a.NOMEPARC).localeCompare(String(b.NOMEPARC)));
  return { linhas:lote.map((g) => consolidar(g,entrada.simulacoes,simularTabelas)), transportadoras,
    total:selecionados.length,pagina,tamanhoPagina:10,consultaId:entrada.id };
}

module.exports = { consultar, sqlBase, agrupar, filtrar, consolidar };
