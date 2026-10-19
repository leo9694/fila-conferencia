const ConsultaTabela = (() => {
  const escapar = (valor) => String(valor ?? '-').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const texto = (coluna, linha) => String((coluna.render ? coluna.render(linha) : linha[coluna.campo]) ?? '-');
  const normalizar = (valor) => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  let fecharMenuAtual = null;

  function fecharMenu() {
    fecharMenuAtual?.();
  }

  function comparar(coluna, a, b) {
    if (coluna.numero) {
      const numero = (linha) => {
        const valor = coluna.campo ? linha[coluna.campo] : (coluna.valor ? coluna.valor(linha) : texto(coluna, linha));
        return typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(/\./g, '').replace(',', '.')) || 0;
      };
      return numero(a) - numero(b);
    }
    const valor = (linha) => {
      const exibido = texto(coluna, linha);
      const data = exibido.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return data ? `${data[3]}-${data[2]}-${data[1]}` : exibido;
    };
    return valor(a).localeCompare(valor(b), 'pt-BR', { sensitivity: 'base', numeric: true });
  }

  function obterLinhas(colunas, linhas, filtros, ordem) {
    const visiveis = linhas.filter((linha) => colunas.every((coluna, i) => !filtros[i] || filtros[i].has(texto(coluna, linha))));
    if (ordem) visiveis.sort((a, b) => comparar(colunas[ordem.coluna], a, b) * (ordem.direcao === 'asc' ? 1 : -1));
    return visiveis;
  }

  function criar(container, colunas, linhas, aoSelecionar) {
    const filtros = {};
    let ordem = null;
    let selecionado = null;
    let visiveis = [];

    function desenhar() {
      fecharMenu();
      visiveis = obterLinhas(colunas, linhas, filtros, ordem);
      container.innerHTML = `<table class="consulta-table"><thead><tr>${colunas.map((coluna, i) => {
        const ordenada = ordem?.coluna === i;
        return `<th aria-sort="${ordenada ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}">
          <div class="consulta-coluna-cabecalho"><button type="button" data-ordenar="${i}" class="consulta-coluna-nome">${escapar(coluna.titulo)}${ordenada ? (ordem.direcao === 'asc' ? ' ↑' : ' ↓') : ''}</button>
          <button type="button" data-menu-coluna="${i}" class="consulta-coluna-filtro${filtros[i] ? ' ativo' : ''}" aria-label="Filtrar ou ordenar ${escapar(coluna.titulo)}" aria-expanded="false">☷</button></div></th>`;
      }).join('')}</tr></thead><tbody>${visiveis.map((linha, indice) => `<tr${aoSelecionar ? ` class="consulta-produto-resultado${String(linha.CODPROD) === String(selecionado) ? ' is-selected' : ''}" tabindex="0" data-cod-prod="${escapar(linha.CODPROD)}" aria-label="Selecionar ${escapar(linha.CODPROD)} - ${escapar(linha.DESCRPROD)}"` : ''} data-linha="${indice}">${colunas.map((coluna) => `<td class="${coluna.numero ? 'numero' : ''}">${escapar(texto(coluna, linha))}</td>`).join('')}</tr>`).join('')}
        ${!visiveis.length ? `<tr><td colspan="${colunas.length}">Nenhum resultado para os filtros selecionados.</td></tr>` : ''}</tbody></table>`;
      container.querySelectorAll('[data-ordenar]').forEach((botao) => botao.addEventListener('click', () => {
        const coluna = Number(botao.dataset.ordenar);
        ordenar(coluna, ordem?.coluna === coluna && ordem.direcao === 'asc' ? 'desc' : 'asc');
        container.querySelector(`[data-ordenar="${coluna}"]`)?.focus();
      }));
      container.querySelectorAll('[data-menu-coluna]').forEach((botao) => botao.addEventListener('click', () => abrirMenu(botao, Number(botao.dataset.menuColuna))));
      if (aoSelecionar) container.querySelectorAll('[data-linha]').forEach((tr) => {
        const selecionar = () => {
          const linha = visiveis[Number(tr.dataset.linha)];
          selecionado = linha.CODPROD;
          container.querySelectorAll('[data-linha]').forEach((item) => item.classList.toggle('is-selected', item === tr));
          aoSelecionar(linha);
        };
        tr.addEventListener('click', selecionar);
        tr.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selecionar(); }
        });
      });
    }

    function ordenar(coluna, direcao) {
      ordem = { coluna, direcao };
      desenhar();
    }

    function filtrar(coluna, valores) {
      filtros[coluna] = valores === null ? null : new Set(valores);
      desenhar();
    }

    function abrirMenu(botao, indice) {
      const estavaAberto = botao.getAttribute('aria-expanded') === 'true';
      fecharMenu();
      if (estavaAberto) return;
      const menu = document.createElement('div');
      menu.className = 'consulta-coluna-menu';
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', `Opções de ${colunas[indice].titulo}`);
      menu.innerHTML = `<button type="button" data-ordem="asc">↑ Ordenar Ascendente</button>
        <button type="button" data-ordem="desc">↓ Ordenar Descendente</button>
        <button type="button" data-abrir-filtro aria-expanded="false">☷ Filtrar</button>
        <button type="button" data-limpar-filtro>Limpar filtro desta coluna</button>
        <div class="consulta-coluna-opcoes" hidden></div>`;
      document.body.appendChild(menu);
      botao.setAttribute('aria-expanded', 'true');
      const rect = botao.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - Math.min(420, window.innerHeight - 16) - 8))}px`;
      const aoClicarFora = (event) => { if (!menu.contains(event.target) && !botao.contains(event.target)) fecharMenu(); };
      const aoTeclar = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); fecharMenu(); botao.focus(); }
      };
      const aoRolar = (event) => { if (!menu.contains(event.target)) fecharMenu(); };
      fecharMenuAtual = () => {
        menu.remove();
        botao.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', aoClicarFora, true);
        document.removeEventListener('keydown', aoTeclar, true);
        document.removeEventListener('scroll', aoRolar, true);
        window.removeEventListener('resize', fecharMenu);
        fecharMenuAtual = null;
      };
      document.addEventListener('pointerdown', aoClicarFora, true);
      document.addEventListener('keydown', aoTeclar, true);
      document.addEventListener('scroll', aoRolar, true);
      window.addEventListener('resize', fecharMenu);
      menu.querySelectorAll('[data-ordem]').forEach((item) => item.addEventListener('click', () => {
        ordenar(indice, item.dataset.ordem);
        container.querySelector(`[data-menu-coluna="${indice}"]`)?.focus();
      }));
      menu.querySelector('[data-limpar-filtro]').addEventListener('click', () => filtrar(indice, null));
      menu.querySelector('[data-abrir-filtro]').addEventListener('click', (event) => {
        const painel = menu.querySelector('.consulta-coluna-opcoes');
        painel.hidden = !painel.hidden;
        event.currentTarget.setAttribute('aria-expanded', String(!painel.hidden));
        if (painel.hidden) return;
        const valores = [...new Set(linhas.map((linha) => texto(colunas[indice], linha)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
        painel.innerHTML = `<input type="search" placeholder="Pesquisar valores" aria-label="Pesquisar valores desta coluna">
          <button type="button" data-aplicar>Aplicar filtro</button>
          <label><input type="checkbox" data-todos> Selecionar todos</label>
          <div class="consulta-coluna-valores">${valores.map((valor, i) => `<label><input type="checkbox" data-valor="${i}" ${!filtros[indice] || filtros[indice].has(valor) ? 'checked' : ''}> ${escapar(valor)}</label>`).join('')}</div>`;
        const pesquisa = painel.querySelector('input[type="search"]');
        const todos = painel.querySelector('[data-todos]');
        const opcoes = [...painel.querySelectorAll('[data-valor]')];
        const atualizarTodos = () => {
          const exibidos = opcoes.filter((opcao) => !opcao.parentElement.hidden);
          todos.checked = exibidos.length > 0 && exibidos.every((opcao) => opcao.checked);
          todos.indeterminate = !todos.checked && exibidos.some((opcao) => opcao.checked);
        };
        pesquisa.addEventListener('input', () => {
          opcoes.forEach((opcao) => { opcao.parentElement.hidden = !normalizar(valores[Number(opcao.dataset.valor)]).includes(normalizar(pesquisa.value.trim())); });
          atualizarTodos();
        });
        todos.addEventListener('change', () => {
          opcoes.filter((opcao) => !opcao.parentElement.hidden).forEach((opcao) => { opcao.checked = todos.checked; });
          atualizarTodos();
        });
        opcoes.forEach((opcao) => opcao.addEventListener('change', atualizarTodos));
        painel.querySelector('[data-aplicar]').addEventListener('click', () => {
          const marcados = opcoes.filter((opcao) => opcao.checked && !opcao.parentElement.hidden).map((opcao) => valores[Number(opcao.dataset.valor)]);
          filtrar(indice, marcados.length === valores.length ? null : marcados);
          container.querySelector(`[data-menu-coluna="${indice}"]`)?.focus();
        });
        atualizarTodos();
        pesquisa.focus();
      });
      menu.querySelector('button').focus();
    }

    desenhar();
    return { ordenar, filtrar, obterVisiveis: () => [...visiveis] };
  }

  return { criar, obterLinhas, comparar, fecharMenu };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ConsultaTabela;
