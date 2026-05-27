let periodoSelecionado = null;
let refreshLoop = null;
let relogioInterval = null;
let usuarioLogado = null;

const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginUsuario = document.getElementById('login-usuario');
const loginSenha = document.getElementById('login-senha');
const botaoToggleLoginSenha = document.getElementById('toggle-login-senha');
const loginSubmit = document.getElementById('login-submit');
const loginStatus = document.getElementById('login-status');
const homeScreen = document.getElementById('home-screen');
const conferenciaScreen = document.getElementById('conferencia-screen');
const acompanhamentoScreen = document.getElementById('acompanhamento-screen');
const filaScreen = document.getElementById('fila-screen');
const consultaProdutosScreen = document.getElementById('consulta-produtos-screen');
const filaContexto = document.getElementById('fila-contexto');
const inputDataInicial = document.getElementById('data-inicial');
const inputDataFinal = document.getElementById('data-final');
const inputEmpresaFiltro = document.getElementById('empresa-filtro');
const botaoAbrirConferencia = document.getElementById('abrir-conferencia');
const botaoAbrirAcompanhamento = document.getElementById('abrir-acompanhamento');
const botaoAbrirConsultaHome = document.getElementById('abrir-consulta-home');
const botaoExibirAcompanhamento = document.getElementById('exibir-acompanhamento');
const botaoVoltarHomeAcompanhamento = document.getElementById('voltar-home-acompanhamento');
const botaoVoltarHomeFila = document.getElementById('voltar-home-fila');
const filaDataInicial = document.getElementById('fila-data-inicial');
const filaDataFinal = document.getElementById('fila-data-final');
const filaEmpresa = document.getElementById('fila-empresa');
const filaUsuarioLogado = document.getElementById('fila-usuario-logado');
const homeUsuarioLogado = document.getElementById('home-usuario-logado');
const botaoLogout = document.getElementById('logout-button');
const botaoBuscarFilaConferencia = document.getElementById('buscar-fila-conferencia');
const filaEtapaPedidos = document.getElementById('fila-etapa-pedidos');
const filaEtapaConferencia = document.getElementById('fila-etapa-conferencia');
const filaPedidosLista = document.getElementById('fila-pedidos-lista');
const filaCountPedidos = document.getElementById('fila-count-pedidos');
const filaBuscaPedido = document.getElementById('fila-busca-pedido');
const pedidoPreview = document.getElementById('pedido-preview');
const pedidoPreviewTitulo = document.getElementById('pedido-preview-titulo');
const pedidoPreviewMeta = document.getElementById('pedido-preview-meta');
const pedidoPreviewValor = document.getElementById('pedido-preview-valor');
const pedidoPreviewItens = document.getElementById('pedido-preview-itens');
const pedidoPreviewUnidades = document.getElementById('pedido-preview-unidades');
const pedidoPreviewStatus = document.getElementById('pedido-preview-status');
const pedidoPreviewItensLista = document.getElementById('pedido-preview-itens-lista');
const botaoCancelarPreviewPedido = document.getElementById('cancelar-preview-pedido');
const botaoConfirmarPreviewPedido = document.getElementById('confirmar-preview-pedido');
const pedidoEmConferenciaCard = document.getElementById('pedido-em-conferencia-card');
const botaoVoltarListaFila = document.getElementById('voltar-lista-fila');
const produtoFotoTitulo = document.querySelector('#produto-foto-panel .produto-foto-head strong');
const produtoFotoLegenda = document.getElementById('produto-foto-legenda');
const produtoFotoFrame = document.getElementById('produto-foto-frame');
const pedidoConferenciaTitulo = document.getElementById('pedido-conferencia-titulo');
const pedidoConferenciaStatus = document.getElementById('pedido-conferencia-status');
const botaoAbrirConsultaProdutos = document.getElementById('abrir-consulta-produtos');
const scanCodigo = document.getElementById('scan-codigo');
const scanQtd = document.getElementById('scan-qtd');
const botaoScanAdicionar = document.getElementById('scan-adicionar');
const scanStatus = document.getElementById('scan-status');
const itensPendentesLista = document.getElementById('itens-pendentes-lista');
const itensConferidosLista = document.getElementById('itens-conferidos-lista');
const itensPendentesCount = document.getElementById('itens-pendentes-count');
const itensConferidosCount = document.getElementById('itens-conferidos-count');
const resumoItensOk = document.getElementById('resumo-itens-ok');
const resumoQtdOk = document.getElementById('resumo-qtd-ok');
const resumoFaltando = document.getElementById('resumo-faltando');
const resumoDivergencias = document.getElementById('resumo-divergencias');
const botaoConfirmarConferencia = document.getElementById('confirmar-conferencia');
const confirmarStatus = document.getElementById('confirmar-status');
const corteModal = document.getElementById('corte-modal');
const corteModalProduto = document.getElementById('corte-modal-produto');
const corteTotal = document.getElementById('corte-total');
const corteConferido = document.getElementById('corte-conferido');
const corteDisponivel = document.getElementById('corte-disponivel');
const corteQtd = document.getElementById('corte-qtd');
const corteStatus = document.getElementById('corte-status');
const botaoCancelarCorte = document.getElementById('cancelar-corte');
const botaoConfirmarCorte = document.getElementById('confirmar-corte');
const posConferenciaModal = document.getElementById('pos-conferencia-modal');
const posConferenciaTexto = document.getElementById('pos-conferencia-texto');
const volumePanel = document.getElementById('volume-panel');
const volumeQtd = document.getElementById('volume-qtd');
const volumeStatus = document.getElementById('volume-status');
const botaoImprimirEtiquetaVolume = document.getElementById('imprimir-etiqueta-volume');
const botaoVoltarListaPosConferencia = document.getElementById('voltar-lista-pos-conferencia');
const metricAndamento = document.getElementById('metric-andamento');
const metricAguardando = document.getElementById('metric-aguardando');
const metricConferidos = document.getElementById('metric-conferidos');
const metricTotalFaturado = document.getElementById('metric-total-faturado');
const metricRelogio = document.getElementById('metric-relogio');
const heroTitulo = document.getElementById('hero-titulo');
const heroPeriodo = document.getElementById('hero-periodo');
const countPendentes = document.getElementById('count-pendentes');
const countConferidos = document.getElementById('count-conferidos');
const consultaProdutoCodigo = document.getElementById('consulta-produto-codigo');
const botaoConsultaProdutoBuscar = document.getElementById('consulta-produto-buscar');
const consultaProdutoTitulo = document.getElementById('consulta-produto-titulo');
const consultaProdutoLegenda = document.getElementById('consulta-produto-legenda');
const consultaProdutoFoto = document.getElementById('consulta-produto-foto');
const consultaProdutoResumo = document.getElementById('consulta-produto-resumo');
const consultaProdutoDetalhes = document.getElementById('consulta-produto-detalhes');
const consultaProdutoStatus = document.getElementById('consulta-produto-status');
const consultaEstoqueStatus = document.getElementById('consulta-estoque-status');
let filaPedidos = [];
let pedidoSelecionado = null;
let pedidoPreviewSelecionado = null;
let itensPedidoPreview = [];
let itensPedidoSelecionado = [];
let itemCorteSelecionado = null;
let pedidoConcluido = null;
let volumePanelAberto = false;
let produtoFotoAtual = null;
let ordenacaoItens = { coluna: '', direcao: '' };
const itensGridMinimos = [34, 78, 210, 122, 148, 118];
const itensGridLarguras = [34, 92, 240, 142, 170, 132];

function aplicarLargurasGridItens() {
  document.documentElement.style.setProperty(
    '--itens-grid-columns',
    itensGridLarguras.map((largura) => `${largura}px`).join(' ')
  );
}

function escaparAtributo(valor) {
  return String(valor ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function configurarRedimensionamentoColunas(header) {
  header.querySelectorAll('.column-resizer').forEach((resizer) => {
    resizer.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const coluna = Number(resizer.dataset.colIndex);
      const inicioX = event.clientX;
      const larguraInicial = itensGridLarguras[coluna];
      document.body.classList.add('resizing-columns');

      const mover = (moveEvent) => {
        const delta = moveEvent.clientX - inicioX;
        itensGridLarguras[coluna] = Math.max(itensGridMinimos[coluna], larguraInicial + delta);
        aplicarLargurasGridItens();
      };

      const soltar = () => {
        document.body.classList.remove('resizing-columns');
        document.removeEventListener('mousemove', mover);
        document.removeEventListener('mouseup', soltar);
      };

      document.addEventListener('mousemove', mover);
      document.addEventListener('mouseup', soltar);
    });
  });
}

function fecharMenusOrdenacaoItens() {
  document.querySelectorAll('.itens-sort-menu.aberto').forEach((menu) => {
    menu.classList.remove('aberto');
  });
}

function compararItensPorColuna(a, b) {
  if (ordenacaoItens.coluna === 'produto') {
    const produtoA = Number(a.codProd || 0);
    const produtoB = Number(b.codProd || 0);
    return produtoA - produtoB;
  }

  return String(a.descrProd || '').localeCompare(String(b.descrProd || ''), 'pt-BR', {
    sensitivity: 'base',
    numeric: true
  });
}

function ordenarItens(itens) {
  if (!ordenacaoItens.coluna || !ordenacaoItens.direcao) {
    return [...itens];
  }

  return [...itens].sort((a, b) => {
    const comparacao = compararItensPorColuna(a, b);

    if (comparacao !== 0) {
      return ordenacaoItens.direcao === 'asc' ? comparacao : -comparacao;
    }

    return Number(a.sequencia || 0) - Number(b.sequencia || 0);
  });
}

aplicarLargurasGridItens();

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await fetchOriginal(...args);
  const url = String(args[0] || '');

  if (response.status === 401 && !url.includes('/api/auth/')) {
    mostrarLogin('Sessao expirada. Entre novamente.');
  }

  return response;
};

function formatarUsuarioLogado() {
  if (!usuarioLogado) return '-';
  return `${usuarioLogado.codUsu} - ${usuarioLogado.nome || 'Usuario'}`;
}

function temUsuarioLogado() {
  return usuarioLogado?.codUsu !== null && usuarioLogado?.codUsu !== undefined;
}

function atualizarUsuarioLogadoNaTela() {
  const texto = formatarUsuarioLogado();
  homeUsuarioLogado.textContent = texto;
  filaUsuarioLogado.textContent = texto;
}

function mostrarLogin(mensagem = '') {
  usuarioLogado = null;
  loginScreen.classList.add('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  loginStatus.textContent = mensagem;
  atualizarUsuarioLogadoNaTela();

  if (refreshLoop) {
    refreshLoop.stop();
    refreshLoop = null;
  }

  setTimeout(() => loginUsuario.focus(), 0);
}

async function carregarEmpresas() {
  try {
    const res = await fetch('/api/empresas');
    const payload = await res.json();
    const empresas = payload.itens || [];

    inputEmpresaFiltro.innerHTML = '<option value="">Todas as empresas</option>';
    filaEmpresa.innerHTML = '<option value="">Selecione a empresa</option>';

    empresas.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.codEmp;
      option.textContent = `${item.codEmp} - ${item.empresa}`;
      inputEmpresaFiltro.appendChild(option);

      const filaOption = document.createElement('option');
      filaOption.value = item.codEmp;
      filaOption.textContent = `${item.codEmp} - ${item.empresa}`;
      filaEmpresa.appendChild(filaOption);
    });

    atualizarTituloPainel();
  } catch (error) {
    console.error('Erro ao carregar empresas:', error);
    inputEmpresaFiltro.innerHTML = '<option value="">Todas as empresas</option>';
    filaEmpresa.innerHTML = '<option value="">Selecione a empresa</option>';
    atualizarTituloPainel();
  }
}

function obterDataHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function formatarData(dataISO) {
  if (!dataISO) return '-';

  const texto = String(dataISO);
  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    return `${dia}/${mes}/${ano}`;
  }

  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})/);
  if (sankhyaMatch) {
    const [, dia, mes, ano] = sankhyaMatch;
    return `${dia}/${mes}/${ano}`;
  }

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
}

function formatarDataHora(dataISO) {
  if (!dataISO) return '-';

  const texto = String(dataISO);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(texto)) {
    const dataComFuso = new Date(texto);
    if (!Number.isNaN(dataComFuso.getTime())) {
      return `${dataComFuso.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })} ${dataComFuso.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Cuiaba',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
  }

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})T? ?(\d{2})?:?(\d{2})?/);
  if (isoMatch) {
    const [, ano, mes, dia, hora = '00', minuto = '00'] = isoMatch;
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (sankhyaMatch) {
    const [, dia, mes, ano, hora = '00', minuto = '00'] = sankhyaMatch;
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  const data = new Date(texto);
  return Number.isNaN(data.getTime())
    ? '-'
    : `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
}

function formatarTempoMinutos(totalMinutos) {
  if (totalMinutos === null || totalMinutos === undefined) return '-';
  return `${Math.max(1, Number(totalMinutos) || 0)} min`;
}

function formatarResumoPedidoPainel(item) {
  const qtdItens = Number(item.QTD_ITENS || 0);
  const qtdTotal = Number(item.QTD_TOTAL || 0);

  if (!qtdItens && !qtdTotal) {
    return '-';
  }

  return `${formatarQuantidade(qtdItens)} itens / ${formatarQuantidade(qtdTotal)} un.`;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarPeriodo(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal) {
    return '-';
  }

  return `${formatarData(dataInicial)} ate ${formatarData(dataFinal)}`;
}

function obterNomeEmpresaSelecionada() {
  const optionSelecionada = inputEmpresaFiltro.options[inputEmpresaFiltro.selectedIndex];
  return optionSelecionada ? optionSelecionada.textContent : 'Todas as empresas';
}

function limparNomeEmpresaParaTitulo(nomeEmpresa) {
  return nomeEmpresa.replace(/^\s*\d+\s*-\s*/, '').trim();
}

function atualizarTituloPainel() {
  const empresaSelecionada = obterNomeEmpresaSelecionada();
  const empresaLimpa = limparNomeEmpresaParaTitulo(empresaSelecionada);

  heroTitulo.textContent = empresaSelecionada === 'Todas as empresas'
    ? 'Fila de Conferencia'
    : `Fila de Conferencia - ${empresaLimpa}`;

  heroTitulo.classList.remove('is-long', 'is-xlong');

  if (heroTitulo.textContent.length > 54) {
    heroTitulo.classList.add('is-xlong');
  } else if (heroTitulo.textContent.length > 40) {
    heroTitulo.classList.add('is-long');
  }
}

function formatarHoraAtual() {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function iniciarRelogio() {
  if (relogioInterval) {
    clearInterval(relogioInterval);
  }

  metricRelogio.textContent = formatarHoraAtual();
  relogioInterval = setInterval(() => {
    metricRelogio.textContent = formatarHoraAtual();
  }, 1000);
}

function minutosDesdeInicio(inicioISO) {
  if (!inicioISO) return 0;
  const inicio = new Date(inicioISO);
  if (Number.isNaN(inicio.getTime())) return 0;

  const agora = new Date();
  return Math.max(0, Math.floor((agora - inicio) / 60000));
}

function obterTimestamp(valor) {
  if (!valor) return 0;

  const texto = String(valor);
  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(texto).getTime();
  }

  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})/);
  if (sankhyaMatch) {
    const [, dia, mes, ano] = sankhyaMatch;
    return new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
  }

  const timestamp = new Date(texto).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function ordenarPorDataDesc(valorA, valorB, fallbackA = null, fallbackB = null) {
  const dataA = valorA ? obterTimestamp(valorA) : obterTimestamp(fallbackA);
  const dataB = valorB ? obterTimestamp(valorB) : obterTimestamp(fallbackB);
  return dataB - dataA;
}

function mostrarHome() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar o sistema.');
    return;
  }

  loginScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  homeScreen.classList.add('active');
}

function mostrarConferencia() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar o sistema.');
    return;
  }

  loginScreen.classList.remove('active');
  homeScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  conferenciaScreen.classList.add('active');
}

function mostrarAcompanhamento() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar o sistema.');
    return;
  }

  loginScreen.classList.remove('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  acompanhamentoScreen.classList.add('active');
}

function mostrarFila() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar o sistema.');
    return;
  }

  loginScreen.classList.remove('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  filaScreen.classList.add('active');
}

function mostrarConsultaProdutos() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar a consulta de produtos.');
    return;
  }

  loginScreen.classList.remove('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.add('active');
  consultaProdutoCodigo.focus();
}

function criarCard(item) {
  const div = document.createElement('div');

  let statusClass = 'status-aguardando';
  let mostrarTempo = false;

  if (
    item.STATUS_CONFERENCIA === 'EM ANDAMENTO' ||
    item.STATUS_CONFERENCIA === 'EM CONFERENCIA'
  ) {
    statusClass = 'status-andamento';
    mostrarTempo = true;
  }

  if (item.STATUS_CONFERENCIA === 'CONFERIDO') {
    statusClass = 'status-conferido';
  }

  const dataFormatada = formatarData(item.DTNEG);

  const valor = Number(item.VLRNOTA) || 0;
  const minutos = minutosDesdeInicio(item.DT_INICIO_CONFERENCIA);
  const mostrarTempoTotal = item.STATUS_CONFERENCIA === 'CONFERIDO';
  const resumoPedido = formatarResumoPedidoPainel(item);
  const conclusao = mostrarTempoTotal && item.DT_FIM_CONFERENCIA
    ? `Concluido: ${formatarDataHora(item.DT_FIM_CONFERENCIA)}`
    : '';

  div.className = `card-item ${statusClass}`;
  div.innerHTML = `
    <div class="nota-numero">Nota ${item.NUNOTA}</div>

    <div class="linha-flex">
      <div class="nota-info">
        <span>Data: ${dataFormatada}</span>
        <span>Valor: R$ ${valor.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}</span>
        <span>${resumoPedido}</span>
        ${conclusao ? `<span>${conclusao}</span>` : ''}
      </div>
    </div>

    <div class="linha-flex">
      <div class="empresa-nome">${item.EMPRESA || '-'}</div>
      <div class="conferente">
        ${mostrarTempoTotal ? `<div class="tempo-total">${formatarTempoMinutos(item.TEMPO_TOTAL_CONFERENCIA_MIN)}</div>` : ''}
        ${mostrarTempo ? `<div class="tempo-total tempo-total-andamento">${minutos} min</div>` : ''}
        <div>${item.NOME_CONFERENTE || '-'}</div>
      </div>
    </div>

    <div class="status-text">${item.STATUS_CONFERENCIA}</div>
  `;

  return div;
}

function renderizarEstadoVazio(container, mensagem) {
  container.innerHTML = `<div class="empty-state">${mensagem}</div>`;
}

function formatarQuantidade(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function formatarTipoEstoque(tipo) {
  const valor = String(tipo || '').trim().toUpperCase();
  if (valor === 'P') return 'Proprio';
  if (valor === 'T') return 'Terceiro';
  return valor || '-';
}

function calcularDiasAte(dataValor) {
  const timestamp = obterTimestamp(dataValor);
  if (!timestamp) return '-';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((timestamp - hoje.getTime()) / 86400000);
}

function normalizarQuantidade(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarCodigo(valor) {
  return String(valor || '').trim().toUpperCase();
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escaparJsString(valor) {
  return String(valor ?? '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function montarErroConfirmacao(payload) {
  const detalhes = Array.isArray(payload?.detalhesSankhya)
    ? payload.detalhesSankhya.filter(Boolean)
    : [];

  const detalheHtml = detalhes.length > 0
    ? `<div class="erro-detalhes">${detalhes.map((detalhe) => `<div>${escaparHtml(detalhe)}</div>`).join('')}</div>`
    : '';

  return `<span class="danger-text">${escaparHtml(payload?.erro || 'Erro ao confirmar conferencia')}</span>${detalheHtml}`;
}

function obterCodigosItem(item) {
  if (Array.isArray(item.codigosConferencia) && item.codigosConferencia.length > 0) {
    return item.codigosConferencia
      .map((entrada) => normalizarCodigo(entrada.codigo))
      .filter(Boolean);
  }

  return (item.codigos || []).map(normalizarCodigo).filter(Boolean);
}

function obterEntradaCodigoItem(item, codigo) {
  const codigoNormalizado = normalizarCodigo(codigo);
  const entradas = Array.isArray(item.codigosConferencia) && item.codigosConferencia.length > 0
    ? item.codigosConferencia
    : (item.codigos || []).map((valor) => ({
      codigo: valor,
      tipo: 'CODIGO_BARRAS',
      multiplicador: 1
    }));

  return entradas.find((entrada) => normalizarCodigo(entrada.codigo) === codigoNormalizado) || null;
}

function obterDescricaoEntradaCodigo(entrada) {
  if (!entrada) return 'codigo';
  if (entrada.tipo === 'UNIDADE_ALTERNATIVA') return entrada.descricao || 'unidade alternativa';
  if (entrada.tipo === 'REFERENCIA') return 'referencia';
  if (entrada.tipo === 'CODIGO_PRODUTO') return 'codigo do produto';
  return entrada.descricao || 'codigo de barras';
}

function itemEstaOk(item) {
  return quantidadeEfetivaItem(item) === item.qtdNeg;
}

function itemTemExcesso(item) {
  return item.qtdConferida > item.qtdNeg;
}

function quantidadeCortadaItem(item) {
  return Math.max(0, Number(item.qtdCortada) || 0);
}

function quantidadeEfetivaItem(item) {
  return Math.min(item.qtdNeg, Math.max(0, item.qtdConferida) + quantidadeCortadaItem(item));
}

function quantidadePendenteItem(item) {
  return Math.max(item.qtdNeg - quantidadeEfetivaItem(item), 0);
}

function obterClasseItem(item) {
  if (itemTemExcesso(item)) return 'excesso';
  if (itemEstaOk(item)) return 'ok';
  if (item.qtdConferida > 0) return 'parcial';
  return '';
}

function pedidoPodeIniciarConferencia(pedido) {
  return pedido?.STATUS_CONFERENCIA !== 'CONFERIDO';
}

function atualizarControlesConferencia() {
  const temPedido = Boolean(pedidoSelecionado);
  scanCodigo.disabled = !temPedido;
  scanQtd.disabled = !temPedido;
  botaoScanAdicionar.disabled = !temPedido;
}

function mostrarEtapaPedidosFila() {
  filaEtapaConferencia.classList.remove('active');
  filaEtapaPedidos.classList.add('active');
  filaScreen.classList.remove('conferencia-mode');
}

function mostrarEtapaConferenciaFila() {
  filaEtapaPedidos.classList.remove('active');
  filaEtapaConferencia.classList.add('active');
  filaScreen.classList.add('conferencia-mode');
}

function calcularResumoConferencia() {
  const totalItens = itensPedidoSelecionado.length;
  const itensOk = itensPedidoSelecionado.filter(itemEstaOk).length;
  const qtdEsperada = itensPedidoSelecionado.reduce((total, item) => total + item.qtdNeg, 0);
  const qtdConferida = itensPedidoSelecionado.reduce((total, item) => total + item.qtdConferida, 0);
  const qtdCortada = itensPedidoSelecionado.reduce((total, item) => total + quantidadeCortadaItem(item), 0);
  const faltando = itensPedidoSelecionado.reduce((total, item) => {
    return total + quantidadePendenteItem(item);
  }, 0);
  const divergencias = itensPedidoSelecionado.filter((item) => !itemEstaOk(item)).length;

  return {
    totalItens,
    itensOk,
    qtdEsperada,
    qtdConferida,
    qtdCortada,
    faltando,
    divergencias,
    pronto: totalItens > 0 && divergencias === 0
  };
}

function renderizarResumoConferencia() {
  const resumo = calcularResumoConferencia();

  resumoItensOk.textContent = `${resumo.itensOk}/${resumo.totalItens}`;
  resumoQtdOk.textContent = `${formatarQuantidade(resumo.qtdConferida)}/${formatarQuantidade(resumo.qtdEsperada)}${resumo.qtdCortada > 0 ? ` | corte ${formatarQuantidade(resumo.qtdCortada)}` : ''}`;
  resumoFaltando.textContent = formatarQuantidade(resumo.faltando);
  resumoDivergencias.textContent = resumo.divergencias;
  botaoConfirmarConferencia.disabled = !resumo.pronto || !pedidoSelecionado || !temUsuarioLogado();

  pedidoConferenciaStatus.textContent = pedidoSelecionado
    ? `${resumo.itensOk}/${resumo.totalItens} itens`
    : '-';
}

function renderizarConsultaVazia(mensagem = 'Digite o codigo do produto para visualizar o estoque.') {
  consultaProdutoTitulo.textContent = 'Produto';
  consultaProdutoLegenda.textContent = 'Informe um codigo para consultar.';
  consultaProdutoFoto.innerHTML = '<div class="consulta-empty">Sem produto selecionado.</div>';
  consultaProdutoResumo.innerHTML = `<div class="consulta-empty">${escaparHtml(mensagem)}</div>`;
  consultaProdutoDetalhes.innerHTML = '<div class="consulta-empty">Nenhum detalhe carregado.</div>';
  consultaProdutoStatus.textContent = 'Aguardando consulta';
  consultaEstoqueStatus.textContent = '0 registros';
}

function montarTabelaConsulta(colunas, linhas) {
  if (!linhas.length) {
    return '<div class="consulta-empty">Nenhum estoque ativo com saldo positivo.</div>';
  }

  const cabecalho = colunas
    .map((coluna) => `<th class="${coluna.numero ? 'numero' : ''}">${escaparHtml(coluna.titulo)}</th>`)
    .join('');
  const corpo = linhas
    .map((linha) => `
      <tr>
        ${colunas.map((coluna) => {
          const valor = coluna.render ? coluna.render(linha) : linha[coluna.campo];
          return `<td class="${coluna.numero ? 'numero' : ''}">${escaparHtml(valor ?? '-')}</td>`;
        }).join('')}
      </tr>
    `)
    .join('');

  return `<table class="consulta-table"><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
}

function renderizarConsultaProduto(payload) {
  const produto = payload.produto;
  const estoquePorEmpresa = payload.estoquePorEmpresa || [];
  const estoque = payload.estoque || [];

  consultaProdutoTitulo.textContent = `${produto.CODPROD} - ${produto.DESCRPROD || 'Produto'}`;
  consultaProdutoLegenda.textContent = `Grupo: ${produto.DESCRGRUPOPROD || produto.CODGRUPOPROD || '-'}`;
  consultaProdutoFoto.innerHTML = `
    <img
      src="/api/fila-conferencia/produtos/${Number(produto.CODPROD)}/foto?v=${Date.now()}"
      alt="Foto do produto ${escaparAtributo(produto.DESCRPROD || produto.CODPROD)}"
      loading="lazy"
    >
  `;
  const img = consultaProdutoFoto.querySelector('img');
  img.addEventListener('error', () => {
    consultaProdutoFoto.innerHTML = '<div class="consulta-empty">Foto nao cadastrada para este produto.</div>';
  }, { once: true });

  const colunasResumo = [
    { titulo: 'Referencia', render: () => produto.REFERENCIA || '-' },
    { titulo: 'Codigo', render: () => produto.CODPROD },
    { titulo: 'Descricao', render: () => produto.DESCRPROD || '-' },
    { titulo: 'Unidade', render: () => produto.CODVOL || '-' },
    ...estoquePorEmpresa.map((empresa) => ({
      titulo: empresa.NOMEEMPRESA || `Emp. ${empresa.CODEMP}`,
      numero: true,
      render: () => formatarQuantidade(empresa.DISPONIVEL)
    })),
    { titulo: 'Total estoque', numero: true, render: () => formatarQuantidade(estoquePorEmpresa.reduce((total, item) => total + Number(item.ESTOQUE || 0), 0)) },
    { titulo: 'Total disponivel', numero: true, render: () => formatarQuantidade(estoquePorEmpresa.reduce((total, item) => total + Number(item.DISPONIVEL || 0), 0)) }
  ];

  consultaProdutoResumo.innerHTML = montarTabelaConsulta(colunasResumo, [produto]);

  const colunasDetalhes = [
    { titulo: 'Cod. empresa', campo: 'CODEMP', numero: true },
    { titulo: 'Nome empresa', campo: 'NOMEEMPRESA' },
    { titulo: 'Local', campo: 'CODLOCAL', numero: true },
    { titulo: 'Descricao local', campo: 'DESCRLOCAL' },
    { titulo: 'Estoque', numero: true, render: (linha) => formatarQuantidade(linha.ESTOQUE) },
    { titulo: 'Reservado', numero: true, render: (linha) => formatarQuantidade(linha.RESERVADO) },
    { titulo: 'Controle', campo: 'CONTROLE' },
    { titulo: 'Disponivel', numero: true, render: (linha) => formatarQuantidade(linha.DISPONIVEL) },
    { titulo: 'Dt. Validade', render: (linha) => formatarData(linha.DTVAL) },
    { titulo: 'Tipo', render: (linha) => formatarTipoEstoque(linha.TIPO) },
    { titulo: 'Poder', render: (linha) => formatarTipoEstoque(linha.TIPO) },
    { titulo: 'Qtde de dias', numero: true, render: (linha) => calcularDiasAte(linha.DTVAL) }
  ];

  consultaProdutoDetalhes.innerHTML = montarTabelaConsulta(colunasDetalhes, estoque);
  consultaProdutoStatus.textContent = `${estoquePorEmpresa.length} empresas com estoque positivo`;
  consultaEstoqueStatus.textContent = `${estoque.length} registros`;
}

async function buscarConsultaProduto() {
  const codigo = consultaProdutoCodigo.value.trim();

  if (!codigo) {
    renderizarConsultaVazia('Informe um codigo, referencia ou codigo de barras.');
    consultaProdutoCodigo.focus();
    return;
  }

  botaoConsultaProdutoBuscar.disabled = true;
  consultaProdutoStatus.textContent = 'Consultando produto...';
  consultaProdutoResumo.innerHTML = '<div class="consulta-empty">Buscando informacoes de estoque...</div>';
  consultaProdutoDetalhes.innerHTML = '<div class="consulta-empty">Carregando detalhes...</div>';

  try {
    const res = await fetch(`/api/produtos/consulta?codigo=${encodeURIComponent(codigo)}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Produto nao encontrado');
    }

    renderizarConsultaProduto(payload);
  } catch (error) {
    consultaProdutoStatus.textContent = 'Erro na consulta';
    renderizarConsultaVazia(error.message);
  } finally {
    botaoConsultaProdutoBuscar.disabled = false;
  }
}

function abrirConsultaProdutos() {
  const url = `${window.location.pathname}${window.location.search}#consulta-produtos`;
  window.open(url, '_blank', 'noopener');
}

function abrirConsultaProdutosMesmaTela() {
  renderizarConsultaVazia();
  mostrarHomeESuspenderRefresh();
  mostrarConsultaProdutos();
  history.pushState({ tela: 'consulta-produtos' }, '', '#consulta-produtos');
}

function alternarVisibilidadeSenha() {
  const estaVisivel = loginSenha.type === 'text';
  loginSenha.type = estaVisivel ? 'password' : 'text';
  botaoToggleLoginSenha.setAttribute('aria-label', estaVisivel ? 'Mostrar senha' : 'Ocultar senha');
  botaoToggleLoginSenha.title = estaVisivel ? 'Mostrar senha' : 'Ocultar senha';
  botaoToggleLoginSenha.innerHTML = estaVisivel
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="3"></circle><path d="M4 4l16 16"></path></svg>';
  loginSenha.focus();
}

function renderizarFotoProdutoVazia(mensagem = 'Sem produto selecionado.') {
  produtoFotoAtual = null;
  if (produtoFotoTitulo) {
    produtoFotoTitulo.textContent = 'Produto selecionado';
  }
  if (produtoFotoLegenda) {
    produtoFotoLegenda.textContent = 'Clique em um item ou confira um produto.';
  }
  if (produtoFotoFrame) {
    produtoFotoFrame.innerHTML = `<div class="produto-foto-placeholder">${escaparHtml(mensagem)}</div>`;
  }
}

function mostrarFotoProduto(item, origem = 'selecionado') {
  if (!item || !produtoFotoFrame || !produtoFotoLegenda) {
    return;
  }

  const codProd = Number(item.codProd);
  if (!codProd) {
    renderizarFotoProdutoVazia('Produto sem codigo para buscar foto.');
    return;
  }

  const legendaOrigem = origem === 'ultimo' ? 'Produto conferido' : 'Produto selecionado';
  const descricao = `${item.codProd} - ${item.descrProd || 'Produto'}`;
  produtoFotoAtual = { codProd, origem };
  if (produtoFotoTitulo) {
    produtoFotoTitulo.textContent = legendaOrigem;
  }
  produtoFotoLegenda.textContent = descricao;
  produtoFotoFrame.innerHTML = `
    <img
      src="/api/fila-conferencia/produtos/${codProd}/foto?v=${Date.now()}"
      alt="Foto do produto ${escaparAtributo(descricao)}"
      loading="lazy"
    >
  `;

  const img = produtoFotoFrame.querySelector('img');
  img.addEventListener('error', () => {
    if (produtoFotoAtual?.codProd !== codProd) {
      return;
    }
    produtoFotoFrame.innerHTML = `<div class="produto-foto-placeholder">Foto nao cadastrada para ${escaparHtml(descricao)}.</div>`;
  }, { once: true });
}

function salvarProgressoConferencia() {
  if (!pedidoSelecionado || !temUsuarioLogado()) {
    return;
  }

  fetch('/api/fila-conferencia/progresso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      nunota: pedidoSelecionado.NUNOTA,
      nuconf: pedidoSelecionado.nuconf || pedidoSelecionado.NUCONFATUAL || null,
      itens: itensPedidoSelecionado.map((item) => ({
        sequencia: item.sequencia,
        qtdConferida: normalizarQuantidade(item.qtdConferida),
        qtdCortada: quantidadeCortadaItem(item)
      }))
    })
  }).catch((error) => {
    console.error('Erro ao salvar progresso da conferencia:', error);
  });
}

function criarLinhaItemConferencia(item, quantidade, classe, rotuloQuantidade, options = {}) {
  const row = document.createElement('div');
  row.className = `item-row ${classe}`;
  const descricao = escaparAtributo(item.descrProd);
  const codigoProduto = escaparAtributo(item.codProd);
  const codigoBarras = escaparAtributo(item.codigoBarras || '-');
  const unidade = escaparAtributo(item.codVol);
  const controle = escaparAtributo(item.controle || '-');
  const quantidadeTexto = rotuloQuantidade || formatarQuantidade(quantidade);
  const quantidadeComUnidade = `${quantidadeTexto} - ${item.codVol || '-'}`;
  row.innerHTML = `
    <div>${options.desfazer ? '<button class="item-action item-action-return" type="button" aria-label="Voltar item para conferencia" title="Voltar item para conferencia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 4 12l6 6"/><path d="M5 12h15"/></svg></button>' : ''}${options.cortar ? '<button class="item-action item-action-cut" type="button" aria-label="Cortar quantidade do item" title="Cortar quantidade do item"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5 19 19"/><path d="M8.5 15.5 19 5"/></svg></button>' : ''}</div>
    <div class="item-code" title="${codigoProduto}">${item.codProd}</div>
    <div class="item-name" title="${descricao}">${item.descrProd}</div>
    <div class="item-qtd" title="${escaparAtributo(quantidadeComUnidade)}">${quantidadeComUnidade}</div>
    <div class="item-unit" title="${controle}">${item.controle || '-'}</div>
    <div class="item-codes" title="${codigoBarras}">${item.codigoBarras || '-'}</div>
  `;

  if (options.desfazer) {
    row.querySelector('.item-action').addEventListener('click', (event) => {
      event.stopPropagation();
      desfazerConferenciaItem(item.sequencia);
    });
  }

  if (options.cortar) {
    row.querySelector('.item-action-cut').addEventListener('click', (event) => {
      event.stopPropagation();
      abrirModalCorte(item.sequencia);
    });
  }

  if (options.selecionavel !== false) {
    row.title = 'Clique para ver a foto do produto';
    row.addEventListener('click', () => mostrarFotoProduto(item, 'selecionado'));
  }

  return row;
}

function criarCabecalhoItens() {
  const header = document.createElement('div');
  header.className = 'itens-grid-header';
  const colunas = ['', 'Produto', 'Descricao (Produto)', 'Quantidade', 'Controle', 'Cod. Barras'];
  header.innerHTML = colunas.map((coluna, index) => `
    <div class="itens-grid-col-header${index === 1 || index === 2 ? ' coluna-ordenavel' : ''}">
      <span>${coluna}</span>
      ${index === 1 || index === 2 ? `
        <button class="itens-sort-toggle" type="button" data-sort-coluna="${index === 1 ? 'produto' : 'descricao'}" aria-label="Ordenar ${coluna}" title="Ordenar ${coluna}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"/><path d="M4 12h7"/><path d="M4 17h4"/><path d="m17 6 3 3 3-3"/><path d="M20 9v9"/></svg>
        </button>
        <div class="itens-sort-menu">
          <button type="button" data-sort-direcao="asc"><span aria-hidden="true">A-Z</span> Ordenar Ascendente</button>
          <button type="button" data-sort-direcao="desc"><span aria-hidden="true">Z-A</span> Ordenar Descendente</button>
        </div>
      ` : ''}
      <button class="column-resizer" type="button" data-col-index="${index}" aria-label="Redimensionar coluna ${coluna || 'acao'}"></button>
    </div>
  `).join('');
  configurarRedimensionamentoColunas(header);

  header.querySelectorAll('.itens-sort-toggle').forEach((sortToggle) => {
    const sortMenu = sortToggle.parentElement.querySelector('.itens-sort-menu');
    sortToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const menuAberto = sortMenu.classList.contains('aberto');
      fecharMenusOrdenacaoItens();
      sortMenu.classList.toggle('aberto', !menuAberto);
    });

    sortMenu.querySelectorAll('[data-sort-direcao]').forEach((botao) => {
      botao.addEventListener('click', (event) => {
        event.stopPropagation();
        ordenacaoItens = {
          coluna: sortToggle.dataset.sortColuna,
          direcao: botao.dataset.sortDirecao
        };
        fecharMenusOrdenacaoItens();
        renderizarItensConferencia();
      });
    });
  });

  return header;
}

function renderizarItensPlanilha(container, itens, modo = 'preview') {
  container.innerHTML = '';
  container.appendChild(criarCabecalhoItens());

  if (itens.length === 0) {
    renderizarEstadoVazio(container, 'Nenhum item encontrado para este pedido.');
    return;
  }

  ordenarItens(itens).forEach((item) => {
    const quantidade = modo === 'preview' ? item.qtdNeg : item.qtdConferida;
    container.appendChild(criarLinhaItemConferencia(
      item,
      quantidade,
      '',
      formatarQuantidade(quantidade),
      { selecionavel: false }
    ));
  });
}

function renderizarItensConferencia() {
  itensPendentesLista.innerHTML = '';
  itensConferidosLista.innerHTML = '';

  if (!pedidoSelecionado) {
    itensPendentesCount.textContent = '0 itens';
    itensConferidosCount.textContent = '0 itens';
    renderizarEstadoVazio(itensPendentesLista, 'Selecione um pedido para ver os itens.');
    renderizarEstadoVazio(itensConferidosLista, 'Nenhum item conferido.');
    renderizarResumoConferencia();
    return;
  }

  let totalPendentes = 0;
  let totalConferidos = 0;

  itensPendentesLista.appendChild(criarCabecalhoItens());
  itensConferidosLista.appendChild(criarCabecalhoItens());

  ordenarItens(itensPedidoSelecionado).forEach((item) => {
    const quantidadeConferida = Math.max(0, item.qtdConferida);
    const quantidadeCortada = quantidadeCortadaItem(item);
    const quantidadePendente = quantidadePendenteItem(item);

    if (quantidadePendente > 0) {
      totalPendentes += 1;
      itensPendentesLista.appendChild(criarLinhaItemConferencia(
        item,
        quantidadePendente,
        quantidadeConferida > 0 || quantidadeCortada > 0 ? 'parcial' : '',
        `${formatarQuantidade(quantidadePendente)} / ${formatarQuantidade(item.qtdNeg)}`,
        { cortar: true }
      ));
    }

    if (quantidadeCortada > 0 && quantidadePendente === 0 && quantidadeConferida === 0) {
      totalConferidos += 1;
      itensConferidosLista.appendChild(criarLinhaItemConferencia(
        item,
        quantidadeCortada,
        'cortado',
        `corte ${formatarQuantidade(quantidadeCortada)} / ${formatarQuantidade(item.qtdNeg)}`,
        { desfazer: true }
      ));
    }

    if (quantidadeConferida > 0) {
      totalConferidos += 1;
      itensConferidosLista.appendChild(criarLinhaItemConferencia(
        item,
        quantidadeConferida,
        itemTemExcesso(item) ? 'excesso' : (quantidadeCortada > 0 ? 'cortado' : 'ok'),
        `${formatarQuantidade(quantidadeConferida)} / ${formatarQuantidade(item.qtdNeg)}${quantidadeCortada > 0 ? ` | corte ${formatarQuantidade(quantidadeCortada)}` : ''}`,
        { desfazer: true }
      ));
    }
  });

  itensPendentesCount.textContent = `${totalPendentes} itens`;
  itensConferidosCount.textContent = `${totalConferidos} itens`;

  if (totalPendentes === 0) {
    renderizarEstadoVazio(itensPendentesLista, 'Todos os itens deste pedido foram conferidos.');
  }

  if (totalConferidos === 0) {
    renderizarEstadoVazio(itensConferidosLista, 'Nenhum item conferido.');
  }

  renderizarResumoConferencia();
}

function desfazerConferenciaItem(sequencia) {
  const item = itensPedidoSelecionado.find((candidate) => Number(candidate.sequencia) === Number(sequencia));
  if (!item) {
    return;
  }

  const quantidadeAnterior = item.qtdConferida;
  item.qtdConferida = 0;
  const corteAnterior = quantidadeCortadaItem(item);
  item.qtdCortada = 0;
  scanStatus.innerHTML = `<span class="success-text">${item.codProd} voltou para itens em conferencia. Conferido removido: ${formatarQuantidade(quantidadeAnterior)}${corteAnterior > 0 ? ` | corte removido: ${formatarQuantidade(corteAnterior)}` : ''}.</span>`;
  renderizarItensConferencia();
  salvarProgressoConferencia();
  scanCodigo.focus();
}

function abrirModalCorte(sequencia) {
  const item = itensPedidoSelecionado.find((candidate) => Number(candidate.sequencia) === Number(sequencia));
  if (!item) {
    return;
  }

  const disponivel = quantidadePendenteItem(item);
  itemCorteSelecionado = item;
  corteModalProduto.textContent = `${item.codProd} - ${item.descrProd}`;
  corteTotal.textContent = formatarQuantidade(item.qtdNeg);
  corteConferido.textContent = formatarQuantidade(item.qtdConferida);
  corteDisponivel.textContent = formatarQuantidade(disponivel);
  corteQtd.max = String(disponivel);
  corteQtd.value = String(disponivel || 1);
  corteStatus.textContent = '';
  corteModal.hidden = false;
  setTimeout(() => {
    corteQtd.focus();
    corteQtd.select();
  }, 0);
}

function fecharModalCorte() {
  itemCorteSelecionado = null;
  corteModal.hidden = true;
  corteStatus.textContent = '';
}

function confirmarCorteItem() {
  if (!itemCorteSelecionado) {
    return;
  }

  const quantidade = Number(corteQtd.value);
  const disponivel = quantidadePendenteItem(itemCorteSelecionado);

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    corteStatus.innerHTML = '<span class="danger-text">Informe uma quantidade valida para corte.</span>';
    return;
  }

  if (quantidade > disponivel) {
    corteStatus.innerHTML = `<span class="danger-text">A quantidade maxima para corte e ${formatarQuantidade(disponivel)}.</span>`;
    return;
  }

  itemCorteSelecionado.qtdCortada = quantidadeCortadaItem(itemCorteSelecionado) + quantidade;
  scanStatus.innerHTML = `<span class="success-text">${itemCorteSelecionado.codProd} cortado: ${formatarQuantidade(itemCorteSelecionado.qtdCortada)} de ${formatarQuantidade(itemCorteSelecionado.qtdNeg)}.</span>`;
  fecharModalCorte();
  renderizarItensConferencia();
  salvarProgressoConferencia();
  scanCodigo.focus();
}

function abrirModalPosConferencia(pedido) {
  pedidoConcluido = pedido;
  volumePanelAberto = false;
  volumePanel.classList.remove('active');
  volumeQtd.value = '1';
  volumeStatus.textContent = '';
  botaoImprimirEtiquetaVolume.textContent = 'Imprimir etiqueta';
  posConferenciaTexto.textContent = `Pedido ${pedido.NUNOTA} conferido com sucesso.`;
  posConferenciaModal.hidden = false;
}

function abrirModalEtiquetaPedido(pedido) {
  pedidoConcluido = pedido;
  volumePanelAberto = true;
  volumePanel.classList.add('active');
  volumeQtd.value = String(Math.max(1, Number(pedido.QTDVOL || 1)));
  volumeStatus.textContent = '';
  botaoImprimirEtiquetaVolume.textContent = 'Gerar etiqueta';
  posConferenciaTexto.textContent = `Informe a quantidade de volumes para imprimir as etiquetas do pedido ${pedido.NUNOTA}.`;
  posConferenciaModal.hidden = false;
  setTimeout(() => {
    volumeQtd.focus();
    volumeQtd.select();
  }, 0);
}

function fecharModalPosConferenciaEVoltar() {
  posConferenciaModal.hidden = true;
  volumeStatus.textContent = '';
  volumePanel.classList.remove('active');
  pedidoConcluido = null;
  buscarFilaConferencia();
}

function montarHtmlEtiquetas(etiqueta, volumes) {
  const nomeTexto = `${etiqueta.nomeParc || etiqueta.razaoSocial || '-'} (${etiqueta.codParc || '-'})`;
  const razaoTexto = etiqueta.razaoSocial || etiqueta.nomeParc || '-';
  const nomeParc = escaparHtml(nomeTexto);
  const razaoSocial = escaparHtml(razaoTexto);
  const classeNome = nomeTexto.length > 46 ? 'fit-xsmall' : nomeTexto.length > 28 ? 'fit-small' : '';
  const classeRazao = razaoTexto.length > 46 ? 'fit-xsmall' : razaoTexto.length > 34 ? 'fit-small' : '';
  const cidadeUf = escaparHtml([etiqueta.cidade, etiqueta.uf].filter(Boolean).join('-') || '-');
  const endereco = escaparHtml(etiqueta.endereco || '-');
  const transportadora = escaparHtml(etiqueta.transportadora || 'TRANSPORTADORA NAO INFORMADA');
  const pedido = escaparHtml(etiqueta.nunota || '-');

  const paginas = Array.from({ length: volumes }, (_, index) => {
    const volumeAtual = index + 1;
    return `
      <section class="label">
        <div class="top">
          <div class="icon-box package-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/>
              <path d="M4 7.5 12 12l8-4.5"/>
              <path d="M12 12v9"/>
            </svg>
          </div>
          <div class="pedido-area">
            <div class="section-label">Pedido</div>
            <div class="pedido-numero">${pedido}</div>
            <div class="pedido-info">Informacao consta no rodape da NF-e</div>
          </div>
          <div class="separator"></div>
          <div class="volume-area">
            <div class="section-label">Volume</div>
            <div class="volume-big">${volumes}</div>
          </div>
          <div class="separator small"></div>
          <div class="volume-text">Vol: ${volumeAtual}</div>
        </div>

        <div class="cliente">
          <div class="icon-box inverse user-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 21c.8-4.5 4-7 8-7s7.2 2.5 8 7z"/>
            </svg>
          </div>
          <div class="cliente-texto">
            <div class="section-label inverse-label">Destino</div>
            <strong class="${classeNome}">${nomeParc}</strong>
            <em class="${classeRazao}">${razaoSocial}</em>
          </div>
        </div>

        <div class="endereco-bloco">
          <div class="icon-box pin-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 22s7-7.1 7-13a7 7 0 0 0-14 0c0 5.9 7 13 7 13z"/>
              <circle cx="12" cy="9" r="2.6"/>
            </svg>
          </div>
          <div class="endereco-texto">
            <div class="section-label">Endereco</div>
            <div class="endereco">${endereco}</div>
            <div class="cidade">${cidadeUf}</div>
          </div>
        </div>

        <div class="transportadora-bloco">
          <div class="icon-box truck-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 7h11v9H3z"/>
              <path d="M14 10h3l3 3v3h-6z"/>
              <circle cx="7" cy="18" r="2"/>
              <circle cx="17" cy="18" r="2"/>
            </svg>
          </div>
          <div>
            <div class="section-label">Transportadora</div>
            <div class="transportadora">${transportadora}</div>
          </div>
        </div>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas pedido ${pedido}</title>
  <style>
    @page { size: 100mm 50mm; margin: 0; }
    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { margin: 0; background: #eee; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label {
      width: 100mm;
      height: 50mm;
      padding: 1.6mm 3mm 1.4mm;
      background: #fff;
      border: 0.45mm solid #000;
      border-radius: 2.6mm;
      page-break-after: always;
      overflow: hidden;
    }
    .top {
      display: grid;
      grid-template-columns: 8mm 42mm 0.3mm 20mm 0.3mm 15mm;
      align-items: center;
      gap: 1.7mm;
      height: 10.8mm;
    }
    .icon-box {
      width: 7mm;
      height: 7mm;
      border-radius: 1.5mm;
      background: #000 !important;
      color: #fff !important;
      display: grid;
      place-items: center;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .icon-box svg {
      width: 4.8mm;
      height: 4.8mm;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .icon-box.inverse {
      background: #fff !important;
      color: #000 !important;
    }
    .user-icon svg { fill: currentColor; stroke: none; }
    .truck-icon svg { width: 5.4mm; height: 5.4mm; }
    .section-label {
      font-size: 6pt;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 900;
    }
    .pedido-numero {
      font-size: 23pt;
      line-height: 0.86;
      font-weight: 900;
      letter-spacing: 0;
    }
    .pedido-info {
      margin-top: 0.3mm;
      color: #3d3d3d;
      font-size: 4.7pt;
      font-weight: 800;
      white-space: nowrap;
    }
    .separator {
      width: 0.3mm;
      height: 9.2mm;
      background: #999;
    }
    .separator.small { height: 8.8mm; }
    .volume-area .section-label { margin-bottom: 0.4mm; }
    .volume-big {
      height: 7.5mm;
      border-radius: 1.3mm;
      background: #000 !important;
      color: #fff !important;
      display: grid;
      place-items: center;
      font-size: 21pt;
      line-height: 1;
      font-weight: 900;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .volume-text {
      font-size: 14pt;
      line-height: 1;
      font-weight: 900;
      white-space: nowrap;
    }
    .cliente {
      display: grid;
      grid-template-columns: 8mm minmax(0, 1fr);
      gap: 1.6mm;
      align-items: center;
      margin-top: 1.4mm;
      background: #000 !important;
      color: #fff !important;
      border-radius: 1.1mm;
      padding: 1mm 1.6mm;
      height: 11.6mm;
      overflow: hidden;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .cliente strong,
    .cliente em {
      display: block;
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
      transform-origin: left center;
    }
    .cliente strong {
      font-size: 10.2pt;
      line-height: 1;
      font-weight: 900;
    }
    .cliente em {
      margin-top: 0.65mm;
      font-size: 7.2pt;
      line-height: 1;
      font-weight: 900;
    }
    .cliente .fit-small { font-size: 8.8pt; }
    .cliente .fit-xsmall { font-size: 7.2pt; }
    .inverse-label {
      color: #fff !important;
      margin-bottom: 0.55mm;
    }
    .endereco-bloco {
      display: grid;
      grid-template-columns: 8mm minmax(0, 1fr);
      gap: 1.8mm;
      align-items: start;
      margin-top: 0.9mm;
      min-height: 12.2mm;
    }
    .endereco-texto { min-width: 0; }
    .endereco {
      margin-top: 0.45mm;
      font-size: 7.8pt;
      line-height: 1;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cidade {
      margin-top: 0.85mm;
      font-size: 16.7pt;
      line-height: 0.9;
      font-weight: 900;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
    }
    .transportadora-bloco {
      display: grid;
      grid-template-columns: 8mm minmax(0, 1fr);
      gap: 1.8mm;
      align-items: center;
      border-top: 0.25mm solid #999;
      padding-top: 0.65mm;
      margin-top: 0.15mm;
    }
    .transportadora {
      margin-top: 0.3mm;
      font-size: 9.8pt;
      line-height: 1;
      font-weight: 900;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media print {
      body { background: #fff; }
      .label { border: none; }
      .volume-big, .cliente, .icon-box { background: #000 !important; color: #fff !important; }
      .icon-box.inverse { background: #fff !important; color: #000 !important; }
    }
  </style>
</head>
<body>
  ${paginas}
  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}

async function imprimirEtiquetaVolume() {
  if (!pedidoConcluido) {
    return;
  }

  if (!volumePanelAberto) {
    volumePanelAberto = true;
    volumePanel.classList.add('active');
    botaoImprimirEtiquetaVolume.textContent = 'Gerar etiqueta';
    setTimeout(() => {
      volumeQtd.focus();
      volumeQtd.select();
    }, 0);
    return;
  }

  const volumes = Number(volumeQtd.value);
  if (!Number.isInteger(volumes) || volumes <= 0) {
    volumeStatus.innerHTML = '<span class="danger-text">Informe uma quantidade valida de volumes.</span>';
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    volumeStatus.innerHTML = '<span class="danger-text">O navegador bloqueou a aba de impressao.</span>';
    return;
  }

  printWindow.document.write('<p style="font-family:Arial;padding:16px">Gerando etiqueta...</p>');
  printWindow.document.close();
  volumeStatus.textContent = 'Gravando volumes e gerando etiqueta...';

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${pedidoConcluido.NUNOTA}/etiquetas-volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumes })
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao gerar etiqueta');
    }

    printWindow.document.open();
    printWindow.document.write(montarHtmlEtiquetas(payload.etiqueta, volumes));
    printWindow.document.close();
    volumeStatus.innerHTML = '<span class="success-text">Etiqueta gerada.</span>';
  } catch (error) {
    printWindow.close();
    volumeStatus.innerHTML = `<span class="danger-text">${escaparHtml(error.message)}</span>`;
  }
}

function renderizarPedidosFila() {
  filaPedidosLista.innerHTML = '';
  const pedidosFiltrados = filaPedidos;
  filaCountPedidos.textContent = pedidosFiltrados.length;

  if (pedidosFiltrados.length === 0) {
    const temBuscaPedido = Boolean(String(filaBuscaPedido?.value || '').trim());
    renderizarEstadoVazio(
      filaPedidosLista,
      filaPedidos.length === 0 && !temBuscaPedido
        ? 'Nenhum pedido aguardando conferencia para os filtros.'
        : 'Nenhum pedido encontrado com esse numero.'
    );
    return;
  }

  const header = document.createElement('div');
  header.className = 'pedido-list-header';
  header.innerHTML = `
    <div></div>
    <div>Pedido</div>
    <div>Data</div>
    <div>Cliente</div>
    <div>Valor</div>
    <div>Itens</div>
    <div>Status</div>
  `;
  filaPedidosLista.appendChild(header);

  pedidosFiltrados.forEach((pedido) => {
    const card = document.createElement('div');
    const emAndamento = pedido.STATUS_CONFERENCIA === 'EM ANDAMENTO';
    card.className = `pedido-operacao-card ${emAndamento ? 'andamento' : ''} ${pedidoSelecionado?.NUNOTA === pedido.NUNOTA ? 'active' : ''}`;
    card.innerHTML = `
      <div class="pedido-list-action">
        ${pedido.STATUS_CONFERENCIA === 'CONFERIDO'
          ? '<button class="pedido-label-button" type="button" aria-label="Gerar etiqueta de volume" title="Gerar etiqueta de volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V4h3"/><path d="M17 4h3v3"/><path d="M20 17v3h-3"/><path d="M7 20H4v-3"/><path d="M7 8h10v8H7z"/><path d="M9 11h6"/><path d="M9 14h4"/></svg></button>'
          : ''}
      </div>
      <strong>Pedido ${pedido.NUNOTA}</strong>
      <div class="pedido-meta">${formatarData(pedido.DTNEG)}</div>
      <div class="pedido-cliente" title="${pedido.EMPRESA || '-'}">${pedido.EMPRESA || '-'}</div>
      <div class="pedido-meta">${formatarMoeda(pedido.VLRNOTA)}</div>
      <div class="pedido-meta">${pedido.QTD_ITENS} | ${formatarQuantidade(pedido.QTD_TOTAL)} un.</div>
      <div class="pedido-list-status">
        ${emAndamento
        ? `<span class="pedido-status-mini">${pedido.NOME_CONFERENTE || 'Em andamento'}</span>`
          : pedido.STATUS_CONFERENCIA === 'CONFERIDO'
            ? '<span class="pedido-status-mini conferido">Conferido</span>'
          : '<span class="pedido-status-mini novo">Novo</span>'}
      </div>
    `;
    const botaoEtiqueta = card.querySelector('.pedido-label-button');
    if (botaoEtiqueta) {
      botaoEtiqueta.addEventListener('click', (event) => {
        event.stopPropagation();
        abrirModalEtiquetaPedido(pedido);
      });
    }
    card.addEventListener('click', () => abrirPreviewPedido(pedido));
    filaPedidosLista.appendChild(card);
  });
}

function renderizarPedidoEmConferencia() {
  if (!pedidoSelecionado) {
    renderizarEstadoVazio(pedidoEmConferenciaCard, 'Nenhum pedido selecionado.');
    return;
  }

  pedidoEmConferenciaCard.innerHTML = `
    <div class="pedido-operacao-card pedido-side-card active ${pedidoSelecionado.STATUS_CONFERENCIA === 'EM ANDAMENTO' ? 'andamento' : ''}">
      <strong>Pedido ${pedidoSelecionado.NUNOTA}</strong>
      <div class="pedido-side-meta">
        <span>${formatarData(pedidoSelecionado.DTNEG)}</span>
        <span>${formatarMoeda(pedidoSelecionado.VLRNOTA)}</span>
      </div>
      <div class="pedido-side-cliente">${pedidoSelecionado.EMPRESA || '-'}</div>
      <div class="pedido-side-meta">
        <span>${pedidoSelecionado.QTD_ITENS} itens</span>
        <span>${formatarQuantidade(pedidoSelecionado.QTD_TOTAL)} un.</span>
      </div>
      ${pedidoSelecionado.STATUS_CONFERENCIA === 'EM ANDAMENTO' ? '<span class="pedido-status-mini">Conferencia em andamento</span>' : ''}
    </div>
  `;
}

function fecharPreviewPedido() {
  pedidoPreviewSelecionado = null;
  itensPedidoPreview = [];
  pedidoPreview.hidden = true;
  pedidoPreviewItensLista.innerHTML = '';
}

function limparPedidoConferencia(mensagem = 'Selecione um pedido para iniciar.') {
  pedidoSelecionado = null;
  fecharPreviewPedido();
  itensPedidoSelecionado = [];
  pedidoConferenciaTitulo.textContent = 'Nenhum pedido selecionado';
  pedidoConferenciaStatus.textContent = '-';
  filaContexto.textContent = '-';
  scanStatus.textContent = mensagem;
  confirmarStatus.textContent = '';
  scanCodigo.value = '';
  scanQtd.value = '1';
  renderizarFotoProdutoVazia();
  atualizarControlesConferencia();
  renderizarItensConferencia();
  renderizarPedidosFila();
  renderizarPedidoEmConferencia();
}

async function buscarFilaConferencia() {
  const dataInicial = filaDataInicial.value || obterDataHoje();
  const dataFinal = filaDataFinal.value || dataInicial;
  const empresa = filaEmpresa.value.trim();
  const pedidoBusca = String(filaBuscaPedido.value || '').trim();

  if (pedidoBusca && !/^\d+$/.test(pedidoBusca)) {
    scanStatus.textContent = 'Informe apenas numeros para buscar o pedido.';
    return;
  }

  if (!empresa && !pedidoBusca) {
    scanStatus.textContent = 'Selecione uma empresa para buscar a fila.';
    return;
  }

  filaDataInicial.value = dataInicial <= dataFinal ? dataInicial : dataFinal;
  filaDataFinal.value = dataInicial <= dataFinal ? dataFinal : dataInicial;
  mostrarEtapaPedidosFila();
  limparPedidoConferencia('Buscando pedidos...');

  try {
    const params = new URLSearchParams({
      dataInicial: filaDataInicial.value,
      dataFinal: filaDataFinal.value
    });

    if (empresa) {
      params.set('empresa', empresa);
    }

    if (pedidoBusca) {
      params.set('pedido', pedidoBusca);
    }

    const res = await fetch(`/api/fila-conferencia/pedidos?${params.toString()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao buscar pedidos');
    }

    filaPedidos = payload.itens || [];
    scanStatus.textContent = pedidoBusca
      ? 'Pedido localizado. Selecione para visualizar os itens.'
      : 'Selecione um pedido para conferir.';
    renderizarPedidosFila();
  } catch (error) {
    console.error('Erro ao buscar fila de conferencia:', error);
    filaPedidos = [];
    renderizarPedidosFila();
    scanStatus.textContent = error.message;
  }
}

async function abrirPreviewPedido(pedido) {
  if (!temUsuarioLogado()) {
    scanStatus.textContent = 'Entre no sistema antes de visualizar o pedido.';
    return;
  }

  pedidoPreviewSelecionado = pedido;
  itensPedidoPreview = [];
  pedidoPreview.hidden = false;
  pedidoPreviewTitulo.textContent = `Pedido ${pedido.NUNOTA}`;
  pedidoPreviewMeta.textContent = `${formatarData(pedido.DTNEG)} | ${pedido.EMPRESA || '-'}`;
  pedidoPreviewValor.textContent = formatarMoeda(pedido.VLRNOTA);
  pedidoPreviewItens.textContent = pedido.QTD_ITENS;
  pedidoPreviewUnidades.textContent = formatarQuantidade(pedido.QTD_TOTAL);
  pedidoPreviewStatus.textContent = pedido.STATUS_CONFERENCIA === 'EM ANDAMENTO' ? 'Continuar' : 'Novo';
  pedidoPreviewStatus.textContent = pedido.STATUS_CONFERENCIA === 'CONFERIDO'
    ? 'Conferido'
    : pedidoPreviewStatus.textContent;
  botaoConfirmarPreviewPedido.disabled = !pedidoPodeIniciarConferencia(pedido);
  botaoConfirmarPreviewPedido.textContent = pedidoPodeIniciarConferencia(pedido)
    ? 'Iniciar conferencia'
    : 'Pedido ja conferido';
  renderizarEstadoVazio(pedidoPreviewItensLista, 'Carregando itens do pedido...');

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${pedido.NUNOTA}/itens`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao buscar itens');
    }

    itensPedidoPreview = payload.itens || [];
    renderizarItensPlanilha(pedidoPreviewItensLista, itensPedidoPreview);
  } catch (error) {
    console.error('Erro ao abrir preview do pedido:', error);
    renderizarEstadoVazio(pedidoPreviewItensLista, error.message);
  }
}

async function selecionarPedidoConferencia(pedido) {
  if (!temUsuarioLogado()) {
    scanStatus.textContent = 'Entre no sistema antes de iniciar a conferencia.';
    return;
  }

  pedidoSelecionado = pedido;
  itensPedidoSelecionado = [];
  confirmarStatus.textContent = '';
  scanStatus.textContent = 'Iniciando conferencia no Sankhya...';
  pedidoConferenciaTitulo.textContent = `Pedido ${pedido.NUNOTA}`;
  filaContexto.textContent = `Periodo ${formatarPeriodo(filaDataInicial.value, filaDataFinal.value)} | ${filaEmpresa.options[filaEmpresa.selectedIndex]?.textContent || '-'} | ${formatarUsuarioLogado()}`;
  atualizarControlesConferencia();
  renderizarPedidosFila();
  renderizarPedidoEmConferencia();

  try {
    const iniciarRes = await fetch('/api/fila-conferencia/iniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nunota: pedido.NUNOTA,
        codUsu: usuarioLogado.codUsu
      })
    });
    const iniciarPayload = await iniciarRes.json();

    if (!iniciarRes.ok) {
      throw new Error(iniciarPayload.erro || 'Erro ao iniciar conferencia');
    }

    pedidoSelecionado.nuconf = iniciarPayload.nuconf;
    mostrarEtapaConferenciaFila();
    scanStatus.textContent = 'Carregando itens do pedido...';

    const itensCarregados = pedidoPreviewSelecionado?.NUNOTA === pedido.NUNOTA && itensPedidoPreview.length > 0
      ? itensPedidoPreview
      : null;

    if (!itensCarregados) {
      const res = await fetch(`/api/fila-conferencia/pedidos/${pedido.NUNOTA}/itens`);
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.erro || 'Erro ao buscar itens');
      }

      itensPedidoPreview = payload.itens || [];
    }

    itensPedidoSelecionado = (itensCarregados || itensPedidoPreview || []).map((item) => ({
      ...item,
      qtdConferida: normalizarQuantidade(item.qtdConferida),
      qtdCortada: normalizarQuantidade(item.qtdCortada)
    }));
    fecharPreviewPedido();
    scanStatus.textContent = '';
    renderizarItensConferencia();
    scanCodigo.focus();
  } catch (error) {
    console.error('Erro ao selecionar pedido:', error);
    scanStatus.textContent = error.message;
    renderizarItensConferencia();
  }
}

function adicionarConferenciaPorCodigo() {
  const codigo = normalizarCodigo(scanCodigo.value);
  const qtd = Number(scanQtd.value || 1);

  if (!pedidoSelecionado || !codigo) {
    return;
  }

  if (!Number.isFinite(qtd) || qtd <= 0) {
    scanStatus.textContent = 'Informe uma quantidade valida.';
    return;
  }

  const itensCompativeis = itensPedidoSelecionado
    .map((candidate) => ({
      item: candidate,
      entrada: obterEntradaCodigoItem(candidate, codigo)
    }))
    .filter((candidate) => candidate.entrada);
  const match = itensCompativeis.find((candidate) => quantidadePendenteItem(candidate.item) > 0) || itensCompativeis[0];
  const item = match?.item;

  if (!item) {
    scanStatus.innerHTML = `<span class="danger-text">Codigo ${codigo} nao encontrado neste pedido.</span>`;
    scanCodigo.select();
    return;
  }

  const multiplicador = Math.max(0, Number(match.entrada.multiplicador) || 1);
  const qtdConvertida = qtd * multiplicador;
  const pendente = quantidadePendenteItem(item);

  if (qtdConvertida > pendente) {
    scanStatus.innerHTML = `<span class="danger-text">Quantidade maior que o pendente do item. Pendente: ${formatarQuantidade(pendente)}.</span>`;
    scanQtd.select();
    return;
  }

  item.qtdConferida += qtdConvertida;
  const detalheConversao = multiplicador !== 1
    ? ` (${formatarQuantidade(qtd)} x ${formatarQuantidade(multiplicador)} = ${formatarQuantidade(qtdConvertida)} un.)`
    : '';
  scanStatus.innerHTML = `<span class="success-text">${item.codProd} conferido por ${obterDescricaoEntradaCodigo(match.entrada)}${detalheConversao}: ${formatarQuantidade(item.qtdConferida)} de ${formatarQuantidade(item.qtdNeg)}.</span>`;
  mostrarFotoProduto(item, 'ultimo');
  scanCodigo.value = '';
  scanQtd.value = '1';
  renderizarItensConferencia();
  salvarProgressoConferencia();
  scanCodigo.focus();
}

async function confirmarConferencia() {
  if (!pedidoSelecionado) {
    return;
  }

  const resumo = calcularResumoConferencia();
  if (!resumo.pronto) {
    confirmarStatus.textContent = 'Ainda existem itens divergentes.';
    return;
  }

  if (!temUsuarioLogado()) {
    confirmarStatus.textContent = 'Entre no sistema antes de confirmar.';
    return;
  }

  botaoConfirmarConferencia.disabled = true;
  confirmarStatus.textContent = 'Confirmando conferencia no Sankhya...';

  try {
    const res = await fetch('/api/fila-conferencia/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nunota: pedidoSelecionado.NUNOTA,
        nuconf: pedidoSelecionado.nuconf,
        codUsu: usuarioLogado.codUsu,
        itens: itensPedidoSelecionado.map((item) => ({
          sequencia: item.sequencia,
          codProd: item.codProd,
          qtdConferida: item.qtdConferida,
          qtdCortada: quantidadeCortadaItem(item)
        }))
      })
    });
    const payload = await res.json();

    if (!res.ok) {
      confirmarStatus.innerHTML = montarErroConfirmacao(payload);
      renderizarResumoConferencia();
      return;
    }

    const pedidoFinalizado = { ...pedidoSelecionado };
    confirmarStatus.innerHTML = '<span class="success-text">Conferencia confirmada.</span>';
    filaPedidos = filaPedidos.filter((pedido) => pedido.NUNOTA !== pedidoSelecionado.NUNOTA);
    limparPedidoConferencia('Pedido conferido. Selecione o proximo pedido.');
    abrirModalPosConferencia(pedidoFinalizado);
  } catch (error) {
    console.error('Erro ao confirmar conferencia:', error);
    confirmarStatus.innerHTML = `<span class="danger-text">${error.message}</span>`;
    renderizarResumoConferencia();
  }
}

async function carregarFila() {
  if (!periodoSelecionado) {
    return;
  }

  try {
    const params = new URLSearchParams({
      dataInicial: periodoSelecionado.dataInicial,
      dataFinal: periodoSelecionado.dataFinal
    });

    if (periodoSelecionado.empresa) {
      params.set('empresa', periodoSelecionado.empresa);
    }

    const res = await fetch(`/api/conferencias?${params.toString()}`);
    const payload = await res.json();
    const dados = payload.itens || [];

    const poolPendentes = document.getElementById('pool-pendentes');
    const poolConferidos = document.getElementById('pool-conferidos');

    poolPendentes.innerHTML = '';
    poolConferidos.innerHTML = '';

    const emConferencia = dados
      .filter((d) =>
        d.STATUS_CONFERENCIA === 'EM ANDAMENTO' ||
        d.STATUS_CONFERENCIA === 'EM CONFERENCIA'
      )
      .sort((a, b) =>
        minutosDesdeInicio(b.DT_INICIO_CONFERENCIA) -
        minutosDesdeInicio(a.DT_INICIO_CONFERENCIA)
      );

    const aguardando = dados
      .filter((d) => d.STATUS_CONFERENCIA === 'AGUARDANDO CONFERENCIA')
      .sort((a, b) => obterTimestamp(a.DTNEG) - obterTimestamp(b.DTNEG));

    const conferidos = dados
      .filter((d) => d.STATUS_CONFERENCIA === 'CONFERIDO')
      .sort((a, b) => ordenarPorDataDesc(
        a.DT_FIM_CONFERENCIA,
        b.DT_FIM_CONFERENCIA,
        a.DTNEG,
        b.DTNEG
      ));

    metricAndamento.textContent = emConferencia.length;
    metricAguardando.textContent = aguardando.length;
    metricConferidos.textContent = conferidos.length;
    metricTotalFaturado.textContent = formatarMoeda(
      conferidos.reduce((total, item) => total + (Number(item.VLRNOTA) || 0), 0)
    );
    countPendentes.textContent = `${emConferencia.length + aguardando.length} pedidos`;
    countConferidos.textContent = `${conferidos.length} pedidos`;

    if (emConferencia.length === 0 && aguardando.length === 0) {
      renderizarEstadoVazio(poolPendentes, 'Nenhuma nota pendente no periodo selecionado.');
    } else {
      [...emConferencia, ...aguardando].forEach((item) => {
        poolPendentes.appendChild(criarCard(item));
      });
    }

    if (conferidos.length === 0) {
      renderizarEstadoVazio(poolConferidos, 'Nenhuma nota conferida no periodo selecionado.');
    } else {
      conferidos.forEach((item) => {
        poolConferidos.appendChild(criarCard(item));
      });
    }
  } catch (err) {
    console.error('Erro ao carregar fila:', err);
  }
}

function iniciarAutoRefresh() {
  if (refreshLoop) {
    refreshLoop.stop();
  }

  refreshLoop = createAsyncRefreshLoop(carregarFila, {
    intervalMs: 15000,
    onError(error) {
      console.error('Erro no refresh async da fila:', error);
    }
  });
  refreshLoop.start();
}

function abrirConferencia() {
  const dataInicial = inputDataInicial.value || obterDataHoje();
  const dataFinal = inputDataFinal.value || dataInicial;
  const empresa = inputEmpresaFiltro.value.trim();

  periodoSelecionado = dataInicial <= dataFinal
    ? { dataInicial, dataFinal, empresa }
    : { dataInicial: dataFinal, dataFinal: dataInicial, empresa };

  inputDataInicial.value = periodoSelecionado.dataInicial;
  inputDataFinal.value = periodoSelecionado.dataFinal;
  inputEmpresaFiltro.value = periodoSelecionado.empresa;
  atualizarTituloPainel();
  heroPeriodo.textContent = `Periodo: ${formatarPeriodo(
    periodoSelecionado.dataInicial,
    periodoSelecionado.dataFinal
  )}`;

  mostrarConferencia();
  history.pushState(
    {
      tela: 'painel-acompanhamento',
      periodoSelecionado
    },
    '',
    `#acompanhamento-painel`
  );
  iniciarAutoRefresh();
}

function mostrarHomeESuspenderRefresh() {
  mostrarHome();
  if (refreshLoop) {
    refreshLoop.stop();
    refreshLoop = null;
  }
}

function abrirAcompanhamento() {
  const hoje = obterDataHoje();
  inputDataInicial.value = hoje;
  inputDataFinal.value = hoje;
  inputEmpresaFiltro.value = '';
  atualizarTituloPainel();
  mostrarHomeESuspenderRefresh();
  mostrarAcompanhamento();
  history.pushState({ tela: 'acompanhamento' }, '', '#acompanhamento');
}

function abrirFila() {
  const hoje = obterDataHoje();
  filaDataInicial.value = filaDataInicial.value || hoje;
  filaDataFinal.value = filaDataFinal.value || hoje;
  limparPedidoConferencia();
  mostrarEtapaPedidosFila();
  mostrarHomeESuspenderRefresh();
  mostrarFila();
  history.pushState({ tela: 'fila' }, '', '#fila-conferencia');
}

function voltarParaHomeViaHistorico() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  mostrarHomeESuspenderRefresh();
}

function prepararTelaInicial() {
  const hoje = obterDataHoje();
  inputDataInicial.value = hoje;
  inputDataFinal.value = hoje;
  filaDataInicial.value = hoje;
  filaDataFinal.value = hoje;
  inputEmpresaFiltro.value = '';
  atualizarTituloPainel();
  heroPeriodo.textContent = `Periodo: ${formatarPeriodo(hoje, hoje)}`;
  limparPedidoConferencia();
}

async function prepararSessaoAutenticada(usuario) {
  usuarioLogado = usuario;
  atualizarUsuarioLogadoNaTela();
  prepararTelaInicial();
  await carregarEmpresas();
  if (window.location.hash === '#consulta-produtos') {
    renderizarConsultaVazia();
    mostrarConsultaProdutos();
    history.replaceState({ tela: 'consulta-produtos' }, '', '#consulta-produtos');
    return;
  }

  mostrarHome();
  history.replaceState({ tela: 'home' }, '', window.location.pathname + window.location.search);
}

async function autenticarUsuario(event) {
  event.preventDefault();
  loginStatus.textContent = '';
  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Entrando...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: loginUsuario.value.trim(),
        senha: loginSenha.value
      })
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Usuario ou senha invalidos');
    }

    loginSenha.value = '';
    await prepararSessaoAutenticada(payload.usuario);
  } catch (error) {
    loginStatus.textContent = error.message;
    loginSenha.select();
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Entrar';
  }
}

async function encerrarSessao() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Erro ao encerrar sessao:', error);
  }

  filaPedidos = [];
  limparPedidoConferencia();
  mostrarLogin('Sessao encerrada.');
  history.replaceState({ tela: 'login' }, '', window.location.pathname + window.location.search);
}

async function inicializarApp() {
  iniciarRelogio();

  try {
    const res = await fetch('/api/auth/me');
    const payload = await res.json();

    if (payload.autenticado && payload.usuario) {
      await prepararSessaoAutenticada(payload.usuario);
      return;
    }

    mostrarLogin();
    history.replaceState({ tela: 'login' }, '', window.location.pathname + window.location.search);
  } catch (error) {
    console.error('Erro ao verificar sessao:', error);
    mostrarLogin('Nao foi possivel verificar o login.');
  }
}

loginForm.addEventListener('submit', autenticarUsuario);
botaoToggleLoginSenha.addEventListener('click', alternarVisibilidadeSenha);
botaoLogout.addEventListener('click', encerrarSessao);
botaoAbrirConferencia.addEventListener('click', abrirFila);
botaoAbrirAcompanhamento.addEventListener('click', abrirAcompanhamento);
botaoAbrirConsultaHome.addEventListener('click', abrirConsultaProdutosMesmaTela);
botaoAbrirConsultaProdutos.addEventListener('click', abrirConsultaProdutos);
botaoConsultaProdutoBuscar.addEventListener('click', buscarConsultaProduto);
consultaProdutoCodigo.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    buscarConsultaProduto();
  }
});
botaoExibirAcompanhamento.addEventListener('click', abrirConferencia);
botaoVoltarHomeAcompanhamento.addEventListener('click', voltarParaHomeViaHistorico);
botaoVoltarHomeFila.addEventListener('click', voltarParaHomeViaHistorico);
botaoVoltarListaFila.addEventListener('click', () => {
  mostrarEtapaPedidosFila();
  limparPedidoConferencia('Selecione um pedido para iniciar.');
  buscarFilaConferencia();
});
botaoBuscarFilaConferencia.addEventListener('click', buscarFilaConferencia);
filaBuscaPedido.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    buscarFilaConferencia();
  }
});
botaoCancelarPreviewPedido.addEventListener('click', fecharPreviewPedido);
botaoConfirmarPreviewPedido.addEventListener('click', () => {
  if (pedidoPreviewSelecionado) {
    selecionarPedidoConferencia(pedidoPreviewSelecionado);
  }
});
pedidoPreview.addEventListener('click', (event) => {
  if (event.target === pedidoPreview) {
    fecharPreviewPedido();
  }
});
botaoCancelarCorte.addEventListener('click', fecharModalCorte);
botaoConfirmarCorte.addEventListener('click', confirmarCorteItem);
corteModal.addEventListener('click', (event) => {
  if (event.target === corteModal) {
    fecharModalCorte();
  }
});
corteQtd.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmarCorteItem();
  }
});
botaoImprimirEtiquetaVolume.addEventListener('click', imprimirEtiquetaVolume);
botaoVoltarListaPosConferencia.addEventListener('click', fecharModalPosConferenciaEVoltar);
volumeQtd.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    imprimirEtiquetaVolume();
  }
});
botaoScanAdicionar.addEventListener('click', adicionarConferenciaPorCodigo);
botaoConfirmarConferencia.addEventListener('click', confirmarConferencia);
scanCodigo.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    scanQtd.focus();
    scanQtd.select();
  }
});
scanQtd.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    adicionarConferenciaPorCodigo();
  }
});
document.addEventListener('click', fecharMenusOrdenacaoItens);

window.addEventListener('popstate', (event) => {
  const state = event.state;

  if (
    (state?.tela === 'painel-acompanhamento' || state?.tela === 'conferencia') &&
    state.periodoSelecionado
  ) {
    periodoSelecionado = state.periodoSelecionado;
    inputDataInicial.value = periodoSelecionado.dataInicial;
    inputDataFinal.value = periodoSelecionado.dataFinal;
    inputEmpresaFiltro.value = periodoSelecionado.empresa || '';
    atualizarTituloPainel();
    heroPeriodo.textContent = `Periodo: ${formatarPeriodo(
      periodoSelecionado.dataInicial,
      periodoSelecionado.dataFinal
    )}`;
    mostrarConferencia();
    iniciarAutoRefresh();
    return;
  }

  if (state?.tela === 'acompanhamento') {
    mostrarHomeESuspenderRefresh();
    mostrarAcompanhamento();
    return;
  }

  if (state?.tela === 'fila') {
    mostrarHomeESuspenderRefresh();
    mostrarFila();
    return;
  }

  if (state?.tela === 'consulta-produtos' || window.location.hash === '#consulta-produtos') {
    mostrarHomeESuspenderRefresh();
    renderizarConsultaVazia();
    mostrarConsultaProdutos();
    return;
  }

  mostrarHomeESuspenderRefresh();
});

inicializarApp();
