(function () {
  const $ = (id) => document.getElementById(`definicao-frete-${id}`);
  const form = $('form');
  const cabecalho = $('colunas');
  const linhas = $('linhas');
  const consultar = form.querySelector('button[type="submit"]');
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  let filtros;
  let requisicao;
  let pagina = 1;
  let temMais = false;

  function paginacao() {
    $('pagina').textContent = `Página ${pagina}`;
    $('anterior').disabled = Boolean(requisicao) || pagina === 1;
    $('proxima').disabled = Boolean(requisicao) || !temMais;
  }

  function limparGrade() {
    cabecalho.querySelectorAll('[data-tabela]').forEach((coluna) => coluna.remove());
    linhas.replaceChildren();
  }

  function renderizar(dados) {
    limparGrade();
    for (const tabela of dados.colunas) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.dataset.tabela = tabela.codigo;
      th.textContent = `${tabela.codigo} - ${tabela.nome || 'Tabela de frete'}`;
      th.className = 'analise-frete-numero';
      cabecalho.append(th);
    }
    const fragmento = document.createDocumentFragment();
    for (const nota of dados.linhas) {
      const tr = fragmento.appendChild(document.createElement('tr'));
      const campos = [
        Number(nota.NUMNOTA) > 0 ? nota.NUMNOTA : '—',
        [nota.CODPARC, nota.CLIENTE].filter(Boolean).join(' - '),
        [nota.CIDADE, nota.UF].filter(Boolean).join(' / '),
        nota.VLRNOTA == null ? '—' : moeda.format(nota.VLRNOTA),
        nota.PESO == null ? '—' : numero.format(nota.PESO),
        nota.QTDVOL == null ? '—' : numero.format(nota.QTDVOL)
      ];
      campos.forEach((valor, indice) => {
        const td = tr.insertCell();
        td.textContent = valor || '—';
        if (indice === 0 && Number(nota.ORDEMCARGA) > 0) {
          const icone = document.createElement('span');
          icone.className = 'definicao-frete-ordem';
          icone.title = `Ordem de carga ${nota.ORDEMCARGA}`;
          icone.setAttribute('role', 'img');
          icone.setAttribute('aria-label', icone.title);
          icone.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 4h14v13H1zM15 8h4l4 4v5h-8"/><circle cx="5.5" cy="18" r="2.5" fill="white"/><circle cx="18.5" cy="18" r="2.5" fill="white"/></svg>';
          td.append(icone);
        }
        if (indice >= 3) td.className = 'analise-frete-numero';
      });
      const sugestoes = new Map(nota.sugestoes.map((sugestao) => [String(sugestao.codigo), sugestao]));
      for (const tabela of dados.colunas) {
        const sugestao = sugestoes.get(String(tabela.codigo));
        const td = tr.insertCell();
        td.className = 'analise-frete-numero definicao-frete-sugestao';
        td.textContent = sugestao ? (sugestao.valor == null ? 'Indisponível' : moeda.format(sugestao.valor)) : '—';
        if (sugestao?.regiao) td.title = sugestao.regiao;
      }
    }
    linhas.append(fragmento);
    pagina = dados.pagina;
    temMais = dados.temMais;
    $('status').textContent = dados.linhas.length ? `${dados.linhas.length} nota(s) nesta página` : 'Nenhuma nota encontrada para os filtros.';
  }

  async function carregar(destino) {
    if (!filtros || requisicao) return;
    const pedido = new AbortController();
    requisicao = pedido;
    consultar.disabled = true;
    paginacao();
    $('status').textContent = 'Consultando sugestões…';
    linhas.setAttribute('aria-busy', 'true');
    try {
      const parametros = new URLSearchParams({ ...filtros, pagina: String(destino) });
      const resposta = await fetch(`/api/transporte/definicao-frete?${parametros}`, { signal: pedido.signal });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível consultar as sugestões.');
      if (requisicao === pedido) renderizar(dados);
    } catch (erro) {
      if (requisicao === pedido) $('status').textContent = erro.message;
    } finally {
      if (requisicao === pedido) {
        requisicao = null;
        consultar.disabled = false;
        linhas.removeAttribute('aria-busy');
        paginacao();
      }
    }
  }

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (requisicao) return;
    filtros = Object.fromEntries(new FormData(form));
    pagina = 1;
    temMais = false;
    limparGrade();
    carregar(1);
  });
  $('anterior').addEventListener('click', () => carregar(pagina - 1));
  $('proxima').addEventListener('click', () => carregar(pagina + 1));

  window.definicaoFreteController = {
    preparar(inicio, fim) {
      if (!form.elements.dataInicial.value) form.elements.dataInicial.value = inicio;
      if (!form.elements.dataFinal.value) form.elements.dataFinal.value = fim;
    },
    limparSessao() {
      requisicao?.abort();
      requisicao = null;
      filtros = null;
      pagina = 1;
      temMais = false;
      form.reset();
      consultar.disabled = false;
      linhas.removeAttribute('aria-busy');
      limparGrade();
      paginacao();
      $('status').textContent = 'Informe os filtros e clique em Consultar.';
    }
  };
}());
