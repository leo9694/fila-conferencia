(function () {
  const $ = (id) => document.getElementById(`analise-frete-${id}`);
  let pagina = 1;
  let total = 0;
  let consulta = null;
  let filtros = null;
  const moeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v) => Number(v || 0).toLocaleString('pt-BR');

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
      celula(tr, [`${p.TIPMOV === 'P' ? 'Pedido' : 'Venda direta'} ${p.NUNOTA}`, `Nota fiscal: ${p.NUMNOTA || '—'} · ${p.CODEMP} - ${p.NOMEEMP || 'Empresa sem nome'}`, p.DATA_PEDIDO]);
      celula(tr, [`${p.CODPARC || '—'} - ${p.CLIENTE || 'Cliente sem nome'}`, p.CIDADE || '—']);
      celula(tr, [p.TRANSPORTADORA]);
      celula(tr, [`Venda: ${moeda(p.VLRNOTA)}`, `Frete no pedido: ${moeda(p.VLRFRETE)}`, `${numero(p.PESO)} kg · ${numero(p.QTDVOL)} volumes`, `CIF/FOB: ${p.CIF_FOB || '—'}`]);
      celula(tr, p.simulacoes.length ? p.simulacoes.map((s) => `${s.codigo} · ${s.tabela} · ${s.regiao || 'Rota direta'}: ${s.erro ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(s.valor)}`) : ['Sem tabela/região aplicável à transportadora']);
      celula(tr, p.ctes.length ? [
        ...p.ctes.map((c) => `CT-e ${c.NUM_CTE} · ${c.TRANSPORTADORA_CTE}: ${moeda(c.FRETE_CTE_TOTAL ?? c.FRETE_REAL)}`),
        p.compartilhado ? `Frete rateado por peso: ${moeda(p.real)}` : `Total real: ${moeda(p.real)}`,
        ...p.ctes.map((c) => Number(c.STATUS_IMPORTACAO) === 2 ? 'CT-e importado no Sankhya' : 'CT-e não importado no Sankhya')
      ] : ['Sem CT-e importado vinculado']);
      celula(tr, p.simulacoes.length ? p.simulacoes.map((s) => s.diferenca == null ? '—' : moeda(s.diferenca)) : ['—']);
      $('linhas').appendChild(tr);
    }
  }

  async function carregar() {
    consulta?.abort();
    const atual = new AbortController();
    consulta = atual;
    $('status').textContent = 'Consultando pedidos, tabelas de frete e CT-es…';
    $('linhas').replaceChildren();
    $('anterior').disabled = $('proxima').disabled = true;
    $('pagina').textContent = '';
    try {
      const params = new URLSearchParams({ ...filtros, pagina });
      const response = await fetch(`/api/transporte/analise-frete?${params}`, { signal: atual.signal });
      if (!response.ok) throw new Error('Não foi possível consultar. Verifique o período (máximo 24 meses) e sua sessão.');
      const dados = await response.json();
      if (consulta !== atual) return;
      total = dados.total;
      render(dados.linhas);
      const selecionada = $('transportadora').value;
      $('transportadora').replaceChildren(new Option('Todas', '0'),
        ...dados.transportadoras.map((t) => new Option(t.NOMEPARC, t.CODPARC)));
      if ([...$('transportadora').options].some((o) => o.value === selecionada)) $('transportadora').value = selecionada;
      $('status').textContent = total ? `${numero(total)} pedidos/vendas no período. Sugestões calculadas com as configurações atuais.` : 'Nenhum pedido/venda encontrado para os filtros.';
      $('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(total / 10))}`;
      $('anterior').disabled = pagina <= 1;
      $('proxima').disabled = pagina * 10 >= total;
    } catch (erro) {
      if (erro.name !== 'AbortError' && consulta === atual) $('status').textContent = erro.message;
    }
  }

  function consultar() {
    pagina = 1;
    filtros = { dataInicial: $('inicio').value, dataFinal: $('fim').value, transportadora: $('transportadora').value };
    return carregar();
  }
  $('form').addEventListener('submit', (e) => { e.preventDefault(); consultar(); });
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
      return consultar();
    },
    limparSessao() {
      consulta?.abort(); consulta = null; filtros = null; pagina = 1; total = 0;
      $('linhas').replaceChildren(); $('form').reset(); $('status').textContent = '';
      $('transportadora').replaceChildren(new Option('Todas', '0'));
    }
  };
}());
