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

  function mostrarTransportadora(nota) {
    const transportadora = $('transportadora-carga');
    const temCarga = Number(nota.ORDEMCARGA) > 0;
    transportadora.hidden = false;
    transportadora.textContent = temCarga
      ? `Transportadora da carga · ${nota.TRANSPORTADORA_CARGA || 'Indisponível'}`
      : `Transportadora da nota · ${nota.TRANSPORTADORA_NOTA || 'Não selecionada'}`;
  }

  function montarSelecaoTransportadora(celula, nota, tabela, opcoes, pedido) {
    const seletor = document.createElement('select');
    seletor.setAttribute('aria-label', `Transportadora para ${nomeTabela(tabela)}`);
    seletor.append(new Option('Selecione', ''));
    for (const opcao of opcoes) {
      seletor.append(new Option(`${opcao.TRANSPORTADORA} (${opcao.CODPARC})`, opcao.CODPARC));
    }
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = 'Aplicar na nota e no parceiro';
    botao.disabled = true;
    seletor.addEventListener('change', () => { botao.disabled = !seletor.value; });
    botao.addEventListener('click', async () => {
      const status = $('transportadora-status');
      const controles = [...$('sugestoes-linhas').querySelectorAll('button, select')];
      controles.forEach((controle) => { controle.disabled = true; });
      status.hidden = false;
      status.textContent = 'Salvando transportadora…';
      try {
        const resposta = await fetch(`/api/transporte/definicao-frete/${nota.NUNOTA}/transportadora`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tabela: tabela.codigo, transportadora: seletor.value })
        });
        const resultado = await resposta.json();
        if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível salvar a transportadora.');
        nota.TRANSPORTADORA_NOTA = resultado.nome;
        if (requisicaoHistorico === pedido && dialogo.open) {
          mostrarTransportadora(nota);
          status.textContent = resultado.preferencialAtualizada
            ? 'Transportadora atualizada na nota e no cadastro do parceiro.'
            : 'Transportadora atualizada na nota. A preferência do parceiro não foi salva. Tente aplicar novamente.';
        }
      } catch (erro) {
        if (requisicaoHistorico === pedido && dialogo.open) status.textContent = erro.message;
      } finally {
        controles.forEach((controle) => {
          controle.disabled = controle.tagName === 'BUTTON' && !controle.previousElementSibling.value;
        });
      }
    });
    celula.append(seletor, botao);
  }

  async function abrirDetalhes(nota, campos, sugestoes, colunas, transportadoras) {
    requisicaoHistorico?.abort();
    const pedido = new AbortController();
    requisicaoHistorico = pedido;
    $('titulo').textContent = `Nota ${campos[0] === '—' ? nota.NUNOTA : campos[0]}`;
    $('cliente').textContent = campos[1];
    mostrarTransportadora(nota);
    const editavel = ['A', 'P'].includes(nota.STATUSNOTA) && !(Number(nota.ORDEMCARGA) > 0);
    $('acao-transportadora').hidden = !editavel;
    $('transportadora-status').hidden = true;
    const listaSugestoes = $('sugestoes-linhas');
    listaSugestoes.replaceChildren();
    for (const tabela of colunas) {
      const sugestao = sugestoes.get(String(tabela.codigo));
      if (!sugestao) continue;
      const linha = listaSugestoes.insertRow();
      for (const texto of [nomeTabela(tabela), sugestao.regiao || '—', valorSugestao(sugestao)]) {
        linha.insertCell().textContent = texto;
      }
      if (editavel) {
        const celula = linha.insertCell();
        celula.className = 'definicao-frete-selecao-transportadora';
        const opcoes = transportadoras.filter((opcao) => Number(opcao.NUCFR) === Number(tabela.codigo));
        if (sugestao.valor != null && opcoes.length) montarSelecaoTransportadora(celula, nota, tabela, opcoes, pedido);
        else celula.textContent = '—';
      }
    }
    $('sugestoes-grade').hidden = !listaSugestoes.rows.length;
    $('sugestoes-vazio').hidden = Boolean(listaSugestoes.rows.length);
    const [, , faturamento, destino, venda, peso, volumes] = campos;
    $('resumo').replaceChildren(...[
      ['Data', nota.DATA_NOTA], ['Faturamento', faturamento], ['Destino', destino], ['Valor da venda', venda],
      ['Peso (kg)', peso], ['Volumes', volumes],
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
        nota.DATA_FATURAMENTO || '—',
        [nota.CIDADE, nota.UF].filter(Boolean).join(' / '),
        nota.VLRNOTA == null ? '—' : moeda.format(nota.VLRNOTA),
        nota.PESO == null ? '—' : numero.format(nota.PESO),
        nota.QTDVOL == null ? '—' : numero.format(nota.QTDVOL)
      ];
      tr.className = 'analise-frete-nota-detalhavel';
      const sugestoes = new Map(nota.sugestoes.map((sugestao) => [String(sugestao.codigo), sugestao]));
      tr.addEventListener('click', () => abrirDetalhes(nota, campos, sugestoes, dados.colunas, dados.transportadoras || []));
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
        if (indice === 0) {
          const confirmada = nota.STATUSNOTA === 'L';
          const status = document.createElement('span');
          status.className = `definicao-frete-confirmacao ${confirmada ? 'is-confirmada' : ''}`;
          status.title = confirmada ? 'Nota confirmada' : 'Nota não confirmada';
          status.setAttribute('role', 'img');
          status.setAttribute('aria-label', status.title);
          status.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="${confirmada ? 'm8 12 3 3 5-6' : 'M12 7v5l3 2'}"/></svg>`;
          td.append(status);
        }
        if (indice >= 4) td.className = 'analise-frete-numero';
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
