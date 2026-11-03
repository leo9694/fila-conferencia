(function () {
  const $ = (id) => document.getElementById(`analise-frete-${id}`);
  let pagina = 1;
  let total = 0;
  let tamanhoPagina = 30;
  let consulta = null;
  let filtros = null;
  let transportadorasDisponiveis = [];
  const transportadorasSelecionadas = new Set();
  const moeda = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v) => Number(v || 0).toLocaleString('pt-BR');
  const dataBr = (v) => {
    const partes = String(v || '').split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : (v || '—');
  };
  let consultaId = null;

  function celula(tr, linhas, opcoes = {}) {
    const td = document.createElement('td');
    if (opcoes.classe) td.className = opcoes.classe;
    if (opcoes.linhas > 1) td.rowSpan = opcoes.linhas;
    for (const texto of linhas) {
      const div = document.createElement('div');
      div.textContent = texto;
      td.appendChild(div);
    }
    tr.appendChild(td);
    return td;
  }

  function urlRomaneio(nota) {
    const ordem = Number(nota.ORDEMCARGA);
    const empresa = Number(nota.CODEMP);
    if (!Number.isSafeInteger(ordem) || ordem <= 0 || !Number.isSafeInteger(empresa) || empresa <= 0) return null;
    return `/api/fila-conferencia/romaneio/${ordem}/pdf?empresa=${empresa}`;
  }

  function celulaNota(tr, nota) {
    const td = celula(tr, [nota.NUMNOTA || '—']);
    const url = urlRomaneio(nota);
    if (!url) return;
    const ordem = Number(nota.ORDEMCARGA);
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'consulta-coluna-filtro analise-frete-ordem-botao';
    botao.title = `Ver ordem de carga ${ordem}`;
    botao.setAttribute('aria-label', botao.title);
    botao.setAttribute('aria-haspopup', 'dialog');
    botao.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 4h14v13H1zM15 8h4l4 4v5h-8"/><circle cx="5.5" cy="18" r="2.5" fill="white"/><circle cx="18.5" cy="18" r="2.5" fill="white"/></svg>';
    botao.addEventListener('click', () => {
      $('ordem-titulo').textContent = `Ordem de carga ${ordem}`;
      $('ordem-link').href = url;
      $('ordem-dialogo').showModal();
    });
    td.firstElementChild.appendChild(botao);
  }

  function celulaCtes(tr, pedido, linhas) {
    const td = document.createElement('td');
    td.className = 'analise-frete-cte';
    if (linhas > 1) td.rowSpan = linhas;
    if (!pedido.ctes.length) {
      const div = document.createElement('div');
      div.textContent = 'Sem CT-e emitido vinculado';
      td.appendChild(div);
    } else {
      for (const cte of pedido.ctes) {
        const div = document.createElement('div');
        div.textContent = cte.NUM_CTE || '—';
        td.appendChild(div);
      }
    }
    tr.appendChild(td);
    const opcoes = { linhas };
    const frete = [pedido.ctes.length ? moeda(pedido.real) : '—'];
    if (pedido.ctes.length && pedido.agrupadoCte) frete.push('Total do CT-e');
    else if (pedido.ctes.length && pedido.compartilhado) frete.push('Rateado por peso');
    celula(tr, frete, { ...opcoes, classe: 'analise-frete-numero analise-frete-real' });
  }

  function render(linhas) {
    $('linhas').replaceChildren();
    for (const p of linhas) {
      const notas = p.notasDetalhes?.length ? p.notasDetalhes : [p];
      notas.forEach((nota, indice) => {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        tr.classList.add('analise-frete-nota-detalhavel');
        tr.addEventListener('click', (event) => {
          if (!event.target.closest('button, a')) abrirDetalhesNota(nota, p);
        });
        tr.addEventListener('keydown', (event) => {
          if (event.target !== tr || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          abrirDetalhesNota(nota, p);
        });
        if (indice > 0) tr.classList.add('analise-frete-cte-continuacao');
        celulaNota(tr, nota);
        celula(tr, [dataBr(nota.DATA_PEDIDO)]);
        celula(tr, [`${nota.CODPARC || '—'} - ${nota.CLIENTE || 'Cliente sem nome'}`]);
        celula(tr, [nota.CIDADE || '—']);
        celula(tr, [nota.TRANSPORTADORA || '—']);
        celula(tr, [moeda(nota.VLRNOTA)], { classe: 'analise-frete-numero' });
        celula(tr, [numero(nota.PESO)], { classe: 'analise-frete-numero' });
        celula(tr, [numero(nota.QTDVOL)], { classe: 'analise-frete-numero' });
        if (indice === 0) {
          const opcoes = { linhas: notas.length };
          celula(tr, p.simulacoes.length ? p.simulacoes.map((s) => s.regiao || 'Rota direta') : ['—'], opcoes);
          celula(tr, p.simulacoes.length ? p.simulacoes.map((s) => s.erro ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(s.valor)) : ['—'], { ...opcoes, classe: 'analise-frete-numero analise-frete-sugestao' });
        }
        if (indice === 0) celulaCtes(tr, p, notas.length);
        if (indice === 0) celula(tr, p.grupoIncompleto ? ['CT-e com notas fora do período'] : p.simulacoes.length ? p.simulacoes.map((s) => s.diferenca == null ? '—' : moeda(s.diferenca)) : ['—'], { classe: 'analise-frete-numero analise-frete-diferenca', linhas: notas.length });
        $('linhas').appendChild(tr);
      });
    }
  }

  function secaoDetalhes(titulo, campos) {
    const secao = document.createElement('section');
    const nome = document.createElement('h3');
    nome.textContent = titulo;
    const lista = document.createElement('dl');
    for (const [rotulo, valor] of campos) {
      const campo = document.createElement('div');
      const termo = document.createElement('dt');
      const descricao = document.createElement('dd');
      termo.textContent = rotulo;
      descricao.textContent = valor ?? '—';
      campo.append(termo, descricao);
      lista.appendChild(campo);
    }
    secao.append(nome, lista);
    return secao;
  }

  function linkDocumento(rotulo, url) {
    const link = document.createElement('a');
    link.className = 'analise-frete-download';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', `${rotulo} em nova aba`);
    link.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 5h6v6m0-6-9 9m9 0v5H5V5h5"/></svg>';
    link.append(document.createTextNode(rotulo));
    return link;
  }

  function abrirDetalhesNota(nota, grupo) {
    const tipo = Number(nota.CODTIPOPER) === 10 ? 'Nota de bonificação' : 'Nota de venda';
    $('detalhes-titulo').textContent = nota.NUMNOTA ? `${tipo} ${nota.NUMNOTA}` : tipo;
    const corpo = $('detalhes-corpo');
    corpo.replaceChildren(
      secaoDetalhes('Dados da nota', [
        ['Número único', nota.NUNOTA], ['Data', dataBr(nota.DATA_PEDIDO)],
        ['Empresa', `${nota.CODEMP ?? '—'} - ${nota.NOMEEMP || 'Empresa sem nome'}`],
        ['Cliente', `${nota.CODPARC || '—'} - ${nota.CLIENTE || 'Cliente sem nome'}`],
        ['Valor da nota', moeda(nota.VLRNOTA)]
      ]),
      secaoDetalhes('Transporte', [
        ['Destino', nota.CIDADE], ['Transportadora', nota.TRANSPORTADORA],
        ['Ordem de carga', nota.ORDEMCARGA || '—'], ['Frete no pedido', moeda(nota.VLRFRETE)],
        ['CIF/FOB', nota.CIF_FOB], ['Peso (kg)', numero(nota.PESO)], ['Volumes', numero(nota.QTDVOL)],
        [grupo.compartilhado ? 'Frete rateado por peso' : grupo.agrupadoCte ? 'Frete real do grupo' : 'Frete real', moeda(grupo.real)]
      ])
    );
    for (const sugestao of grupo.simulacoes) {
      corpo.appendChild(secaoDetalhes('Simulação de frete', [
        ['Tabela', sugestao.codigo ? `${sugestao.codigo} - ${sugestao.tabela}` : sugestao.tabela],
        ['Região', sugestao.regiao || 'Rota direta'],
        ['Frete sugerido', sugestao.erro ? 'Cálculo indisponível — revisar fórmula/rotas' : moeda(sugestao.valor)],
        ['Diferença', grupo.grupoIncompleto ? 'CT-e com notas fora do período' : moeda(sugestao.diferenca)]
      ]));
    }
    if (!grupo.simulacoes.length) {
      corpo.appendChild(secaoDetalhes('Simulação de frete', [['Tabela', 'Sem tabela/região aplicável à transportadora']]));
    }
    const romaneio = urlRomaneio(nota);
    for (const [indice, cte] of grupo.ctes.entries()) {
      const secao = secaoDetalhes(`CT-e ${cte.NUM_CTE || '—'}`, [
        ['Transportadora do CT-e', cte.TRANSPORTADORA_CTE],
        ['Valor do CT-e', moeda(cte.FRETE_CTE_TOTAL ?? cte.FRETE_REAL)],
        ['Situação do CT-e', Number(cte.STATUS_IMPORTACAO) === 2 ? 'Importado no Sankhya' : 'Pendente de importação']
      ]);
      const chave = String(cte.CHAVEACESSO || '');
      const acoes = document.createElement('div');
      acoes.className = 'analise-frete-acoes-documentos';
      if (/^\d{44}$/.test(chave)) {
        acoes.appendChild(linkDocumento('Abrir CT-e', `/api/transporte/analise-frete/ctes/${chave}/visualizar`));
      }
      if (romaneio && indice === 0) acoes.appendChild(linkDocumento('Abrir ordem de carga', romaneio));
      if (acoes.childElementCount) secao.appendChild(acoes);
      corpo.appendChild(secao);
    }
    if (!grupo.ctes.length) {
      const secao = secaoDetalhes('CT-e', [['Vínculo', 'Sem CT-e emitido vinculado']]);
      if (romaneio) secao.appendChild(linkDocumento('Abrir ordem de carga', romaneio));
      corpo.appendChild(secao);
    }
    $('detalhes-dialogo').showModal();
  }

  function atualizarTextoTransportadoras() {
    const nomes = transportadorasDisponiveis.filter((t) => transportadorasSelecionadas.has(String(t.CODPARC)))
      .map((t) => t.NOMEPARC);
    $('transportadora-texto').textContent = nomes.length === 0 ? 'Todas'
      : nomes.length === 1 ? nomes[0] : `${nomes.length} transportadoras selecionadas`;
  }

  function prepararFiltrosColunas() {
    ConsultaTabela.fecharMenu();
    const corpo = $('linhas');
    const cabecalhos = [...$('tabela').querySelectorAll('thead th')];
    const grupos = [];
    for (const linha of corpo.rows) {
      if (linha.classList.contains('analise-frete-cte-continuacao') && grupos.length) {
        grupos.at(-1).push(linha);
      } else {
        grupos.push([linha]);
      }
    }
    const filtros = new Map();
    let ordem = null;
    const valoresDaColuna = (grupo, indice) => grupo.flatMap((linha) =>
      [...(linha.cells[indice]?.children || [])].map((celula) => celula.textContent.trim()));
    const titulos = cabecalhos.map((th) => th.dataset.titulo || th.textContent.trim());
    const botoes = [];

    function atualizar() {
      ConsultaTabela.fecharMenu();
      const visiveis = grupos.filter((grupo) => [...filtros].every(([indice, valores]) =>
        valoresDaColuna(grupo, indice).some((valor) => valores.has(valor))));
      if (ordem) {
        const { indice, direcao } = ordem;
        const numerica = cabecalhos[indice].classList.contains('analise-frete-numero');
        const valor = (grupo) => valoresDaColuna(grupo, indice)[0] || '—';
        const coluna = numerica
          ? { numero: true, valor: (grupo) => valor(grupo).replace(/[^\d,.-]/g, '') }
          : { render: valor };
        visiveis.sort((a, b) => ConsultaTabela.comparar(coluna, a, b) * (direcao === 'asc' ? 1 : -1));
      }
      corpo.replaceChildren(...visiveis.flat());
      if (!visiveis.length && grupos.length) {
        const linha = corpo.insertRow();
        const celula = linha.insertCell();
        celula.colSpan = cabecalhos.length;
        celula.textContent = 'Nenhum resultado para os filtros desta página.';
      }
      botoes.forEach(({ nome, menu }, indice) => {
        const direcao = ordem?.indice === indice ? ordem.direcao : null;
        nome.textContent = titulos[indice] + (direcao ? (direcao === 'asc' ? ' ↑' : ' ↓') : '');
        menu.classList.toggle('ativo', filtros.has(indice));
        cabecalhos[indice].setAttribute('aria-sort', direcao ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    cabecalhos.forEach((th, indice) => {
      const titulo = titulos[indice];
      th.dataset.titulo = titulo;
      const conteudo = document.createElement('div');
      conteudo.className = 'consulta-coluna-cabecalho';
      const nome = document.createElement('button');
      nome.type = 'button';
      nome.className = 'consulta-coluna-nome';
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.className = 'consulta-coluna-filtro';
      menu.textContent = '☷';
      menu.setAttribute('aria-label', `Filtrar ou ordenar ${titulo}`);
      menu.setAttribute('aria-expanded', 'false');
      const ordenar = (direcao) => { ordem = { indice, direcao }; atualizar(); };
      nome.addEventListener('click', () => ordenar(ordem?.indice === indice && ordem.direcao === 'asc' ? 'desc' : 'asc'));
      menu.addEventListener('click', () => ConsultaTabela.abrirMenuColuna(menu, {
        titulo,
        valores: [...new Set(grupos.flatMap((grupo) => valoresDaColuna(grupo, indice)))]
          .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
        filtro: filtros.get(indice),
        ordenar,
        filtrar: (valores) => {
          if (valores === null) filtros.delete(indice);
          else filtros.set(indice, new Set(valores));
          atualizar();
        },
        restaurarFoco: () => menu.focus()
      }));
      conteudo.append(nome, menu);
      th.replaceChildren(conteudo);
      botoes.push({ nome, menu });
    });
    atualizar();
  }

  function renderizarTransportadoras(lista) {
    transportadorasDisponiveis = lista;
    const validas = new Set(lista.map((t) => String(t.CODPARC)));
    for (const id of transportadorasSelecionadas) if (!validas.has(id)) transportadorasSelecionadas.delete(id);
    const criarOpcao = (valor, nome) => {
      const label = document.createElement('label');
      label.className = 'analise-frete-multiselect-opcao';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = valor;
      input.checked = valor === '0' ? transportadorasSelecionadas.size === 0 : transportadorasSelecionadas.has(valor);
      input.addEventListener('change', () => {
        if (valor === '0') transportadorasSelecionadas.clear();
        else if (input.checked) transportadorasSelecionadas.add(valor);
        else transportadorasSelecionadas.delete(valor);
        renderizarTransportadoras(transportadorasDisponiveis);
      });
      label.append(input, document.createTextNode(nome));
      return label;
    };
    $('transportadora-opcoes').replaceChildren(criarOpcao('0', 'Todas'),
      ...lista.map((t) => criarOpcao(String(t.CODPARC), t.NOMEPARC)));
    atualizarTextoTransportadoras();
  }

  async function carregar() {
    consulta?.abort();
    const atual = new AbortController();
    consulta = atual;
    $('status').textContent = 'Consultando notas, tabelas de frete e CT-es…';
    $('status').classList.add('is-loading');
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
      tamanhoPagina = Number.isSafeInteger(dados.tamanhoPagina) && dados.tamanhoPagina > 0 ? dados.tamanhoPagina : 30;
      consultaId = dados.consultaId;
      render(dados.linhas);
      prepararFiltrosColunas();
      renderizarTransportadoras(dados.transportadoras);
      $('status').textContent = total ? `${numero(total)} registros · CT-es agrupados e notas sem CT-e. Filtros de coluna nesta página.` : 'Nenhum registro encontrado para os filtros.';
      $('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(total / tamanhoPagina))}`;
      $('anterior').disabled = pagina <= 1;
      $('proxima').disabled = pagina * tamanhoPagina >= total;
    } catch (erro) {
      if (erro.name !== 'AbortError' && consulta === atual) $('status').textContent = erro.message;
    } finally {
      if (consulta === atual) {
        $('linhas').removeAttribute('aria-busy');
        $('status').classList.remove('is-loading');
      }
    }
  }

  function consultar() {
    pagina = 1;
    consultaId = null;
    $('transportadora-opcoes').hidden = true;
    $('transportadora-trigger').setAttribute('aria-expanded', 'false');
    filtros = { dataInicial: $('inicio').value, dataFinal: $('fim').value, empresa: $('empresa').value,
      transportadora: [...transportadorasSelecionadas].join(','),
      cteEmitido: $('cte-emitido').value, statusCte: $('status-cte').value, busca: $('busca').value.trim() };
    return carregar();
  }
  function atualizarStatusCte() {
    const semCte = $('cte-emitido').value === 'sem';
    $('status-cte').disabled = semCte;
    if (semCte) $('status-cte').value = 'todos';
  }
  const tabela = $('tabela');
  const barraHorizontal = $('scroll-horizontal');
  let posicaoAplicada = tabela.scrollLeft;
  let larguraBarra = 0;
  const observarLarguras = new ResizeObserver(() => {
    const alcance = tabela.scrollWidth - tabela.clientWidth;
    barraHorizontal.hidden = alcance <= 0;
    if (barraHorizontal.hidden) return;
    const largura = barraHorizontal.clientWidth + alcance;
    if (largura === larguraBarra) return;
    larguraBarra = largura;
    barraHorizontal.firstElementChild.style.width = `${largura}px`;
    posicaoAplicada = tabela.scrollLeft;
    barraHorizontal.scrollLeft = tabela.scrollLeft;
  });
  observarLarguras.observe(tabela);
  observarLarguras.observe(tabela.firstElementChild);
  barraHorizontal.addEventListener('scroll', () => {
    if (tabela.scrollLeft !== barraHorizontal.scrollLeft) tabela.scrollLeft = barraHorizontal.scrollLeft;
    // O navegador pode arredondar ou limitar a posição aplicada à tabela.
    posicaoAplicada = tabela.scrollLeft;
  });
  tabela.addEventListener('scroll', () => {
    if (tabela.scrollLeft === posicaoAplicada) return;
    posicaoAplicada = tabela.scrollLeft;
    if (barraHorizontal.scrollLeft !== tabela.scrollLeft) barraHorizontal.scrollLeft = tabela.scrollLeft;
  });

  $('form').addEventListener('submit', (e) => { e.preventDefault(); consultar(); });
  $('transportadora-trigger').addEventListener('click', () => {
    const abrir = $('transportadora-opcoes').hidden;
    $('transportadora-opcoes').hidden = !abrir;
    $('transportadora-trigger').setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', (e) => {
    if ($('transportadora').contains(e.target)) return;
    $('transportadora-opcoes').hidden = true;
    $('transportadora-trigger').setAttribute('aria-expanded', 'false');
  });
  $('cte-emitido').addEventListener('change', atualizarStatusCte);
  $('anterior').addEventListener('click', () => { if (pagina > 1) { pagina--; carregar(); } });
  $('proxima').addEventListener('click', () => { if (pagina * tamanhoPagina < total) { pagina++; carregar(); } });
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
      if (!filtros) {
        $('status').textContent = 'Defina os filtros e clique em Consultar.';
        $('anterior').disabled = true;
        $('proxima').disabled = true;
        $('pagina').textContent = '';
      }
    },
    limparSessao() {
      consulta?.abort(); consulta = null; filtros = null; pagina = 1; total = 0;
      consultaId = null;
      $('linhas').replaceChildren(); $('form').reset(); $('status').textContent = '';
      prepararFiltrosColunas();
      $('status').classList.remove('is-loading');
      transportadorasSelecionadas.clear();
      renderizarTransportadoras([]);
    }
  };
  renderizarTransportadoras([]);
}());
