(function iniciarModuloVendasGerais() {
  const elementos = {
    screen: document.getElementById('vendas-gerais-screen'),
    menu: document.getElementById('home-nav-vendas-gerais'),
    form: document.getElementById('vendas-dashboard-form'),
    inicio: document.getElementById('vendas-data-inicial'),
    fim: document.getElementById('vendas-data-final'),
    empresa: document.getElementById('vendas-empresa'),
    atualizar: document.getElementById('vendas-atualizar'),
    status: document.getElementById('vendas-dashboard-status'),
    periodo: document.getElementById('vendas-dashboard-periodo'),
    valor: document.getElementById('vendas-kpi-valor'),
    pedidos: document.getElementById('vendas-kpi-pedidos'),
    ticket: document.getElementById('vendas-kpi-ticket'),
    clientes: document.getElementById('vendas-kpi-clientes'),
    vendedores: document.getElementById('vendas-kpi-vendedores'),
    faturados: document.getElementById('vendas-kpi-faturados'),
    conversao: document.getElementById('vendas-kpi-conversao'),
    mensal: document.getElementById('vendas-grafico-mensal'),
    statusChart: document.getElementById('vendas-grafico-status'),
    ranking: document.getElementById('vendas-ranking-vendedores'),
    grupos: document.getElementById('vendas-grafico-grupos'),
    empresas: document.getElementById('vendas-tabela-empresas')
  };

  let permitido = false;
  let empresasCarregadas = false;
  let codigoUsuarioAtual = null;

  function normalizarCodigoUsuario(codUsu) {
    if (codUsu === null || codUsu === undefined || codUsu === '') return null;
    const codigo = Number(codUsu);
    return Number.isInteger(codigo) && codigo >= 0 ? codigo : null;
  }

  function chavePermissao(codUsu) {
    const codigo = normalizarCodigoUsuario(codUsu);
    return codigo === null ? null : `vendas-gerais-permitido:${codigo}`;
  }

  function lerPermissaoDaSessao(codUsu) {
    const chave = chavePermissao(codUsu);
    if (!chave) return false;
    try {
      return sessionStorage.getItem(chave) === '1';
    } catch {
      return false;
    }
  }

  function gravarPermissaoDaSessao(codUsu, possuiAcesso) {
    const chave = chavePermissao(codUsu);
    if (!chave) return;
    try {
      if (possuiAcesso) sessionStorage.setItem(chave, '1');
      else sessionStorage.removeItem(chave);
    } catch {
      // A indisponibilidade do sessionStorage nao pode impedir a validacao no backend.
    }
  }

  function limparPermissoesArmazenadas() {
    try {
      for (let indice = sessionStorage.length - 1; indice >= 0; indice -= 1) {
        const chave = sessionStorage.key(indice);
        if (chave?.startsWith('vendas-gerais-permitido:')) sessionStorage.removeItem(chave);
      }
    } catch {
      // O logout continua valido mesmo quando o armazenamento do navegador falha.
    }
  }

  function html(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function moeda(valor, compacto = false) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      notation: compacto && Math.abs(Number(valor || 0)) >= 100000 ? 'compact' : 'standard',
      maximumFractionDigits: compacto ? 1 : 2
    });
  }

  function numero(valor, casas = 0) {
    return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  }

  function percentual(valor) {
    return `${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function dataHoje() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  }

  function dataInicialPadrao() {
    const data = new Date();
    data.setHours(0, 0, 0, 0);
    data.setDate(data.getDate() - 29);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  }

  function dataBr(valor) {
    const match = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(valor || '');
  }

  function rotuloMes(valor) {
    const match = String(valor || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return valor || '-';
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))).replace('.', '');
  }

  function vazio(elemento, mensagem) {
    if (elemento) elemento.innerHTML = `<div class="vendas-empty">${html(mensagem)}</div>`;
  }

  function renderizarMensal(meses) {
    if (!meses.length) { vazio(elementos.mensal, 'Nenhuma venda encontrada no período.'); return; }
    const largura = 820;
    const altura = 238;
    const margem = { top: 28, right: 25, bottom: 38, left: 52 };
    const areaW = largura - margem.left - margem.right;
    const areaH = altura - margem.top - margem.bottom;
    const maximo = Math.max(...meses.map((item) => Number(item.valor || 0)), 1);
    const x = (indice) => margem.left + (meses.length === 1 ? areaW / 2 : indice * areaW / (meses.length - 1));
    const y = (valor) => margem.top + areaH - Number(valor || 0) / maximo * areaH;
    const pontos = meses.map((item, indice) => `${x(indice)},${y(item.valor)}`).join(' ');
    const area = `${margem.left},${margem.top + areaH} ${pontos} ${x(meses.length - 1)},${margem.top + areaH}`;
    const grades = [0, .25, .5, .75, 1].map((parte) => {
      const linhaY = margem.top + areaH - parte * areaH;
      return `<line class="vendas-chart-grid" x1="${margem.left}" y1="${linhaY}" x2="${largura - margem.right}" y2="${linhaY}"/><text class="vendas-chart-label" x="${margem.left - 9}" y="${linhaY + 4}" text-anchor="end">${html(moeda(maximo * parte, true))}</text>`;
    }).join('');
    const passoRotulo = Math.max(1, Math.ceil(meses.length / 10));
    const labels = meses.map((item, indice) => (indice % passoRotulo === 0 || indice === meses.length - 1)
      ? `<text class="vendas-chart-label" x="${x(indice)}" y="${altura - 10}" text-anchor="middle">${html(rotuloMes(item.mes))}</text>`
      : '').join('');
    const dots = meses.map((item, indice) => {
      const mostrarValor = meses.length <= 8 || indice % passoRotulo === 0 || indice === meses.length - 1;
      return `<g><circle class="vendas-chart-dot" cx="${x(indice)}" cy="${y(item.valor)}" r="4.5"><title>${html(rotuloMes(item.mes))}: ${html(moeda(item.valor))} · ${numero(item.pedidos)} pedidos</title></circle>${mostrarValor ? `<text class="vendas-chart-value" x="${x(indice)}" y="${Math.max(12, y(item.valor) - 10)}" text-anchor="middle">${html(moeda(item.valor, true))}</text>` : ''}</g>`;
    }).join('');
    elementos.mensal.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de vendas mensais"><defs><linearGradient id="vendas-area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b8f79" stop-opacity=".24"/><stop offset="1" stop-color="#0b8f79" stop-opacity=".02"/></linearGradient></defs>${grades}<polygon class="vendas-chart-area" points="${area}"/><polyline class="vendas-chart-line" points="${pontos}"/>${dots}${labels}</svg>`;
  }

  const statusConfig = {
    FATURADO: { rotulo: 'Faturados', cor: '#087f6d' },
    LIBERADO: { rotulo: 'Liberados', cor: '#2f80d1' },
    EM_ATENDIMENTO: { rotulo: 'Em atendimento', cor: '#7957d5' },
    PENDENTE: { rotulo: 'Pendentes', cor: '#e2872b' },
    OUTROS: { rotulo: 'Outros', cor: '#8b99a2' }
  };

  function renderizarStatus(itens) {
    const total = itens.reduce((soma, item) => soma + Number(item.pedidos || 0), 0);
    if (!total) { vazio(elementos.statusChart, 'Nenhum pedido no período.'); return; }
    let acumulado = 0;
    const faixas = itens.map((item) => {
      const config = statusConfig[item.status] || statusConfig.OUTROS;
      const inicio = acumulado;
      acumulado += Number(item.pedidos || 0) / total * 100;
      return `${config.cor} ${inicio}% ${acumulado}%`;
    }).join(', ');
    const lista = itens.map((item) => {
      const config = statusConfig[item.status] || statusConfig.OUTROS;
      return `<div class="vendas-status-item"><i style="background:${config.cor}"></i><span>${html(config.rotulo)}</span><strong>${numero(item.pedidos)}</strong></div>`;
    }).join('');
    elementos.statusChart.innerHTML = `<div class="vendas-status-donut" style="background:conic-gradient(${faixas})"><div class="vendas-status-donut-center"><strong>${numero(total)}</strong><span>pedidos</span></div></div><div class="vendas-status-list">${lista}</div>`;
  }

  function renderizarRanking(itens) {
    if (!itens.length) { vazio(elementos.ranking, 'Nenhum vendedor encontrado.'); return; }
    elementos.ranking.innerHTML = itens.map((item) => `<div class="vendas-ranking-item"><span class="vendas-ranking-position">${item.posicao}</span><div class="vendas-ranking-copy"><strong title="${html(item.nome)}">${html(item.nome)}</strong><span>${numero(item.pedidos)} pedidos · ticket ${html(moeda(item.ticketMedio))}</span></div><span class="vendas-ranking-value">${html(moeda(item.valor, true))}</span></div>`).join('');
  }

  function renderizarGrupos(itens) {
    if (!itens.length) { vazio(elementos.grupos, 'Nenhum grupo encontrado.'); return; }
    const maior = Math.max(...itens.map((item) => Number(item.valor || 0)), 1);
    elementos.grupos.innerHTML = itens.slice(0, 8).map((item) => `<div class="vendas-group-row"><span class="vendas-group-name" title="${html(item.nome)}">${html(item.nome)}</span><strong class="vendas-group-value">${html(moeda(item.valor, true))}</strong><span class="vendas-group-track"><i style="width:${Math.max(2, Number(item.valor || 0) / maior * 100)}%"></i></span></div>`).join('');
  }

  function renderizarEmpresas(itens, valorTotal) {
    if (!itens.length) { elementos.empresas.innerHTML = '<tr><td colspan="6"><div class="vendas-empty">Nenhuma empresa com vendas no período.</div></td></tr>'; return; }
    elementos.empresas.innerHTML = itens.map((item) => {
      const participacao = valorTotal ? Number(item.valor || 0) / valorTotal * 100 : 0;
      return `<tr><td><span class="vendas-company-name"><i>${html(String(item.nome || 'E').charAt(0))}</i>${html(item.codEmp)} - ${html(item.nome)}</span></td><td>${numero(item.pedidos)}</td><td>${numero(item.clientes)}</td><td>${html(moeda(item.ticketMedio))}</td><td>${html(moeda(item.valor))}</td><td><span class="vendas-company-share"><i><span style="width:${Math.min(100, participacao)}%"></span></i>${percentual(participacao)}</span></td></tr>`;
    }).join('');
  }

  function renderizar(payload) {
    const resumo = payload.resumo || {};
    const faturados = (payload.status || []).find((item) => item.status === 'FATURADO')?.pedidos || 0;
    elementos.valor.textContent = moeda(resumo.valor);
    elementos.pedidos.textContent = `${numero(resumo.pedidos)} pedidos`;
    elementos.ticket.textContent = moeda(resumo.ticketMedio);
    elementos.clientes.textContent = numero(resumo.clientes);
    elementos.vendedores.textContent = `${numero(resumo.vendedores)} vendedores`;
    elementos.faturados.textContent = numero(faturados);
    elementos.conversao.textContent = `${percentual(resumo.pedidos ? faturados / resumo.pedidos * 100 : 0)} do total`;
    const nomeEmpresa = elementos.empresa.selectedOptions[0]?.textContent || 'Todas as empresas';
    elementos.periodo.textContent = `${dataBr(payload.periodo?.inicio)} a ${dataBr(payload.periodo?.fim)} · ${nomeEmpresa}`;
    renderizarMensal(payload.meses || []);
    renderizarStatus(payload.status || []);
    renderizarRanking(payload.vendedores || []);
    renderizarGrupos(payload.grupos || []);
    renderizarEmpresas(payload.empresas || [], Number(resumo.valor || 0));
    elementos.status.textContent = `Dados atualizados · consulta em ${Number(payload.consultaMs || 0).toLocaleString('pt-BR')} ms`;
    elementos.status.classList.remove('is-error');
  }

  async function verificarAcesso(usuarioOuCodigo = codigoUsuarioAtual) {
    const usuario = usuarioOuCodigo && typeof usuarioOuCodigo === 'object' ? usuarioOuCodigo : null;
    const codUsu = usuario ? usuario.codUsu : usuarioOuCodigo;
    const codigoAnterior = codigoUsuarioAtual;
    codigoUsuarioAtual = normalizarCodigoUsuario(codUsu);
    const mesmoUsuario = codigoUsuarioAtual !== null && codigoUsuarioAtual === codigoAnterior;
    const permissaoRestaurada = lerPermissaoDaSessao(codigoUsuarioAtual);
    const permissaoAssinada = usuario?.gruposConfirmados === true
      ? usuario?.permissoes?.vendasGerais === true
      : null;

    if (permissaoAssinada !== null) {
      permitido = permissaoAssinada;
      gravarPermissaoDaSessao(codigoUsuarioAtual, permitido);
      elementos.menu.hidden = !permitido;
      return permitido;
    }

    // Depois da primeira validacao positiva, a permissao visual permanece durante
    // toda a sessao deste usuario. As APIs continuam protegidas pelo backend.
    if (permissaoRestaurada || (mesmoUsuario && permitido)) {
      permitido = true;
      elementos.menu.hidden = false;
      return true;
    }

    permitido = false;
    elementos.menu.hidden = true;
    try {
      const resposta = await fetch('/api/vendas-gerais/acesso', { cache: 'no-store' });
      permitido = resposta.ok;
      gravarPermissaoDaSessao(codigoUsuarioAtual, permitido);
      elementos.menu.hidden = !permitido;
    } catch (erro) {
      console.error('Falha ao verificar acesso ao painel de vendas:', erro);
      permitido = false;
      elementos.menu.hidden = true;
    }
    return permitido;
  }

  async function carregarEmpresas() {
    if (empresasCarregadas) return;
    const resposta = await fetch('/api/vendas-gerais/empresas', { cache: 'no-store' });
    if (!resposta.ok) throw new Error('Não foi possível carregar as empresas.');
    const payload = await resposta.json();
    elementos.empresa.innerHTML = '<option value="">Todas as empresas</option>' + (payload.itens || []).map((item) => `<option value="${Number(item.codEmp)}">${Number(item.codEmp)} - ${html(item.nome)}</option>`).join('');
    empresasCarregadas = true;
  }

  async function carregar() {
    if (!permitido) throw new Error('Acesso restrito aos grupos Gerente e Diretoria.');
    elementos.screen.classList.add('is-loading');
    elementos.atualizar.disabled = true;
    elementos.atualizar.classList.add('is-loading');
    elementos.status.textContent = 'Atualizando indicadores de vendas...';
    elementos.status.classList.remove('is-error');
    try {
      const params = new URLSearchParams({ dataInicial: elementos.inicio.value, dataFinal: elementos.fim.value });
      if (elementos.empresa.value) params.set('empresa', elementos.empresa.value);
      const resposta = await fetch(`/api/vendas-gerais/dashboard?${params}`, { cache: 'no-store' });
      const payload = await resposta.json();
      if (!resposta.ok) throw new Error(payload.erro || 'Não foi possível carregar o painel.');
      renderizar(payload);
    } catch (erro) {
      elementos.status.textContent = erro.message;
      elementos.status.classList.add('is-error');
      throw erro;
    } finally {
      elementos.screen.classList.remove('is-loading');
      elementos.atualizar.disabled = false;
      elementos.atualizar.classList.remove('is-loading');
    }
  }

  async function preparar() {
    const hoje = dataHoje();
    if (!elementos.fim.value) elementos.fim.value = hoje;
    if (!elementos.inicio.value) elementos.inicio.value = dataInicialPadrao();
    await carregarEmpresas();
    await carregar();
  }

  function limparSessao() {
    limparPermissoesArmazenadas();
    permitido = false;
    empresasCarregadas = false;
    codigoUsuarioAtual = null;
    elementos.menu.hidden = true;
  }

  elementos.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    carregar().catch((erro) => console.error('Erro no painel de vendas:', erro));
  });

  window.vendasDashboardController = {
    get permitido() { return permitido; },
    verificarAcesso,
    preparar,
    limparSessao
  };
})();
