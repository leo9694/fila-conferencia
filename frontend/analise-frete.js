(function () {
  const $ = (id) => document.getElementById(`analise-frete-${id}`);
  let pagina = 1;
  let total = 0;
  let consulta = null;
  let filtros = null;
  const moeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v) => Number(v || 0).toLocaleString('pt-BR');
  let consultaId = null;

  function celula(tr, linhas) {
    const td = document.createElement('td');
    for (const texto of linhas) {
      const div = document.createElement('div');
      div.textContent = texto;
      td.appendChild(div);
    }
    tr.appendChild(td);
  }

  function render(linhas) {
    $('linhas').replaceChildren();
    for (const p of linhas) {
      const tr = document.createElement('tr');
      const tipoNota = Number(p.CODTIPOPER) === 10 ? 'Nota de bonificação' : 'Nota de venda';
      celula(tr, [p.agrupadoCte ? `Notas: ${p.NUMNOTA}` : `${tipoNota} ${p.NUMNOTA || '—'}`, `Nº único: ${p.NUNOTA} · ${p.CODEMP} - ${p.NOMEEMP || 'Empresa sem nome'}`, p.DATA_PEDIDO]);
      celula(tr, [`${p.CODPARC || '—'} - ${p.CLIENTE || 'Cliente sem nome'}`, p.CIDADE || '—']);
      celula(tr, [p.TRANSPORTADORA]);
      celula(tr, [p.agrupadoCte ? `Vendas somadas: ${moeda(p.VLRNOTA)}` : `Venda: ${moeda(p.VLRNOTA)}`, p.agrupadoCte ? `Frete nos pedidos: ${moeda(p.VLRFRETE)}` : `Frete no pedido: ${moeda(p.VLRFRETE)}`, `${numero(p.PESO)} kg · ${numero(p.QTDVOL)} volumes`, `CIF/FOB: ${p.CIF_FOB || '—'}`]);
      celula(tr, p.simulacoes.length ? p.simulacoes.map((s) => `${s.codigo ? `${s.codigo} · ` : ''}${s.tabela} · ${s.regiao || 'Rota direta'}: ${s.erro ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(s.valor)}`) : ['Sem tabela/região aplicável à transportadora']);
      celula(tr, p.ctes.length ? [
        ...p.ctes.map((c) => `CT-e ${c.NUM_CTE} · ${c.TRANSPORTADORA_CTE}: ${moeda(c.FRETE_CTE_TOTAL ?? c.FRETE_REAL)}`),
        p.agrupadoCte ? `Total do CT-e: ${moeda(p.real)}` : p.compartilhado ? `Frete rateado por peso: ${moeda(p.real)}` : `Total real: ${moeda(p.real)}`,
        ...p.ctes.map((c) => Number(c.STATUS_IMPORTACAO) === 2 ? 'CT-e importado no Sankhya' : 'CT-e pendente de importação')
      ] : ['Sem CT-e emitido vinculado']);
      celula(tr, p.grupoIncompleto ? ['CT-e com notas fora do período'] : p.simulacoes.length ? p.simulacoes.map((s) => s.diferenca == null ? '—' : moeda(s.diferenca)) : ['—']);
      $('linhas').appendChild(tr);
    }
  }

  async function carregar() {
    consulta?.abort();
    const atual = new AbortController();
    consulta = atual;
    $('status').textContent = 'Consultando notas, tabelas de frete e CT-es…';
    $('linhas').setAttribute('aria-busy', 'true');
    $('anterior').disabled = $('proxima').disabled = true;
    $('pagina').textContent = '';
    try {
      const params = new URLSearchParams({ ...filtros, pagina });
      if (consultaId) params.set('consultaId', consultaId);
      const response = await fetch(`/api/transporte/analise-frete?${params}`, { signal: atual.signal });
      if (!response.ok) throw new Error('Não foi possível consultar. Clique em Consultar para atualizar; confira o período e sua sessão.');
      const dados = await response.json();
      if (consulta !== atual) return;
      total = dados.total;
      pagina = dados.pagina;
      consultaId = dados.consultaId;
      render(dados.linhas);
      const selecionada = $('transportadora').value;
      $('transportadora').replaceChildren(new Option('Todas', '0'),
        ...dados.transportadoras.map((t) => new Option(t.NOMEPARC, t.CODPARC)));
      if ([...$('transportadora').options].some((o) => o.value === selecionada)) $('transportadora').value = selecionada;
      $('status').textContent = total ? `${numero(total)} registros · CT-es agrupados e notas sem CT-e.` : 'Nenhum registro encontrado para os filtros.';
      $('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(total / 10))}`;
      $('anterior').disabled = pagina <= 1;
      $('proxima').disabled = pagina * 10 >= total;
    } catch (erro) {
      if (erro.name !== 'AbortError' && consulta === atual) $('status').textContent = erro.message;
    } finally {
      if (consulta === atual) $('linhas').removeAttribute('aria-busy');
    }
  }

  function consultar() {
    pagina = 1;
    consultaId = null;
    filtros = { dataInicial: $('inicio').value, dataFinal: $('fim').value, transportadora: $('transportadora').value,
      cteEmitido: $('cte-emitido').value, statusCte: $('status-cte').value, busca: $('busca').value.trim() };
    return carregar();
  }
  function atualizarStatusCte() {
    const semCte = $('cte-emitido').value === 'sem';
    $('status-cte').disabled = semCte;
    if (semCte) $('status-cte').value = 'todos';
  }
  $('form').addEventListener('submit', (e) => { e.preventDefault(); consultar(); });
  $('cte-emitido').addEventListener('change', atualizarStatusCte);
  $('anterior').addEventListener('click', () => { if (pagina > 1) { pagina--; carregar(); } });
  $('proxima').addEventListener('click', () => { if (pagina * 10 < total) { pagina++; carregar(); } });
  window.analiseFreteController = {
    preparar() {
      if (!$('inicio').value) {
        const data = new Date();
        const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        $('fim').value = iso(data);
        data.setDate(data.getDate() - 29);
        $('inicio').value = iso(data);
      }
      atualizarStatusCte();
      return consultar();
    },
    limparSessao() {
      consulta?.abort(); consulta = null; filtros = null; pagina = 1; total = 0;
      consultaId = null;
      $('linhas').replaceChildren(); $('form').reset(); $('status').textContent = '';
      $('transportadora').replaceChildren(new Option('Todas', '0'));
    }
  };
}());
