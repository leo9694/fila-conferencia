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
    celula(tr, [moeda(pedido.valorTde)], { ...opcoes, classe: 'analise-frete-numero' });
    celula(tr, [pedido.ctes.length ? moeda(pedido.real) : '—'], { ...opcoes, classe: 'analise-frete-numero' });
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
          celulaCtes(tr, p, notas.length);
          const diferencas = p.grupoIncompleto ? [] : p.simulacoes.map((s) => s.diferenca);
          const textos = p.grupoIncompleto ? ['CT-e com notas fora do período'] : diferencas.map(moeda);
          const td = celula(tr, textos.length ? textos : ['—'], { ...opcoes, classe: 'analise-frete-numero analise-frete-diferenca' });
          diferencas.forEach((valor, posicao) => {
            if (valor > 50) td.children[posicao].className = 'analise-frete-diferenca-alta';
          });
        }
        $('linhas').appendChild(tr);
      });
    }
  }

  function secaoDetalhes(titulo, campos) {
    const secao = document.createElement('section');
    if (titulo) {
      const topo = document.createElement('header');
      const nome = document.createElement('h3');
      nome.textContent = titulo;
      topo.appendChild(nome);
      secao.appendChild(topo);
    }
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
    secao.appendChild(lista);
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
    $('detalhes-meta').textContent = `Nº único ${nota.NUNOTA ?? '—'} · ${dataBr(nota.DATA_PEDIDO)}`;
    const situacao = $('detalhes-situacao');
    const pendente = grupo.ctes.some((cte) => Number(cte.STATUS_IMPORTACAO) !== 2);
    situacao.textContent = !grupo.ctes.length ? 'Sem CT-e' : pendente ? 'CT-e pendente' : 'CT-e importado';
    situacao.classList.toggle('is-pendente', pendente);
    situacao.classList.toggle('is-importado', grupo.ctes.length > 0 && !pendente);
    const rotuloFrete = grupo.compartilhado ? 'Frete rateado por peso' : grupo.agrupadoCte ? 'Frete real do grupo' : 'Frete real';
    const resumo = secaoDetalhes(null, [
      ['Valor da nota', moeda(nota.VLRNOTA)], [rotuloFrete, moeda(grupo.real)],
      ['Empresa', `${nota.CODEMP ?? '—'} - ${nota.NOMEEMP || 'Empresa sem nome'}`],
      ['Cliente', `${nota.CODPARC || '—'} - ${nota.CLIENTE || 'Cliente sem nome'}`]
    ]);
    resumo.className = 'analise-frete-detalhes-resumo';
    const corpo = $('detalhes-corpo');
    corpo.replaceChildren(
      resumo,
      secaoDetalhes('Transporte', [
        ['Destino', nota.CIDADE], ['Transportadora', nota.TRANSPORTADORA],
        ['Ordem de carga', nota.ORDEMCARGA || '—'], ['CIF/FOB', nota.CIF_FOB],
        ['Peso (kg)', numero(nota.PESO)], ['Volumes', numero(nota.QTDVOL)],
        ['Frete no pedido', moeda(nota.VLRFRETE)], [rotuloFrete, moeda(grupo.real)]
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
      secao.className = 'analise-frete-detalhes-cte';
      const statusCte = secao.querySelector('dl > div:last-child dd');
      statusCte.className = `analise-frete-detalhes-status ${Number(cte.STATUS_IMPORTACAO) === 2 ? 'is-importado' : 'is-pendente'}`;
      const chave = String(cte.CHAVEACESSO || '');
      const acoes = document.createElement('div');
      acoes.className = 'analise-frete-acoes-documentos';
      if (/^\d{44}$/.test(chave)) {
        acoes.appendChild(linkDocumento('Abrir CT-e', `/api/transporte/analise-frete/ctes/${chave}/visualizar`));
      }
      if (romaneio && indice === 0) acoes.appendChild(linkDocumento('Abrir ordem de carga', romaneio));
      if (acoes.childElementCount) secao.firstElementChild.appendChild(acoes);
      corpo.appendChild(secao);
    }
    if (!grupo.ctes.length) {
      const secao = secaoDetalhes('CT-e', [['Vínculo', 'Sem CT-e emitido vinculado']]);
      if (romaneio) secao.firstElementChild.appendChild(linkDocumento('Abrir ordem de carga', romaneio));
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

  const filtrosColunas = new Map();
  const opcoesColunas = new Map();
  let ordemColuna = null;
  let consultandoOpcoes = false;

  function filtrosDaGrade() {
    return {
      ordemColuna,
      filtrosColunas: Object.fromEntries([...filtrosColunas].map(([coluna, valores]) => [coluna, [...valores]]))
    };
  }

  async function exportarExcel() {
    const atual = consulta;
    const botao = $('exportar');
    if (!consultaId || !total || botao.disabled) return;
    botao.disabled = true;
    botao.textContent = 'Exportando…';
    try {
      const resposta = await fetch('/api/transporte/analise-frete/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filtros, consultaId, ...filtrosDaGrade() }),
        signal: atual.signal
      });
      if (!resposta.ok) throw new Error('Não foi possível exportar. Clique em Consultar e tente novamente.');
      const arquivo = await resposta.blob();
      if (consulta !== atual) return;
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'analise-de-frete.xlsx';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (erro) {
      if (erro.name !== 'AbortError' && consulta === atual) $('status').textContent = erro.message;
    } finally {
      botao.textContent = 'Exportar Excel';
      if (consulta === atual) botao.disabled = !total;
    }
  }

  async function solicitarAnalise(parametros, signal) {
    const resposta = await fetch('/api/transporte/analise-frete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...filtros, consultaId, ...parametros }),
      signal
    });
    if (!resposta.ok) throw new Error('Não foi possível consultar. Clique em Consultar para atualizar os dados.');
    return resposta.json();
  }

  function prepararFiltrosColunas() {
    ConsultaTabela.fecharMenu();
    const cabecalhos = [...$('tabela').querySelectorAll('thead th')];
    const titulos = cabecalhos.map((th) => th.dataset.titulo || th.textContent.trim());

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
      const coluna = th.dataset.coluna;
      const direcao = ordemColuna?.coluna === coluna ? ordemColuna.direcao : null;
      nome.textContent = titulo + (direcao ? (direcao === 'asc' ? ' ↑' : ' ↓') : '');
      menu.classList.toggle('ativo', filtrosColunas.has(coluna));
      th.setAttribute('aria-sort', direcao ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none');
      const aplicar = () => { pagina = 1; carregar(); };
      const ordenar = (sentido) => { ordemColuna = { coluna, direcao: sentido }; aplicar(); };
      const indisponivel = () => !consultaId || $('linhas').getAttribute('aria-busy') === 'true';
      nome.addEventListener('click', () => {
        if (!indisponivel()) ordenar(direcao === 'asc' ? 'desc' : 'asc');
      });
      menu.addEventListener('click', async () => {
        if (indisponivel() || consultandoOpcoes) return;
        const atual = consulta;
        try {
          if (!opcoesColunas.has(coluna)) {
            consultandoOpcoes = true;
            menu.setAttribute('aria-busy', 'true');
            const dados = await solicitarAnalise({ opcoesColuna: coluna }, atual.signal);
            if (consulta !== atual) return;
            opcoesColunas.set(coluna, dados.valores);
          }
          ConsultaTabela.abrirMenuColuna(menu, {
            titulo,
            numerica: th.classList.contains('analise-frete-numero') || ['nota', 'cte'].includes(coluna),
            valores: opcoesColunas.get(coluna),
            filtro: filtrosColunas.get(coluna),
            ordenar,
            filtrar: (valores) => {
              if (valores === null) filtrosColunas.delete(coluna);
              else filtrosColunas.set(coluna, new Set(valores));
              aplicar();
            },
            restaurarFoco: () => menu.focus()
          });
        } catch (erro) {
          if (erro.name !== 'AbortError' && consulta === atual) $('status').textContent = erro.message;
        } finally {
          consultandoOpcoes = false;
          menu.removeAttribute('aria-busy');
        }
      });
      conteudo.append(nome, menu);
      th.replaceChildren(conteudo);
    });
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
    ConsultaTabela.fecharMenu();
    consulta?.abort();
    const atual = new AbortController();
    consulta = atual;
    $('status').textContent = 'Consultando notas, tabelas de frete e CT-es…';
    $('status').classList.add('is-loading');
    $('linhas').setAttribute('aria-busy', 'true');
    $('anterior').disabled = $('proxima').disabled = true;
    $('exportar').disabled = true;
    $('pagina').textContent = '';
    try {
      const dados = await solicitarAnalise({ pagina, ...filtrosDaGrade() }, atual.signal);
      if (consulta !== atual) return;
      total = dados.total;
      pagina = dados.pagina;
      tamanhoPagina = Number.isSafeInteger(dados.tamanhoPagina) && dados.tamanhoPagina > 0 ? dados.tamanhoPagina : 30;
      consultaId = dados.consultaId;
      render(dados.linhas);
      prepararFiltrosColunas();
      renderizarTransportadoras(dados.transportadoras);
      $('status').textContent = total ? `${numero(total)} registros · CT-es agrupados e notas sem CT-e. Filtros de coluna em todos os resultados.` : 'Nenhum registro encontrado para os filtros.';
      $('pagina').textContent = `Página ${pagina} de ${Math.max(1, Math.ceil(total / tamanhoPagina))}`;
      $('anterior').disabled = pagina <= 1;
      $('proxima').disabled = pagina * tamanhoPagina >= total;
      $('exportar').disabled = !total;
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
    filtrosColunas.clear();
    opcoesColunas.clear();
    ordemColuna = null;
    $('transportadora-opcoes').hidden = true;
    $('transportadora-trigger').setAttribute('aria-expanded', 'false');
    const cliente = $('cliente').value.trim();
    filtros = { cliente, dataInicial: cliente ? '' : $('inicio').value, dataFinal: cliente ? '' : $('fim').value, empresa: $('empresa').value,
      transportadora: [...transportadorasSelecionadas].join(','),
      cteEmitido: $('cte-emitido').value, statusCte: $('status-cte').value, busca: $('busca').value.trim() };
    return carregar();
  }
  function atualizarDatas() {
    const semPeriodo = Boolean($('cliente').value.trim());
    for (const campo of [$('inicio'), $('fim')]) {
      campo.required = !semPeriodo;
      campo.disabled = semPeriodo;
    }
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
  $('exportar').addEventListener('click', exportarExcel);
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
  $('cliente').addEventListener('input', atualizarDatas);
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
      atualizarDatas();
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
      $('exportar').disabled = true;
      filtrosColunas.clear();
      opcoesColunas.clear();
      ordemColuna = null;
      $('linhas').replaceChildren(); $('form').reset(); $('status').textContent = '';
      atualizarDatas();
      prepararFiltrosColunas();
      $('status').classList.remove('is-loading');
      transportadorasSelecionadas.clear();
      renderizarTransportadoras([]);
    }
  };
  renderizarTransportadoras([]);
}());
