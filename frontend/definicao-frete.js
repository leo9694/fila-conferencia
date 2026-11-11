(function () {
  const $ = (id) => document.getElementById(`definicao-frete-${id}`);
  const form = $('form');
  const cabecalho = $('colunas');
  const linhas = $('linhas');
  const consultar = form.querySelector('button[type="submit"]');
  const dialogo = $('dialogo');
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const nomeTabela = (tabela) => `${tabela.codigo} - ${tabela.nome || 'Tabela de frete'}`;
  const valorSugestao = (sugestao) => sugestao.valor == null ? 'Indisponível' : moeda.format(sugestao.valor);
  let filtros;
  let requisicao;
  let requisicaoHistorico;
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

  function linkCte(cte, texto) {
    const link = document.createElement('a');
    link.href = `/api/transporte/analise-frete/ctes/${cte.chave}/visualizar`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = texto;
    link.setAttribute('aria-label', `${texto} · Abrir CT-e em nova aba`);
    return link;
  }

  function preencherFreteReal(celula, nota) {
    const valor = nota.freteReal == null ? 'Indisponível' : moeda.format(nota.freteReal);
    const documentos = nota.documentosCte || [];
    celula.className = 'definicao-frete-historico-cte';
    if (!documentos.length) {
      celula.textContent = valor;
    } else if (documentos.length === 1) {
      celula.append(linkCte(documentos[0], valor));
    } else {
      const detalhes = document.createElement('details');
      const resumo = document.createElement('summary');
      resumo.textContent = `${valor} (${documentos.length} CT-es)`;
      detalhes.append(resumo, ...documentos.map((cte, indice) => linkCte(cte, `CT-e ${cte.numero || indice + 1}`)));
      celula.append(detalhes);
    }
  }

  async function abrirDetalhes(nota, campos, sugestoes, colunas) {
    requisicaoHistorico?.abort();
    const pedido = new AbortController();
    requisicaoHistorico = pedido;
    $('titulo').textContent = `Nota ${campos[0] === '—' ? nota.NUNOTA : campos[0]}`;
    $('cliente').textContent = campos[1];
    const listaSugestoes = $('sugestoes-linhas');
    listaSugestoes.replaceChildren();
    for (const tabela of colunas) {
      const sugestao = sugestoes.get(String(tabela.codigo));
      if (!sugestao) continue;
      const linha = listaSugestoes.insertRow();
      for (const texto of [nomeTabela(tabela), sugestao.regiao || '—', valorSugestao(sugestao)]) {
        linha.insertCell().textContent = texto;
      }
    }
    $('sugestoes-grade').hidden = !listaSugestoes.rows.length;
    $('sugestoes-vazio').hidden = Boolean(listaSugestoes.rows.length);
    $('resumo').replaceChildren(...[
      ['Data', nota.DATA_NOTA], ['Destino', campos[2]], ['Valor da venda', campos[3]],
      ['Peso (kg)', campos[4]], ['Volumes', campos[5]],
      ['Ordem de carga', Number(nota.ORDEMCARGA) > 0 ? nota.ORDEMCARGA : '—']
    ].map(([rotulo, valor]) => {
      const campo = document.createElement('div');
      const termo = document.createElement('dt');
      const descricao = document.createElement('dd');
      termo.textContent = rotulo;
      descricao.textContent = valor || '—';
      campo.append(termo, descricao);
      return campo;
    }));
    const status = $('historico-status');
    const grade = $('historico-grade');
    const colunasHistorico = $('historico-colunas');
    const registros = $('historico-linhas');
    colunasHistorico.querySelectorAll('[data-tabela]').forEach((coluna) => coluna.remove());
    registros.replaceChildren();
    grade.hidden = true;
    status.textContent = 'Consultando histórico…';
    dialogo.showModal();

    try {
      const resposta = await fetch(`/api/transporte/definicao-frete/${nota.NUNOTA}/historico`, { signal: pedido.signal });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível consultar o histórico do cliente.');
      if (requisicaoHistorico !== pedido || !dialogo.open) return;
      const tabelas = new Map(dados.pedidos.flatMap((anterior) =>
        (anterior.sugestoes || []).map((sugestao) => [String(sugestao.codigo), sugestao])));
      const codigos = [...tabelas.keys()].sort((a, b) => Number(a) - Number(b));
      for (const codigo of codigos) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.dataset.tabela = codigo;
        th.textContent = nomeTabela(tabelas.get(codigo));
        colunasHistorico.append(th);
      }
      for (const anterior of dados.pedidos) {
        const linha = registros.insertRow();
        const valor = anterior.VLRNOTA == null ? '—' : moeda.format(anterior.VLRNOTA);
        for (const texto of [Number(anterior.NUMNOTA) > 0 ? anterior.NUMNOTA : anterior.NUNOTA,
          anterior.DATA_NOTA, anterior.TRANSPORTADORA, valor]) {
          linha.insertCell().textContent = texto || '—';
        }
        preencherFreteReal(linha.insertCell(), anterior);
        linha.insertCell().textContent = anterior.valorTde == null ? '—' : moeda.format(anterior.valorTde);
        const sugestoesAnteriores = new Map((anterior.sugestoes || []).map((sugestao) => [String(sugestao.codigo), sugestao]));
        for (const codigo of codigos) {
          const sugestao = sugestoesAnteriores.get(codigo);
          const celula = linha.insertCell();
          celula.className = 'definicao-frete-historico-sugestao';
          celula.textContent = sugestao ? valorSugestao(sugestao) : '—';
        }
      }
      grade.hidden = !dados.pedidos.length;
      status.textContent = grade.hidden ? 'Nenhum pedido anterior encontrado.' : '';
    } catch (erro) {
      if (requisicaoHistorico === pedido && dialogo.open) status.textContent = erro.message;
    }
  }

  function renderizar(dados) {
    limparGrade();
    for (const tabela of dados.colunas) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.dataset.tabela = tabela.codigo;
      th.textContent = nomeTabela(tabela);
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
      tr.className = 'analise-frete-nota-detalhavel';
      const sugestoes = new Map(nota.sugestoes.map((sugestao) => [String(sugestao.codigo), sugestao]));
      tr.addEventListener('click', () => abrirDetalhes(nota, campos, sugestoes, dados.colunas));
      campos.forEach((valor, indice) => {
        const td = tr.insertCell();
        td.textContent = valor || '—';
        if (indice === 0) {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'definicao-frete-nota-botao';
          botao.textContent = valor;
          botao.setAttribute('aria-label', `Ver detalhes da nota ${valor === '—' ? nota.NUNOTA : valor}`);
          botao.setAttribute('aria-haspopup', 'dialog');
          td.replaceChildren(botao);
        }
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
      for (const tabela of dados.colunas) {
        const sugestao = sugestoes.get(String(tabela.codigo));
        const td = tr.insertCell();
        td.className = 'analise-frete-numero definicao-frete-sugestao';
        td.textContent = sugestao ? valorSugestao(sugestao) : '—';
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
  dialogo.addEventListener('close', () => {
    if (!dialogo.open) {
      requisicaoHistorico?.abort();
      requisicaoHistorico = null;
    }
  });

  window.definicaoFreteController = {
    preparar(inicio, fim) {
      if (!form.elements.dataInicial.value) form.elements.dataInicial.value = inicio;
      if (!form.elements.dataFinal.value) form.elements.dataFinal.value = fim;
    },
    limparSessao() {
      requisicao?.abort();
      requisicaoHistorico?.abort();
      requisicaoHistorico = null;
      if (dialogo.open) dialogo.close();
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
