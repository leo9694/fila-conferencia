(function () {
  const $ = (id) => document.getElementById(`analise-frete-${id}`);
  let pagina = 1;
  let total = 0;
  let consulta = null;
  let filtros = null;
  const moeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v) => Number(v || 0).toLocaleString('pt-BR');
  const somar = (linhas, campo) => linhas.reduce((totalLinha, linha) => totalLinha + Number(linha[campo] || 0), 0);
  const arredondar = (valor) => Math.round(valor * 100) / 100;

  function agruparPorCte(linhas) {
    const grupos = new Map();
    const avulsas = [];
    for (const linha of linhas) {
      const cte = linha.ctes?.length === 1 ? linha.ctes[0] : null;
      if (cte && Number(cte.COMPARTILHADO) === 1) {
        if (!grupos.has(cte.CHAVEACESSO)) grupos.set(cte.CHAVEACESSO, { cte, pedidos: [] });
        grupos.get(cte.CHAVEACESSO).pedidos.push(linha);
      } else avulsas.push(linha);
    }
    const consolidadas = [...grupos.values()].flatMap(({ cte, pedidos }) => {
      if (pedidos.length < 2) return pedidos;
      const sugestoes = pedidos.flatMap((p) => p.simulacoes || []);
      const possuiSugestaoIncompleta = pedidos.some((p) => !p.simulacoes?.length || p.simulacoes.some((s) => s.erro || s.valor == null));
      const valorSugerido = possuiSugestaoIncompleta ? null : arredondar(sugestoes.reduce((totalSugestao, s) => totalSugestao + Number(s.valor), 0));
      const valorReal = Number(cte.FRETE_CTE_TOTAL ?? cte.FRETE_REAL);
      const nomesTabelas = [...new Set(sugestoes.map((s) => s.tabela).filter(Boolean))];
      return [{
        ...pedidos[0],
        agrupadoCte: true,
        NUNOTA: pedidos.map((p) => p.NUNOTA).join(' · '),
        NUMNOTA: pedidos.map((p) => p.NUMNOTA).filter(Boolean).join(' · '),
        CLIENTE: [...new Set(pedidos.map((p) => p.CLIENTE).filter(Boolean))].join(' · '),
        CODPARC: [...new Set(pedidos.map((p) => p.CODPARC).filter(Boolean))].join(' · '),
        CIDADE: [...new Set(pedidos.map((p) => p.CIDADE).filter(Boolean))].join(' · '),
        VLRNOTA: arredondar(somar(pedidos, 'VLRNOTA')),
        VLRFRETE: arredondar(somar(pedidos, 'VLRFRETE')),
        PESO: arredondar(somar(pedidos, 'PESO')),
        QTDVOL: somar(pedidos, 'QTDVOL'),
        ctes: [{ ...cte, FRETE_REAL: valorReal }],
        compartilhado: false,
        real: valorReal,
        simulacoes: [{ codigo: pedidos[0].simulacoes?.[0]?.codigo, tabela: nomesTabelas.join(' + ') || 'Tabela de frete', valor: valorSugerido,
          diferenca: valorSugerido == null ? null : arredondar(valorReal - valorSugerido) }]
      }];
    });
    return [...avulsas, ...consolidadas].sort((a, b) => String(b.DATA_PEDIDO || '').localeCompare(String(a.DATA_PEDIDO || '')));
  }

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
      render(agruparPorCte(dados.linhas));
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
    filtros = { dataInicial: $('inicio').value, dataFinal: $('fim').value, transportadora: $('transportadora').value,
      cteEmitido: $('cte-emitido').value, statusCte: $('status-cte').value };
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
      $('linhas').replaceChildren(); $('form').reset(); $('status').textContent = '';
      $('transportadora').replaceChildren(new Option('Todas', '0'));
    }
  };
}());
