(function () {
  const $ = (id) => document.getElementById(id);
  const form = $('rastreio-produto-form');
  const status = $('rastreio-produto-status');
  const tbody = $('rastreio-produto-linhas');
  const anterior = $('rastreio-produto-anterior');
  const proxima = $('rastreio-produto-proxima');
  let filtros = null;
  let pagina = 1;
  let totalPaginas = 0;
  let carregando = false;
  let filtrosCarregados = false;
  let carregamentoFiltros = null;
  const filtrosColunas = {};
  const selecoes = {};
  let movimentacoes = [];
  const painel = $('rastreio-produto-painel');
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const numero = (value) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  const moeda = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tipos = { V: 'Venda', C: 'Compra', P: 'Pedido de venda', O: 'Pedido de compra', D: 'Devolução de venda', E: 'Devolução de compra', T: 'Transferência', J: 'Requisição', Q: 'Requisição', F: 'Produção' };
  const dataLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  $('rastreio-produto-final').value = dataLocal(hoje);
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 29);
  $('rastreio-produto-inicial').value = dataLocal(inicio);
  const camposColunas = ['colData', 'colMovimento', 'colDocumento', 'colTop', 'colEmpresa', 'colParceiro'];
  document.querySelectorAll('.rastreio-produto-table thead th').forEach((th, index) => {
    const titulo = th.textContent;
    const campo = camposColunas[index];
    th.innerHTML = `<div class="rastreio-produto-coluna"><span>${escape(titulo)}</span><details class="rastreio-produto-filtro"><summary aria-label="Filtrar ${escape(titulo)}" title="Filtrar ${escape(titulo)}">▽</summary><form data-coluna="${campo}"><label><input type="search" placeholder="Pesquisar" aria-label="Pesquisar valores de ${escape(titulo)}"></label><label class="rastreio-produto-selecionar"><input type="checkbox" data-todos> (Selecionar tudo)</label><div class="rastreio-produto-opcoes"></div><p class="rastreio-produto-filtro-status" role="status"></p><footer><button type="submit" data-ok>OK</button><button type="button" data-cancelar>Cancelar</button></footer></form></details></div>`;
    const details = th.querySelector('details');
    const pesquisa = th.querySelector('[type="search"]');
    const todos = th.querySelector('[data-todos]');
    const opcoes = th.querySelector('.rastreio-produto-opcoes');
    const feedback = th.querySelector('.rastreio-produto-filtro-status');
    const ok = th.querySelector('[data-ok]');
    let valores = [];
    let escolhidos = new Set();
    let pronto = false;
    let versao = 0;
    const visiveis = () => valores.filter((valor) => valor.toLocaleLowerCase('pt-BR').includes(pesquisa.value.toLocaleLowerCase('pt-BR')));
    const atualizarTodos = () => {
      const lista = visiveis();
      const quantidade = lista.filter((valor) => escolhidos.has(valor)).length;
      todos.checked = lista.length > 0 && quantidade === lista.length;
      todos.indeterminate = quantidade > 0 && quantidade < lista.length;
      todos.disabled = !pronto || !lista.length;
    };
    const renderOpcoes = () => {
      const termo = pesquisa.value.toLocaleLowerCase('pt-BR');
      opcoes.innerHTML = valores.map((valor, optionIndex) => ({ valor, optionIndex })).filter(({ valor }) => valor.toLocaleLowerCase('pt-BR').includes(termo)).map(({ valor, optionIndex }) => `<label><input type="checkbox" data-opcao="${optionIndex}" ${escolhidos.has(valor) ? 'checked' : ''}> <span>${escape(valor || '(Vazios)')}</span></label>`).join('');
      atualizarTodos();
    };
    pesquisa.addEventListener('input', renderOpcoes);
    todos.addEventListener('change', () => {
      visiveis().forEach((valor) => todos.checked ? escolhidos.add(valor) : escolhidos.delete(valor));
      renderOpcoes();
    });
    opcoes.addEventListener('change', (event) => {
      const input = event.target.closest('[data-opcao]');
      if (!input) return;
      const valor = valores[Number(input.dataset.opcao)];
      if (input.checked) escolhidos.add(valor); else escolhidos.delete(valor);
      atualizarTodos();
    });
    th.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (carregando || !pronto) return;
      const incluidos = valores.filter((valor) => escolhidos.has(valor));
      const excluidos = valores.filter((valor) => !escolhidos.has(valor));
      if (!excluidos.length) delete selecoes[campo];
      else selecoes[campo] = incluidos.length <= excluidos.length ? { modo: 'incluir', valores: incluidos } : { modo: 'excluir', valores: excluidos };
      details.classList.toggle('is-filtered', Boolean(selecoes[campo]));
      details.open = false;
      consultar(1);
    });
    th.querySelector('[data-cancelar]').addEventListener('click', () => { details.open = false; });
    details.addEventListener('toggle', async () => {
      const token = ++versao;
      if (!details.open) return;
      document.querySelectorAll('.rastreio-produto-filtro').forEach((other) => { if (other !== details) other.open = false; });
      pronto = false;
      valores = [];
      pesquisa.value = '';
      opcoes.innerHTML = '';
      ok.disabled = true;
      atualizarTodos();
      feedback.textContent = filtros ? 'Carregando valores...' : 'Realize a consulta primeiro.';
      if (!filtros || carregando) return;
      try {
        const response = await fetch('/api/produtos/rastreio/valores', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...filtros, ...filtrosColunas, selecoes, coluna: campo }) });
        const payload = await response.json();
        if (token !== versao || !details.open) return;
        if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar os valores.');
        valores = payload.valores;
        const atual = selecoes[campo];
        escolhidos = new Set(valores.filter((valor) => !atual || (atual.modo === 'incluir' ? atual.valores.includes(valor) : !atual.valores.includes(valor))));
        pronto = true;
        ok.disabled = false;
        feedback.textContent = valores.length ? '' : 'Nenhum valor disponível.';
        renderOpcoes();
        pesquisa.focus();
      } catch (error) {
        if (token === versao) feedback.textContent = error.message;
      }
    });
  });

  async function preparar() {
    if (filtrosCarregados) return;
    if (carregamentoFiltros) return carregamentoFiltros;
    carregamentoFiltros = (async () => {
      try {
        const response = await fetch('/api/produtos/rastreio/filtros', { credentials: 'same-origin' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar os filtros.');
        $('rastreio-produto-empresa').innerHTML = '<option value="">Todas as empresas</option>' + payload.empresas.map((item) => `<option value="${escape(item.CODEMP)}">${escape(item.CODEMP)} - ${escape(item.NOMEFANTASIA)}</option>`).join('');
        $('rastreio-produto-top').innerHTML = '<option value="">Todas as TOPs</option>' + payload.tops.map((item) => `<option value="${escape(item.CODTIPOPER)}">${escape(item.CODTIPOPER)} - ${escape(item.DESCROPER)}</option>`).join('');
        filtrosCarregados = true;
      } catch (error) {
        status.className = 'rastreio-produto-status is-error';
        status.textContent = error.message;
      } finally {
        carregamentoFiltros = null;
      }
    })();
    return carregamentoFiltros;
  }

  function atualizarBotoes() {
    form.querySelector('button').disabled = carregando;
    anterior.disabled = carregando || pagina <= 1;
    proxima.disabled = carregando || pagina >= totalPaginas;
    document.querySelectorAll('.rastreio-produto-filtro button').forEach((button) => { button.disabled = carregando; });
  }

  async function consultar(destino = 1) {
    if (carregando) return;
    carregando = true;
    atualizarBotoes();
    status.className = 'rastreio-produto-status is-loading';
    status.textContent = 'Consultando movimentações...';
    $('rastreio-produto-resultados').setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/produtos/rastreio', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...filtros, ...filtrosColunas, selecoes, pagina: destino, limite: 50 }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || 'Não foi possível consultar.');
      pagina = payload.pagina;
      totalPaginas = payload.totalPaginas;
      movimentacoes = payload.movimentacoes;
      status.textContent = `${payload.produto.CODPROD} - ${payload.produto.DESCRPROD} · ${numero(payload.total)} movimentações`;
      tbody.innerHTML = payload.movimentacoes.map((item, index) => {
        const data = String(item.DATA_MOVIMENTO || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, '$3/$2/$1');
        return `<tr class="rastreio-produto-row${index % 2 ? ' is-striped' : ''}" data-rastreio-detalhes="${index}">
          <td data-label="Data">${escape(data)}</td>
          <td data-label="Movimentação">${escape(tipos[item.TIPMOV] || item.TIPMOV)}</td>
          <td data-label="Nota / pedido"><button type="button" class="rastreio-produto-documento" aria-haspopup="dialog" aria-label="Detalhes do documento ${escape(item.NUMNOTA || item.NUNOTA)}">${escape(item.NUMNOTA || item.NUNOTA)}</button></td>
          <td data-label="TOP">${escape(item.CODTIPOPER)} - ${escape(item.DESCROPER || '—')}</td>
          <td data-label="Empresa">${escape(item.CODEMP)} - ${escape(item.EMPRESA || '—')}</td>
          <td data-label="Parceiro">${escape(item.CODPARC)} - ${escape(item.NOMEPARC || '—')}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="6">Nenhuma movimentação no período selecionado.</td></tr>';
      $('rastreio-produto-pagina').textContent = totalPaginas ? `Página ${pagina} de ${totalPaginas}` : 'Sem resultados';
    } catch (error) {
      status.className = 'rastreio-produto-status is-error';
      status.textContent = error.message;
    } finally {
      carregando = false;
      status.classList.remove('is-loading');
      $('rastreio-produto-resultados').setAttribute('aria-busy', 'false');
      atualizarBotoes();
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (carregando) return;
    const novosFiltros = Object.fromEntries(new FormData(form));
    if (JSON.stringify(novosFiltros) !== JSON.stringify(filtros)) {
      Object.keys(selecoes).forEach((campo) => delete selecoes[campo]);
      document.querySelectorAll('.rastreio-produto-filtro').forEach((details) => { details.classList.remove('is-filtered'); details.open = false; });
    }
    filtros = novosFiltros;
    consultar(1);
  });
  anterior.addEventListener('click', () => consultar(pagina - 1));
  proxima.addEventListener('click', () => consultar(pagina + 1));
  tbody.addEventListener('click', (event) => {
    const row = event.target.closest('[data-rastreio-detalhes]');
    if (!row) return;
    const item = movimentacoes[Number(row.dataset.rastreioDetalhes)];
    if (!item) return;
    const dataBr = (value) => String(value || '—').replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, '$3/$2/$1');
    const efeito = item.RESERVA === 'S' ? 'Reserva de estoque' : Number(item.ATUALESTOQUE) > 0 ? 'Entrada' : Number(item.ATUALESTOQUE) < 0 ? 'Saída' : 'Sem efeito no estoque';
    const dados = {
      'Movimentação': tipos[item.TIPMOV] || item.TIPMOV,
      'Nota / pedido': item.NUMNOTA || 'Sem número', 'Nº único': item.NUNOTA, 'Série': item.SERIENOTA || '—',
      'Situação': item.STATUSNOTA === 'L' ? 'Confirmado' : 'Pendente / não confirmado',
      'Data da movimentação': dataBr(item.DATA_MOVIMENTO), 'Data de negociação': dataBr(item.DATA_NEGOCIACAO),
      'TOP': `${item.CODTIPOPER} - ${item.DESCROPER || '—'}`, 'Empresa': `${item.CODEMP} - ${item.EMPRESA || '—'}`,
      'Parceiro': `${item.CODPARC} - ${item.NOMEPARC || '—'}`, 'Lote / controle': item.CONTROLE || '—',
      'Local / item': `${item.CODLOCALORIG} / ${item.SEQUENCIA}`, 'Quantidade': `${numero(item.QTDNEG)} ${item.CODVOL || ''}`,
      'Efeito no estoque': efeito, 'Valor unitário': moeda(item.VLRUNIT), 'Valor total': moeda(item.VLRTOT)
    };
    $('rastreio-produto-painel-dados').innerHTML = Object.entries(dados).map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('');
    painel.showModal();
  });
  $('rastreio-produto-painel-fechar').addEventListener('click', () => painel.close());
  painel.addEventListener('click', (event) => { if (event.target === painel) painel.close(); });
  window.rastreioProdutoController = { preparar };
  atualizarBotoes();
})();
