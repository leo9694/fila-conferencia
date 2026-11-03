const moeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v) => Number(v || 0).toLocaleString('pt-BR');
const data = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : (v || '—');
const camposNota = {
  nota: (n) => n.NUMNOTA || '—',
  data: (n) => data(n.DATA_PEDIDO),
  cliente: (n) => `${n.CODPARC || '—'} - ${n.CLIENTE || 'Cliente sem nome'}`,
  destino: (n) => n.CIDADE || '—',
  transportadora: (n) => n.TRANSPORTADORA || '—',
  venda: (n) => moeda(n.VLRNOTA),
  peso: (n) => numero(n.PESO),
  volumes: (n) => numero(n.QTDVOL)
};
const simuladas = new Set(['regiao', 'sugerido', 'diferenca']);
const colunas = new Set([...Object.keys(camposNota), ...simuladas, 'cte', 'real']);
const numericas = new Set(['venda', 'peso', 'volumes', 'sugerido', 'real', 'diferenca']);

function lerColunas(query) {
  const filtros = Object.entries(query.filtrosColunas ?? {});
  const ordem = query.ordemColuna;
  const opcoes = query.opcoesColuna;
  if (filtros.some(([coluna, valores]) => !colunas.has(coluna) || !Array.isArray(valores) ||
    valores.some((valor) => typeof valor !== 'string')) ||
    (ordem && (!colunas.has(ordem.coluna) || !['asc', 'desc'].includes(ordem.direcao))) ||
    (opcoes && !colunas.has(opcoes))) {
    throw new Error('Filtro ou ordenação de coluna inválida.');
  }
  return { filtros: filtros.map(([coluna, valores]) => [coluna, new Set(valores)]), ordem, opcoes };
}

function valoresColuna(grupo, coluna, consolidar) {
  if (Object.hasOwn(camposNota, coluna)) return grupo.notas.map(camposNota[coluna]).map(String);
  if (coluna === 'cte') return [grupo.cte ? String(grupo.cte.NUM_CTE || '—') : 'Sem CT-e emitido vinculado'];
  if (coluna === 'real') return [moeda(grupo.cte?.FRETE_CTE_TOTAL)];
  const nota = consolidar(grupo);
  if (coluna === 'diferenca' && nota.grupoIncompleto) return ['CT-e com notas fora do período'];
  if (!nota.simulacoes.length) return ['—'];
  return nota.simulacoes.map((s) => {
    if (coluna === 'regiao') return s.regiao || 'Rota direta';
    if (coluna === 'sugerido') return s.erro ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(s.valor);
    return moeda(s.diferenca);
  });
}

function compararColuna(coluna, a, b) {
  if (numericas.has(coluna)) {
    const converter = (v) => Number(v.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    return converter(a) - converter(b);
  }
  if (coluna === 'data') {
    const iso = (v) => v.split('/').reverse().join('-');
    return iso(a).localeCompare(iso(b));
  }
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

module.exports = { lerColunas, valoresColuna, compararColuna, simuladas };
