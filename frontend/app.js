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
const atualizacaoContatoScreen = document.getElementById('atualizacao-contato-screen');
const filaContexto = document.getElementById('fila-contexto');
const inputDataInicial = document.getElementById('data-inicial');
const inputDataFinal = document.getElementById('data-final');
const inputEmpresaFiltro = document.getElementById('empresa-filtro');
const botaoAbrirConferencia = document.getElementById('abrir-conferencia');
const botaoAbrirAcompanhamento = document.getElementById('abrir-acompanhamento');
const botaoAbrirConsultaHome = document.getElementById('abrir-consulta-home');
const botaoAbrirAtualizacaoContato = document.getElementById('abrir-atualizacao-contato');
const botaoExibirAcompanhamento = document.getElementById('exibir-acompanhamento');
const botaoVoltarHomeAcompanhamento = document.getElementById('voltar-home-acompanhamento');
const botaoVoltarHomeFila = document.getElementById('voltar-home-fila');
const botaoVoltarHomeContato = document.getElementById('voltar-home-contato');
const filaDataInicial = document.getElementById('fila-data-inicial');
const filaDataFinal = document.getElementById('fila-data-final');
const filaEmpresa = document.getElementById('fila-empresa');
const filaUsuarioLogado = document.getElementById('fila-usuario-logado');
const filaTituloOperacao = document.querySelector('.fila-toolbar-top h2');
const botaoModoEntrada = document.getElementById('fila-modo-entrada');
const filaModoIcone = document.getElementById('fila-modo-icone');
const filaModoTitulo = document.getElementById('fila-modo-titulo');
const filaModoDescricao = document.getElementById('fila-modo-descricao');
const filaSidebarTitle = document.getElementById('fila-sidebar-title');
const homeUsuarioLogado = document.getElementById('home-usuario-logado');
const botaoLogout = document.getElementById('logout-button');
const botaoBuscarFilaConferencia = document.getElementById('buscar-fila-conferencia');
const filaEtapaPedidos = document.getElementById('fila-etapa-pedidos');
const filaEtapaConferencia = document.getElementById('fila-etapa-conferencia');
const filaPedidosLista = document.getElementById('fila-pedidos-lista');
const filaCountPedidos = document.getElementById('fila-count-pedidos');
const filaBuscaPedido = document.getElementById('fila-busca-pedido');
const filaFiltroStatus = document.getElementById('fila-filtro-status');
const botaoAbrirRomaneio = document.getElementById('abrir-romaneio-cargas');
const romaneioModal = document.getElementById('romaneio-modal');
const botaoFecharRomaneio = document.getElementById('fechar-romaneio-cargas');
const botaoCancelarRomaneio = document.getElementById('cancelar-romaneio-cargas');
const romaneioTransportadora = document.getElementById('romaneio-transportadora');
const romaneioTransportadoraTrigger = document.getElementById('romaneio-transportadora-trigger');
const romaneioTransportadoraTexto = document.getElementById('romaneio-transportadora-texto');
const romaneioTransportadoraOpcoes = document.getElementById('romaneio-transportadora-opcoes');
const romaneioResumo = document.getElementById('romaneio-resumo');
  const romaneioLista = document.getElementById('romaneio-lista');
  const romaneioStatus = document.getElementById('romaneio-status');
  const botaoGerarRomaneio = document.getElementById('gerar-romaneio-cargas');
  const botaoImprimirRomaneio = document.getElementById('imprimir-romaneio-cargas');
const pedidoPreview = document.getElementById('pedido-preview');
const pedidoPreviewTitulo = document.getElementById('pedido-preview-titulo');
const pedidoPreviewMeta = document.getElementById('pedido-preview-meta');
const pedidoPreviewValor = document.getElementById('pedido-preview-valor');
const pedidoPreviewItens = document.getElementById('pedido-preview-itens');
const pedidoPreviewUnidades = document.getElementById('pedido-preview-unidades');
const pedidoPreviewVolumesCard = document.getElementById('pedido-preview-volumes-card');
const pedidoPreviewVolumes = document.getElementById('pedido-preview-volumes');
const pedidoPreviewStatus = document.getElementById('pedido-preview-status');
const pedidoPreviewItensLista = document.getElementById('pedido-preview-itens-lista');
const pedidoPreviewDocumentos = document.getElementById('pedido-preview-documentos');
const botaoCancelarPreviewPedido = document.getElementById('cancelar-preview-pedido');
const botaoImprimirPreviewPedido = document.getElementById('imprimir-preview-pedido');
const botaoAbrirSeparacaoPedido = document.getElementById('abrir-separacao-pedido');
const botaoConfirmarPreviewPedido = document.getElementById('confirmar-preview-pedido');
const separacaoScreen = document.getElementById('separacao-screen');
const separacaoMeta = document.getElementById('separacao-meta');
const separacaoCodigo = document.getElementById('separacao-codigo');
const botaoLimparCodigoSeparacao = document.getElementById('separacao-limpar-codigo');
const separacaoProgresso = document.getElementById('separacao-progresso');
const separacaoStatus = document.getElementById('separacao-status');
const separacaoItensLista = document.getElementById('separacao-itens-lista');
const botaoFecharSeparacaoPedido = document.getElementById('fechar-separacao-pedido');
const botaoFinalizarSeparacao = document.getElementById('finalizar-separacao');
const separacaoConfirmModal = document.getElementById('separacao-confirm-modal');
const separacaoConfirmTitulo = document.getElementById('separacao-confirm-titulo');
const separacaoConfirmProduto = document.getElementById('separacao-confirm-produto');
const separacaoLoteField = document.getElementById('separacao-lote-field');
const separacaoLoteSelect = document.getElementById('separacao-lote-select');
const separacaoLoteInfo = document.getElementById('separacao-lote-info');
const separacaoConfirmField = document.getElementById('separacao-confirm-field');
const separacaoConfirmQtd = document.getElementById('separacao-confirm-qtd');
const separacaoConfirmStatus = document.getElementById('separacao-confirm-status');
const botaoCancelarConfirmacaoSeparacao = document.getElementById('separacao-confirm-cancelar');
const botaoConfirmarSeparacao = document.getElementById('separacao-confirmar');
const botaoAjustarQuantidadeSeparacao = document.getElementById('separacao-ajustar-qtd');
const separacaoAjustePainel = document.getElementById('separacao-ajuste-painel');
const separacaoAjusteQtd = document.getElementById('separacao-ajuste-qtd');
const botaoCancelarAjusteSeparacao = document.getElementById('separacao-ajuste-cancelar');
const botaoAplicarAjusteSeparacao = document.getElementById('separacao-ajuste-aplicar');
const separacaoFinalModal = document.getElementById('separacao-final-modal');
const separacaoFinalResumo = document.getElementById('separacao-final-resumo');
const separacaoFinalLista = document.getElementById('separacao-final-lista');
const botaoCancelarFinalSeparacao = document.getElementById('separacao-final-cancelar');
const botaoConfirmarFinalSeparacao = document.getElementById('separacao-final-confirmar');
const pedidoEmConferenciaCard = document.getElementById('pedido-em-conferencia-card');
const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
const mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');
const pedidoSidebar = document.getElementById('pedido-sidebar');
const botaoVoltarListaFila = document.getElementById('voltar-lista-fila');
const scanProdutoPreview = document.getElementById('scan-produto-preview');
const produtoFotoPanel = document.getElementById('produto-foto-panel');
const produtoFotoTitulo = document.querySelector('#produto-foto-panel .produto-foto-head strong');
const produtoFotoLegenda = document.getElementById('produto-foto-legenda');
const produtoFotoFrame = document.getElementById('produto-foto-frame');
const produtoFotoModal = document.getElementById('produto-foto-modal');
const produtoFotoModalTitulo = document.getElementById('produto-foto-modal-titulo');
const produtoFotoModalLegenda = document.getElementById('produto-foto-modal-legenda');
const produtoFotoModalBody = document.getElementById('produto-foto-modal-body');
const produtoFotoModalFechar = document.getElementById('produto-foto-modal-fechar');
const pedidoConferenciaTitulo = document.getElementById('pedido-conferencia-titulo');
const pedidoConferenciaStatus = document.getElementById('pedido-conferencia-status');
const botaoAbrirConsultaProdutos = document.getElementById('abrir-consulta-produtos');
const scanCodigo = document.getElementById('scan-codigo');
const scanControleField = document.getElementById('scan-controle-field');
const scanControle = document.getElementById('scan-controle');
const scanControleOpcoes = document.getElementById('scan-controle-opcoes');
const scanQtd = document.getElementById('scan-qtd');
const scanValidadeField = document.getElementById('scan-validade-field');
const scanValidade = document.getElementById('scan-validade');
const scanFabricacaoField = document.getElementById('scan-fabricacao-field');
const scanFabricacao = document.getElementById('scan-fabricacao');
const botaoScanAdicionar = document.getElementById('scan-adicionar');
const scanStatus = document.getElementById('scan-status');
const botaoAbrirEntradaCaixa = document.getElementById('abrir-entrada-caixa');
const entradaCaixaContador = document.getElementById('entrada-caixa-contador');
const entradaCaixaModal = document.getElementById('entrada-caixa-modal');
const entradaCaixaResumo = document.getElementById('entrada-caixa-resumo');
const entradaCaixaLista = document.getElementById('entrada-caixa-lista');
const botaoFecharEntradaCaixa = document.getElementById('fechar-entrada-caixa');
const botaoContinuarEntradaCaixa = document.getElementById('continuar-entrada-caixa');
const botaoZerarEntradaCaixa = document.getElementById('zerar-entrada-caixa');
const botaoImprimirEntradaCaixa = document.getElementById('imprimir-entrada-caixa');
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
const posConferenciaTitulo = document.getElementById('pos-conferencia-titulo');
const posConferenciaTexto = document.getElementById('pos-conferencia-texto');
const posConferenciaDocumentos = document.getElementById('pos-conferencia-documentos');
const botaoImprimirEtiquetaVolume = document.getElementById('imprimir-etiqueta-volume');
const botaoVoltarListaPosConferencia = document.getElementById('voltar-lista-pos-conferencia');
const confirmarVolumesModal = document.getElementById('confirmar-volumes-modal');
const confirmarVolumesQtd = document.getElementById('confirmar-volumes-qtd');
const confirmarVolumesStatus = document.getElementById('confirmar-volumes-status');
const botaoCancelarVolumesConferencia = document.getElementById('cancelar-volumes-conferencia');
const botaoConfirmarVolumesConferencia = document.getElementById('confirmar-volumes-conferencia');
const entradaAlteracoesModal = document.getElementById('entrada-alteracoes-modal');
const entradaAlteracoesLista = document.getElementById('entrada-alteracoes-lista');
const botaoCancelarAlteracoesEntrada = document.getElementById('cancelar-alteracoes-entrada');
const botaoConfirmarAlteracoesEntrada = document.getElementById('confirmar-alteracoes-entrada');
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
const botaoConsultaProdutoVoltar = document.getElementById('consulta-produto-voltar');
const consultaProdutoTitulo = document.getElementById('consulta-produto-titulo');
const consultaProdutoLegenda = document.getElementById('consulta-produto-legenda');
const consultaProdutoFoto = document.getElementById('consulta-produto-foto');
const botaoConsultaProdutoEtiqueta = document.getElementById('consulta-produto-imprimir-etiqueta');
const consultaEtiquetaModal = document.getElementById('consulta-etiqueta-modal');
const consultaEtiquetaLote = document.getElementById('consulta-etiqueta-lote');
const consultaEtiquetaCancelar = document.getElementById('consulta-etiqueta-cancelar');
const consultaEtiquetaConfirmar = document.getElementById('consulta-etiqueta-confirmar');
const consultaProdutoResumo = document.getElementById('consulta-produto-resumo');
const consultaProdutoDetalhes = document.getElementById('consulta-produto-detalhes');
const consultaProdutoStatus = document.getElementById('consulta-produto-status');
const consultaEstoqueStatus = document.getElementById('consulta-estoque-status');
const contatoBusca = document.getElementById('contato-busca');
const contatoSomenteAtivos = document.getElementById('contato-somente-ativos');
const contatoPerfil = document.getElementById('contato-perfil');
const contatoEstado = document.getElementById('contato-estado');
const contatoCidade = document.getElementById('contato-cidade');
const contatoCompraInicial = document.getElementById('contato-compra-inicial');
const contatoCompraFinal = document.getElementById('contato-compra-final');
const botaoExibirContatosAtualizados = document.getElementById('contato-exibir-atualizados');
const contatoClientesLista = document.getElementById('contato-clientes-lista');
const contatoStatus = document.getElementById('contato-status');
const contatoListaTitulo = document.getElementById('contato-lista-titulo');
const contatoPagination = document.getElementById('contato-pagination');
const contatoPaginaPrimeira = document.getElementById('contato-pagina-primeira');
const contatoPaginaAnterior = document.getElementById('contato-pagina-anterior');
const contatoPaginaProxima = document.getElementById('contato-pagina-proxima');
const contatoPaginaUltima = document.getElementById('contato-pagina-ultima');
const contatoPaginaInfo = document.getElementById('contato-pagina-info');
const contatoDetalheCard = document.getElementById('contato-detalhe-card');
const contatoDetalheAvatar = document.getElementById('contato-detalhe-avatar');
const contatoDetalheNome = document.getElementById('contato-detalhe-nome');
const contatoDetalheSubtitulo = document.getElementById('contato-detalhe-subtitulo');
const contatoDetalheAtivo = document.getElementById('contato-detalhe-ativo');
const contatoDetalheConteudo = document.getElementById('contato-detalhe-conteudo');
const botaoCriarCardBitrix = document.getElementById('criar-card-bitrix');
const contatoBitrixStatus = document.getElementById('contato-bitrix-status');
const bitrixConfirmModal = document.getElementById('bitrix-confirm-modal');
const bitrixConfirmText = document.getElementById('bitrix-confirm-text');
const bitrixCardTitle = document.getElementById('bitrix-card-title');
const bitrixConfirmResult = document.getElementById('bitrix-confirm-result');
const botaoCancelarBitrix = document.getElementById('bitrix-confirm-cancel');
const botaoConfirmarBitrix = document.getElementById('bitrix-confirm-submit');
const botaoVoltarListaContatos = document.getElementById('voltar-lista-contatos');
const botaoProximoClienteContatos = document.getElementById('proximo-cliente-contatos');
let filaPedidos = [];
let filaModoConferencia = 'saida';
let romaneioPedidos = [];
let romaneioGerando = false;
let romaneioTransportadoras = [];
let romaneioTransportadorasSelecionadas = new Set();
let romaneioBuscaPedidosId = 0;
let pedidoSelecionado = null;
let consultaProdutoAtual = null;
let sincronizacaoCaixaEntradaInterval = null;
let sincronizacaoCaixaEntradaEmAndamento = false;
let salvamentoProgressoEmAndamento = false;
let salvamentosProgressoPendentes = 0;
let salvamentoProgressoPendente = Promise.resolve();
let maiorCaixaEntradaRemota = 0;
let pedidoPreviewSelecionado = null;
let itensPedidoPreview = [];
let itensSeparacao = [];
let itemSeparacaoPendente = null;
let separacaoConcluida = false;
let separacaoVersao = 0;
let separacaoSyncTimer = null;
let separacaoSyncEmAndamento = false;
let itensPedidoSelecionado = [];
let itemCorteSelecionado = null;
let pedidoConcluido = null;
let contatoBuscaTimer = null;
let contatoClientesAtuais = [];
let contatoOrdenacaoUltimaCompra = '';
let contatoOrdenacaoColuna = { coluna: '', direcao: '' };
let contatoFiltrosColuna = { perfil: null, vendedor: null, status: null };
let contatoPaginacao = { pagina: 1, tamanho: 50, total: 0, totalPaginas: 1 };
let contatoFacetas = { perfis: [], vendedores: [], status: ['Pendente', 'Aguardando', 'Atualizado'] };
let contatoDetalheAtual = null;
let contatoOrigemLista = 'nenhuma';
let produtoFotoAtual = null;
let ordenacaoItens = { coluna: '', direcao: '' };
const itensGridMinimos = [34, 78, 210, 122, 148, 118];
const itensGridLarguras = [34, 92, 240, 142, 170, 132];
const STORAGE_NAVEGACAO_FILA = 'filaConferencia:navegacaoAtual';
const STORAGE_SEPARACAO_PREFIX = 'filaConferencia:separacao:';
const TEMPO_TOQUE_LONGO_SEPARACAO_MS = 550;
let toqueLongoSeparacao = null;
let leituraSeparacaoMobile = '';

function separacaoEmMobile() {
  return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
}

function configurarLeitorSeparacao() {
  if (!separacaoCodigo) return;
  const mobile = separacaoEmMobile();
  // O leitor fisico funciona como teclado: o campo precisa continuar gravavel.
  // inputMode=none impede apenas a abertura do teclado virtual no mobile.
  separacaoCodigo.readOnly = false;
  separacaoCodigo.inputMode = mobile ? 'none' : 'numeric';
  separacaoCodigo.setAttribute('virtualkeyboardpolicy', mobile ? 'manual' : 'auto');
  separacaoCodigo.setAttribute(
    'aria-label',
    mobile ? 'Leitor de codigo de barras. Use o scanner ou mantenha um produto pressionado.' : 'Codigo de barras ou produto'
  );
}

function limparCodigoSeparacao({ focar = false } = {}) {
  separacaoCodigo.value = '';
  leituraSeparacaoMobile = '';
  if (focar) setTimeout(() => separacaoCodigo.focus({ preventScroll: true }), 0);
}

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

function salvarNavegacaoFila(extra = {}) {
  if (!temUsuarioLogado()) return;

  const estado = {
    tela: 'fila',
    etapa: filaEtapaConferencia.classList.contains('active') ? 'conferencia' : 'pedidos',
    modo: filaModoConferencia,
    dataInicial: filaDataInicial.value || obterDataHoje(),
    dataFinal: filaDataFinal.value || filaDataInicial.value || obterDataHoje(),
    empresa: filaEmpresa.value || '',
    buscaPedido: filaBuscaPedido.value || '',
    pedido: pedidoSelecionado
      ? {
        ...pedidoSelecionado,
        nuconf: pedidoSelecionado.nuconf || pedidoSelecionado.NUCONFATUAL || null
      }
      : null,
    ...extra
  };

  try {
    sessionStorage.setItem(STORAGE_NAVEGACAO_FILA, JSON.stringify(estado));
  } catch (error) {
    console.warn('Nao foi possivel salvar a navegacao da fila:', error);
  }
}

function obterNavegacaoFilaSalva() {
  try {
    const texto = sessionStorage.getItem(STORAGE_NAVEGACAO_FILA);
    return texto ? JSON.parse(texto) : null;
  } catch (error) {
    console.warn('Nao foi possivel ler a navegacao da fila:', error);
    return null;
  }
}

function limparNavegacaoFilaSalva() {
  try {
    sessionStorage.removeItem(STORAGE_NAVEGACAO_FILA);
  } catch (error) {
    console.warn('Nao foi possivel limpar a navegacao da fila:', error);
  }
}

function atualizarUsuarioLogadoNaTela() {
  const texto = formatarUsuarioLogado();
  homeUsuarioLogado.textContent = texto;
  filaUsuarioLogado.textContent = texto;
}

function mostrarLogin(mensagem = '') {
  usuarioLogado = null;
  limparNavegacaoFilaSalva();
  loginScreen.classList.add('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  atualizacaoContatoScreen.classList.remove('active');
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

function formatarDataInput(dataValor) {
  if (!dataValor) return '';

  const texto = String(dataValor).trim();
  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    return `${ano}-${mes}-${dia}`;
  }

  const brMatch = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    return `${ano}-${mes}-${dia}`;
  }

  const sankhyaMatch = texto.match(/^(\d{2})(\d{2})(\d{4})/);
  if (sankhyaMatch) {
    const [, dia, mes, ano] = sankhyaMatch;
    return `${ano}-${mes}-${dia}`;
  }

  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return '';

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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

function formatarResumoItensUnidadesPainel(item) {
  const qtdItens = Number(item.QTD_ITENS || 0);
  const qtdTotal = Number(item.QTD_TOTAL || 0);

  return {
    itens: qtdItens ? `${formatarQuantidade(qtdItens)} ${qtdItens === 1 ? 'item' : 'itens'}` : '-',
    unidades: qtdTotal ? `${formatarQuantidade(qtdTotal)} un.` : '-'
  };
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function parametrosRomaneio() {
  const dataInicial = filaDataInicial.value || obterDataHoje();
  const dataFinal = filaDataFinal.value || dataInicial;
  return {
    empresa: String(filaEmpresa.value || '').trim(),
    dataInicial: dataInicial <= dataFinal ? dataInicial : dataFinal,
    dataFinal: dataInicial <= dataFinal ? dataFinal : dataInicial
  };
}

function definirStatusRomaneio(mensagem = '', tipo = '') {
  romaneioStatus.textContent = mensagem;
  romaneioStatus.className = `romaneio-status${tipo ? ` ${tipo}` : ''}`;
}

function limparPedidosRomaneio(mensagem = 'Selecione uma ou mais transportadoras para listar as notas faturadas.') {
  romaneioPedidos = [];
  romaneioResumo.hidden = true;
  romaneioResumo.innerHTML = '';
  romaneioLista.innerHTML = `<div class="romaneio-empty">${escaparHtml(mensagem)}</div>`;
  botaoGerarRomaneio.disabled = true;
  botaoImprimirRomaneio.hidden = true;
  delete botaoImprimirRomaneio.dataset.ordemCarga;
  delete botaoImprimirRomaneio.dataset.empresa;
}

function renderizarPedidosRomaneio() {
  if (romaneioPedidos.length === 0) {
    limparPedidosRomaneio('Nenhuma nota faturada pendente de carga para as transportadoras selecionadas.');
    return;
  }

  const pedidosSelecionados = romaneioPedidos.filter((pedido) => pedido.selecionada !== false);
  const valorTotal = pedidosSelecionados.reduce((total, pedido) => total + Number(pedido.VLRNOTA || 0), 0);
  const volumes = pedidosSelecionados.reduce((total, pedido) => total + Number(pedido.QTDVOL || 0), 0);
  const todosSelecionados = pedidosSelecionados.length === romaneioPedidos.length;
  romaneioResumo.hidden = false;
  romaneioResumo.innerHTML = `
    <span><strong>${pedidosSelecionados.length}</strong> de ${romaneioPedidos.length} nota(s) selecionada(s)</span>
    <span>${formatarQuantidade(volumes)} volume(s) | <strong>${formatarMoeda(valorTotal)}</strong></span>
  `;

  const linhas = romaneioPedidos.map((pedido) => `
    <div class="romaneio-row">
      <span class="romaneio-selecao"><input type="checkbox" data-romaneio-nota="${Number(pedido.NUNOTA)}" ${pedido.selecionada !== false ? 'checked' : ''} aria-label="Selecionar nota ${Number(pedido.NUMNOTA || pedido.NUNOTA)}"></span>
      <span><span class="romaneio-tipo ${pedido.TIPO_DOCUMENTO === 'BONIFICACAO' ? 'bonificacao' : 'venda'}">${pedido.TIPO_DOCUMENTO === 'BONIFICACAO' ? 'Bonificação' : 'Venda'}</span></span>
      <span>${Number(pedido.NUMNOTA) > 0 ? `Nro. ${Number(pedido.NUMNOTA)}` : 'Sem numero fiscal'}<small>Interna ${Number(pedido.NUNOTA)}</small></span>
      <span>${formatarData(pedido.DTNEG)}</span>
      <span class="romaneio-cliente" title="${escaparAtributo(`${pedido.CODPARC || '-'} - ${pedido.CLIENTE || '-'}`)}">${escaparHtml(`${pedido.CODPARC || '-'} - ${pedido.CLIENTE || '-'}`)}</span>
      <span>${formatarMoeda(pedido.VLRNOTA)}</span>
      <span>${formatarQuantidade(pedido.QTDVOL)} volume${Number(pedido.QTDVOL || 0) === 1 ? '' : 's'}</span>
    </div>
  `).join('');

  romaneioLista.innerHTML = `
    <div class="romaneio-row romaneio-row-header">
      <span class="romaneio-selecao"><input type="checkbox" data-romaneio-selecionar-todas ${todosSelecionados ? 'checked' : ''} aria-label="Selecionar todas as notas"></span>
      <span>Tipo</span><span>Nota</span><span>Data</span><span>Cliente</span><span>Valor</span><span>Volumes</span>
    </div>
    ${linhas}
  `;
  botaoGerarRomaneio.disabled = pedidosSelecionados.length === 0;
}

function codigosTransportadorasRomaneio() {
  return [...romaneioTransportadorasSelecionadas].map(Number).filter(Boolean);
}

function atualizarResumoTransportadorasRomaneio() {
  const selecionadas = romaneioTransportadoras.filter((item) => (
    romaneioTransportadorasSelecionadas.has(String(item.codigo))
  ));

  if (selecionadas.length === 0) {
    romaneioTransportadoraTexto.textContent = 'Selecione uma ou mais transportadoras';
  } else if (selecionadas.length === 1) {
    const item = selecionadas[0];
    romaneioTransportadoraTexto.textContent = `${item.codigo} - ${item.nome} (${item.notas} nota${item.notas === 1 ? '' : 's'})`;
  } else {
    const totalNotas = selecionadas.reduce((total, item) => total + Number(item.notas || 0), 0);
    romaneioTransportadoraTexto.textContent = `${selecionadas.length} transportadoras selecionadas (${totalNotas} notas)`;
  }

  romaneioTransportadoraOpcoes.querySelectorAll('[data-romaneio-transportadora]').forEach((campo) => {
    campo.checked = romaneioTransportadorasSelecionadas.has(String(campo.value));
    campo.closest('[role="option"]')?.setAttribute('aria-selected', String(campo.checked));
  });
}

function definirSeletorTransportadorasAberto(aberto) {
  const podeAbrir = aberto && !romaneioTransportadoraTrigger.disabled;
  romaneioTransportadora.classList.toggle('is-open', podeAbrir);
  romaneioTransportadoraOpcoes.hidden = !podeAbrir;
  romaneioTransportadoraTrigger.setAttribute('aria-expanded', String(podeAbrir));
}

function limparSelecaoTransportadorasRomaneio() {
  romaneioTransportadorasSelecionadas.clear();
  atualizarResumoTransportadorasRomaneio();
  definirSeletorTransportadorasAberto(false);
}

async function carregarPedidosRomaneio() {
  const transportadoras = codigosTransportadorasRomaneio();
  const buscaId = ++romaneioBuscaPedidosId;
  definirStatusRomaneio();
  if (transportadoras.length === 0) {
    limparPedidosRomaneio();
    return;
  }

  limparPedidosRomaneio('Buscando notas faturadas pendentes de carga...');
  try {
    const params = new URLSearchParams({
      ...parametrosRomaneio(),
      transportadoras: transportadoras.join(',')
    });
    const resposta = await fetch(`/api/fila-conferencia/romaneio/pedidos?${params.toString()}`);
    const payload = await resposta.json();
    if (buscaId !== romaneioBuscaPedidosId) return;
    if (!resposta.ok) throw new Error(payload.erro || 'Erro ao buscar notas faturadas da transportadora.');
    romaneioPedidos = (payload.itens || []).map((pedido) => ({ ...pedido, selecionada: true }));
    renderizarPedidosRomaneio();
  } catch (error) {
    if (buscaId !== romaneioBuscaPedidosId) return;
    limparPedidosRomaneio('Nao foi possivel carregar as notas faturadas.');
    definirStatusRomaneio(error.message, 'error');
  }
}

async function carregarTransportadorasRomaneio() {
  const parametros = parametrosRomaneio();
  if (!parametros.empresa) {
    throw new Error('Selecione a empresa antes de abrir o romaneio.');
  }

  romaneioTransportadoraTrigger.disabled = true;
  romaneioTransportadoraTexto.textContent = 'Buscando transportadoras...';
  romaneioTransportadoraOpcoes.innerHTML = '';
  romaneioTransportadoras = [];
  romaneioTransportadorasSelecionadas.clear();
  limparPedidosRomaneio();
  definirStatusRomaneio();

  try {
    const params = new URLSearchParams(parametros);
    const resposta = await fetch(`/api/fila-conferencia/romaneio/transportadoras?${params.toString()}`);
    const payload = await resposta.json();
    if (!resposta.ok) throw new Error(payload.erro || 'Erro ao buscar transportadoras.');

    romaneioTransportadoras = payload.itens || [];
    romaneioTransportadoraOpcoes.innerHTML = romaneioTransportadoras.map((transportadora) => `
      <label class="romaneio-transportadora-option" role="option" aria-selected="false">
        <input type="checkbox" value="${Number(transportadora.codigo)}" data-romaneio-transportadora>
        <span>${escaparHtml(`${transportadora.codigo} - ${transportadora.nome} (${transportadora.notas} nota${transportadora.notas === 1 ? '' : 's'})`)}</span>
      </label>
    `).join('');
    atualizarResumoTransportadorasRomaneio();
    if (romaneioTransportadoras.length === 0) {
      limparPedidosRomaneio('Nenhuma transportadora possui notas faturadas pendentes de carga neste periodo.');
    }
  } finally {
    romaneioTransportadoraTrigger.disabled = false;
  }
}

async function abrirRomaneioCargas() {
  if (filaModoConferencia !== 'saida') return;
  romaneioModal.hidden = false;
  atualizarIcones();
  try {
    await carregarTransportadorasRomaneio();
  } catch (error) {
    romaneioTransportadoras = [];
    romaneioTransportadoraOpcoes.innerHTML = '';
    limparSelecaoTransportadorasRomaneio();
    limparPedidosRomaneio('Informe os filtros da fila para consultar as cargas.');
    definirStatusRomaneio(error.message, 'error');
  }
}

function fecharRomaneioCargas() {
  if (romaneioGerando) return;
  romaneioBuscaPedidosId += 1;
  romaneioModal.hidden = true;
  limparSelecaoTransportadorasRomaneio();
  limparPedidosRomaneio();
  definirStatusRomaneio();
}

async function gerarRomaneioCargas() {
  const transportadoras = codigosTransportadorasRomaneio();
  const notasSelecionadas = romaneioPedidos.filter((pedido) => pedido.selecionada !== false);
  if (transportadoras.length === 0 || notasSelecionadas.length === 0 || romaneioGerando) {
    if (!romaneioGerando && romaneioPedidos.length > 0 && notasSelecionadas.length === 0) {
      definirStatusRomaneio('Selecione ao menos uma nota para gerar o romaneio.', 'error');
    }
    return;
  }

  romaneioGerando = true;
  botaoGerarRomaneio.disabled = true;
  romaneioTransportadoraTrigger.disabled = true;
  botaoGerarRomaneio.innerHTML = '<span class="pos-conferencia-spinner" aria-hidden="true"></span> Gerando carga...';
  definirStatusRomaneio('Criando a Ordem de Carga e vinculando as notas faturadas no Sankhya...');

  try {
    const resposta = await fetch('/api/fila-conferencia/romaneio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...parametrosRomaneio(),
        transportadoras,
        notas: notasSelecionadas.map((pedido) => Number(pedido.NUNOTA))
      })
    });
    const payload = await resposta.json();
    if (!resposta.ok && resposta.status !== 207) {
      throw new Error(payload.erro || 'Erro ao gerar o romaneio de cargas.');
    }

    const quantidade = payload.notasVinculadas?.length || 0;
    const textoFalhas = payload.falhas?.length
      ? ` ${payload.falhas.length} nota(s) nao puderam ser vinculadas.`
      : '';
    definirStatusRomaneio(
      `Ordem de Carga ${payload.codigoOrdemCarga} gerada com ${quantidade} nota(s) faturada(s).${textoFalhas}`,
      payload.falhas?.length ? 'error' : 'success'
    );
    romaneioPedidos = [];
    romaneioResumo.hidden = false;
    romaneioResumo.innerHTML = `<span>Ordem de Carga</span><strong>${payload.codigoOrdemCarga}</strong>`;
    romaneioLista.innerHTML = `
      <div class="romaneio-empty">
        Romaneio gerado no Sankhya. Codigo da Ordem de Carga: <strong>${payload.codigoOrdemCarga}</strong>.
      </div>
    `;
    botaoImprimirRomaneio.hidden = false;
    botaoImprimirRomaneio.dataset.ordemCarga = String(payload.codigoOrdemCarga);
    botaoImprimirRomaneio.dataset.empresa = String(parametrosRomaneio().empresa || '');
  } catch (error) {
    definirStatusRomaneio(error.message, 'error');
    botaoGerarRomaneio.disabled = false;
  } finally {
    romaneioGerando = false;
    romaneioTransportadoraTrigger.disabled = false;
    botaoGerarRomaneio.textContent = 'Gerar romaneio';
  }
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
    ? 'Fila de Conferência'
    : `Fila de Conferência - ${empresaLimpa}`;

  heroTitulo.classList.remove('is-long', 'is-xlong');

  if (heroTitulo.textContent.length > 70) {
    heroTitulo.classList.add('is-xlong');
  } else if (heroTitulo.textContent.length > 48) {
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
    const horaAtual = formatarHoraAtual();
    metricRelogio.textContent = horaAtual;
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
  atualizacaoContatoScreen.classList.remove('active');
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
  atualizacaoContatoScreen.classList.remove('active');
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
  atualizacaoContatoScreen.classList.remove('active');
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
  atualizacaoContatoScreen.classList.remove('active');
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
  atualizacaoContatoScreen.classList.remove('active');
  consultaProdutosScreen.classList.add('active');
  consultaProdutoCodigo.focus();
}

function mostrarAtualizacaoContato() {
  if (!usuarioLogado) {
    mostrarLogin('Entre para acessar a atualizacao de contato.');
    return;
  }

  loginScreen.classList.remove('active');
  homeScreen.classList.remove('active');
  conferenciaScreen.classList.remove('active');
  acompanhamentoScreen.classList.remove('active');
  filaScreen.classList.remove('active');
  consultaProdutosScreen.classList.remove('active');
  atualizacaoContatoScreen.classList.add('active');
  contatoPerfil.focus();
}

function criarIndicadorStatusPedido(tipo, valor) {
  const financeiro = tipo === 'financeiro';
  const ok = String(valor ?? '').trim() === '1';
  const nome = financeiro ? 'Financeiro' : 'Comercial';
  const descricao = ok ? 'OK' : 'Pendente de analise';
  const icone = financeiro ? 'circle-dollar-sign' : 'briefcase-business';

  return `
    <span
      class="pedido-status-indicador ${ok ? 'ok' : 'pendente'}"
      title="${nome}: ${descricao}"
      aria-label="${nome}: ${descricao}"
    >
      <i data-lucide="${icone}" aria-hidden="true"></i>
    </span>
  `;
}

function criarCard(item) {
  const div = document.createElement('div');

  let statusClass = 'status-aguardando';
  let mostrarTempo = false;
  let statusLabel = 'AGUARDANDO';
  let tempoLabel = '';
  let tipoCard = 'aguardando';

  if (
    item.STATUS_CONFERENCIA === 'EM ANDAMENTO' ||
    item.STATUS_CONFERENCIA === 'EM CONFERENCIA'
  ) {
    statusClass = 'status-andamento';
    mostrarTempo = true;
    statusLabel = 'EM ANDAMENTO';
    tempoLabel = '';
    tipoCard = 'aguardando';
  }

  if (item.STATUS_CONFERENCIA === 'CONFERIDO') {
    statusClass = 'status-conferido';
    statusLabel = 'CONFERIDO';
    tempoLabel = 'Duracao';
    tipoCard = 'conferido';
  }

  const dataFormatada = formatarData(item.DTNEG);

  const valor = Number(item.VLRNOTA) || 0;
  const minutos = minutosDesdeInicio(item.DT_INICIO_CONFERENCIA);
  const mostrarTempoTotal = item.STATUS_CONFERENCIA === 'CONFERIDO';
  const resumoPedido = formatarResumoPedidoPainel(item);
  const resumoItensUnidades = formatarResumoItensUnidadesPainel(item);
  const conclusao = mostrarTempoTotal && item.DT_FIM_CONFERENCIA
    ? `Concluido: ${formatarDataHora(item.DT_FIM_CONFERENCIA)}`
    : '';
  const tempo = mostrarTempoTotal
    ? formatarTempoMinutos(item.TEMPO_TOTAL_CONFERENCIA_MIN)
    : mostrarTempo
      ? `${minutos} min`
      : 'recente';
  const operador = item.NOME_CONFERENTE || '-';
  const conclusaoValor = mostrarTempoTotal && item.DT_FIM_CONFERENCIA
    ? formatarDataHora(item.DT_FIM_CONFERENCIA)
    : '-';
  const metaTempoAguardando = mostrarTempo && operador !== '-'
    ? `<span class="tempo-operador"><b>${tempo}</b><small>${operador}</small></span>`
    : `<span>${tempoLabel ? `${tempoLabel}: ` : ''}${tempo}</span>`;
  const indicadoresStatus = `
    <span class="pedido-status-indicadores">
      ${criarIndicadorStatusPedido('financeiro', item.STATUS_FINANCEIRO)}
      ${criarIndicadorStatusPedido('comercial', item.STATUS_COMERCIAL)}
    </span>
  `;

  div.className = `card-item ${statusClass} card-${tipoCard}`;

  if (tipoCard === 'conferido') {
    div.innerHTML = `
      <div class="pedido-card-top">
        <div>
          <div class="nota-numero">Nota ${item.NUNOTA}</div>
          <div class="empresa-nome">${item.EMPRESA || '-'}</div>
        </div>
      </div>

      <div class="pedido-meta-row">
        <div class="pedido-meta-item">
          <i data-lucide="circle-dollar-sign" class="meta-icon"></i>
          <span><strong>Valor</strong>R$ ${valor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</span>
        </div>
        <div class="pedido-meta-item">
          <span class="meta-dupla">
            <span><i data-lucide="package" class="meta-icon"></i>${resumoItensUnidades.itens}</span>
            <span><i data-lucide="package-open" class="meta-icon"></i>${resumoItensUnidades.unidades}</span>
          </span>
        </div>
        <div class="pedido-meta-item">
          <i data-lucide="calendar-check" class="meta-icon"></i>
          <span><strong>Concluido</strong>${conclusaoValor}<br><b>${operador}</b></span>
        </div>
        <div class="pedido-meta-item">
          <i data-lucide="clock" class="meta-icon"></i>
          <span><strong>${tempoLabel}</strong>${tempo}</span>
        </div>
        <div class="pedido-status-cell">
          <div class="status-text">${statusLabel}</div>
        </div>
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="pedido-card-top">
        <div>
          <div class="nota-cliente-linha">
            <span class="nota-numero">Nota ${item.NUNOTA}</span>
            <span class="empresa-nome">${item.EMPRESA || '-'}</span>
          </div>
        </div>
        <div class="pedido-card-status-group">
          ${indicadoresStatus}
          <div class="status-text">${statusLabel}</div>
        </div>
      </div>

      <div class="pedido-meta-row">
        <div class="pedido-meta-item">
          <i data-lucide="calendar-days" class="meta-icon"></i>
          <span><strong>Data:</strong> ${dataFormatada}</span>
        </div>
        <div class="pedido-meta-item">
          <i data-lucide="circle-dollar-sign" class="meta-icon"></i>
          <span><strong>Valor:</strong> R$ ${valor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</span>
        </div>
        <div class="pedido-meta-item">
          <span class="meta-dupla">
            <span><i data-lucide="package" class="meta-icon"></i>${resumoItensUnidades.itens}</span>
            <span><i data-lucide="package-open" class="meta-icon"></i>${resumoItensUnidades.unidades}</span>
          </span>
        </div>
        <div class="pedido-meta-item">
          <i data-lucide="clock" class="meta-icon"></i>
          ${metaTempoAguardando}
        </div>
      </div>
    `;
  }

  return div;
}

function renderizarEstadoVazio(container, mensagem) {
  container.innerHTML = `<div class="empty-state">${mensagem}</div>`;
}

function atualizarIcones() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
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

function obterUnidadeExibicaoItem(item) {
  return String(item?.codVolPadrao || item?.codVol || 'UN').trim() || 'UN';
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

function obterItensCompativeisCodigo(codigo) {
  const codigoNormalizado = normalizarCodigo(codigo);
  if (!codigoNormalizado) return [];

  return itensPedidoSelecionado
    .map((candidate) => ({
      item: candidate,
      entrada: obterEntradaCodigoItem(candidate, codigoNormalizado)
    }))
    .filter((candidate) => candidate.entrada);
}

function obterItemEntradaParaDatas() {
  if (filaModoConferencia !== 'entrada') return null;

  const itensCompativeis = obterItensCompativeisCodigo(scanCodigo.value);
  if (itensCompativeis.length === 0) return null;

  const controleInformado = String(scanControle?.value || '').trim().toUpperCase();
  if (controleInformado) {
    return itensCompativeis.find(({ item }) =>
      String(item.controle || '').trim().toUpperCase() === controleInformado
    )?.item || itensCompativeis[0].item;
  }

  return itensCompativeis.find(({ item }) => quantidadePendenteItem(item) > 0)?.item
    || itensCompativeis[0].item;
}

function preencherDatasEntradaPorItem(item, { preservarDigitado = false } = {}) {
  if (filaModoConferencia !== 'entrada' || !item) return;

  const validade = formatarDataInput(item.dtValidade);
  const fabricacao = formatarDataInput(item.dtFabricacao);

  if (scanValidade && (!preservarDigitado || !scanValidade.value)) {
    scanValidade.value = validade;
  }

  if (scanFabricacao && (!preservarDigitado || !scanFabricacao.value)) {
    scanFabricacao.value = fabricacao;
  }
}

function atualizarDatasEntradaPorLeitura({ preservarDigitado = false } = {}) {
  if (filaModoConferencia !== 'entrada') return;
  preencherDatasEntradaPorItem(obterItemEntradaParaDatas(), { preservarDigitado });
}

function limparDatasEntrada() {
  if (scanValidade) scanValidade.value = '';
  if (scanFabricacao) scanFabricacao.value = '';
}

function atualizarProdutoLeituraEntrada() {
  if (!scanProdutoPreview) return;

  const codigoOriginal = String(scanCodigo?.value || '').trim();
  const codigo = normalizarCodigo(codigoOriginal);
  if (filaModoConferencia !== 'entrada' || !codigo) {
    scanProdutoPreview.hidden = true;
    scanProdutoPreview.classList.remove('not-found');
    scanProdutoPreview.innerHTML = '';
    return;
  }

  const compativeis = obterItensCompativeisCodigo(codigo);
  const candidato = compativeis.find(({ item }) => quantidadePendenteItem(item) > 0) || compativeis[0];
  if (!candidato?.item) {
    scanProdutoPreview.hidden = false;
    scanProdutoPreview.classList.add('not-found');
    scanProdutoPreview.innerHTML = `
      <span>Codigo digitado</span>
      <strong>${escaparHtml(codigoOriginal)}</strong>
      <small>Nenhum produto encontrado nesta nota.</small>
    `;
    return;
  }

  const item = candidato.item;
  scanProdutoPreview.hidden = false;
  scanProdutoPreview.classList.remove('not-found');
  scanProdutoPreview.innerHTML = `
    <span>Produto identificado</span>
    <strong>${escaparHtml(item.codProd)} - ${escaparHtml(item.descrProd || 'Produto')}</strong>
  `;
}

function atualizarOpcoesControleEntrada() {
  if (!scanControleOpcoes || filaModoConferencia !== 'entrada') return;

  const controles = [...new Set(obterItensCompativeisCodigo(scanCodigo.value)
    .map(({ item }) => String(item.controle || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));

  scanControle.placeholder = controles.length > 0
    ? 'Selecione ou digite o lote'
    : 'Digite o lote, se houver';
  scanControleOpcoes.innerHTML = controles
    .map((controle) => `
      <button class="controle-lote-opcao" type="button" role="option" data-controle="${escaparAtributo(controle)}">
        ${escaparHtml(controle)}
      </button>
    `)
    .join('');
}

function abrirOpcoesControleEntrada() {
  if (!scanControleOpcoes || filaModoConferencia !== 'entrada') return;
  atualizarOpcoesControleEntrada();
  scanControleOpcoes.classList.toggle('active', Boolean(scanControleOpcoes.children.length));
}

function fecharOpcoesControleEntrada() {
  scanControleOpcoes?.classList.remove('active');
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
  scanControle.disabled = !temPedido || filaModoConferencia !== 'entrada';
  scanQtd.disabled = !temPedido;
  if (scanValidade) scanValidade.disabled = !temPedido || filaModoConferencia !== 'entrada';
  if (scanFabricacao) scanFabricacao.disabled = !temPedido || filaModoConferencia !== 'entrada';
  botaoScanAdicionar.disabled = !temPedido;
}

function ehMobileConferencia() {
  return window.matchMedia('(max-width: 900px)').matches && filaScreen.classList.contains('conferencia-mode');
}

function alternarSidebarMobileConferencia(aberto) {
  if (!mobileSidebarToggle || !mobileSidebarBackdrop || !pedidoSidebar) return;

  filaScreen.classList.toggle('mobile-sidebar-open', aberto);
  mobileSidebarBackdrop.hidden = !aberto;
  mobileSidebarToggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  document.body.classList.toggle('mobile-sidebar-lock', aberto);
  atualizarIcones();
}

function mostrarEtapaPedidosFila() {
  pararSincronizacaoCaixaEntrada();
  filaEtapaConferencia.classList.remove('active');
  filaEtapaPedidos.classList.add('active');
  filaScreen.classList.remove('conferencia-mode');
  alternarSidebarMobileConferencia(false);
  salvarNavegacaoFila({ etapa: 'pedidos', pedido: null });
}

function mostrarEtapaConferenciaFila() {
  filaEtapaPedidos.classList.remove('active');
  filaEtapaConferencia.classList.add('active');
  filaScreen.classList.add('conferencia-mode');
  salvarNavegacaoFila({ etapa: 'conferencia' });
  iniciarSincronizacaoCaixaEntrada();
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
  consultaProdutoAtual = null;
  consultaProdutoTitulo.textContent = 'Produto';
  consultaProdutoLegenda.textContent = 'Informe um codigo para consultar.';
  consultaProdutoFoto.innerHTML = '<div class="consulta-empty">Sem produto selecionado.</div>';
  botaoConsultaProdutoEtiqueta.disabled = true;
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
  botaoConsultaProdutoEtiqueta.disabled = false;
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

function imprimirEtiquetaProdutoConsultado() {
  const produto = consultaProdutoAtual;
  if (!produto) return;

  const estoque = Array.isArray(produto.estoque) ? produto.estoque[0] : null;
  abrirEtiquetaProdutoParaImpressao(estoque);
}

function montarItemEtiquetaProduto(estoque) {
  const produto = consultaProdutoAtual;
  const item = {
    codProd: produto.produto.CODPROD,
    descrProd: produto.produto.DESCRPROD || `Produto ${produto.produto.CODPROD}`,
    controle: estoque?.CONTROLE || '',
    validade: estoque?.DTVAL || '',
    fabricacao: '',
    codVol: produto.produto.CODVOL || 'UN',
    quantidade: 1
  };
  return item;
}

function abrirEtiquetaProdutoParaImpressao(estoque) {
  if (!consultaProdutoAtual) return;

  const item = montarItemEtiquetaProduto(estoque);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    consultaProdutoStatus.textContent = 'O navegador bloqueou a nova aba de impressao.';
    return;
  }

  printWindow.document.write(montarHtmlEtiquetasCaixaEntrada('produto', [item]));
  printWindow.document.close();
}

function fecharSelecaoEtiquetaProduto() {
  consultaEtiquetaModal.hidden = true;
}

function abrirSelecaoEtiquetaProduto() {
  if (!consultaProdutoAtual) return;

  const estoques = Array.isArray(consultaProdutoAtual.estoque) ? consultaProdutoAtual.estoque : [];
  consultaEtiquetaLote.innerHTML = estoques.length
    ? estoques.map((estoque, indice) => {
      const lote = estoque.CONTROLE || 'Sem Lote';
      const validade = estoque.DTVAL ? (formatarData(estoque.DTVAL) || 'Sem validade') : 'Sem validade';
      return `<option value="${indice}">${escaparHtml(lote)} | Validade: ${escaparHtml(validade)}</option>`;
    }).join('')
    : '<option value="-1">Sem Lote | Sem validade</option>';

  consultaEtiquetaModal.hidden = false;
  consultaEtiquetaLote.focus();
}

function confirmarSelecaoEtiquetaProduto() {
  if (!consultaProdutoAtual) return;
  const estoques = Array.isArray(consultaProdutoAtual.estoque) ? consultaProdutoAtual.estoque : [];
  const indice = Number(consultaEtiquetaLote.value);
  const estoque = indice >= 0 ? estoques[indice] : null;
  fecharSelecaoEtiquetaProduto();
  abrirEtiquetaProdutoParaImpressao(estoque);
}

async function buscarConsultaProduto() {
  const codigo = consultaProdutoCodigo.value.trim();

  if (!codigo) {
    renderizarConsultaVazia('Informe um codigo, referencia ou codigo de barras.');
    consultaProdutoCodigo.focus();
    return;
  }

  botaoConsultaProdutoBuscar.disabled = true;
  consultaProdutoAtual = null;
  botaoConsultaProdutoEtiqueta.disabled = true;
  consultaProdutoStatus.textContent = 'Consultando produto...';
  consultaProdutoResumo.innerHTML = '<div class="consulta-empty">Buscando informacoes de estoque...</div>';
  consultaProdutoDetalhes.innerHTML = '<div class="consulta-empty">Carregando detalhes...</div>';

  try {
    const res = await fetch(`/api/produtos/consulta?codigo=${encodeURIComponent(codigo)}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Produto nao encontrado');
    }

    consultaProdutoAtual = payload;
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
  history.pushState({ tela: 'consulta-produtos', origem: 'home' }, '', '#consulta-produtos');
}

function voltarConsultaProdutos() {
  if (history.state?.origem) {
    history.back();
    return;
  }

  mostrarHomeESuspenderRefresh();
  mostrarHome();
  history.replaceState({ tela: 'home' }, '', window.location.pathname + window.location.search);
}

function obterValorOrdenacaoUltimaCompra(cliente) {
  return Number(cliente.ULTIMA_COMPRA_ORD || 0);
}

function obterClientesContatoOrdenados() {
  if (contatoOrigemLista === 'cidade') return [...contatoClientesAtuais];

  const dataInicial = Number(String(contatoCompraInicial.value || '').replace(/-/g, ''));
  const dataFinal = Number(String(contatoCompraFinal.value || '').replace(/-/g, ''));
  const clientes = contatoClientesAtuais.filter((cliente) => {
    const perfil = String(cliente.PERFIL || 'Sem perfil');
    const vendedor = String(cliente.VENDEDOR || 'Sem vendedor');
    const status = rotuloStatusContato(obterStatusContatoCliente(cliente));
    if (contatoFiltrosColuna.perfil && !contatoFiltrosColuna.perfil.has(perfil)) return false;
    if (contatoFiltrosColuna.vendedor && !contatoFiltrosColuna.vendedor.has(vendedor)) return false;
    if (contatoFiltrosColuna.status && !contatoFiltrosColuna.status.has(status)) return false;
    if (!dataInicial && !dataFinal) return true;
    const ultimaCompra = obterValorOrdenacaoUltimaCompra(cliente);
    if (!ultimaCompra) return false;
    if (dataInicial && ultimaCompra < dataInicial) return false;
    if (dataFinal && ultimaCompra > dataFinal) return false;
    return true;
  });

  if (contatoOrdenacaoColuna.coluna) {
    return clientes.sort((a, b) => {
      const coluna = contatoOrdenacaoColuna.coluna;
      const comparacao = coluna === 'codigo'
        ? Number(a.CODPARC || 0) - Number(b.CODPARC || 0)
        : String(a.NOMEPARC || '').localeCompare(String(b.NOMEPARC || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
      return contatoOrdenacaoColuna.direcao === 'asc' ? comparacao : -comparacao;
    });
  }

  if (!contatoOrdenacaoUltimaCompra) {
    return clientes;
  }

  return clientes.sort((a, b) => {
    const valorA = obterValorOrdenacaoUltimaCompra(a);
    const valorB = obterValorOrdenacaoUltimaCompra(b);

    if (!valorA && valorB) return 1;
    if (valorA && !valorB) return -1;

    if (valorA === valorB) {
      return String(a.NOMEPARC || '').localeCompare(String(b.NOMEPARC || ''), 'pt-BR');
    }

    return contatoOrdenacaoUltimaCompra === 'asc' ? valorA - valorB : valorB - valorA;
  });
}

function alternarOrdenacaoUltimaCompraContato() {
  contatoOrdenacaoColuna = { coluna: '', direcao: '' };
  contatoOrdenacaoUltimaCompra = contatoOrdenacaoUltimaCompra === 'desc' ? 'asc' : 'desc';
  if (contatoOrigemLista === 'cidade') carregarClientesContato(1, true);
  else desenharClientesContato();
}

function valoresUnicosContato(coluna) {
  if (contatoOrigemLista === 'cidade') {
    if (coluna === 'perfil') return contatoFacetas.perfis;
    if (coluna === 'vendedor') return contatoFacetas.vendedores;
    return contatoFacetas.status;
  }
  const valores = coluna === 'status'
    ? contatoClientesAtuais.map((cliente) => rotuloStatusContato(obterStatusContatoCliente(cliente)))
    : contatoClientesAtuais.map((cliente) => String(cliente[coluna === 'perfil' ? 'PERFIL' : 'VENDEDOR'] || (coluna === 'perfil' ? 'Sem perfil' : 'Sem vendedor')));
  return [...new Set(valores)]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }));
}

function criarMenuOrdenacaoContato(coluna) {
  const alfabetico = coluna === 'cliente';
  return `
    <div class="contato-coluna-menu contato-sort-menu">
      <button type="button" data-contato-sort="${coluna}" data-direcao="asc">${alfabetico ? 'A-Z' : '1-9'} <span>Ordenar crescente</span></button>
      <button type="button" data-contato-sort="${coluna}" data-direcao="desc">${alfabetico ? 'Z-A' : '9-1'} <span>Ordenar decrescente</span></button>
    </div>
  `;
}

function criarMenuFiltroContato(coluna) {
  const valores = valoresUnicosContato(coluna);
  const selecao = contatoFiltrosColuna[coluna];
  const todosMarcados = !selecao || valores.every((valor) => selecao.has(valor));
  return `
    <div class="contato-coluna-menu contato-filter-menu" data-filter-menu="${coluna}">
      <input class="contato-filter-search" type="search" placeholder="Pesquisar" aria-label="Pesquisar ${coluna}">
      <div class="contato-filter-options">
        <label class="contato-filter-option contato-filter-all">
          <input type="checkbox" data-filter-all ${todosMarcados ? 'checked' : ''}> <span>Selecionar todos</span>
        </label>
        ${valores.map((valor) => `
          <label class="contato-filter-option" data-filter-text="${escaparAtributo(valor.toLowerCase())}">
            <input type="checkbox" data-filter-value="${escaparAtributo(valor)}" ${!selecao || selecao.has(valor) ? 'checked' : ''}> <span>${escaparHtml(valor)}</span>
          </label>
        `).join('')}
      </div>
      <button class="contato-filter-apply" type="button">Aplicar</button>
    </div>
  `;
}

function criarCabecalhoMenuContato(rotulo, coluna, tipo) {
  const ativo = tipo === 'filtro' && contatoFiltrosColuna[coluna] !== null;
  return `
    <div class="contato-coluna-menu-host">
      <span>${rotulo}</span>
      <button class="contato-coluna-menu-toggle${ativo ? ' ativo' : ''}" type="button" data-contato-menu="${coluna}" aria-label="Filtrar ou ordenar ${rotulo}" title="Filtrar ou ordenar ${rotulo}">
        <i data-lucide="${tipo === 'filtro' ? 'list-filter' : 'arrow-up-down'}" aria-hidden="true"></i>
      </button>
      ${tipo === 'filtro' ? criarMenuFiltroContato(coluna) : criarMenuOrdenacaoContato(coluna)}
    </div>
  `;
}

function configurarMenusColunasContato() {
  contatoClientesLista.querySelectorAll('.contato-coluna-menu').forEach((menu) => {
    menu.addEventListener('click', (event) => event.stopPropagation());
  });

  contatoClientesLista.querySelectorAll('.contato-coluna-menu-toggle').forEach((botao) => {
    botao.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = botao.parentElement.querySelector('.contato-coluna-menu');
      const abrir = !menu.classList.contains('aberto');
      fecharMenusColunasContato();
      menu.classList.toggle('aberto', abrir);
      if (abrir) menu.querySelector('input[type="search"]')?.focus();
    });
  });

  contatoClientesLista.querySelectorAll('[data-contato-sort]').forEach((botao) => {
    botao.addEventListener('click', () => {
      contatoOrdenacaoUltimaCompra = '';
      contatoOrdenacaoColuna = { coluna: botao.dataset.contatoSort, direcao: botao.dataset.direcao };
      if (contatoOrigemLista === 'cidade') carregarClientesContato(1, true);
      else desenharClientesContato();
    });
  });

  contatoClientesLista.querySelectorAll('[data-filter-menu]').forEach((menu) => {
    const pesquisa = menu.querySelector('.contato-filter-search');
    const selecionarTodos = menu.querySelector('[data-filter-all]');
    const opcoes = [...menu.querySelectorAll('[data-filter-value]')];
    pesquisa.addEventListener('input', () => {
      const termo = pesquisa.value.trim().toLocaleLowerCase('pt-BR');
      menu.querySelectorAll('[data-filter-text]').forEach((opcao) => {
        opcao.hidden = Boolean(termo) && !opcao.dataset.filterText.includes(termo);
      });
    });
    selecionarTodos.addEventListener('change', () => {
      opcoes.forEach((opcao) => { opcao.checked = selecionarTodos.checked; });
    });
    opcoes.forEach((opcao) => {
      opcao.addEventListener('change', () => {
        selecionarTodos.checked = opcoes.every((item) => item.checked);
      });
    });
    menu.querySelector('.contato-filter-apply').addEventListener('click', () => {
      const marcados = new Set(opcoes.filter((opcao) => opcao.checked).map((opcao) => opcao.dataset.filterValue));
      contatoFiltrosColuna[menu.dataset.filterMenu] = marcados.size === opcoes.length ? null : marcados;
      if (contatoOrigemLista === 'cidade') carregarClientesContato(1, true);
      else desenharClientesContato();
    });
  });
}

function fecharMenusColunasContato() {
  document.querySelectorAll('.contato-coluna-menu.aberto').forEach((menu) => menu.classList.remove('aberto'));
}

function criarCabecalhoListaContato(indicadorOrdenacao) {
  return `
    <div class="contato-header">
      <div aria-label="Limite de credito"></div>
      ${criarCabecalhoMenuContato('Codigo', 'codigo', 'ordenacao')}
      ${criarCabecalhoMenuContato('Cliente', 'cliente', 'ordenacao')}
      <div>Ativo</div>
      ${criarCabecalhoMenuContato('Perfil', 'perfil', 'filtro')}
      ${criarCabecalhoMenuContato('Vendedor', 'vendedor', 'filtro')}
      <div class="contato-coluna-menu-host">
        <button class="contato-sort-button" type="button" id="contato-ordenar-ultima-compra">
          Ultima compra <span aria-hidden="true">${indicadorOrdenacao}</span>
        </button>
        <button class="contato-coluna-menu-toggle${contatoFiltrosColuna.status !== null ? ' ativo' : ''}" type="button" data-contato-menu="status" aria-label="Filtrar status" title="Filtrar status">
          <i data-lucide="list-filter" aria-hidden="true"></i>
        </button>
        ${criarMenuFiltroContato('status')}
      </div>
    </div>
  `;
}

function configurarCabecalhoListaContato() {
  document.getElementById('contato-ordenar-ultima-compra')?.addEventListener('click', alternarOrdenacaoUltimaCompraContato);
  configurarMenusColunasContato();
  atualizarIcones();
}

function atualizarPaginacaoContato() {
  const ativa = contatoOrigemLista === 'cidade' && contatoPaginacao.total > 0;
  contatoPagination.hidden = !ativa;
  if (!ativa) return;

  const { pagina, totalPaginas, total } = contatoPaginacao;
  contatoPaginaInfo.textContent = `Pagina ${pagina} de ${totalPaginas} | ${total} clientes`;
  contatoPaginaPrimeira.disabled = pagina <= 1;
  contatoPaginaAnterior.disabled = pagina <= 1;
  contatoPaginaProxima.disabled = pagina >= totalPaginas;
  contatoPaginaUltima.disabled = pagina >= totalPaginas;
  atualizarIcones();
}

function irParaPaginaContato(pagina) {
  const destino = Math.max(1, Math.min(Number(pagina) || 1, contatoPaginacao.totalPaginas || 1));
  if (destino === contatoPaginacao.pagina) return;
  carregarClientesContato(destino, true);
}

function contatoValorPreenchido(valor) {
  return valor !== null && valor !== undefined && String(valor).trim() !== '';
}

function valorContato(valor, fallback = '-') {
  return contatoValorPreenchido(valor) ? String(valor) : fallback;
}

function criarInfoItemContato(label, valor) {
  return `
    <div class="contato-info-item">
      <span class="contato-info-label">${escaparHtml(label)}</span>
      <span class="contato-info-value">${escaparHtml(valorContato(valor))}</span>
    </div>
  `;
}

function criarInfoItemContatoFull(label, valor) {
  return `
    <div class="contato-info-item full">
      <span class="contato-info-label">${escaparHtml(label)}</span>
      <span class="contato-info-value">${escaparHtml(valorContato(valor))}</span>
    </div>
  `;
}

function criarInfoItemContatoDestaque(label, valor) {
  return `
    <div class="contato-info-item contato-info-highlight full">
      <span class="contato-info-label">${escaparHtml(label)}</span>
      <strong class="contato-info-value">${escaparHtml(valorContato(valor))}</strong>
    </div>
  `;
}

function obterStatusContatoCliente(cliente = {}) {
  if (cliente.STATUS_ATUALIZACAO_CONTATO) return cliente.STATUS_ATUALIZACAO_CONTATO;
  return contatoValorPreenchido(cliente.DATA_ATUALIZACAO_CONTATO) ? 'atualizado' : 'pendente';
}

function rotuloStatusContato(status) {
  if (status === 'aguardando') return 'Aguardando';
  if (status === 'atualizado') return 'Atualizado';
  return 'Pendente';
}

function criarIndicadorLimiteCreditoLista(cliente = {}) {
  const limite = Number(cliente.LIMCRED || 0);
  const definido = cliente.LIMCRED_CADASTRADO === 'S';
  const titulo = definido
    ? `Limite definido: ${formatarMoeda(limite)}`
    : 'Sem limite de credito definido';

  return `
    <div
      class="contato-limite-lista ${definido ? 'definido' : 'sem-limite'}"
      title="${escaparAtributo(titulo)}"
      aria-label="${escaparAtributo(titulo)}"
    >
      <i data-lucide="circle-dollar-sign" aria-hidden="true"></i>
    </div>
  `;
}

function criarCampoContatoEditavel(tipo, nome, titulo, valor) {
  return `
    <label class="contato-edit-row">
      <span class="contato-mini-icon">${iconeContato(tipo)}</span>
      <span class="contato-edit-label">${escaparHtml(titulo)}</span>
      <input
        class="contato-edit-input"
        name="${escaparAtributo(nome)}"
        type="${tipo === 'email' ? 'email' : 'text'}"
        value="${escaparAtributo(valorContato(valor, ''))}"
        autocomplete="off"
      >
    </label>
  `;
}

function criarSelectPerfilCliente(perfis = [], codTipParcAtual = '') {
  const valorAtual = String(codTipParcAtual || '');
  const opcoes = [
    '<option value="">Selecione o perfil</option>',
    ...perfis.map((perfil) => {
      const codigo = String(perfil.CODTIPPARC || '');
      return `<option value="${escaparAtributo(codigo)}"${codigo === valorAtual ? ' selected' : ''}>${escaparHtml(perfil.DESCRTIPPARC || codigo)}</option>`;
    })
  ];

  return `
    <div class="contato-perfil-edit">
      <span>Perfil</span>
      <select id="contato-perfil-cliente" name="codTipParc" aria-label="Perfil do cliente">
        ${opcoes.join('')}
      </select>
      <button class="contato-perfil-save" id="contato-salvar-perfil" type="button">Salvar Perfil</button>
      <span class="contato-perfil-status" id="contato-perfil-status" aria-live="polite"></span>
    </div>
  `;
}

function normalizarTextoBuscaContato(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function selecionarContatoModelo(contatos, tipo) {
  const cargosFixos = {
    nfe: 'NFE',
    transporte: 'TRANSPORTE',
    financeiro: 'FINANCEIRO'
  };
  const cargoAlvo = cargosFixos[tipo];

  return contatos.find((contato) => {
    const cargo = normalizarTextoBuscaContato(contato.CARGO || '');
    return cargo === cargoAlvo;
  }) || null;
}

function contatoEhModeloFixo(contato) {
  const cargo = normalizarTextoBuscaContato(contato?.CARGO || '');
  return cargo === 'NFE' || cargo === 'TRANSPORTE' || cargo === 'FINANCEIRO';
}

function criarOpcoesCargoContato(cargoAtual = '', cargoPadrao = '') {
  const cargos = [
    'Geral',
    'Proprietaria',
    'Compras',
    'Financeiro',
    'NFE',
    'Transporte',
    'Recebimento',
    'Entrega',
    'Gerente'
  ];
  const valor = cargoAtual || cargoPadrao || 'Geral';
  const opcoes = cargos.includes(valor) ? cargos : [valor, ...cargos];

  return opcoes.map((cargo) => `
    <option value="${escaparAtributo(cargo)}"${cargo === valor ? ' selected' : ''}>${escaparHtml(cargo)}</option>
  `).join('');
}

function criarCardContatoEditavel(contato = {}, tipo = 'extra', titulo = 'Contato adicional') {
  const cargosFixos = {
    nfe: 'NFE',
    transporte: 'Transporte',
    financeiro: 'Financeiro'
  };
  const cargoPadrao = cargosFixos[tipo] || 'Geral';
  const contatoId = contato.CODCONTATO || contato.codContato || '';
  const cargoValor = contato.CARGO || contato.cargo || cargoPadrao;
  const cargoCampo = tipo === 'extra'
    ? `<select name="cargo">${criarOpcoesCargoContato(cargoValor, cargoPadrao)}</select>`
    : `
      <input name="cargo" type="hidden" value="${escaparAtributo(cargoPadrao)}">
      <strong class="contato-fixed-cargo">${escaparHtml(cargoPadrao)}</strong>
    `;

  return `
    <div class="contato-card-edit" data-tipo="${escaparAtributo(tipo)}" data-codcontato="${escaparAtributo(contatoId)}">
      <div class="contato-card-edit-head">
        <strong>${escaparHtml(titulo)}</strong>
        ${tipo === 'extra' ? '<button class="contato-remove-button" type="button" title="Remover contato">Remover</button>' : '<span class="contato-card-fixed">Fixo</span>'}
      </div>
      <div class="contato-card-edit-grid">
        <label>
          <span>Nome do contato</span>
          <input name="nome" type="text" value="${escaparAtributo(contato.NOMECONTATO || contato.nome || '')}" maxlength="40">
        </label>
        <label>
          <span>Cargo</span>
          ${cargoCampo}
        </label>
        <label>
          <span>Telefone</span>
          <input name="telefone" type="text" value="${escaparAtributo(contato.TELEFONE || contato.telefone || '')}" maxlength="13">
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" value="${escaparAtributo(contato.EMAIL || contato.email || '')}" maxlength="80">
        </label>
      </div>
    </div>
  `;
}

function montarContatosEditaveis(contatos = []) {
  const contatoNfe = selecionarContatoModelo(contatos, 'nfe');
  const contatoTransporte = selecionarContatoModelo(contatos, 'transporte');
  const contatoFinanceiro = selecionarContatoModelo(contatos, 'financeiro');
  const extras = contatos.filter((contato) => !contatoEhModeloFixo(contato));

  return `
    <div class="contato-extra-list" id="contato-extra-list">
      ${criarCardContatoEditavel(contatoFinanceiro || {}, 'financeiro', 'Contato Financeiro')}
      ${criarCardContatoEditavel(contatoNfe || {}, 'nfe', 'Contato NF-e')}
      ${criarCardContatoEditavel(contatoTransporte || {}, 'transporte', 'Contato de Transporte/Logistica')}
      ${extras.map((contato) => criarCardContatoEditavel(contato, 'extra', 'Contato adicional')).join('')}
    </div>
    <button class="contato-add-button" id="contato-adicionar" type="button">+ Adicionar contato</button>
  `;
}

function obterIniciaisContato(nome = '') {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return partes.map((parte) => parte[0]).join('').toUpperCase() || '--';
}

function iconeContato(tipo) {
  const icones = {
    usuario: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.2 0-7 2.1-7 5v1h14v-1c0-2.9-2.8-5-7-5Z"/></svg>',
    documento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7V3Zm7 1.8V8h3.2L14 4.8ZM9 11h6v1.8H9V11Zm0 4h6v1.8H9V15Z"/></svg>',
    telefone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 4.1 9.8 4c.6 0 1 .4 1.1.9l.6 3c.1.5-.1 1-.6 1.3l-1.4.8c.9 1.8 2.3 3.2 4.1 4.1l.8-1.4c.3-.5.8-.7 1.3-.6l3 .6c.5.1.9.6.9 1.1l-.1 2.6c0 .8-.6 1.4-1.4 1.4A12.1 12.1 0 0 1 5.8 5.5c0-.8.6-1.4 1.4-1.4Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4V6Zm2 2v.3l6 4 6-4V8H6Zm12 8v-5.2l-6 4-6-4V16h12Z"/></svg>',
    calendario: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v17H4V4h3V2Zm11 8H6v9h12v-9ZM6 8h12V6H6v2Z"/></svg>',
    endereco: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.8A2.8 2.8 0 1 1 12 6a2.8 2.8 0 0 1 0 5.8Z"/></svg>',
    grupo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 13c-3 0-5 1.5-5 4v2h10v-2c0-2.5-2-4-5-4Zm8 0c-.7 0-1.4.1-2 .3 1.2.9 2 2.1 2 3.7v2h5v-2c0-2.5-2-4-5-4Z"/></svg>'
  };

  return icones[tipo] || icones.documento;
}

function montarEnderecoContato(parceiro = {}) {
  const partes = [
    parceiro.ENDERECO,
    parceiro.NUMEND ? `N. ${parceiro.NUMEND}` : '',
    parceiro.COMPLEMENTO,
    parceiro.BAIRRO,
    parceiro.CIDADE && parceiro.UF ? `${parceiro.CIDADE}-${parceiro.UF}` : parceiro.CIDADE,
    parceiro.CEP ? `CEP ${parceiro.CEP}` : ''
  ].filter(contatoValorPreenchido);

  return partes.join(' - ');
}

function criarPainelLimiteCredito(parceiro = {}, situacoes = []) {
  const limiteDefinido = Number(parceiro.LIMCRED || 0);
  const sugestao = Number(parceiro.SUGESTAO_LIMCRED || 0);
  const qtdPedidos = Number(parceiro.QTD_PEDIDOS_SUGESTAO || 0);
  const possuiLimite = parceiro.LIMCRED_CADASTRADO === 'S';
  const possuiSugestao = sugestao > 0 && qtdPedidos > 0;
  const sugestaoPorFaixa = !possuiSugestao
    ? 0
    : sugestao < 2000
      ? 2000
      : sugestao <= 5000
        ? 5000
        : sugestao;
  const valorCampo = possuiLimite ? limiteDefinido : possuiSugestao ? sugestaoPorFaixa : '';
  const tipoIndicador = possuiLimite ? 'definido' : 'sugestao';
  const icone = possuiLimite ? 'circle-check' : 'lightbulb';
  const textoIndicador = possuiLimite
    ? limiteDefinido === 0 && possuiSugestao
      ? `Valor definido no Sankhya | Media (${qtdPedidos} pedidos): ${formatarMoeda(sugestao)}`
      : 'Valor definido no Sankhya'
    : possuiSugestao
      ? `Sugestao: ${formatarMoeda(sugestaoPorFaixa)} | Media (${qtdPedidos} pedidos): ${formatarMoeda(sugestao)}`
      : 'Sem limite definido e sem historico de pedidos';
  const opcoesSituacao = situacoes.map((item) => `
    <option value="${escaparAtributo(item.VALOR)}" ${String(item.VALOR) === String(parceiro.SITUACAO || '') ? 'selected' : ''}>${escaparHtml(item.OPCAO)}</option>
  `).join('');

  return `
    <div class="contato-info-section contato-limite-section">
      <h3><span class="contato-section-icon">${iconeContato('documento')}</span>Limite de credito</h3>
      <div class="contato-limite-form">
        <div class="contato-credito-fields">
          <label>
            <span>Valor do limite</span>
            <div class="contato-limite-input-wrap">
              <span>R$</span>
              <input
                id="contato-limite-credito"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                value="${valorCampo === '' ? '' : escaparAtributo(Number(valorCampo).toFixed(2))}"
                placeholder="Sem sugestao"
              >
            </div>
          </label>
          <label>
            <span>Situacao de credito</span>
            <select id="contato-situacao-credito">
              <option value="">Selecione</option>
              ${opcoesSituacao}
            </select>
          </label>
          <div class="contato-limite-feedback contato-limite-feedback-inline contato-credito-full">
            <span class="contato-limite-indicador ${tipoIndicador}" id="contato-limite-indicador">
              <i data-lucide="${icone}" aria-hidden="true"></i>
            </span>
            <span id="contato-limite-origem">${escaparHtml(textoIndicador)}</span>
          </div>
          <label class="contato-credito-full">
            <span>Observacoes</span>
            <textarea id="contato-observacoes" maxlength="4000" rows="4">${escaparHtml(parceiro.OBSERVACOES || '')}</textarea>
          </label>
          <label class="contato-credito-full">
            <span>Motivo do bloqueio</span>
            <textarea id="contato-motivo-bloqueio" rows="3" readonly>${escaparHtml(parceiro.MOTBLOQ || '')}</textarea>
          </label>
        </div>
        <button class="contato-limite-save" id="contato-salvar-limite" type="button">Salvar</button>
      </div>
      <span class="contato-limite-status" id="contato-limite-status" aria-live="polite"></span>
    </div>
  `;
}

function mostrarListaContato() {
  contatoDetalheCard.hidden = true;
  document.querySelector('.contato-lista-card').hidden = false;
}

async function voltarERecarregarListaContato() {
  mostrarListaContato();
  contatoDetalheAtual = null;

  if (contatoOrigemLista === 'atualizados') {
    await carregarClientesAtualizadosContato();
    return;
  }

  if (contatoOrigemLista === 'pesquisa' && contatoBusca.value.trim()) {
    await buscarClientesContato();
    return;
  }

  if (contatoCidade.value) {
    await carregarClientesContato(contatoPaginacao.pagina, true);
    return;
  }

  desenharClientesContato();
}

function mostrarDetalheContato() {
  document.querySelector('.contato-lista-card').hidden = true;
  contatoDetalheCard.hidden = false;
}

function obterProximoClienteContato(codParcAtual) {
  const clientes = obterClientesContatoOrdenados();
  const indiceAtual = clientes.findIndex((cliente) => String(cliente.CODPARC) === String(codParcAtual));
  return indiceAtual >= 0 ? clientes[indiceAtual + 1] || null : null;
}

function atualizarBotaoProximoClienteContato(codParcAtual) {
  if (!botaoProximoClienteContatos) return;

  const proximo = obterProximoClienteContato(codParcAtual);
  botaoProximoClienteContatos.disabled = !proximo;
  botaoProximoClienteContatos.title = proximo
    ? `Abrir ${proximo.NOMEPARC || `cliente ${proximo.CODPARC}`}`
    : 'Este e o ultimo cliente da lista';
}

function abrirProximoClienteContato() {
  const proximo = obterProximoClienteContato(contatoDetalheAtual?.CODPARC);
  if (proximo) abrirDetalheContato(proximo.CODPARC);
}

function renderizarDetalheContato(payload) {
  const parceiro = payload?.parceiro || {};
  const contatos = payload?.contatos || [];
  const perfis = payload?.perfis || [];
  const situacoes = payload?.situacoes || [];
  const endereco = montarEnderecoContato(parceiro);
  contatoDetalheAtual = parceiro;
  botaoCriarCardBitrix.disabled = false;
  contatoBitrixStatus.textContent = '';
  contatoBitrixStatus.className = 'contato-bitrix-status';

  contatoDetalheNome.textContent = parceiro.NOMEPARC || 'Cliente';
  contatoDetalheAvatar.textContent = obterIniciaisContato(parceiro.NOMEPARC);
  contatoDetalheSubtitulo.innerHTML = `
    <span>${escaparHtml(valorContato(parceiro.CODPARC))}</span>
    <span aria-hidden="true">|</span>
    ${criarSelectPerfilCliente(perfis, parceiro.CODTIPPARC)}
  `;
  const statusContato = obterStatusContatoCliente(parceiro);
  contatoDetalheAtivo.innerHTML = `
    <span class="contato-header-status contato-header-status-active"><span></span>Ativo</span>
    <span class="contato-header-status contato-header-status-${escaparAtributo(statusContato)}"><span></span>${escaparHtml(rotuloStatusContato(statusContato))}</span>
  `;
  atualizarBotaoProximoClienteContato(parceiro.CODPARC);

  contatoDetalheConteudo.innerHTML = `
    <div class="contato-detalhe-col">
      ${criarPainelLimiteCredito(parceiro, situacoes)}
      <div class="contato-info-section">
        <h3><span class="contato-section-icon">${iconeContato('documento')}</span>Informacoes basicas</h3>
        <div class="contato-info-grid">
          ${criarInfoItemContato('Codigo', parceiro.CODPARC)}
          ${criarInfoItemContato('Ativo', parceiro.ATIVO)}
          ${criarInfoItemContatoFull('Nome', parceiro.NOMEPARC)}
          ${criarInfoItemContatoFull('Razao social', parceiro.RAZAOSOCIAL)}
          ${criarInfoItemContato('CNPJ/CPF', parceiro.CGC_CPF)}
          ${criarInfoItemContato('Tipo pessoa', parceiro.TIPO_PESSOA)}
          ${criarInfoItemContatoDestaque('Vendedor preferencial', parceiro.VENDEDOR_PREFERENCIAL ? `${parceiro.CODVEND} - ${parceiro.VENDEDOR_PREFERENCIAL}` : '-')}
          ${criarInfoItemContato('Ultima compra', parceiro.ULTIMA_COMPRA || 'Sem compra')}
          ${criarInfoItemContato('Ultimo contato', parceiro.DTULTCONTATO)}
          ${criarInfoItemContato('Atualizado contato', parceiro.DATA_ATUALIZACAO_CONTATO)}
        </div>
      </div>
      <div class="contato-info-section">
        <h3><span class="contato-section-icon">${iconeContato('endereco')}</span>Endereco</h3>
        <div class="contato-person-card">
          <div class="contato-person-avatar">${iconeContato('endereco')}</div>
          <div>
            <strong>${escaparHtml(endereco || '-')}</strong>
            <span>${escaparHtml(parceiro.CIDADE && parceiro.UF ? `${parceiro.CIDADE}-${parceiro.UF}` : valorContato(parceiro.CIDADE))}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="contato-detalhe-col">
      <div class="contato-info-section">
        <h3><span class="contato-section-icon">${iconeContato('telefone')}</span>Contato principal da empresa</h3>
        <div class="contato-edit-form" id="contato-edit-form">
          ${criarCampoContatoEditavel('telefone', 'telefonePrincipal', 'Telefone principal', parceiro.TELEFONE || '')}
          ${criarCampoContatoEditavel('telefone', 'celularPrincipal', 'Celular principal', parceiro.FAX || '')}
          ${criarCampoContatoEditavel('email', 'email', 'Email', parceiro.EMAIL)}
        </div>
      </div>
      <div class="contato-info-section">
        <h3><span class="contato-section-icon">${iconeContato('grupo')}</span>Contatos cadastrados</h3>
        ${montarContatosEditaveis(contatos)}
        <div class="contato-save-panel">
          <button class="btn-start contato-save-button" id="contato-salvar" type="button">Salvar contatos</button>
          <button class="btn-back contato-wait-button" id="contato-aguardando" type="button">Aguardando resposta</button>
        </div>
        <div class="contato-save-status" id="contato-save-status"></div>
      </div>
    </div>
  `;

  document.getElementById('contato-salvar')?.addEventListener('click', () => salvarContatoCliente('salvar'));
  document.getElementById('contato-aguardando')?.addEventListener('click', () => salvarContatoCliente('aguardando'));
  document.getElementById('contato-salvar-perfil')?.addEventListener('click', salvarPerfilCliente);
  document.getElementById('contato-salvar-limite')?.addEventListener('click', salvarLimiteCreditoCliente);
  document.getElementById('contato-adicionar')?.addEventListener('click', adicionarContatoExtra);
  document.querySelectorAll('.contato-remove-button').forEach((botao) => {
    botao.addEventListener('click', () => botao.closest('.contato-card-edit')?.remove());
  });
  atualizarIcones();
}

function obterDadosContatoEditados() {
  const form = document.getElementById('contato-edit-form');
  const dados = {};

  if (!form) return dados;

  form.querySelectorAll('input[name]').forEach((input) => {
    dados[input.name] = input.value.trim();
  });

  return dados;
}

async function salvarPerfilCliente() {
  if (!contatoDetalheAtual?.CODPARC) return;

  const select = document.getElementById('contato-perfil-cliente');
  const botao = document.getElementById('contato-salvar-perfil');
  const status = document.getElementById('contato-perfil-status');
  if (!select || !botao) return;

  botao.disabled = true;
  if (status) {
    status.textContent = 'Salvando...';
    status.className = 'contato-perfil-status';
  }

  try {
    const res = await fetch(`/api/contatos/clientes/${encodeURIComponent(contatoDetalheAtual.CODPARC)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'salvar-perfil', codTipParc: select.value })
    });
    const resposta = await res.json();

    if (!res.ok) {
      throw new Error(resposta.erro || 'Erro ao salvar perfil');
    }

    const perfil = resposta.parceiro?.PERFIL || 'Sem perfil';
    const codTipParc = resposta.parceiro?.CODTIPPARC || '';
    contatoDetalheAtual = { ...contatoDetalheAtual, PERFIL: perfil, CODTIPPARC: codTipParc };
    atualizarClienteContatoNaLista(contatoDetalheAtual.CODPARC, { PERFIL: perfil, CODTIPPARC: codTipParc });

    if (status) {
      status.textContent = 'Perfil salvo.';
      status.classList.add('success');
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.classList.add('error');
    }
  } finally {
    botao.disabled = false;
  }
}

async function salvarLimiteCreditoCliente() {
  if (!contatoDetalheAtual?.CODPARC) return;

  const input = document.getElementById('contato-limite-credito');
  const situacaoInput = document.getElementById('contato-situacao-credito');
  const observacoesInput = document.getElementById('contato-observacoes');
  const botao = document.getElementById('contato-salvar-limite');
  const status = document.getElementById('contato-limite-status');
  const indicador = document.getElementById('contato-limite-indicador');
  const origem = document.getElementById('contato-limite-origem');
  if (!input || !situacaoInput || !observacoesInput || !botao) return;

  const limiteCredito = Number(input.value);
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0 || input.value.trim() === '') {
    status.textContent = 'Informe um valor valido.';
    status.className = 'contato-limite-status error';
    return;
  }

  if (!situacaoInput.value) {
    status.textContent = 'Selecione a situacao de credito.';
    status.className = 'contato-limite-status error';
    situacaoInput.focus();
    return;
  }

  botao.disabled = true;
  status.textContent = 'Salvando...';
  status.className = 'contato-limite-status';

  try {
    const res = await fetch(`/api/contatos/clientes/${encodeURIComponent(contatoDetalheAtual.CODPARC)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'salvar-limite',
        limiteCredito,
        situacao: situacaoInput.value,
        observacoes: observacoesInput.value
      })
    });
    const resposta = await res.json();

    if (!res.ok) {
      throw new Error(resposta.erro || 'Erro ao salvar limite de credito');
    }

    const limiteSalvo = Number(resposta.parceiro?.LIMCRED ?? limiteCredito);
    input.value = limiteSalvo.toFixed(2);
    contatoDetalheAtual = {
      ...contatoDetalheAtual,
      LIMCRED: limiteSalvo,
      LIMCRED_CADASTRADO: resposta.parceiro?.LIMCRED_CADASTRADO || 'S',
      SITUACAO: resposta.parceiro?.SITUACAO ?? situacaoInput.value,
      OBSERVACOES: resposta.parceiro?.OBSERVACOES ?? observacoesInput.value,
      MOTBLOQ: resposta.parceiro?.MOTBLOQ ?? contatoDetalheAtual.MOTBLOQ
    };
    atualizarClienteContatoNaLista(contatoDetalheAtual.CODPARC, {
      LIMCRED: limiteSalvo,
      LIMCRED_CADASTRADO: 'S'
    });
    indicador.className = 'contato-limite-indicador definido';
    indicador.innerHTML = '<i data-lucide="circle-check" aria-hidden="true"></i>';
    origem.textContent = 'Valor definido no Sankhya';
    status.textContent = 'Informacoes de credito salvas.';
    status.className = 'contato-limite-status success';
    atualizarIcones();
  } catch (error) {
    status.textContent = error.message;
    status.className = 'contato-limite-status error';
  } finally {
    botao.disabled = false;
  }
}

function obterContatosEditados() {
  return Array.from(document.querySelectorAll('.contato-card-edit')).map((card) => {
    const dados = {
      tipo: card.dataset.tipo || 'extra',
      codContato: card.dataset.codcontato || ''
    };

    card.querySelectorAll('input[name], select[name]').forEach((input) => {
      dados[input.name] = input.value.trim();
    });

    return dados;
  });
}

function validarCamposContatoObrigatorios(dados, contatos) {
  const faltando = [];
  const contatoNfe = contatos.find((contato) => contato.tipo === 'nfe');
  const contatoTransporte = contatos.find((contato) => contato.tipo === 'transporte');
  const contatoFinanceiro = contatos.find((contato) => contato.tipo === 'financeiro');

  if (!contatoValorPreenchido(dados.telefonePrincipal) && !contatoValorPreenchido(dados.celularPrincipal)) {
    faltando.push('telefone ou celular principal');
  }
  if (!contatoValorPreenchido(dados.email)) faltando.push('email principal');

  [
    ['contato NF-e', contatoNfe],
    ['contato de Transporte/Logistica', contatoTransporte],
    ['contato Financeiro', contatoFinanceiro]
  ].forEach(([titulo, contato]) => {
    if (!contatoValorPreenchido(contato?.nome)) faltando.push(`nome do ${titulo}`);
    if (!contatoValorPreenchido(contato?.cargo)) faltando.push(`cargo do ${titulo}`);
    if (!contatoValorPreenchido(contato?.telefone)) faltando.push(`telefone do ${titulo}`);
    if (!contatoValorPreenchido(contato?.email)) faltando.push(`email do ${titulo}`);
  });

  return faltando;
}

function adicionarContatoExtra() {
  const lista = document.getElementById('contato-extra-list');
  if (!lista) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = criarCardContatoEditavel({}, 'extra', 'Contato adicional').trim();
  const card = wrapper.firstElementChild;
  lista.appendChild(card);
  card.querySelector('.contato-remove-button')?.addEventListener('click', () => card.remove());
  card.querySelector('input[name="nome"]')?.focus();
}

function atualizarClienteContatoNaLista(codParc, alteracoes = {}) {
  contatoClientesAtuais = contatoClientesAtuais.map((cliente) => {
    if (String(cliente.CODPARC) !== String(codParc)) return cliente;
    return { ...cliente, ...alteracoes };
  });
  desenharClientesContato();
}

async function salvarContatoCliente(acao) {
  if (!contatoDetalheAtual?.CODPARC) return;

  const statusEl = document.getElementById('contato-save-status');
  const botaoSalvar = document.getElementById('contato-salvar');
  const botaoAguardando = document.getElementById('contato-aguardando');
  const codParc = contatoDetalheAtual.CODPARC;
  const payload = {
    acao,
    ...obterDadosContatoEditados(),
    contatos: obterContatosEditados()
  };

  if (acao === 'salvar') {
    const faltando = validarCamposContatoObrigatorios(payload, payload.contatos);
    if (faltando.length > 0) {
      if (statusEl) {
        statusEl.textContent = `Preencha os campos obrigatorios: ${faltando.join(', ')}`;
        statusEl.className = 'contato-save-status error';
      }
      return;
    }
  }

  if (statusEl) {
    statusEl.textContent = acao === 'aguardando' ? 'Marcando como aguardando resposta...' : 'Salvando contatos...';
    statusEl.className = 'contato-save-status';
  }

  botaoSalvar?.setAttribute('disabled', 'disabled');
  botaoAguardando?.setAttribute('disabled', 'disabled');

  try {
    const res = await fetch(`/api/contatos/clientes/${encodeURIComponent(codParc)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resposta = await res.json();

    if (!res.ok) {
      throw new Error(resposta.erro || 'Erro ao atualizar contato');
    }

    const statusContato = resposta.statusContato || (acao === 'aguardando' ? 'aguardando' : 'atualizado');
    const dataAtualizacao = resposta.parceiro?.DATA_ATUALIZACAO_CONTATO || contatoDetalheAtual.DATA_ATUALIZACAO_CONTATO;
    const perfilAtualizado = resposta.parceiro?.PERFIL || contatoDetalheAtual.PERFIL;
    const codTipParcAtualizado = resposta.parceiro?.CODTIPPARC ?? contatoDetalheAtual.CODTIPPARC;
    contatoDetalheAtual = {
      ...contatoDetalheAtual,
      STATUS_ATUALIZACAO_CONTATO: statusContato,
      DATA_ATUALIZACAO_CONTATO: dataAtualizacao,
      PERFIL: perfilAtualizado,
      CODTIPPARC: codTipParcAtualizado
    };
    atualizarClienteContatoNaLista(codParc, {
      STATUS_ATUALIZACAO_CONTATO: statusContato,
      DATA_ATUALIZACAO_CONTATO: dataAtualizacao,
      PERFIL: perfilAtualizado,
      CODTIPPARC: codTipParcAtualizado
    });

    if (statusEl) {
      statusEl.textContent = statusContato === 'aguardando'
        ? 'Cliente marcado como aguardando resposta.'
        : 'Contatos salvos com sucesso.';
      statusEl.classList.add(statusContato === 'aguardando' ? 'warning' : 'success');
    }

    if (contatoDetalheAtivo) {
      contatoDetalheAtivo.textContent = `${contatoDetalheAtual.ATIVO ? `Ativo: ${contatoDetalheAtual.ATIVO}` : 'Ativo'} | ${rotuloStatusContato(statusContato)}`;
    }
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = error.message;
      statusEl.classList.add('error');
    }
  } finally {
    botaoSalvar?.removeAttribute('disabled');
    botaoAguardando?.removeAttribute('disabled');
  }
}

async function abrirDetalheContato(codParc) {
  if (!codParc) return;

  mostrarDetalheContato();
  atualizarBotaoProximoClienteContato(codParc);
  contatoDetalheAtual = null;
  botaoCriarCardBitrix.disabled = true;
  contatoBitrixStatus.textContent = '';
  contatoDetalheNome.textContent = 'Carregando cliente...';
  contatoDetalheAvatar.textContent = '--';
  contatoDetalheSubtitulo.textContent = `Codigo ${codParc}`;
  contatoDetalheAtivo.textContent = 'Carregando';
  contatoDetalheConteudo.innerHTML = '<div class="consulta-empty">Buscando dados do cliente...</div>';

  try {
    const res = await fetch(`/api/contatos/clientes/${encodeURIComponent(codParc)}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao carregar cliente');
    }

    renderizarDetalheContato(payload);
  } catch (error) {
    contatoDetalheAtual = null;
    contatoDetalheNome.textContent = 'Erro ao carregar cliente';
    contatoDetalheAvatar.textContent = '!';
    contatoDetalheSubtitulo.textContent = '';
    contatoDetalheAtivo.textContent = 'Erro';
    contatoDetalheConteudo.innerHTML = `<div class="consulta-empty">${escaparHtml(error.message)}</div>`;
  }
}

function abrirConfirmacaoCardBitrix() {
  if (!contatoDetalheAtual?.CODPARC || botaoCriarCardBitrix.disabled) return;
  bitrixConfirmModal.classList.remove('is-processing');
  bitrixConfirmText.textContent = `Confirma a criacao do card para ${contatoDetalheAtual.CODPARC} - ${contatoDetalheAtual.NOMEPARC || 'este cliente'}?`;
  bitrixCardTitle.value = `${contatoDetalheAtual.CODPARC} - ${contatoDetalheAtual.NOMEPARC || 'Cliente'}`;
  bitrixCardTitle.disabled = false;
  bitrixConfirmResult.textContent = '';
  bitrixConfirmResult.className = 'bitrix-confirm-result';
  botaoCancelarBitrix.textContent = 'Cancelar';
  botaoCancelarBitrix.disabled = false;
  botaoConfirmarBitrix.textContent = 'Confirmar envio';
  botaoConfirmarBitrix.disabled = false;
  botaoConfirmarBitrix.hidden = false;
  bitrixConfirmModal.hidden = false;
  atualizarIcones();
}

function fecharConfirmacaoCardBitrix() {
  if (bitrixConfirmModal.classList.contains('is-processing')) return;
  bitrixConfirmModal.hidden = true;
}

async function criarCardBitrixCliente() {
  if (!contatoDetalheAtual?.CODPARC || botaoConfirmarBitrix.disabled) return;
  const codParc = contatoDetalheAtual.CODPARC;
  const tituloCard = bitrixCardTitle.value.trim();
  if (!tituloCard) {
    bitrixConfirmResult.textContent = 'Informe o nome do card.';
    bitrixConfirmResult.className = 'bitrix-confirm-result error';
    bitrixCardTitle.focus();
    return;
  }
  botaoCriarCardBitrix.disabled = true;
  botaoConfirmarBitrix.disabled = true;
  botaoCancelarBitrix.disabled = true;
  bitrixCardTitle.disabled = true;
  bitrixConfirmModal.classList.add('is-processing');
  bitrixConfirmResult.textContent = '';
  bitrixConfirmResult.className = 'bitrix-confirm-result';
  contatoBitrixStatus.textContent = 'Enviando...';
  contatoBitrixStatus.className = 'contato-bitrix-status';

  try {
    const res = await fetch(`/api/contatos/clientes/${encodeURIComponent(codParc)}/bitrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tituloCard })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error([payload.erro, payload.detalhes].filter(Boolean).join(' - ') || 'Erro ao criar card');
    const mensagem = payload.negocio?.criado
      ? `Card criado em ${payload.funil?.nome || 'Atualizacao Cadastral'}, etapa ${payload.etapa?.nome || 'Aguardando Contato'}.`
      : 'Este cliente ja possui card nesse funil.';
    contatoBitrixStatus.textContent = mensagem;
    contatoBitrixStatus.classList.add('success');
    bitrixConfirmResult.textContent = mensagem;
    bitrixConfirmResult.classList.add('success');
    botaoCancelarBitrix.textContent = 'Fechar';
    botaoConfirmarBitrix.hidden = true;
  } catch (error) {
    contatoBitrixStatus.textContent = error.message;
    contatoBitrixStatus.classList.add('error');
    bitrixConfirmResult.textContent = error.message;
    bitrixConfirmResult.classList.add('error');
    botaoCancelarBitrix.textContent = 'Fechar';
    botaoConfirmarBitrix.textContent = 'Tentar novamente';
  } finally {
    bitrixConfirmModal.classList.remove('is-processing');
    botaoCriarCardBitrix.disabled = false;
    botaoCancelarBitrix.disabled = false;
    bitrixCardTitle.disabled = false;
    botaoConfirmarBitrix.disabled = false;
  }
}

function desenharClientesContato() {
  const clientes = obterClientesContatoOrdenados();

  if (!clientes.length) {
    const periodoAtivo = contatoCompraInicial.value || contatoCompraFinal.value;
    const indicadorVazio = contatoOrdenacaoUltimaCompra === 'asc' ? '&uarr;' : contatoOrdenacaoUltimaCompra === 'desc' ? '&darr;' : '&varr;';
    contatoClientesLista.innerHTML = `
      ${criarCabecalhoListaContato(indicadorVazio)}
      <div class="consulta-empty">${periodoAtivo ? 'Nenhum cliente da lista possui ultima compra neste periodo.' : 'Nenhum cliente encontrado para os filtros selecionados.'}</div>
    `;
    contatoStatus.textContent = '0 clientes';
    configurarCabecalhoListaContato();
    atualizarPaginacaoContato();
    return;
  }

  const indicadorOrdenacao = contatoOrdenacaoUltimaCompra === 'asc' ? '↑' : contatoOrdenacaoUltimaCompra === 'desc' ? '↓' : '↕';

  const linhas = clientes.map((cliente) => {
    const statusContato = obterStatusContatoCliente(cliente);

    return `
      <div class="contato-row contato-status-${statusContato}">
        ${criarIndicadorLimiteCreditoLista(cliente)}
        <div class="contato-codigo">${escaparHtml(cliente.CODPARC)}</div>
        <div class="contato-nome" title="${escaparAtributo(cliente.NOMEPARC || '-')}">
          <button class="contato-link" type="button" data-codparc="${escaparAtributo(cliente.CODPARC)}">${escaparHtml(cliente.NOMEPARC || '-')}</button>
        </div>
        <div class="contato-ativo">${escaparHtml(cliente.ATIVO || '-')}</div>
        <div class="contato-perfil" title="${escaparAtributo(cliente.PERFIL || '-')}">${escaparHtml(cliente.PERFIL || '-')}</div>
        <div class="contato-vendedor" title="${escaparAtributo(cliente.VENDEDOR || 'Sem vendedor')}">${escaparHtml(cliente.VENDEDOR || 'Sem vendedor')}</div>
        <div class="contato-compra">
          <span>${escaparHtml(cliente.ULTIMA_COMPRA || 'Sem compra')}</span>
          <span class="contato-status-badge">${escaparHtml(rotuloStatusContato(statusContato))}</span>
        </div>
      </div>
    `;
  }).join('');

  contatoClientesLista.innerHTML = `
    ${criarCabecalhoListaContato(indicadorOrdenacao)}
    ${linhas}
  `;
  configurarCabecalhoListaContato();
  const periodoAtivo = contatoCompraInicial.value || contatoCompraFinal.value;
  contatoStatus.textContent = contatoOrigemLista === 'cidade'
    ? `${contatoClientesAtuais.length} nesta pagina de ${contatoPaginacao.total} clientes`
    : periodoAtivo
      ? `${clientes.length} de ${contatoClientesAtuais.length} clientes no periodo`
      : `${clientes.length} clientes`;
  atualizarPaginacaoContato();
}

function renderizarClientesContato(clientes = [], paginacao = null, facetas = null, preservarGrade = false) {
  contatoClientesAtuais = clientes;
  if (facetas) {
    contatoFacetas = {
      perfis: Array.isArray(facetas.perfis) ? facetas.perfis : [],
      vendedores: Array.isArray(facetas.vendedores) ? facetas.vendedores : [],
      status: Array.isArray(facetas.status) ? facetas.status : ['Pendente', 'Aguardando', 'Atualizado']
    };
  }
  contatoPaginacao = paginacao
    ? {
        pagina: Number(paginacao.pagina) || 1,
        tamanho: Number(paginacao.tamanho) || 50,
        total: Number(paginacao.total) || 0,
        totalPaginas: Number(paginacao.totalPaginas) || 1
      }
    : { pagina: 1, tamanho: 50, total: clientes.length, totalPaginas: 1 };
  if (!preservarGrade) {
    contatoOrdenacaoColuna = { coluna: '', direcao: '' };
    contatoOrdenacaoUltimaCompra = '';
    contatoFiltrosColuna = { perfil: null, vendedor: null, status: null };
    contatoCompraInicial.value = '';
    contatoCompraFinal.value = '';
  }
  mostrarListaContato();
  desenharClientesContato();
}

async function carregarClientesAtualizadosContato() {
  contatoOrigemLista = 'atualizados';
  mostrarListaContato();
  limparBuscaContato();
  contatoListaTitulo.textContent = 'Clientes atualizados';
  contatoStatus.textContent = 'Carregando atualizados...';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Buscando todos os cadastros atualizados...</div>';
  contatoPagination.hidden = true;
  botaoExibirContatosAtualizados.disabled = true;

  try {
    const res = await fetch('/api/contatos/atualizados');
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao buscar clientes atualizados');
    }

    renderizarClientesContato(payload.clientes || []);
    contatoListaTitulo.textContent = 'Clientes atualizados';
    contatoStatus.textContent = `${(payload.clientes || []).length} clientes atualizados`;
  } catch (error) {
    contatoStatus.textContent = 'Erro ao buscar atualizados';
    contatoClientesLista.innerHTML = `<div class="consulta-empty">${escaparHtml(error.message)}</div>`;
  } finally {
    botaoExibirContatosAtualizados.disabled = false;
  }
}

function limparSelecaoContato(mensagem = 'Selecione perfil, estado e cidade.') {
  contatoOrigemLista = 'nenhuma';
  mostrarListaContato();
  contatoListaTitulo.textContent = 'Clientes da cidade';
  contatoClientesAtuais = [];
  contatoOrdenacaoUltimaCompra = '';
  contatoEstado.innerHTML = '<option value="">Selecione o estado</option>';
  contatoEstado.disabled = true;
  contatoCidade.innerHTML = '<option value="">Selecione a cidade</option>';
  contatoCidade.disabled = true;
  contatoClientesAtuais = [];
  contatoOrdenacaoUltimaCompra = '';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione uma cidade para listar os clientes.</div>';
  contatoPagination.hidden = true;
  contatoStatus.textContent = mensagem;
}

function limparBuscaContato() {
  contatoBusca.value = '';
  if (contatoBuscaTimer) {
    clearTimeout(contatoBuscaTimer);
    contatoBuscaTimer = null;
  }
}

function parametroAtivosContato() {
  return contatoSomenteAtivos.checked ? '1' : '0';
}

async function carregarPerfisContato() {
  contatoStatus.textContent = 'Carregando perfis...';
  contatoPerfil.innerHTML = '<option value="">Carregando perfis...</option>';
  limparBuscaContato();
  limparSelecaoContato('Carregando perfis...');

  try {
    const res = await fetch(`/api/contatos/perfis?ativos=${parametroAtivosContato()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao carregar perfis');
    }

    const perfis = payload.perfis || [];
    contatoPerfil.innerHTML = '<option value="">Selecione o perfil</option>';
    perfis.forEach((perfil) => {
      const option = document.createElement('option');
      option.value = perfil.CODTIPPARC;
      option.textContent = perfil.DESCRTIPPARC;
      contatoPerfil.appendChild(option);
    });
    contatoStatus.textContent = `${perfis.length} perfis`;
  } catch (error) {
    contatoPerfil.innerHTML = '<option value="">Erro ao carregar</option>';
    contatoStatus.textContent = error.message;
  }
}

async function carregarEstadosContato() {
  const codPerfil = contatoPerfil.value;
  limparBuscaContato();
  mostrarListaContato();

  if (!codPerfil) {
    limparSelecaoContato('Selecione o perfil.');
    return;
  }

  contatoStatus.textContent = 'Carregando estados...';
  contatoEstado.innerHTML = '<option value="">Carregando estados...</option>';
  contatoEstado.disabled = true;
  contatoCidade.innerHTML = '<option value="">Selecione a cidade</option>';
  contatoCidade.disabled = true;
  contatoClientesAtuais = [];
  contatoOrdenacaoUltimaCompra = '';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione uma cidade para listar os clientes.</div>';

  try {
    const res = await fetch(`/api/contatos/estados?perfil=${encodeURIComponent(codPerfil)}&ativos=${parametroAtivosContato()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao carregar estados');
    }

    const estados = payload.estados || [];
    contatoEstado.innerHTML = '<option value="">Selecione o estado</option><option value="todos">Todos os estados</option>';
    estados.forEach((estado) => {
      const option = document.createElement('option');
      option.value = estado.UF;
      option.textContent = estado.UF;
      contatoEstado.appendChild(option);
    });
    contatoEstado.disabled = false;
    contatoStatus.textContent = `${estados.length} estados`;
  } catch (error) {
    contatoEstado.innerHTML = '<option value="">Erro ao carregar</option>';
    contatoStatus.textContent = error.message;
  }
}

async function carregarCidadesContato() {
  const codPerfil = contatoPerfil.value;
  const uf = contatoEstado.value;
  limparBuscaContato();
  mostrarListaContato();
  contatoCidade.innerHTML = '<option value="">Selecione a cidade</option>';
  contatoCidade.disabled = true;
  contatoClientesAtuais = [];
  contatoOrdenacaoUltimaCompra = '';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione uma cidade para listar os clientes.</div>';

  if (!codPerfil) {
    contatoStatus.textContent = 'Selecione o perfil.';
    return;
  }

  if (!uf) {
    contatoStatus.textContent = 'Selecione estado e cidade.';
    return;
  }

  contatoStatus.textContent = 'Carregando cidades...';

  try {
    const res = await fetch(`/api/contatos/cidades?perfil=${encodeURIComponent(codPerfil)}&uf=${encodeURIComponent(uf)}&ativos=${parametroAtivosContato()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao carregar cidades');
    }

    const cidades = payload.cidades || [];
    contatoCidade.innerHTML = '<option value="">Selecione a cidade</option><option value="todos">Todas as cidades</option>';
    cidades.forEach((cidade) => {
      const option = document.createElement('option');
      option.value = cidade.CODCID;
      option.textContent = cidade.NOMECID;
      contatoCidade.appendChild(option);
    });
    contatoCidade.disabled = false;
    contatoStatus.textContent = `${cidades.length} cidades`;
  } catch (error) {
    contatoStatus.textContent = error.message;
  }
}

async function carregarClientesContato(pagina = 1, preservarGrade = false) {
  const codPerfil = contatoPerfil.value;
  const codCidade = contatoCidade.value;
  const uf = contatoEstado.value;
  limparBuscaContato();
  mostrarListaContato();
  contatoListaTitulo.textContent = 'Clientes da cidade';

  if (!codPerfil) {
    contatoClientesAtuais = [];
    contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione um perfil antes de listar os clientes.</div>';
    contatoStatus.textContent = 'Selecione o perfil.';
    return;
  }

  if (!codCidade) {
    contatoClientesAtuais = [];
    contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione uma cidade para listar os clientes.</div>';
    contatoStatus.textContent = 'Selecione uma cidade.';
    return;
  }

  if (!preservarGrade) {
    contatoOrdenacaoColuna = { coluna: '', direcao: '' };
    contatoOrdenacaoUltimaCompra = '';
    contatoFiltrosColuna = { perfil: null, vendedor: null, status: null };
    contatoCompraInicial.value = '';
    contatoCompraFinal.value = '';
  }

  contatoOrigemLista = 'cidade';

  contatoStatus.textContent = 'Carregando clientes...';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Buscando clientes da cidade...</div>';

  try {
    const params = new URLSearchParams({
      perfil: codPerfil,
      uf,
      cidade: codCidade,
      ativos: parametroAtivosContato(),
      pagina: String(Number(pagina) || 1)
    });
    if (contatoCompraInicial.value) params.set('dataInicial', contatoCompraInicial.value);
    if (contatoCompraFinal.value) params.set('dataFinal', contatoCompraFinal.value);
    if (contatoFiltrosColuna.perfil !== null) {
      params.set('perfisGrade', JSON.stringify([...contatoFiltrosColuna.perfil]));
    }
    if (contatoFiltrosColuna.vendedor !== null) {
      params.set('vendedoresGrade', JSON.stringify([...contatoFiltrosColuna.vendedor]));
    }
    if (contatoFiltrosColuna.status !== null) {
      params.set('statusGrade', JSON.stringify([...contatoFiltrosColuna.status]));
    }
    if (contatoOrdenacaoColuna.coluna) {
      params.set('ordenar', contatoOrdenacaoColuna.coluna);
      params.set('direcao', contatoOrdenacaoColuna.direcao);
    } else if (contatoOrdenacaoUltimaCompra) {
      params.set('ordenar', 'ultima');
      params.set('direcao', contatoOrdenacaoUltimaCompra);
    }
    const res = await fetch(`/api/contatos/clientes?${params}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao carregar clientes');
    }

    renderizarClientesContato(payload.clientes || [], payload.paginacao, payload.facetas, preservarGrade);
  } catch (error) {
    contatoStatus.textContent = 'Erro ao carregar clientes';
    contatoClientesLista.innerHTML = `<div class="consulta-empty">${escaparHtml(error.message)}</div>`;
  }
}

async function buscarClientesContato() {
  const termo = contatoBusca.value.trim();
  mostrarListaContato();
  contatoListaTitulo.textContent = termo ? 'Resultados da pesquisa' : 'Clientes da cidade';
  contatoPagination.hidden = true;

  if (!termo) {
    if (contatoCidade.value) {
      carregarClientesContato();
    } else {
      contatoClientesAtuais = [];
      contatoClientesLista.innerHTML = '<div class="consulta-empty">Selecione uma cidade para listar os clientes.</div>';
      contatoStatus.textContent = 'Selecione uma cidade ou pesquise por codigo, nome ou CNPJ.';
    }
    return;
  }

  if (termo.length < 2) {
    contatoClientesAtuais = [];
    contatoClientesLista.innerHTML = '<div class="consulta-empty">Digite pelo menos 2 caracteres para pesquisar.</div>';
    contatoStatus.textContent = 'Pesquisa inteligente';
    return;
  }

  contatoOrigemLista = 'pesquisa';

  contatoStatus.textContent = 'Pesquisando clientes...';
  contatoClientesLista.innerHTML = '<div class="consulta-empty">Buscando por codigo, nome ou CNPJ...</div>';

  try {
    const res = await fetch(`/api/contatos/busca?q=${encodeURIComponent(termo)}&ativos=${parametroAtivosContato()}`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao pesquisar clientes');
    }

    renderizarClientesContato(payload.clientes || []);
    contatoStatus.textContent = `${(payload.clientes || []).length} resultados para "${termo}"`;
  } catch (error) {
    contatoStatus.textContent = 'Erro ao pesquisar clientes';
    contatoClientesLista.innerHTML = `<div class="consulta-empty">${escaparHtml(error.message)}</div>`;
  }
}

function agendarBuscaContato() {
  if (contatoBuscaTimer) {
    clearTimeout(contatoBuscaTimer);
  }

  contatoBuscaTimer = setTimeout(() => {
    contatoBuscaTimer = null;
    buscarClientesContato();
  }, 280);
}

function alternarFiltroAtivosContato() {
  if (contatoBusca.value.trim()) {
    buscarClientesContato();
    return;
  }

  if (contatoCidade.value) {
    carregarClientesContato();
    return;
  }

  if (contatoEstado.value) {
    carregarCidadesContato();
    return;
  }

  if (contatoPerfil.value) {
    carregarEstadosContato();
    return;
  }

  carregarPerfisContato();
}

function abrirAtualizacaoContato() {
  mostrarHomeESuspenderRefresh();
  mostrarAtualizacaoContato();
  carregarPerfisContato();
  history.pushState({ tela: 'atualizacao-contato' }, '', '#atualizacao-contato');
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
  produtoFotoPanel?.classList.add('produto-foto-vazio');
  produtoFotoPanel?.classList.remove('produto-foto-ultimo', 'produto-foto-selecionado');
  if (produtoFotoTitulo) {
    produtoFotoTitulo.textContent = 'Produto selecionado';
  }
  if (produtoFotoLegenda) {
    produtoFotoLegenda.textContent = 'Clique em um item ou confira um produto.';
  }
  if (produtoFotoFrame) {
    produtoFotoFrame.classList.remove('has-image');
    produtoFotoFrame.innerHTML = `<div class="produto-foto-placeholder">${escaparHtml(mensagem)}</div>`;
  }
}

function fecharModalFotoProduto() {
  if (produtoFotoModal) {
    produtoFotoModal.hidden = true;
  }
  if (produtoFotoModalBody) {
    produtoFotoModalBody.innerHTML = '';
  }
}

function abrirModalFotoProduto() {
  if (!produtoFotoAtual?.src || !produtoFotoModal || !produtoFotoModalBody) {
    return;
  }

  if (produtoFotoModalTitulo) {
    produtoFotoModalTitulo.textContent = produtoFotoAtual.titulo || 'Foto do produto';
  }
  if (produtoFotoModalLegenda) {
    produtoFotoModalLegenda.textContent = produtoFotoAtual.descricao || '-';
  }
  produtoFotoModalBody.innerHTML = `
    <img
      src="${escaparAtributo(produtoFotoAtual.src)}"
      alt="Foto do produto ${escaparAtributo(produtoFotoAtual.descricao || '')}"
    >
  `;
  produtoFotoModal.hidden = false;
  atualizarIcones();
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

  const legendaOrigem = origem === 'ultimo' ? 'Ultimo produto conferido' : 'Produto selecionado';
  const descricaoProduto = item.descrProd || 'Produto';
  const descricao = `${item.codProd} - ${descricaoProduto}`;
  const fotoSrc = `/api/fila-conferencia/produtos/${codProd}/foto?v=${Date.now()}`;
  produtoFotoAtual = { codProd, origem, src: fotoSrc, titulo: legendaOrigem, descricao };
  produtoFotoPanel?.classList.remove('produto-foto-vazio', 'produto-foto-ultimo', 'produto-foto-selecionado');
  produtoFotoPanel?.classList.add(origem === 'ultimo' ? 'produto-foto-ultimo' : 'produto-foto-selecionado');
  if (produtoFotoTitulo) {
    produtoFotoTitulo.textContent = legendaOrigem;
  }
  produtoFotoLegenda.innerHTML = `
    <span class="produto-foto-code">${escaparHtml(item.codProd)}</span>
    <span class="produto-foto-name">${escaparHtml(descricaoProduto)}</span>
  `;
  produtoFotoFrame.innerHTML = `
    <img
      src="${escaparAtributo(fotoSrc)}"
      alt="Foto do produto ${escaparAtributo(descricao)}"
      loading="lazy"
    >
  `;
  produtoFotoFrame.classList.add('has-image');

  const img = produtoFotoFrame.querySelector('img');
  img.addEventListener('error', () => {
    if (produtoFotoAtual?.codProd !== codProd) {
      return;
    }
    produtoFotoAtual = null;
    produtoFotoFrame.classList.remove('has-image');
    produtoFotoFrame.innerHTML = `<div class="produto-foto-placeholder">Foto nao cadastrada para ${escaparHtml(descricao)}.</div>`;
  }, { once: true });
}

function salvarProgressoConferencia(options = {}) {
  if (!pedidoSelecionado || !temUsuarioLogado()) {
    return Promise.resolve(null);
  }

  salvarNavegacaoFila({ etapa: 'conferencia' });

  const dados = {
    nunota: pedidoSelecionado.NUNOTA,
    nuconf: pedidoSelecionado.nuconf || pedidoSelecionado.NUCONFATUAL || null,
    itens: itensPedidoSelecionado.map((item) => ({
      sequencia: item.sequencia,
      qtdConferida: normalizarQuantidade(item.qtdConferida),
      qtdCortada: quantidadeCortadaItem(item),
      leituras: Array.isArray(item.leituras) ? item.leituras.map((leitura) => ({
        ...leitura,
        caixaId: Number(leitura.caixaId) || null,
        caixaFechada: leitura.caixaFechada === true
      })) : []
    })),
    modo: filaModoConferencia,
    // Mantem o comportamento habitual das leituras. A caixa usa false para apenas
    // distribuir seu estado entre dispositivos sem gravar detalhes no Sankhya outra vez.
    sincronizarSankhya: options.sincronizarSankhya !== false
  };

  // Mantem os envios em ordem para que uma leitura recente nao seja substituida por um estado anterior.
  salvamentosProgressoPendentes += 1;
  salvamentoProgressoPendente = salvamentoProgressoPendente
    .catch(() => null)
    .then(async () => {
      salvamentoProgressoEmAndamento = true;
      try {
        const res = await fetch('/api/fila-conferencia/progresso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.erro || 'Erro ao salvar progresso da conferencia');
        return payload;
      } finally {
        salvamentoProgressoEmAndamento = false;
      }
    })
    .catch((error) => {
      console.error('Erro ao salvar progresso da conferencia:', error);
      return null;
    })
    .finally(() => {
      salvamentosProgressoPendentes = Math.max(0, salvamentosProgressoPendentes - 1);
    });

  return salvamentoProgressoPendente;
}

function aplicarProgressoRemotoCaixa(progresso, resumoCaixas = null) {
  if (!progresso || !pedidoSelecionado || Number(progresso.nunota) !== Number(pedidoSelecionado.NUNOTA)) {
    return false;
  }

  const itensPorSequencia = new Map((progresso.itens || []).map((item) => [Number(item.sequencia), item]));
  let alterou = false;
  itensPedidoSelecionado.forEach((item) => {
    const remoto = itensPorSequencia.get(Number(item.sequencia));
    if (!remoto) return;

    const leiturasAtuais = JSON.stringify(item.leituras || []);
    const leiturasRemotas = JSON.stringify(remoto.leituras || []);
    if (leiturasAtuais !== leiturasRemotas || Number(item.qtdConferida) !== Number(remoto.qtdConferida) || Number(item.qtdCortada) !== Number(remoto.qtdCortada)) {
      item.qtdConferida = normalizarQuantidade(remoto.qtdConferida);
      item.qtdCortada = normalizarQuantidade(remoto.qtdCortada);
      item.leituras = Array.isArray(remoto.leituras) ? remoto.leituras : [];
      alterou = true;
    }
  });

  const maiorRemoto = Number(resumoCaixas?.maiorCaixaId || 0);
  if (maiorRemoto > maiorCaixaEntradaRemota) {
    maiorCaixaEntradaRemota = maiorRemoto;
    alterou = true;
  }

  if (alterou) {
    renderizarItensConferencia();
    if (!entradaCaixaModal.hidden) renderizarModalCaixaEntrada();
  }
  return alterou;
}

async function sincronizarCaixaEntrada(forcar = false) {
  if (filaModoConferencia !== 'entrada' || !pedidoSelecionado || !temUsuarioLogado()
    || sincronizacaoCaixaEntradaEmAndamento || (!forcar && (salvamentoProgressoEmAndamento || salvamentosProgressoPendentes > 0))) {
    return null;
  }

  sincronizacaoCaixaEntradaEmAndamento = true;
  try {
    const res = await fetch(`/api/fila-conferencia/progresso?nunota=${encodeURIComponent(pedidoSelecionado.NUNOTA)}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.erro || 'Erro ao sincronizar a caixa');
    aplicarProgressoRemotoCaixa(payload.progresso, payload.resumoCaixas);
    return payload;
  } catch (error) {
    console.warn('Erro ao sincronizar caixa de entrada:', error);
    return null;
  } finally {
    sincronizacaoCaixaEntradaEmAndamento = false;
  }
}

function iniciarSincronizacaoCaixaEntrada() {
  pararSincronizacaoCaixaEntrada();
  if (filaModoConferencia !== 'entrada' || !pedidoSelecionado) return;
  sincronizarCaixaEntrada(true);
  sincronizacaoCaixaEntradaInterval = window.setInterval(() => sincronizarCaixaEntrada(), 2000);
}

function pararSincronizacaoCaixaEntrada() {
  if (sincronizacaoCaixaEntradaInterval) {
    window.clearInterval(sincronizacaoCaixaEntradaInterval);
    sincronizacaoCaixaEntradaInterval = null;
  }
}

async function encerrarCaixaEntradaNoServidor(caixaId) {
  const res = await fetch('/api/fila-conferencia/progresso/caixas/encerrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nunota: pedidoSelecionado?.NUNOTA,
      caixaId,
      modo: filaModoConferencia
    })
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.erro || 'Nao foi possivel encerrar a caixa');
  maiorCaixaEntradaRemota = Math.max(maiorCaixaEntradaRemota, Number(payload.resumo?.maiorCaixaId || 0));
  return payload;
}

function obterLeiturasCaixasEntrada() {
  return itensPedidoSelecionado.flatMap((item) => (item.leituras || [])
    .filter((leitura) => Number(leitura.caixaId) > 0)
    .map((leitura) => ({ item, leitura })));
}

function obterCaixaEntradaAtual() {
  const leituras = obterLeiturasCaixasEntrada();
  const abertas = leituras.filter(({ leitura }) => leitura.caixaFechada !== true);
  const caixaAberta = abertas.reduce((maior, { leitura }) => Math.max(maior, Number(leitura.caixaId) || 0), 0);
  const maiorCaixa = Math.max(
    maiorCaixaEntradaRemota,
    leituras.reduce((maior, { leitura }) => Math.max(maior, Number(leitura.caixaId) || 0), 0)
  );
  const caixaId = caixaAberta || maiorCaixa + 1 || 1;

  return {
    caixaId,
    leituras: abertas.filter(({ leitura }) => Number(leitura.caixaId) === caixaId)
  };
}

function agruparItensCaixaEntrada(caixa = obterCaixaEntradaAtual()) {
  const grupos = new Map();

  caixa.leituras.forEach(({ item, leitura }) => {
    const controle = String(leitura.controle || item.controle || '').trim();
    const validade = formatarDataInput(leitura.dtValidade || item.dtValidade || '');
    const fabricacao = formatarDataInput(leitura.dtFabricacao || item.dtFabricacao || '');
    const chave = [item.codProd, controle, validade, fabricacao].join('|');
    const atual = grupos.get(chave) || {
      codProd: item.codProd,
      descrProd: item.descrProd || `Produto ${item.codProd}`,
      controle,
      validade,
      fabricacao,
      codVol: obterUnidadeExibicaoItem(item),
      quantidade: 0
    };
    atual.quantidade += normalizarQuantidade(leitura.quantidadeConvertida);
    grupos.set(chave, atual);
  });

  return [...grupos.values()];
}

function atualizarCaixaEntrada() {
  const visivel = filaModoConferencia === 'entrada' && Boolean(pedidoSelecionado);
  if (!botaoAbrirEntradaCaixa || !entradaCaixaContador) return;

  botaoAbrirEntradaCaixa.hidden = !visivel;
  if (!visivel) {
    entradaCaixaContador.textContent = '0 itens';
    return;
  }

  const caixa = obterCaixaEntradaAtual();
  const grupos = agruparItensCaixaEntrada(caixa);
  const unidades = grupos.reduce((total, item) => total + item.quantidade, 0);
  entradaCaixaContador.textContent = `${grupos.length} ${grupos.length === 1 ? 'item' : 'itens'}${unidades > 0 ? ` | ${formatarQuantidade(unidades)} un.` : ''}`;
}

function renderizarModalCaixaEntrada() {
  const caixa = obterCaixaEntradaAtual();
  const grupos = agruparItensCaixaEntrada(caixa);
  const unidades = grupos.reduce((total, item) => total + item.quantidade, 0);

  entradaCaixaResumo.textContent = grupos.length > 0
    ? `Caixa ${caixa.caixaId}: ${grupos.length} ${grupos.length === 1 ? 'produto' : 'produtos'} e ${formatarQuantidade(unidades)} unidades.`
    : `Caixa ${caixa.caixaId}: nenhum item bipado ainda.`;
  botaoImprimirEntradaCaixa.disabled = grupos.length === 0;
  botaoZerarEntradaCaixa.disabled = grupos.length === 0;

  if (grupos.length === 0) {
    entradaCaixaLista.innerHTML = '<div class="empty-state">Bipe os produtos desta caixa para visualizar e imprimir as etiquetas.</div>';
  } else {
    entradaCaixaLista.innerHTML = grupos.map((item) => `
      <div class="entrada-caixa-item">
        <span class="entrada-caixa-item-icon"><i data-lucide="package"></i></span>
        <span class="entrada-caixa-item-info">
          <strong>${escaparHtml(item.codProd)} - ${escaparHtml(item.descrProd)}</strong>
          <span>Lote: ${escaparHtml(item.controle || '-')} | Validade: ${escaparHtml(formatarData(item.validade) || '-')}</span>
        </span>
        <span class="entrada-caixa-item-qtd">${formatarQuantidade(item.quantidade)} ${escaparHtml(item.codVol)}</span>
      </div>
    `).join('');
  }

  atualizarIcones();
}

function abrirModalCaixaEntrada() {
  if (filaModoConferencia !== 'entrada' || !pedidoSelecionado) return;
  renderizarModalCaixaEntrada();
  entradaCaixaModal.hidden = false;
}

function fecharModalCaixaEntrada() {
  entradaCaixaModal.hidden = true;
  scanCodigo.focus();
}

function formatarLoteEtiqueta(valor) {
  const lote = String(valor ?? '').trim();
  return lote ? lote.slice(-4) : 'Sem Lote';
}

function formatarValidadeEtiqueta(valor) {
  const data = formatarDataInput(valor);
  return data ? formatarData(data) : 'Sem validade';
}

function montarHtmlEtiquetasCaixaEntrada(caixaId, itens) {
  const etiquetas = itens.map((item) => `
    <section class="label">
      <div class="produto">${escaparHtml(item.codProd)}</div>
      <div class="linha"></div>
      <div class="lote-validade fit-text" data-min-font="8">
        <span>${escaparHtml(formatarLoteEtiqueta(item.controle))}</span>
        <span>-</span>
        <span>${escaparHtml(formatarValidadeEtiqueta(item.validade))}</span>
      </div>
      <div class="linha"></div>
      <div class="descricao fit-text" data-min-font="9">${escaparHtml(item.descrProd || '-')}</div>
    </section>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiquetas caixa ${caixaId}</title>
  <style>
    @page { size: 100mm 50mm; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eee; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .label {
      position: relative;
      width: 100mm;
      height: 50mm;
      padding: 2.2mm 5mm 2mm;
      background: #fff;
      page-break-after: always;
      overflow: hidden;
    }
    .produto {
      height: 20mm;
      padding-bottom: 3.8mm;
      display: grid;
      place-items: center;
      font-size: 68pt;
      line-height: 0.9;
      font-weight: 950;
      letter-spacing: 0;
      transform: translateY(-2mm);
    }
    .linha {
      height: 1.1mm;
      min-height: 1.1mm;
      border-top: 1.1mm solid #000;
      background: transparent;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .lote-validade {
      height: 12.1mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2.5mm;
      font-size: 28pt;
      line-height: 1;
      font-weight: 950;
      white-space: nowrap;
    }
    .descricao {
      height: 10.8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 17pt;
      line-height: 1.05;
      font-weight: 950;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
    }
    @media screen {
      .label { margin: 10px auto; box-shadow: 0 5px 18px rgba(0,0,0,.24); }
    }
    @media print {
      body { background: #fff; }
      .label { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${etiquetas}
  <script>
    function ajustarTexto() {
      document.querySelectorAll('.fit-text').forEach((elemento) => {
        let tamanho = parseFloat(getComputedStyle(elemento).fontSize);
        const minimo = Number(elemento.dataset.minFont || 9);
        while ((elemento.scrollWidth > elemento.clientWidth || elemento.scrollHeight > elemento.clientHeight) && tamanho > minimo) {
          tamanho -= 0.5;
          elemento.style.fontSize = tamanho + 'px';
        }
      });
    }
    window.addEventListener('load', () => {
      ajustarTexto();
      setTimeout(() => window.print(), 180);
    });
  <\/script>
</body>
</html>`;
}

async function imprimirEtiquetasCaixaEntrada() {
  if (window.matchMedia('(max-width: 900px), (pointer: coarse) and (max-width: 1280px)').matches) {
    entradaCaixaResumo.textContent = 'Imprima esta caixa no computador conectado a impressora de etiquetas.';
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    entradaCaixaResumo.textContent = 'O navegador bloqueou a nova guia de impressao.';
    return;
  }

  const progressoSalvo = await salvarProgressoConferencia({ sincronizarSankhya: false });
  if (!progressoSalvo) {
    printWindow.close();
    entradaCaixaResumo.textContent = 'Nao foi possivel sincronizar a caixa antes da impressao.';
    return;
  }
  await sincronizarCaixaEntrada(true);
  const caixa = obterCaixaEntradaAtual();
  const grupos = agruparItensCaixaEntrada(caixa);
  if (grupos.length === 0) {
    printWindow.close();
    return;
  }

  try {
    await encerrarCaixaEntradaNoServidor(caixa.caixaId);
  } catch (error) {
    printWindow.close();
    entradaCaixaResumo.textContent = error.message;
    await sincronizarCaixaEntrada(true);
    return;
  }

  printWindow.document.write(montarHtmlEtiquetasCaixaEntrada(caixa.caixaId, grupos));
  printWindow.document.close();
  caixa.leituras.forEach(({ leitura }) => {
    leitura.caixaFechada = true;
  });
  atualizarCaixaEntrada();
  fecharModalCaixaEntrada();
  scanStatus.innerHTML = `<span class="success-text">Caixa ${caixa.caixaId} concluida. ${grupos.length} etiqueta(s) aberta(s) para impressao.</span>`;
}

async function zerarCaixaEntradaAtual() {
  const progressoSalvo = await salvarProgressoConferencia({ sincronizarSankhya: false });
  if (!progressoSalvo) {
    entradaCaixaResumo.textContent = 'Nao foi possivel sincronizar a caixa antes de zerar.';
    return;
  }
  await sincronizarCaixaEntrada(true);
  const caixa = obterCaixaEntradaAtual();
  if (caixa.leituras.length === 0) return;

  try {
    await encerrarCaixaEntradaNoServidor(caixa.caixaId);
  } catch (error) {
    entradaCaixaResumo.textContent = error.message;
    await sincronizarCaixaEntrada(true);
    return;
  }

  caixa.leituras.forEach(({ leitura }) => { leitura.caixaFechada = true; });
  atualizarCaixaEntrada();
  fecharModalCaixaEntrada();
  scanStatus.innerHTML = `<span class="success-text">Caixa ${caixa.caixaId} zerada. Os itens permanecem conferidos.</span>`;
}

function criarLinhaItemConferencia(item, quantidade, classe, rotuloQuantidade, options = {}) {
  const row = document.createElement('div');
  const entradaDatas = filaModoConferencia === 'entrada';
  row.className = `item-row ${classe}${entradaDatas ? ' entrada-datas' : ''}`;
  const descricao = escaparAtributo(item.descrProd);
  const codigoProduto = escaparAtributo(item.codProd);
  const codigoBarras = escaparAtributo(item.codigoBarras || '-');
  const unidadeExibicao = obterUnidadeExibicaoItem(item);
  const controlesLidos = [...new Set((item.leituras || [])
    .map((leitura) => String(leitura.controle || '').trim())
    .filter(Boolean))];
  const controleExibido = controlesLidos.length > 0 ? controlesLidos.join(', ') : (item.controle || '-');
  const controle = escaparAtributo(controleExibido);
  const quantidadeTexto = rotuloQuantidade || formatarQuantidade(quantidade);
  const quantidadeComUnidade = `${quantidadeTexto} - ${unidadeExibicao}`;
  const datasLidas = Array.isArray(item.leituras) ? item.leituras : [];
  const dataValidadeExibida = datasLidas.find((leitura) => leitura.dtValidade)?.dtValidade || item.dtValidade || '';
  const dataFabricacaoExibida = datasLidas.find((leitura) => leitura.dtFabricacao)?.dtFabricacao || item.dtFabricacao || '';
  row.innerHTML = `
    <div>${options.desfazer ? '<button class="item-action item-action-return" type="button" aria-label="Voltar item para conferencia" title="Voltar item para conferencia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 4 12l6 6"/><path d="M5 12h15"/></svg></button>' : ''}${options.cortar ? '<button class="item-action item-action-cut" type="button" aria-label="Cortar quantidade do item" title="Cortar quantidade do item"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5 19 19"/><path d="M8.5 15.5 19 5"/></svg></button>' : ''}</div>
    <div class="item-code" title="${codigoProduto}">${item.codProd}</div>
    <div class="item-name" title="${descricao}">${item.descrProd}</div>
    <div class="item-qtd" title="${escaparAtributo(quantidadeComUnidade)}">${quantidadeComUnidade}</div>
    <div class="item-unit" title="${controle}">${escaparHtml(controleExibido)}</div>
    ${entradaDatas ? `
      <div class="item-date" title="${escaparAtributo(formatarData(dataFabricacaoExibida))}">${formatarData(dataFabricacaoExibida)}</div>
      <div class="item-date" title="${escaparAtributo(formatarData(dataValidadeExibida))}">${formatarData(dataValidadeExibida)}</div>
    ` : ''}
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
  const entradaDatas = filaModoConferencia === 'entrada';
  header.className = `itens-grid-header${entradaDatas ? ' entrada-datas' : ''}`;
  const colunas = entradaDatas
    ? ['', 'Produto', 'Descricao (Produto)', 'Quantidade', 'Controle', 'Fabricacao', 'Validade', 'Cod. Barras']
    : ['', 'Produto', 'Descricao (Produto)', 'Quantidade', 'Controle', 'Cod. Barras'];
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

function obterLinhasConferidasEntrada(item) {
  if (filaModoConferencia !== 'entrada') {
    return null;
  }

  const leituras = Array.isArray(item.leituras)
    ? item.leituras.filter((leitura) => normalizarQuantidade(leitura.quantidadeConvertida) > 0)
    : [];

  if (leituras.length === 0) {
    return null;
  }

  return leituras.map((leitura) => ({
    item: {
      ...item,
      controle: leitura.controle || item.controle || '',
      dtFabricacao: leitura.dtFabricacao || item.dtFabricacao || '',
      dtValidade: leitura.dtValidade || item.dtValidade || '',
      leituras: [leitura]
    },
    quantidade: normalizarQuantidade(leitura.quantidadeConvertida)
  }));
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
    atualizarCaixaEntrada();
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
      const linhasEntrada = obterLinhasConferidasEntrada(item);

      if (linhasEntrada) {
        linhasEntrada.forEach(({ item: itemLinha, quantidade }) => {
          totalConferidos += 1;
          itensConferidosLista.appendChild(criarLinhaItemConferencia(
            itemLinha,
            quantidade,
            itemTemExcesso(item) ? 'excesso' : (quantidadeCortada > 0 ? 'cortado' : 'ok'),
            `${formatarQuantidade(quantidade)} / ${formatarQuantidade(item.qtdNeg)}${quantidadeCortada > 0 ? ` | corte ${formatarQuantidade(quantidadeCortada)}` : ''}`,
            { desfazer: true }
          ));
        });
      } else {
        totalConferidos += 1;
        itensConferidosLista.appendChild(criarLinhaItemConferencia(
          item,
          quantidadeConferida,
          itemTemExcesso(item) ? 'excesso' : (quantidadeCortada > 0 ? 'cortado' : 'ok'),
          `${formatarQuantidade(quantidadeConferida)} / ${formatarQuantidade(item.qtdNeg)}${quantidadeCortada > 0 ? ` | corte ${formatarQuantidade(quantidadeCortada)}` : ''}`,
          { desfazer: true }
        ));
      }
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
  atualizarCaixaEntrada();
}

function desfazerConferenciaItem(sequencia) {
  const item = itensPedidoSelecionado.find((candidate) => Number(candidate.sequencia) === Number(sequencia));
  if (!item) {
    return;
  }

  const quantidadeAnterior = item.qtdConferida;
  item.qtdConferida = 0;
  item.leituras = [];
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

function renderizarPainelDocumentosFiscais(container, situacao = {}, fallback = null, documentosCombinados = false, desabilitarBoleto = false) {
  if (!container) return;

  const faturado = Boolean(situacao.faturado || situacao.nota || fallback?.status === 'FATURADO');
  const nota = situacao.nota || fallback?.nota || null;
  const erroFaturamento = fallback?.status === 'ERRO'
    ? (fallback.detalhes || []).filter(Boolean).join(' ')
    : '';

  if (!faturado) {
    container.hidden = false;
    container.innerHTML = `
      <div class="documentos-fiscais-info">
        <strong class="danger-text">Pedido nao faturado</strong>
        <span>${escaparHtml(erroFaturamento || situacao.danfe?.motivo || 'A nota de faturamento ainda nao foi localizada.')}</span>
      </div>
    `;
    return;
  }

  const nunota = nota?.NUNOTA || '';
  const numeroNota = Number(nota?.NUMNOTA || 0) > 0 ? ` | Nota fiscal: ${nota.NUMNOTA}` : '';
  const mensagens = [
    situacao.danfe?.motivo,
    situacao.boleto?.motivo
  ].filter(Boolean).join(' ');
  const boletoIndisponivel = desabilitarBoleto || !situacao.boleto?.disponivel;
  const danfeIndisponivel = !situacao.danfe?.disponivel;
  const tipoDocumentoCombinado = !danfeIndisponivel && boletoIndisponivel
    ? 'danfe'
    : danfeIndisponivel && !boletoIndisponivel
      ? 'boleto'
      : 'completo';
  const textoDocumentoCombinado = tipoDocumentoCombinado === 'danfe'
    ? 'Abrir DANFE'
    : tipoDocumentoCombinado === 'boleto'
      ? 'Abrir boleto'
      : 'Abrir DANFE + boleto';
  const ordemCarga = Number(nota?.ORDEMCARGA || 0);
  const empresaOrdemCarga = Number(nota?.CODEMP || 0);
  const botaoRomaneio = ordemCarga > 0 && empresaOrdemCarga > 0
    ? `<button class="documento-fiscal-button documento-romaneio-button" type="button" data-romaneio-ordem="${ordemCarga}" data-romaneio-empresa="${empresaOrdemCarga}" title="Imprimir romaneio da Ordem de Carga ${ordemCarga}">
        <i data-lucide="truck" aria-hidden="true"></i>OC ${ordemCarga} - Imprimir romaneio
      </button>`
    : '';

  container.hidden = false;
  const botoesDocumentos = documentosCombinados
    ? `<button class="documento-fiscal-button" type="button" data-documento="${tipoDocumentoCombinado}" data-nunota="${escaparAtributo(nunota)}" title="${escaparAtributo(textoDocumentoCombinado)}">
        <i data-lucide="files" aria-hidden="true"></i>${textoDocumentoCombinado}
      </button>`
    : `<button class="documento-fiscal-button" type="button" data-documento="danfe" data-nunota="${escaparAtributo(nunota)}" title="${escaparAtributo(situacao.danfe?.motivo || 'Abrir DANFE')}">
        <i data-lucide="file-text" aria-hidden="true"></i>Abrir DANFE
      </button>
      <button class="documento-fiscal-button" type="button" data-documento="boleto" data-nunota="${escaparAtributo(nunota)}" title="${escaparAtributo(desabilitarBoleto ? 'Bonificacao nao gera boleto' : situacao.boleto?.motivo || 'Abrir boleto')}" ${boletoIndisponivel ? 'disabled' : ''}>
        <i data-lucide="barcode" aria-hidden="true"></i>Abrir boleto
      </button>`;

  container.innerHTML = `
    <div class="documentos-fiscais-info">
      <strong>Faturado | Nota interna: ${escaparHtml(nunota)}${escaparHtml(numeroNota)}</strong>
      <span class="documentos-fiscais-feedback">${escaparHtml(mensagens || 'DANFE e boleto podem ser abertos nas guias abaixo.')}</span>
    </div>
    <div class="documentos-fiscais-actions">
      ${botaoRomaneio}
      ${botoesDocumentos}
    </div>
  `;
  atualizarIcones();
}

async function carregarDocumentosFiscaisPedido(pedido, container, fallback = null, documentosCombinados = false, desabilitarBoleto = false) {
  if (!pedido?.NUNOTA || !container) return;

  container.hidden = false;
  container.innerHTML = '<div class="documentos-fiscais-info"><strong>Consultando faturamento...</strong><span>Buscando nota e documentos no Sankhya.</span></div>';

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${pedido.NUNOTA}/documentos`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.erro || 'Erro ao consultar documentos');
    renderizarPainelDocumentosFiscais(container, payload, fallback, documentosCombinados, desabilitarBoleto);
  } catch (error) {
    renderizarPainelDocumentosFiscais(container, {}, {
      status: 'ERRO',
      detalhes: [error.message]
    });
  }
}

async function abrirDocumentoFiscal(botao) {
  const nunota = botao?.dataset?.nunota;
  const tipo = botao?.dataset?.documento;
  if (!nunota || !['danfe', 'boleto', 'completo'].includes(tipo)) return;

  const painel = botao.closest('.documentos-fiscais-panel');
  const feedback = painel?.querySelector('.documentos-fiscais-feedback');
  const novaAba = window.open('', '_blank');

  if (!novaAba) {
    if (feedback) feedback.textContent = 'O navegador bloqueou a nova guia.';
    return;
  }

  novaAba.document.write('<p style="font-family:Arial;padding:20px">Carregando documento do Sankhya...</p>');
  novaAba.document.close();
  botao.disabled = true;
  const nomeDocumento = tipo === 'danfe' ? 'DANFE' : tipo === 'boleto' ? 'boleto' : 'DANFE e boleto';
  if (feedback) feedback.textContent = `Gerando ${nomeDocumento} no Sankhya...`;

  try {
    const res = await fetch(`/api/fila-conferencia/notas/${nunota}/documentos/${tipo}`);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok || !contentType.includes('application/pdf')) {
      const payload = await res.json().catch(() => ({}));
      throw new Error([payload.erro, payload.detalhes].filter(Boolean).join(' - ') || 'Documento indisponivel');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    novaAba.location.replace(url);
    if (feedback) feedback.textContent = `${nomeDocumento} aberto em nova guia.`;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    novaAba.close();
    if (feedback) {
      feedback.textContent = error.message;
      feedback.classList.add('danger-text');
    }
  } finally {
    botao.disabled = false;
  }
}

async function abrirPdfRomaneio(ordemCarga, empresa, botao = null) {
  const codigo = Number(ordemCarga || 0);
  const codigoEmpresa = Number(empresa || 0);
  if (!codigo || !codigoEmpresa) return;

  const painel = botao?.closest('.documentos-fiscais-panel');
  const feedback = painel?.querySelector('.documentos-fiscais-feedback') || romaneioStatus;
  const novaAba = window.open('', '_blank');
  if (!novaAba) {
    if (feedback) feedback.textContent = 'O navegador bloqueou a nova guia do romaneio.';
    return;
  }

  novaAba.document.write('<p style="font-family:Arial;padding:20px">Gerando romaneio de carga...</p>');
  novaAba.document.close();
  if (botao) botao.disabled = true;
  if (feedback) feedback.textContent = `Gerando romaneio da Ordem de Carga ${codigo}...`;

  try {
    const params = new URLSearchParams({ empresa: String(codigoEmpresa) });
    const res = await fetch(`/api/fila-conferencia/romaneio/${codigo}/pdf?${params.toString()}`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/pdf')) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.erro || 'Romaneio indisponivel');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    novaAba.location.replace(url);
    if (feedback) feedback.textContent = `Romaneio da Ordem de Carga ${codigo} aberto em nova guia.`;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    novaAba.close();
    if (feedback) {
      feedback.textContent = error.message;
      feedback.classList.add('danger-text');
    }
  } finally {
    if (botao) botao.disabled = false;
  }
}

async function abrirPdfPedido() {
  const nunota = pedidoPreviewSelecionado?.NUNOTA;
  if (!nunota || !botaoImprimirPreviewPedido) return;

  const novaAba = window.open('', '_blank');
  if (!novaAba) {
    scanStatus.textContent = 'O navegador bloqueou a nova guia do pedido.';
    return;
  }

  novaAba.document.write('<p style="font-family:Arial;padding:20px">Gerando PDF do pedido...</p>');
  novaAba.document.close();
  botaoImprimirPreviewPedido.disabled = true;

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${nunota}/pdf`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/pdf')) {
      const payload = await res.json().catch(() => ({}));
      throw new Error([payload.erro, payload.detalhes].filter(Boolean).join(' - ') || 'PDF indisponivel');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    novaAba.location.replace(url);
    pedidoPreviewSelecionado.PEDIDO_IMPRESSO = true;
    const pedidoNaFila = filaPedidos.find((pedido) => Number(pedido.NUNOTA) === Number(nunota));
    if (pedidoNaFila) pedidoNaFila.PEDIDO_IMPRESSO = true;
    renderizarPedidosFila();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    novaAba.close();
    scanStatus.textContent = error.message;
  } finally {
    botaoImprimirPreviewPedido.disabled = false;
  }
}

function renderizarDocumentosAuxiliaresEntrada(documentos) {
  const itens = [
    documentos?.notaDevolucao
      ? { titulo: 'Nota de devolucao', numero: documentos.notaDevolucao }
      : null,
    documentos?.pedidoComplementar
      ? { titulo: 'Pedido complementar', numero: documentos.pedidoComplementar }
      : null
  ].filter(Boolean);

  posConferenciaDocumentos.hidden = false;
  posConferenciaDocumentos.innerHTML = `
    <div class="entrada-sucesso-panel">
      <div class="entrada-sucesso-row">
        <i data-lucide="clipboard-check"></i>
        <div>
          <span>Status</span>
          Finalizada OK no Sankhya
        </div>
      </div>
      <div class="entrada-sucesso-docs">
        ${itens.length > 0
          ? itens.map((item) => `
            <div class="entrada-sucesso-doc">
              <small>${escaparHtml(item.titulo)}</small>
              <strong>${escaparHtml(item.numero)}</strong>
            </div>
          `).join('')
          : '<div class="entrada-sucesso-empty">Nenhum documento auxiliar foi retornado pelo Sankhya.</div>'}
      </div>
    </div>
  `;
  atualizarIcones();
}

function abrirModalPosConferencia(pedido, faturamento, documentosAuxiliares = null) {
  const entrada = filaModoConferencia === 'entrada';
  posConferenciaModal.classList.remove('is-processing', 'has-error', 'is-entrada-success');
  const faturamentoPendente = !entrada && faturamento?.status === 'ERRO';
  posConferenciaModal.classList.toggle('has-billing-warning', faturamentoPendente);
  if (entrada) {
    posConferenciaModal.classList.add('is-entrada-success');
  }
  posConferenciaTitulo.innerHTML = entrada
    ? '<span class="entrada-sucesso-head"><span class="entrada-sucesso-icon"><i data-lucide="package-check"></i></span><span><strong class="entrada-sucesso-title">Entrada concluida</strong><span class="entrada-sucesso-subtitle">Nota finalizada com sucesso no Sankhya.</span></span></span>'
    : faturamentoPendente
      ? 'Conferencia finalizada, mas faturamento pendente'
      : 'Conferencia concluida';
  botaoVoltarListaPosConferencia.textContent = 'Voltar para lista';
  pedidoConcluido = pedido;
  posConferenciaDocumentos.hidden = entrada;
  botaoImprimirEtiquetaVolume.hidden = entrada;
  botaoImprimirEtiquetaVolume.textContent = 'Imprimir etiqueta';
  posConferenciaTexto.textContent = entrada
    ? `Nota de entrada ${pedido.NUNOTA}`
    : faturamentoPendente
    ? `Pedido ${pedido.NUNOTA} conferido com sucesso. O faturamento ficou pendente no Sankhya.`
    : `Pedido ${pedido.NUNOTA} conferido com sucesso.`;
  posConferenciaModal.hidden = false;
  atualizarIcones();
  if (entrada) {
    renderizarDocumentosAuxiliaresEntrada(documentosAuxiliares);
  } else {
    carregarDocumentosFiscaisPedido(pedido, posConferenciaDocumentos, faturamento, true);
  }
}

function abrirModalProcessandoConferencia(pedido) {
  pedidoConcluido = null;
  posConferenciaModal.classList.add('is-processing');
  posConferenciaModal.classList.remove('has-error', 'has-billing-warning');
  posConferenciaTitulo.textContent = 'Finalizando conferencia';
  botaoVoltarListaPosConferencia.textContent = 'Voltar para lista';
  posConferenciaTexto.textContent = filaModoConferencia === 'entrada'
    ? `Aguarde enquanto a nota de entrada ${pedido.NUNOTA} e finalizada no Sankhya.`
    : `Aguarde enquanto o pedido ${pedido.NUNOTA} e finalizado e faturado no Sankhya.`;
  botaoImprimirEtiquetaVolume.hidden = true;
  posConferenciaDocumentos.hidden = true;
  posConferenciaDocumentos.innerHTML = '';
  posConferenciaModal.hidden = false;
  atualizarIcones();
}

function exibirErroModalConferencia(payload, error = null) {
  const detalhes = [
    payload?.erro,
    ...(Array.isArray(payload?.detalhesSankhya) ? payload.detalhesSankhya : []),
    payload?.detalhes,
    error?.message
  ].filter(Boolean);

  posConferenciaModal.classList.remove('is-processing');
  posConferenciaModal.classList.add('has-error');
  posConferenciaTitulo.textContent = 'Nao foi possivel concluir';
  posConferenciaTexto.textContent = detalhes.join(' - ') || 'O Sankhya nao concluiu a conferencia. Tente novamente.';
  posConferenciaDocumentos.hidden = true;
  posConferenciaDocumentos.innerHTML = '';
  botaoVoltarListaPosConferencia.textContent = 'Fechar e revisar';
}

function abrirModalEtiquetaPedido(pedido) {
  posConferenciaModal.classList.remove('is-processing', 'has-error', 'has-billing-warning');
  posConferenciaTitulo.textContent = 'Imprimir etiqueta de volume';
  botaoVoltarListaPosConferencia.textContent = 'Voltar para lista';
  pedidoConcluido = pedido;
  botaoImprimirEtiquetaVolume.hidden = false;
  posConferenciaDocumentos.hidden = true;
  posConferenciaDocumentos.innerHTML = '';
  botaoImprimirEtiquetaVolume.textContent = 'Gerar etiqueta';
  posConferenciaTexto.textContent = Number(pedido.QTDVOL || 0) > 0
    ? `O pedido ${pedido.NUNOTA} possui ${pedido.QTDVOL} volume(s) registrado(s).`
    : `O pedido ${pedido.NUNOTA} nao possui quantidade de volumes registrada.`;
  posConferenciaModal.hidden = false;
  atualizarIcones();
}

function fecharModalPosConferenciaEVoltar() {
  const deveRevisar = posConferenciaModal.classList.contains('has-error');
  posConferenciaModal.hidden = true;
  posConferenciaModal.classList.remove('is-processing', 'has-error', 'has-billing-warning');
  posConferenciaDocumentos.hidden = true;
  posConferenciaDocumentos.innerHTML = '';
  pedidoConcluido = null;
  botaoVoltarListaPosConferencia.textContent = 'Voltar para lista';
  if (deveRevisar) {
    botaoConfirmarConferencia.disabled = false;
    scanCodigo.focus();
    return;
  }
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
  const logoUrl = `${window.location.origin}/logo-norte-sul-label.png`;

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
            <strong class="fit-one-line ${classeNome}" data-min-font="7">${nomeParc}</strong>
            <em class="fit-one-line ${classeRazao}" data-min-font="6">${razaoSocial}</em>
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
            <div class="endereco fit-one-line" data-min-font="6">${endereco}</div>
            <div class="cidade fit-one-line" data-min-font="8">${cidadeUf}</div>
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
            <div class="transportadora fit-one-line" data-min-font="6">${transportadora}</div>
          </div>
          <img class="label-logo" src="${escaparAtributo(logoUrl)}" alt="Norte Sul">
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
    .cliente-texto { min-width: 0; }
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
      overflow: visible;
      text-overflow: clip;
      max-width: 70mm;
    }
    .cidade {
      margin-top: 0.85mm;
      font-size: 15.6pt;
      line-height: 0.9;
      font-weight: 900;
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
      max-width: 66mm;
    }
    .transportadora-bloco {
      display: grid;
      grid-template-columns: 8mm minmax(0, 1fr) 16mm;
      gap: 1.8mm;
      align-items: center;
      position: relative;
      padding-top: 0.65mm;
      margin-top: 0.15mm;
    }
    .transportadora-bloco > div:nth-child(2) { min-width: 0; }
    .transportadora-bloco::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 18mm;
      height: 0.25mm;
      background: #999;
    }
    .transportadora {
      margin-top: 0.3mm;
      font-size: 9.8pt;
      line-height: 1;
      font-weight: 900;
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
      max-width: 64mm;
    }
    .label-logo {
      width: 17mm;
      height: 17mm;
      object-fit: contain;
      justify-self: end;
      align-self: end;
      margin-top: -10mm;
      margin-right: -1mm;
      opacity: 0.82;
      filter: grayscale(1) contrast(3.2) brightness(0.18);
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
    function ajustarTextoEmUmaLinha(elemento) {
      const minimo = Number(elemento.dataset.minFont || 6);
      let tamanho = Number.parseFloat(window.getComputedStyle(elemento).fontSize);

      while (elemento.scrollWidth > elemento.clientWidth && tamanho > minimo) {
        tamanho = Math.max(minimo, tamanho - 0.25);
        elemento.style.fontSize = tamanho + 'px';
      }
    }

    window.onload = () => {
      document.querySelectorAll('.fit-one-line').forEach(ajustarTextoEmUmaLinha);
      window.requestAnimationFrame(() => {
        window.focus();
        window.print();
      });
    };
  </script>
</body>
</html>`;
}

async function imprimirEtiquetaVolume() {
  if (!pedidoConcluido) {
    return;
  }

  const volumes = Number(pedidoConcluido.QTDVOL || 0);
  if (!Number.isInteger(volumes) || volumes <= 0) {
    posConferenciaTexto.textContent = 'Este pedido nao possui quantidade de volumes registrada no Sankhya.';
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    posConferenciaTexto.textContent = 'O navegador bloqueou a aba de impressao.';
    return;
  }

  printWindow.document.write('<p style="font-family:Arial;padding:16px">Gerando etiqueta...</p>');
  printWindow.document.close();
  botaoImprimirEtiquetaVolume.disabled = true;
  botaoImprimirEtiquetaVolume.textContent = 'Gerando etiqueta...';

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
    posConferenciaTexto.textContent = `${volumes} etiqueta(s) gerada(s) para o pedido ${pedidoConcluido.NUNOTA}.`;
  } catch (error) {
    printWindow.close();
    posConferenciaTexto.textContent = error.message;
  } finally {
    botaoImprimirEtiquetaVolume.disabled = false;
    botaoImprimirEtiquetaVolume.textContent = 'Imprimir etiqueta';
  }
}

function formatarTituloPedidoConferencia(pedido) {
  if (!pedido) return filaModoConferencia === 'entrada' ? 'Nota' : 'Pedido';
  const base = `${filaModoConferencia === 'entrada' ? 'Nota' : 'Pedido'} ${pedido.NUNOTA}`;
  const numeroNota = Number(pedido.NUMNOTA || 0);
  if (filaModoConferencia !== 'entrada' || !numeroNota) return base;
  return `Nro. Nota ${numeroNota} | ${base}`;
}

function obterEstadoOperacionalPedido(pedido) {
  const statusConferencia = String(pedido?.STATUS_CONFERENCIA || '').trim().toUpperCase();
  const statusSeparacao = String(pedido?.STATUS_SEPARACAO || '').trim().toUpperCase();

  if (statusConferencia === 'EM ANDAMENTO' || statusConferencia === 'EM CONFERENCIA') {
    return 'em-conferencia';
  }
  if (statusSeparacao === 'EM_SEPARACAO') return 'em-separacao';
  if (statusSeparacao === 'SEPARADO') return 'separado';
  if (statusConferencia === 'CONFERIDO') return 'conferido';
  return 'novo';
}

function renderizarPedidosFila() {
  filaPedidosLista.innerHTML = '';
  const prioridadeStatus = {
    'em-conferencia': 0,
    separado: 1,
    'em-separacao': 2,
    novo: 3,
    conferido: 4
  };
  const statusSelecionado = filaFiltroStatus?.value || 'todos';
  const pedidosFiltrados = filaPedidos
    .map((pedido, indiceOriginal) => ({
      pedido,
      indiceOriginal,
      estadoOperacional: obterEstadoOperacionalPedido(pedido)
    }))
    .filter(({ estadoOperacional }) => (
      statusSelecionado === 'todos' || estadoOperacional === statusSelecionado
    ))
    .sort((a, b) => (
      (prioridadeStatus[a.estadoOperacional] ?? 99)
      - (prioridadeStatus[b.estadoOperacional] ?? 99)
      || a.indiceOriginal - b.indiceOriginal
    ))
    .map(({ pedido }) => pedido);
  filaCountPedidos.textContent = pedidosFiltrados.length;

  if (pedidosFiltrados.length === 0) {
    const temBuscaPedido = Boolean(String(filaBuscaPedido?.value || '').trim());
    renderizarEstadoVazio(
      filaPedidosLista,
      filaPedidos.length > 0 && statusSelecionado !== 'todos'
        ? 'Nenhum pedido encontrado com o status selecionado.'
        : filaPedidos.length === 0 && !temBuscaPedido
        ? `Nenhum ${filaModoConferencia === 'entrada' ? 'documento de entrada' : 'pedido'} encontrado para os filtros.`
        : `Nenhum ${filaModoConferencia === 'entrada' ? 'documento de entrada' : 'pedido'} encontrado com esse numero.`
    );
    return;
  }

  const header = document.createElement('div');
  header.className = 'pedido-list-header';
  header.innerHTML = `
    <div></div>
    <div>Status</div>
    ${filaModoConferencia === 'entrada' ? '<div>Nro. Nota</div><div>Nota</div>' : '<div>Pedido</div>'}
    <div>Data</div>
    <div>Cliente</div>
    <div>Valor</div>
    <div>Itens</div>
  `;
  filaPedidosLista.appendChild(header);

  pedidosFiltrados.forEach((pedido) => {
    const card = document.createElement('div');
    const estadoOperacional = obterEstadoOperacionalPedido(pedido);
    const emAndamento = estadoOperacional === 'em-conferencia';
    const entrada = filaModoConferencia === 'entrada';
    const conferido = estadoOperacional === 'conferido';
    const separacaoFinalizada = !entrada && estadoOperacional === 'separado';
    const separacaoIniciada = !entrada && estadoOperacional === 'em-separacao';
    const bonificacao = Number(pedido.CODTIPOPER) === (entrada ? 21 : 6);
    const iconeTipoPedido = bonificacao
      ? '<span class="pedido-status-type-icon bonificacao"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.7 4 5.5S5 3 6.5 3C9 3 12 8 12 8M16.5 8C19 8 20 6.7 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/></svg></span>'
      : entrada
        ? '<span class="pedido-status-type-icon entrada"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/></svg></span>'
        : '<span class="pedido-status-type-icon venda"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg></span>';
    const tituloTipoPedido = bonificacao
      ? (entrada ? 'Bonificacao de entrada' : 'Pedido de bonificacao')
      : (entrada ? 'Compra de produtos' : 'Pedido de venda');
    const numeroNotaFiscal = Number(pedido.NUMNOTA || 0) > 0 ? String(pedido.NUMNOTA) : '-';
    card.className = `pedido-operacao-card ${estadoOperacional} ${pedidoSelecionado?.NUNOTA === pedido.NUNOTA ? 'active' : ''}`;
    card.innerHTML = `
      <div class="pedido-list-action">
        ${pedido.PEDIDO_IMPRESSO
          ? '<span class="pedido-print-indicator" aria-label="Pedido ja impresso" title="Pedido ja impresso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/><path d="m9 17 2 2 4-4"/></svg></span>'
          : ''}
        ${pedido.STATUS_CONFERENCIA === 'CONFERIDO' && !entrada
          ? '<button class="pedido-label-button" type="button" aria-label="Gerar etiqueta de volume" title="Gerar etiqueta de volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V4h3"/><path d="M17 4h3v3"/><path d="M20 17v3h-3"/><path d="M7 20H4v-3"/><path d="M7 8h10v8H7z"/><path d="M9 11h6"/><path d="M9 14h4"/></svg></button>'
          : ''}
      </div>
      <div class="pedido-list-status" title="${tituloTipoPedido}">
        ${iconeTipoPedido}
        ${emAndamento
          ? `<span class="pedido-status-mini em-conferencia" title="Em conferencia">${pedido.NOME_CONFERENTE || 'Em andamento'}</span>`
          : separacaoFinalizada
            ? '<span class="pedido-status-mini separado">Separado</span>'
            : separacaoIniciada
              ? '<span class="pedido-status-mini em-separacao">Em separação</span>'
              : conferido
                ? '<span class="pedido-status-mini conferido">Conferido</span>'
                : '<span class="pedido-status-mini novo">Novo</span>'}
      </div>
      ${entrada ? `<div class="pedido-num-nota">${escaparHtml(numeroNotaFiscal)}</div>` : ''}
      <strong>${entrada ? 'Nota' : 'Pedido'} ${pedido.NUNOTA}</strong>
      <div class="pedido-meta">${formatarData(pedido.DTNEG)}</div>
      <div class="pedido-cliente" title="${escaparAtributo(`${pedido.CODIGO_PARCEIRO || '-'} - ${pedido.EMPRESA || '-'}`)}">${escaparHtml(`${pedido.CODIGO_PARCEIRO || '-'} - ${pedido.EMPRESA || '-'}`)}</div>
      <div class="pedido-meta">${formatarMoeda(pedido.VLRNOTA)}</div>
      <div class="pedido-meta">${pedido.QTD_ITENS} | ${formatarQuantidade(pedido.QTD_TOTAL)} un.</div>
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
      <strong class="pedido-side-title"><i data-lucide="clipboard-list"></i>${formatarTituloPedidoConferencia(pedidoSelecionado)}</strong>
      <div class="pedido-side-meta">
        <span><i data-lucide="calendar-days"></i>${formatarData(pedidoSelecionado.DTNEG)}</span>
        <span><i data-lucide="tag"></i>${formatarMoeda(pedidoSelecionado.VLRNOTA)}</span>
      </div>
      <div class="pedido-side-cliente">${pedidoSelecionado.EMPRESA || '-'}</div>
      <div class="pedido-side-meta">
        <span><i data-lucide="package"></i>${pedidoSelecionado.QTD_ITENS} itens</span>
        <span><i data-lucide="boxes"></i>${formatarQuantidade(pedidoSelecionado.QTD_TOTAL)} un.</span>
        ${filaModoConferencia === 'entrada' ? `<span><i data-lucide="layers"></i>${formatarQuantidade(pedidoSelecionado.QTDVOL || 0)} vol.</span>` : ''}
      </div>
      ${pedidoSelecionado.STATUS_CONFERENCIA === 'EM ANDAMENTO' ? '<span class="pedido-status-mini">Conferencia em andamento</span>' : ''}
    </div>
  `;
  atualizarIcones();
}

function obterChaveStorageSeparacao() {
  return `${STORAGE_SEPARACAO_PREFIX}${pedidoPreviewSelecionado?.NUNOTA || ''}`;
}

function obterChaveItemSeparacao(item, indice) {
  const sequencia = Number(item.sequencia);
  if (Number.isFinite(sequencia) && sequencia > 0) return `seq:${sequencia}`;
  return [
    `prod:${item.codProd || ''}`,
    `controle:${normalizarCodigo(item.controle)}`,
    `un:${normalizarCodigo(item.codVol)}`,
    `idx:${indice}`
  ].join('|');
}

function carregarProgressoSeparacaoLocal() {
  try {
    const salvo = JSON.parse(localStorage.getItem(obterChaveStorageSeparacao()) || '{}');
    return salvo && typeof salvo === 'object' ? salvo : {};
  } catch (error) {
    console.warn('Nao foi possivel carregar o progresso da separacao:', error);
    return {};
  }
}

function aplicarEstadoSeparacao(separacao) {
  if (!separacao) return;
  const registros = new Map((separacao.itens || []).map((item) => [item.chave, item]));
  itensSeparacao = itensSeparacao.map((item) => {
    const registro = registros.get(item.chaveSeparacao);
    if (!registro) return item;
    return {
      ...item,
      qtdSeparada: Math.max(0, normalizarQuantidade(registro.qtdSeparada)),
      separacaoProcessada: Boolean(registro.processado),
      separacaoAjustada: Boolean(registro.ajustado),
      controleSeparado: String(registro.controleSeparado || '').trim() || null,
      dtValidadeSeparada: String(registro.dtValidadeSeparada || '').trim() || null
    };
  });
  separacaoConcluida = separacao.status === 'SEPARADO';
  separacaoVersao = Number(separacao.versao || 0);
}

function refletirSeparacaoConcluidaNaInterface() {
  if (!separacaoConcluida) return;
  if (pedidoPreviewSelecionado) pedidoPreviewSelecionado.STATUS_SEPARACAO = 'SEPARADO';
  const pedidoFila = filaPedidos.find((pedido) => (
    Number(pedido.NUNOTA) === Number(pedidoPreviewSelecionado?.NUNOTA)
  ));
  if (pedidoFila) pedidoFila.STATUS_SEPARACAO = 'SEPARADO';
  botaoAbrirSeparacaoPedido.disabled = true;
  botaoAbrirSeparacaoPedido.textContent = 'Separacao concluida';
  renderizarPedidosFila();
}

async function requisitarSeparacao(caminho = '', options = {}) {
  const nunota = Number(pedidoPreviewSelecionado?.NUNOTA || 0);
  if (!nunota) throw new Error('Pedido de separacao invalido.');
  const resposta = await fetch(`/api/fila-conferencia/separacao/${nunota}${caminho}`, options);
  const payload = await resposta.json();
  if (!resposta.ok) throw new Error(payload.erro || 'Nao foi possivel salvar a separacao.');
  return payload.separacao || null;
}

async function salvarProgressoSeparacao(item) {
  if (!item) return null;
  const separacao = await requisitarSeparacao('/item', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item: {
        chave: item.chaveSeparacao,
        qtdSeparada: normalizarQuantidade(item.qtdSeparada),
        processado: Boolean(item.separacaoProcessada),
        ajustado: Boolean(item.separacaoAjustada),
        controleSeparado: item.controleSeparado || null,
        dtValidadeSeparada: item.dtValidadeSeparada || null
      }
    })
  });
  aplicarEstadoSeparacao(separacao);
  return separacao;
}

function quantidadeEsperadaSeparacao(item) {
  return Math.max(0, normalizarQuantidade(item.qtdNeg));
}

function itemSeparacaoProcessado(item) {
  return Boolean(item.separacaoProcessada);
}

function itemSeparacaoCompleto(item) {
  const esperado = quantidadeEsperadaSeparacao(item);
  return itemSeparacaoProcessado(item)
    && normalizarQuantidade(item.qtdSeparada) === esperado;
}

function itemSeparacaoZerado(item) {
  return itemSeparacaoProcessado(item) && normalizarQuantidade(item.qtdSeparada) === 0;
}

function itemSeparacaoDivergente(item) {
  return itemSeparacaoProcessado(item) && !itemSeparacaoCompleto(item);
}

function obterLoteSeparacao(item) {
  const controle = String(
    item.controleSeparado || item.controle || item.CONTROLE || ''
  ).trim();
  return controle || 'Sem lote';
}

function obterValidadeSeparacao(item) {
  const possuiLoteSeparado = Boolean(String(item.controleSeparado || '').trim());
  const validade = possuiLoteSeparado
    ? (item.dtValidadeSeparada || '')
    : item.dtValidade
    || item.DTVALID
    || item.validade
    || item.dataValidade
    || '';
  return formatarData(validade) || 'Sem validade';
}

async function prepararItensSeparacao() {
  const progresso = carregarProgressoSeparacaoLocal();
  separacaoConcluida = Boolean(progresso.__meta?.concluida);
  itensSeparacao = itensPedidoPreview.map((item, indice) => {
    const chaveSeparacao = obterChaveItemSeparacao(item, indice);
    const esperado = quantidadeEsperadaSeparacao(item);
    const registro = progresso[chaveSeparacao];
    const registroEstruturado = registro && typeof registro === 'object';
    const separado = Math.max(0, normalizarQuantidade(
      registroEstruturado ? registro.qtdSeparada : registro
    ));
    const processado = registroEstruturado
      ? Boolean(registro.processado)
      : (esperado > 0 && separado >= esperado);
    return {
      ...item,
      chaveSeparacao,
      qtdSeparada: separado,
      separacaoProcessada: processado,
      separacaoAjustada: registroEstruturado ? Boolean(registro.ajustado) : false,
      controleSeparado: registroEstruturado
        ? (String(registro.controleSeparado || '').trim() || null)
        : null,
      dtValidadeSeparada: registroEstruturado
        ? (String(registro.dtValidadeSeparada || '').trim() || null)
        : null
    };
  });

  const separacao = await requisitarSeparacao('/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itens: itensSeparacao.map((item) => ({
        chave: item.chaveSeparacao,
        sequencia: item.sequencia,
        codProd: item.codProd,
        qtdEsperada: quantidadeEsperadaSeparacao(item),
        qtdSeparada: normalizarQuantidade(item.qtdSeparada),
        processado: Boolean(item.separacaoProcessada),
        ajustado: Boolean(item.separacaoAjustada),
        controleSeparado: item.controleSeparado || null,
        dtValidadeSeparada: item.dtValidadeSeparada || null
      }))
    })
  });
  aplicarEstadoSeparacao(separacao);
  localStorage.removeItem(obterChaveStorageSeparacao());
  return separacao;
}

async function sincronizarSeparacaoAberta() {
  if (separacaoSyncEmAndamento || separacaoScreen.hidden || !pedidoPreviewSelecionado?.NUNOTA) return;
  separacaoSyncEmAndamento = true;
  try {
    const separacao = await requisitarSeparacao();
    if (separacao && Number(separacao.versao || 0) !== separacaoVersao) {
      aplicarEstadoSeparacao(separacao);
      refletirSeparacaoConcluidaNaInterface();
      fecharConfirmacaoSeparacao();
      fecharResumoFinalSeparacao();
      renderizarItensSeparacao();
      atualizarStatusSeparacao(
        separacaoConcluida
          ? 'Separacao concluida em outro dispositivo.'
          : 'Separacao atualizada por outro dispositivo.',
        'success'
      );
    }
  } catch (error) {
    console.warn('Nao foi possivel sincronizar a separacao:', error);
  } finally {
    separacaoSyncEmAndamento = false;
  }
}

function iniciarSincronizacaoSeparacao() {
  pararSincronizacaoSeparacao();
  separacaoSyncTimer = setInterval(sincronizarSeparacaoAberta, 2000);
}

function pararSincronizacaoSeparacao() {
  if (separacaoSyncTimer) clearInterval(separacaoSyncTimer);
  separacaoSyncTimer = null;
  separacaoSyncEmAndamento = false;
}

function atualizarStatusSeparacao(mensagem, tipo = '') {
  separacaoStatus.textContent = mensagem;
  separacaoStatus.className = `separacao-status${tipo ? ` is-${tipo}` : ''}`;
}

function compararItensSeparacao(a, b) {
  const processadoA = itemSeparacaoProcessado(a) ? 1 : 0;
  const processadoB = itemSeparacaoProcessado(b) ? 1 : 0;
  if (processadoA !== processadoB) return processadoA - processadoB;
  return String(a.descrProd || '').localeCompare(String(b.descrProd || ''), 'pt-BR', {
    sensitivity: 'base',
    numeric: true
  });
}

function agruparItensSeparacao() {
  const grupos = new Map();

  itensSeparacao.forEach((item) => {
    const codigo = String(item.codGrupoProd || '').trim();
    const descricao = String(item.descrGrupoProd || '').trim() || 'Sem grupo';
    const chave = codigo || `SEM_GRUPO:${descricao}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { codigo, descricao, itens: [] });
    }
    grupos.get(chave).itens.push(item);
  });

  return [...grupos.values()]
    .sort((a, b) => {
      if (!a.codigo && b.codigo) return 1;
      if (a.codigo && !b.codigo) return -1;
      const numeroA = Number(a.codigo);
      const numeroB = Number(b.codigo);
      if (Number.isFinite(numeroA) && Number.isFinite(numeroB) && numeroA !== numeroB) {
        return numeroA - numeroB;
      }
      return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base', numeric: true });
    })
    .map((grupo) => ({ ...grupo, itens: [...grupo.itens].sort(compararItensSeparacao) }));
}

function renderizarItensSeparacao() {
  const processados = itensSeparacao.filter(itemSeparacaoProcessado).length;
  separacaoProgresso.textContent = separacaoConcluida
    ? 'Separacao concluida'
    : `${processados}/${itensSeparacao.length} itens separados`;
  const todosProcessados = itensSeparacao.length > 0 && processados === itensSeparacao.length;
  botaoFinalizarSeparacao.hidden = separacaoConcluida || !todosProcessados;
  separacaoCodigo.disabled = separacaoConcluida;
  botaoLimparCodigoSeparacao.disabled = separacaoConcluida;

  if (itensSeparacao.length === 0) {
    separacaoItensLista.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum item encontrado para separar.</td></tr>';
    return;
  }

  separacaoItensLista.innerHTML = agruparItensSeparacao().map((grupo) => {
    const identificacaoGrupo = grupo.codigo
      ? `Grupo ${grupo.codigo} - ${grupo.descricao}`
      : grupo.descricao;
    const cabecalho = `
      <tr class="separacao-group-row">
        <td colspan="6">${escaparHtml(identificacaoGrupo)}</td>
      </tr>
    `;
    const linhas = grupo.itens.map((item) => {
      const esperado = quantidadeEsperadaSeparacao(item);
      const separado = normalizarQuantidade(item.qtdSeparada);
      const processado = itemSeparacaoProcessado(item);
      const completo = itemSeparacaoCompleto(item);
      const zerado = itemSeparacaoZerado(item);
      const parcial = !processado && separado > 0;
      const divergente = itemSeparacaoDivergente(item);
      const classe = zerado
        ? ' is-zero'
        : completo
          ? ' is-complete'
          : (divergente || parcial) ? ' is-partial' : '';
      const status = zerado
        ? 'Zerado'
        : completo
          ? 'Separado'
          : divergente
            ? 'Divergente'
            : parcial ? 'Parcial' : 'Pendente';
      const badgeClasse = zerado ? ' zero' : completo ? '' : ' pending';
      return `
        <tr class="separacao-row${classe}" data-separacao-item="${escaparHtml(item.chaveSeparacao)}" tabindex="0">
          <td><strong class="separacao-product-code">${escaparHtml(item.codProd)}</strong></td>
          <td class="separacao-description" title="${escaparHtml(item.descrProd)}">${escaparHtml(item.descrProd || '-')}</td>
          <td>${formatarQuantidade(separado)} / ${formatarQuantidade(esperado)} ${escaparHtml(obterUnidadeExibicaoItem(item))}</td>
          <td title="${escaparAtributo(obterLoteSeparacao(item))}">${escaparHtml(obterLoteSeparacao(item))}</td>
          <td>${escaparHtml(obterValidadeSeparacao(item))}</td>
          <td><span class="separacao-badge${badgeClasse}">${status}</span></td>
        </tr>
      `;
    }).join('');
    return cabecalho + linhas;
  }).join('');

  atualizarIcones();
}

function fecharConfirmacaoSeparacao() {
  itemSeparacaoPendente = null;
  separacaoConfirmModal.hidden = true;
  separacaoLoteField.hidden = true;
  separacaoLoteSelect.innerHTML = '';
  separacaoLoteInfo.textContent = '';
  separacaoAjustePainel.hidden = true;
  separacaoConfirmStatus.textContent = '';
}

function atualizarProdutoConfirmacaoSeparacao() {
  if (!itemSeparacaoPendente) return;
  const { item, loteSelecionado } = itemSeparacaoPendente;
  const esperado = quantidadeEsperadaSeparacao(item);
  const separado = normalizarQuantidade(item.qtdSeparada);
  const unidadeExibicao = obterUnidadeExibicaoItem(item);
  const lote = loteSelecionado?.controle || obterLoteSeparacao(item);
  const validade = loteSelecionado
    ? (formatarData(loteSelecionado.dtValidade) || 'Sem validade')
    : obterValidadeSeparacao(item);

  separacaoConfirmProduto.innerHTML = `
    ${escaparHtml(item.codProd)} - ${escaparHtml(item.descrProd || '-')}
    <div class="separacao-confirm-meta">Lote: ${escaparHtml(lote)} | Validade: ${escaparHtml(validade)}</div>
    <div class="separacao-confirm-meta">Pedido: ${formatarQuantidade(esperado)} ${escaparHtml(unidadeExibicao)} | Separado: ${formatarQuantidade(separado)} ${escaparHtml(unidadeExibicao)}</div>
  `;
}

function obterLoteSelecionadoConfirmacao() {
  if (!itemSeparacaoPendente) return null;
  const lotes = itemSeparacaoPendente.lotesDisponiveis || [];
  if (lotes.length <= 1) return itemSeparacaoPendente.loteSelecionado || lotes[0] || null;
  return lotes.find((lote) => lote.controle === separacaoLoteSelect.value) || null;
}

async function carregarLotesConfirmacaoSeparacao(item) {
  separacaoLoteField.hidden = true;
  separacaoLoteSelect.innerHTML = '';
  separacaoLoteInfo.textContent = '';
  botaoConfirmarSeparacao.disabled = true;
  separacaoConfirmStatus.textContent = 'Consultando lotes disponiveis no estoque...';

  try {
    const nunota = Number(pedidoPreviewSelecionado?.NUNOTA || 0);
    const resposta = await fetch(`/api/fila-conferencia/separacao/${nunota}/produtos/${Number(item.codProd)}/lotes`);
    const payload = await resposta.json();
    if (!resposta.ok) throw new Error(payload.erro || 'Nao foi possivel consultar os lotes.');
    if (!itemSeparacaoPendente || itemSeparacaoPendente.item !== item) return;

    const lotes = Array.isArray(payload.lotes)
      ? payload.lotes.filter((lote) => Number(lote.estoque || 0) > 0)
      : [];
    itemSeparacaoPendente.lotesDisponiveis = lotes;
    const controleAtual = String(item.controleSeparado || item.controle || '').trim();
    const loteAtual = lotes.find((lote) => lote.controle === controleAtual) || null;

    if (lotes.length === 1) {
      itemSeparacaoPendente.loteSelecionado = lotes[0];
      separacaoLoteInfo.textContent = `Lote unico do estoque: ${lotes[0].controle}.`;
    } else if (lotes.length > 1) {
      separacaoLoteField.hidden = false;
      separacaoLoteSelect.innerHTML = `
        <option value="">Selecione o lote separado</option>
        ${lotes.map((lote) => {
          const validade = formatarData(lote.dtValidade) || 'Sem validade';
          const disponivel = formatarQuantidade(lote.disponivel);
          return `<option value="${escaparAtributo(lote.controle)}">${escaparHtml(lote.controle)} | Validade: ${escaparHtml(validade)} | Disponivel: ${disponivel}</option>`;
        }).join('')}
      `;
      if (loteAtual) separacaoLoteSelect.value = loteAtual.controle;
      itemSeparacaoPendente.loteSelecionado = loteAtual;
      separacaoLoteInfo.textContent = `${lotes.length} lotes positivos encontrados na empresa do pedido.`;
    } else {
      itemSeparacaoPendente.loteSelecionado = null;
    }

    atualizarProdutoConfirmacaoSeparacao();
    separacaoConfirmStatus.textContent = itemSeparacaoProcessado(item)
      ? 'O item ja foi processado. Voce pode ajustar a quantidade ou devolve-lo para pendente.'
      : itemSeparacaoPendente.entradaCodigo?.tipo === 'UNIDADE_ALTERNATIVA'
        ? `${obterDescricaoEntradaCodigo(itemSeparacaoPendente.entradaCodigo)}: 1 leitura equivale a ${formatarQuantidade(itemSeparacaoPendente.quantidade)} ${obterUnidadeExibicaoItem(item)}.`
        : 'Confirme a quantidade separada.';
    botaoConfirmarSeparacao.disabled = false;
  } catch (error) {
    if (!itemSeparacaoPendente || itemSeparacaoPendente.item !== item) return;
    separacaoConfirmStatus.textContent = error.message;
    botaoConfirmarSeparacao.disabled = true;
  }
}

function abrirConfirmacaoSeparacao(item, entradaCodigo = null) {
  if (!item) return;
  if (separacaoConcluida) {
    atualizarStatusSeparacao('Esta separacao ja foi concluida.', 'warning');
    return;
  }
  limparCodigoSeparacao();
  const esperado = quantidadeEsperadaSeparacao(item);
  const separado = normalizarQuantidade(item.qtdSeparada);
  const restante = Math.max(0, esperado - separado);
  const processado = itemSeparacaoProcessado(item);
  const multiplicador = Math.max(0, Number(entradaCodigo?.multiplicador) || 1);
  const quantidade = processado
    ? 0
    : (entradaCodigo ? multiplicador : restante);

  itemSeparacaoPendente = {
    item,
    quantidade,
    entradaCodigo,
    lotesDisponiveis: [],
    loteSelecionado: null
  };

  const unidadeExibicao = obterUnidadeExibicaoItem(item);
  atualizarProdutoConfirmacaoSeparacao();
  separacaoConfirmTitulo.textContent = processado ? 'Item processado' : 'Confirmar separacao';
  separacaoConfirmField.hidden = false;
  separacaoAjustePainel.hidden = true;
  separacaoAjusteQtd.value = String(separado);
  botaoConfirmarSeparacao.hidden = false;
  botaoConfirmarSeparacao.textContent = processado ? 'Voltar para pendente' : 'Confirmar item';
  botaoConfirmarSeparacao.classList.toggle('is-revert', processado);
  separacaoConfirmQtd.textContent = processado
    ? `${formatarQuantidade(separado)} ${unidadeExibicao}`
    : `${formatarQuantidade(quantidade)} ${unidadeExibicao}`;
  separacaoConfirmStatus.textContent = processado
    ? 'O item ja foi processado. Voce pode ajustar a quantidade ou devolve-lo para pendente.'
    : entradaCodigo?.tipo === 'UNIDADE_ALTERNATIVA'
      ? `${obterDescricaoEntradaCodigo(entradaCodigo)}: 1 leitura equivale a ${formatarQuantidade(quantidade)} ${unidadeExibicao}.`
      : 'Confirme a quantidade separada.';
  separacaoConfirmModal.hidden = false;
  carregarLotesConfirmacaoSeparacao(item).then(() => {
    if (!botaoConfirmarSeparacao.disabled) botaoConfirmarSeparacao.focus();
  });
}

async function confirmarItemSeparacao() {
  if (!itemSeparacaoPendente) return;
  const { item, quantidade } = itemSeparacaoPendente;
  const estadoAnterior = {
    qtdSeparada: item.qtdSeparada,
    separacaoProcessada: item.separacaoProcessada,
    separacaoAjustada: item.separacaoAjustada,
    controleSeparado: item.controleSeparado,
    dtValidadeSeparada: item.dtValidadeSeparada
  };
  if (itemSeparacaoProcessado(item)) {
    const descricao = item.descrProd || `Produto ${item.codProd}`;
    item.qtdSeparada = 0;
    item.separacaoProcessada = false;
    item.separacaoAjustada = false;
    item.controleSeparado = null;
    item.dtValidadeSeparada = null;
    try {
      await salvarProgressoSeparacao(item);
      fecharConfirmacaoSeparacao();
      renderizarItensSeparacao();
      atualizarStatusSeparacao(`${descricao} voltou para pendente.`, 'warning');
      limparCodigoSeparacao({ focar: true });
    } catch (error) {
      Object.assign(item, estadoAnterior);
      renderizarItensSeparacao();
      separacaoConfirmStatus.textContent = error.message;
    }
    return;
  }
  const esperado = quantidadeEsperadaSeparacao(item);
  const separado = normalizarQuantidade(item.qtdSeparada);
  const restante = Math.max(0, esperado - separado);

  if (quantidade <= 0) {
    separacaoConfirmStatus.textContent = 'Nao foi possivel calcular a quantidade para esta leitura.';
    return;
  }
  if (quantidade > restante) {
    separacaoConfirmStatus.textContent = `A quantidade excede o restante do item (${formatarQuantidade(restante)}).`;
    return;
  }

  const loteSelecionado = obterLoteSelecionadoConfirmacao();
  if ((itemSeparacaoPendente.lotesDisponiveis || []).length > 1 && !loteSelecionado) {
    separacaoConfirmStatus.textContent = 'Selecione o lote que foi separado.';
    separacaoLoteSelect.focus();
    return;
  }

  const descricao = item.descrProd || `Produto ${item.codProd}`;
  item.qtdSeparada = separado + quantidade;
  item.separacaoProcessada = item.qtdSeparada >= esperado;
  item.separacaoAjustada = false;
  if (loteSelecionado) {
    item.controleSeparado = loteSelecionado.controle;
    item.dtValidadeSeparada = loteSelecionado.dtValidade || null;
  }
  const completo = itemSeparacaoCompleto(item);
  try {
    await salvarProgressoSeparacao(item);
    fecharConfirmacaoSeparacao();
    renderizarItensSeparacao();
    atualizarStatusSeparacao(
      completo
        ? `${descricao} separado com sucesso.`
        : `${descricao}: separacao parcial registrada.`,
      completo ? 'success' : 'warning'
    );
    limparCodigoSeparacao({ focar: true });
  } catch (error) {
    Object.assign(item, estadoAnterior);
    renderizarItensSeparacao();
    separacaoConfirmStatus.textContent = error.message;
  }
}

function abrirAjusteQuantidadeSeparacao() {
  if (!itemSeparacaoPendente) return;
  separacaoAjusteQtd.value = String(normalizarQuantidade(itemSeparacaoPendente.item.qtdSeparada));
  separacaoAjustePainel.hidden = false;
  separacaoConfirmStatus.textContent = 'Informe a quantidade realmente separada. Zero sera registrado como item zerado.';
  setTimeout(() => {
    separacaoAjusteQtd.focus();
    separacaoAjusteQtd.select();
  }, 0);
}

async function aplicarAjusteQuantidadeSeparacao() {
  if (!itemSeparacaoPendente) return;
  const valor = Number(String(separacaoAjusteQtd.value || '').replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0) {
    separacaoConfirmStatus.textContent = 'Informe uma quantidade valida, igual ou maior que zero.';
    return;
  }

  const item = itemSeparacaoPendente.item;
  const estadoAnterior = {
    qtdSeparada: item.qtdSeparada,
    separacaoProcessada: item.separacaoProcessada,
    separacaoAjustada: item.separacaoAjustada,
    controleSeparado: item.controleSeparado,
    dtValidadeSeparada: item.dtValidadeSeparada
  };
  const esperado = quantidadeEsperadaSeparacao(item);
  const descricao = item.descrProd || `Produto ${item.codProd}`;
  const loteSelecionado = obterLoteSelecionadoConfirmacao();
  if (valor > 0 && (itemSeparacaoPendente.lotesDisponiveis || []).length > 1 && !loteSelecionado) {
    separacaoConfirmStatus.textContent = 'Selecione o lote que foi separado.';
    separacaoLoteSelect.focus();
    return;
  }
  item.qtdSeparada = valor;
  item.separacaoProcessada = true;
  item.separacaoAjustada = true;
  if (valor === 0) {
    item.controleSeparado = null;
    item.dtValidadeSeparada = null;
  } else if (loteSelecionado) {
    item.controleSeparado = loteSelecionado.controle;
    item.dtValidadeSeparada = loteSelecionado.dtValidade || null;
  }
  try {
    await salvarProgressoSeparacao(item);
    fecharConfirmacaoSeparacao();
    renderizarItensSeparacao();
    atualizarStatusSeparacao(
      valor === esperado
        ? `${descricao} ajustado e separado.`
        : valor === 0
          ? `${descricao} registrado com quantidade zero.`
          : `${descricao} registrado com quantidade divergente (${formatarQuantidade(valor)} de ${formatarQuantidade(esperado)}).`,
      valor === esperado ? 'success' : 'warning'
    );
    limparCodigoSeparacao({ focar: true });
  } catch (error) {
    Object.assign(item, estadoAnterior);
    renderizarItensSeparacao();
    separacaoConfirmStatus.textContent = error.message;
  }
}

function localizarItemSeparacaoPorCodigo(codigo) {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return null;
  const compativeis = itensSeparacao
    .map((item) => ({ item, entrada: obterEntradaCodigoItem(item, normalizado) }))
    .filter((item) => item.entrada);
  return compativeis.find(({ item }) => !itemSeparacaoProcessado(item)) || compativeis[0] || null;
}

function processarCodigoSeparacao() {
  const codigo = normalizarCodigo(separacaoCodigo.value);
  if (!codigo) {
    atualizarStatusSeparacao('Bipe ou digite um codigo para localizar o produto.', 'warning');
    return;
  }
  const correspondencia = localizarItemSeparacaoPorCodigo(codigo);
  if (!correspondencia) {
    atualizarStatusSeparacao(`Codigo ${codigo} nao encontrado neste pedido.`, 'warning');
    separacaoCodigo.select();
    return;
  }
  leituraSeparacaoMobile = '';
  abrirConfirmacaoSeparacao(correspondencia.item, correspondencia.entrada);
}

function fecharResumoFinalSeparacao() {
  separacaoFinalModal.hidden = true;
}

function abrirResumoFinalSeparacao() {
  const processados = itensSeparacao.filter(itemSeparacaoProcessado);
  if (itensSeparacao.length === 0 || processados.length !== itensSeparacao.length) {
    atualizarStatusSeparacao('Separe ou ajuste todos os itens antes de finalizar a separacao.', 'warning');
    return;
  }

  const conformes = itensSeparacao.filter(itemSeparacaoCompleto).length;
  const divergentes = itensSeparacao.filter(itemSeparacaoDivergente).length;
  const zerados = itensSeparacao.filter(itemSeparacaoZerado).length;
  separacaoFinalResumo.innerHTML = `
    <div class="separacao-final-metric"><span>Conformes</span><strong>${conformes}</strong></div>
    <div class="separacao-final-metric"><span>Divergentes</span><strong>${divergentes}</strong></div>
    <div class="separacao-final-metric"><span>Zerados</span><strong>${zerados}</strong></div>
  `;
  separacaoFinalLista.innerHTML = '';
  separacaoFinalModal.hidden = false;
  setTimeout(() => botaoConfirmarFinalSeparacao.focus(), 0);
}

async function concluirSeparacao() {
  if (itensSeparacao.length === 0 || !itensSeparacao.every(itemSeparacaoProcessado)) return;
  botaoConfirmarFinalSeparacao.disabled = true;
  try {
    const separacao = await requisitarSeparacao('/finalizar', { method: 'POST' });
    aplicarEstadoSeparacao(separacao);
    refletirSeparacaoConcluidaNaInterface();
    pararSincronizacaoSeparacao();
    fecharResumoFinalSeparacao();
    renderizarItensSeparacao();
    atualizarStatusSeparacao('Separacao concluida e quantidades registradas.', 'success');
  } catch (error) {
    atualizarStatusSeparacao(error.message, 'warning');
  } finally {
    botaoConfirmarFinalSeparacao.disabled = false;
  }
}

async function abrirSeparacaoPedido() {
  if (!pedidoPreviewSelecionado || filaModoConferencia !== 'saida') return;
  if (pedidoPreviewSelecionado.STATUS_CONFERENCIA === 'CONFERIDO') return;
  if (pedidoPreviewSelecionado.STATUS_SEPARACAO === 'SEPARADO') return;
  if (itensPedidoPreview.length === 0) {
    atualizarStatusSeparacao('Aguarde o carregamento dos itens do pedido.', 'warning');
    return;
  }

  try {
    await prepararItensSeparacao();
  } catch (error) {
    scanStatus.textContent = error.message;
    return;
  }
  if (separacaoConcluida) {
    refletirSeparacaoConcluidaNaInterface();
    return;
  }
  pedidoPreview.hidden = true;
  separacaoScreen.hidden = false;
  separacaoMeta.textContent = `${formatarTituloPedidoConferencia(pedidoPreviewSelecionado)} | ${pedidoPreviewSelecionado.EMPRESA || '-'}`;
  separacaoCodigo.value = '';
  leituraSeparacaoMobile = '';
  configurarLeitorSeparacao();
  atualizarStatusSeparacao(separacaoConcluida
    ? 'Esta separacao ja foi concluida.'
    : separacaoEmMobile()
      ? 'Bipe um codigo ou mantenha um produto pressionado para confirmar a separacao.'
      : 'Bipe um codigo ou clique em um produto da lista.'
  );
  renderizarItensSeparacao();
  iniciarSincronizacaoSeparacao();
  atualizarIcones();
  setTimeout(() => separacaoCodigo.focus(), 0);
}

function fecharSeparacaoPedido() {
  pararSincronizacaoSeparacao();
  if (toqueLongoSeparacao) {
    clearTimeout(toqueLongoSeparacao.timeout);
    toqueLongoSeparacao = null;
  }
  fecharConfirmacaoSeparacao();
  fecharResumoFinalSeparacao();
  separacaoScreen.hidden = true;
  if (pedidoPreviewSelecionado) pedidoPreview.hidden = false;
}

function fecharPreviewPedido() {
  pararSincronizacaoSeparacao();
  if (separacaoScreen) separacaoScreen.hidden = true;
  fecharConfirmacaoSeparacao();
  fecharResumoFinalSeparacao();
  pedidoPreviewSelecionado = null;
  itensPedidoPreview = [];
  itensSeparacao = [];
  separacaoConcluida = false;
  pedidoPreview.hidden = true;
  pedidoPreviewItensLista.innerHTML = '';
  pedidoPreviewDocumentos.hidden = true;
  pedidoPreviewDocumentos.innerHTML = '';
}

function limparPedidoConferencia(mensagem = 'Selecione um pedido para iniciar.') {
  pararSincronizacaoCaixaEntrada();
  if (entradaCaixaModal) entradaCaixaModal.hidden = true;
  pedidoSelecionado = null;
  maiorCaixaEntradaRemota = 0;
  fecharPreviewPedido();
  itensPedidoSelecionado = [];
  pedidoConferenciaTitulo.textContent = 'Nenhum pedido selecionado';
  pedidoConferenciaStatus.textContent = '-';
  filaContexto.textContent = '-';
  scanStatus.textContent = mensagem;
  confirmarStatus.textContent = '';
  scanCodigo.value = '';
  scanControle.value = '';
  if (scanControleOpcoes) scanControleOpcoes.innerHTML = '';
  fecharOpcoesControleEntrada();
  scanQtd.value = valorPadraoQuantidadeConferencia();
  atualizarProdutoLeituraEntrada();
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
      dataFinal: filaDataFinal.value,
      modo: filaModoConferencia
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
      ? `${filaModoConferencia === 'entrada' ? 'Nota de entrada localizada' : 'Pedido ou nota localizado'}. Selecione para visualizar os itens.`
      : `Selecione ${filaModoConferencia === 'entrada' ? 'uma nota de entrada' : 'um pedido'} para conferir.`;
    renderizarPedidosFila();
    salvarNavegacaoFila({ etapa: 'pedidos', pedido: null });
  } catch (error) {
    console.error('Erro ao buscar fila de conferencia:', error);
    filaPedidos = [];
    renderizarPedidosFila();
    scanStatus.textContent = error.message;
  }
}

async function restaurarConferenciaEmAndamento(estado) {
  const pedido = estado?.pedido;
  if (!pedido?.NUNOTA) return false;

  filaModoConferencia = estado.modo === 'entrada' ? 'entrada' : 'saida';
  filaDataInicial.value = estado.dataInicial || obterDataHoje();
  filaDataFinal.value = estado.dataFinal || filaDataInicial.value;
  filaEmpresa.value = estado.empresa || '';
  filaBuscaPedido.value = estado.buscaPedido || '';
  atualizarModoFilaConferencia();
  mostrarHomeESuspenderRefresh();
  mostrarFila();

  pedidoSelecionado = {
    ...pedido,
    nuconf: pedido.nuconf || pedido.NUCONFATUAL || null,
    STATUS_CONFERENCIA: pedido.STATUS_CONFERENCIA || 'EM ANDAMENTO'
  };
  itensPedidoSelecionado = [];
  confirmarStatus.textContent = '';
  scanStatus.textContent = 'Restaurando conferencia em andamento...';
  pedidoConferenciaTitulo.textContent = formatarTituloPedidoConferencia(pedidoSelecionado);
  filaContexto.textContent = `Periodo ${formatarPeriodo(filaDataInicial.value, filaDataFinal.value)} | ${filaEmpresa.options[filaEmpresa.selectedIndex]?.textContent || '-'} | ${formatarUsuarioLogado()}`;
  mostrarEtapaConferenciaFila();
  renderizarPedidoEmConferencia();
  atualizarControlesConferencia();

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${pedidoSelecionado.NUNOTA}/itens`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao restaurar itens da conferencia');
    }

    itensPedidoSelecionado = (payload.itens || []).map((item) => ({
      ...item,
      qtdConferida: normalizarQuantidade(item.qtdConferida),
      qtdCortada: normalizarQuantidade(item.qtdCortada),
      leituras: Array.isArray(item.leituras) ? item.leituras : []
    }));
    scanStatus.textContent = '';
    fecharPreviewPedido();
    renderizarItensConferencia();
    atualizarOpcoesControleEntrada();
    salvarNavegacaoFila({ etapa: 'conferencia' });
    history.replaceState({ tela: 'fila', etapa: 'conferencia' }, '', '#fila-conferencia');
    setTimeout(() => scanCodigo.focus(), 0);
    return true;
  } catch (error) {
    console.error('Erro ao restaurar conferencia:', error);
    scanStatus.textContent = error.message;
    renderizarItensConferencia();
    return true;
  }
}

async function restaurarNavegacaoFilaSalva() {
  const estado = obterNavegacaoFilaSalva();
  if (!estado || estado.tela !== 'fila') return false;

  filaModoConferencia = estado.modo === 'entrada' ? 'entrada' : 'saida';
  filaDataInicial.value = estado.dataInicial || obterDataHoje();
  filaDataFinal.value = estado.dataFinal || filaDataInicial.value;
  filaEmpresa.value = estado.empresa || '';
  filaBuscaPedido.value = estado.buscaPedido || '';
  atualizarModoFilaConferencia();

  if (estado.etapa === 'conferencia' && estado.pedido?.NUNOTA) {
    return restaurarConferenciaEmAndamento(estado);
  }

  mostrarHomeESuspenderRefresh();
  mostrarFila();
  mostrarEtapaPedidosFila();
  history.replaceState({ tela: 'fila', etapa: 'pedidos' }, '', '#fila-conferencia');

  if (filaEmpresa.value || filaBuscaPedido.value) {
    await buscarFilaConferencia();
  } else {
    renderizarPedidosFila();
    scanStatus.textContent = textoInicialModoFila();
  }

  return true;
}

async function abrirPreviewPedido(pedido) {
  if (!temUsuarioLogado()) {
    scanStatus.textContent = 'Entre no sistema antes de visualizar o pedido.';
    return;
  }

  pedidoPreviewSelecionado = pedido;
  itensPedidoPreview = [];
  pedidoPreview.hidden = false;
  pedidoPreviewTitulo.textContent = formatarTituloPedidoConferencia(pedido);
  pedidoPreviewMeta.textContent = `${formatarData(pedido.DTNEG)} | ${pedido.EMPRESA || '-'}`;
  pedidoPreviewValor.textContent = formatarMoeda(pedido.VLRNOTA);
  pedidoPreviewItens.textContent = pedido.QTD_ITENS;
  pedidoPreviewUnidades.textContent = formatarQuantidade(pedido.QTD_TOTAL);
  if (pedidoPreviewVolumesCard && pedidoPreviewVolumes) {
    pedidoPreviewVolumesCard.hidden = filaModoConferencia !== 'entrada';
    pedidoPreviewVolumes.textContent = formatarQuantidade(pedido.QTDVOL || 0);
  }
  botaoImprimirPreviewPedido.innerHTML = `<i data-lucide="printer" aria-hidden="true"></i>Imprimir ${filaModoConferencia === 'entrada' ? 'nota' : 'pedido'}`;
  botaoAbrirSeparacaoPedido.hidden = filaModoConferencia !== 'saida'
    || pedido.STATUS_CONFERENCIA === 'CONFERIDO';
  botaoAbrirSeparacaoPedido.disabled = true;
  pedidoPreviewStatus.textContent = pedido.STATUS_CONFERENCIA === 'EM ANDAMENTO' ? 'Continuar' : 'Novo';
  pedidoPreviewStatus.textContent = pedido.STATUS_CONFERENCIA === 'CONFERIDO'
    ? 'Conferido'
    : pedidoPreviewStatus.textContent;
  botaoConfirmarPreviewPedido.disabled = !pedidoPodeIniciarConferencia(pedido);
  // A impressao continua disponivel mesmo depois da conferencia.
  botaoImprimirPreviewPedido.hidden = false;
  botaoConfirmarPreviewPedido.textContent = pedidoPodeIniciarConferencia(pedido)
    ? 'Iniciar conferencia'
    : `${filaModoConferencia === 'entrada' ? 'Nota' : 'Pedido'} ja conferido`;
  pedidoPreviewDocumentos.hidden = pedido.STATUS_CONFERENCIA !== 'CONFERIDO' || filaModoConferencia === 'entrada';
  pedidoPreviewDocumentos.innerHTML = '';
  if (pedido.STATUS_CONFERENCIA === 'CONFERIDO' && filaModoConferencia === 'saida') {
    carregarDocumentosFiscaisPedido(pedido, pedidoPreviewDocumentos, null, false, Number(pedido.CODTIPOPER) === 6);
  }
  renderizarEstadoVazio(pedidoPreviewItensLista, 'Carregando itens do pedido...');
  atualizarIcones();

  try {
    const res = await fetch(`/api/fila-conferencia/pedidos/${pedido.NUNOTA}/itens`);
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.erro || 'Erro ao buscar itens');
    }

    itensPedidoPreview = payload.itens || [];
    renderizarItensPlanilha(pedidoPreviewItensLista, itensPedidoPreview);
    botaoAbrirSeparacaoPedido.disabled = filaModoConferencia !== 'saida'
      || itensPedidoPreview.length === 0
      || pedido.STATUS_CONFERENCIA === 'CONFERIDO'
      || pedido.STATUS_SEPARACAO === 'SEPARADO';
    if (pedido.STATUS_SEPARACAO === 'SEPARADO') {
      botaoAbrirSeparacaoPedido.textContent = 'Separação concluída';
    } else if (pedido.STATUS_SEPARACAO === 'EM_SEPARACAO') {
      botaoAbrirSeparacaoPedido.textContent = 'Continuar separação';
    } else {
      botaoAbrirSeparacaoPedido.textContent = 'Separação';
    }
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
  scanQtd.value = valorPadraoQuantidadeConferencia();
  confirmarStatus.textContent = '';
  scanStatus.textContent = 'Iniciando conferencia no Sankhya...';
  pedidoConferenciaTitulo.textContent = formatarTituloPedidoConferencia(pedido);
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
        codUsu: usuarioLogado.codUsu,
        modo: filaModoConferencia
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
      qtdCortada: normalizarQuantidade(item.qtdCortada),
      leituras: Array.isArray(item.leituras) ? item.leituras : []
    }));
    fecharPreviewPedido();
    scanStatus.textContent = '';
    renderizarItensConferencia();
    atualizarOpcoesControleEntrada();
    atualizarProdutoLeituraEntrada();
    salvarNavegacaoFila({ etapa: 'conferencia' });
    scanCodigo.focus();
  } catch (error) {
    console.error('Erro ao selecionar pedido:', error);
    scanStatus.textContent = error.message;
    renderizarItensConferencia();
  }
}

function adicionarConferenciaPorCodigo() {
  const codigo = normalizarCodigo(scanCodigo.value);
  const controleInformado = filaModoConferencia === 'entrada' ? scanControle.value.trim() : '';
  const dtValidadeInformada = filaModoConferencia === 'entrada' ? formatarDataInput(scanValidade?.value) : '';
  const dtFabricacaoInformada = filaModoConferencia === 'entrada' ? formatarDataInput(scanFabricacao?.value) : '';
  const qtd = Number(scanQtd.value);

  if (!pedidoSelecionado || !codigo) {
    return;
  }

  if (!Number.isFinite(qtd) || qtd <= 0) {
    scanStatus.textContent = 'Informe uma quantidade valida.';
    return;
  }

  const itensCompativeis = obterItensCompativeisCodigo(codigo);
  const controlesCompativeis = [...new Set(itensCompativeis
    .map((candidate) => String(candidate.item.controle || '').trim())
    .filter(Boolean))];

  if (filaModoConferencia === 'entrada' && controlesCompativeis.length > 1 && !controleInformado) {
    atualizarOpcoesControleEntrada();
    scanStatus.innerHTML = '<span class="danger-text">Este produto possui mais de um lote/controle. Selecione ou digite o lote recebido.</span>';
    scanControle.focus();
    return;
  }

  const matchControle = controleInformado
    ? itensCompativeis.find((candidate) =>
      String(candidate.item.controle || '').trim().toUpperCase() === controleInformado.toUpperCase()
        && quantidadePendenteItem(candidate.item) > 0
    ) || itensCompativeis.find((candidate) =>
      String(candidate.item.controle || '').trim().toUpperCase() === controleInformado.toUpperCase()
    )
    : null;
  const match = matchControle
    || itensCompativeis.find((candidate) => quantidadePendenteItem(candidate.item) > 0)
    || itensCompativeis[0];
  const item = match?.item;

  if (!item) {
    scanStatus.innerHTML = `<span class="danger-text">Codigo ${codigo} nao encontrado neste pedido.</span>`;
    scanCodigo.select();
    return;
  }

  const multiplicador = Math.max(0, Number(match.entrada.multiplicador) || 1);
  const qtdConvertida = qtd * multiplicador;
  const pendente = quantidadePendenteItem(item);
  const dtValidadeLeitura = dtValidadeInformada || formatarDataInput(item.dtValidade);
  const dtFabricacaoLeitura = dtFabricacaoInformada || formatarDataInput(item.dtFabricacao);

  if (filaModoConferencia !== 'entrada' && qtdConvertida > pendente) {
    scanStatus.innerHTML = `<span class="danger-text">Quantidade maior que o pendente do item. Pendente: ${formatarQuantidade(pendente)}.</span>`;
    scanQtd.select();
    return;
  }

  item.qtdConferida += qtdConvertida;
  item.leituras = Array.isArray(item.leituras) ? item.leituras : [];
  const caixaEntradaAtual = filaModoConferencia === 'entrada' ? obterCaixaEntradaAtual() : null;
  const leituraExistente = item.leituras.find((leitura) =>
    normalizarCodigo(leitura.codigo) === codigo
      && String(leitura.codVol || '') === String(match.entrada.codVol || item.codVol || 'UN')
      && String(leitura.controle || '').trim() === String(controleInformado || item.controle || '').trim()
      && String(leitura.dtValidade || '') === String(dtValidadeLeitura || '')
      && String(leitura.dtFabricacao || '') === String(dtFabricacaoLeitura || '')
      && Number(leitura.multiplicador || 1) === multiplicador
      && (filaModoConferencia !== 'entrada'
        || (Number(leitura.caixaId) === Number(caixaEntradaAtual.caixaId) && leitura.caixaFechada !== true))
  );
  if (leituraExistente) {
    leituraExistente.quantidade += qtd;
    leituraExistente.quantidadeConvertida += qtdConvertida;
  } else {
    item.leituras.push({
      codigo,
      tipo: match.entrada.tipo || 'CODIGO_BARRAS',
      codVol: match.entrada.codVol || item.codVol || 'UN',
      controle: controleInformado || item.controle || '',
      dtValidade: dtValidadeLeitura,
      dtFabricacao: dtFabricacaoLeitura,
      multiplicador,
      quantidade: qtd,
      quantidadeConvertida: qtdConvertida,
      ...(caixaEntradaAtual ? { caixaId: caixaEntradaAtual.caixaId, caixaFechada: false } : {})
    });
  }
  const detalheConversao = multiplicador !== 1
    ? ` (${formatarQuantidade(qtd)} x ${formatarQuantidade(multiplicador)} = ${formatarQuantidade(qtdConvertida)} un.)`
    : '';
  scanStatus.innerHTML = `<span class="success-text">${item.codProd} conferido por ${obterDescricaoEntradaCodigo(match.entrada)}${detalheConversao}: ${formatarQuantidade(item.qtdConferida)} de ${formatarQuantidade(item.qtdNeg)}.</span>`;
  mostrarFotoProduto(item, 'ultimo');
  scanCodigo.value = '';
  scanControle.value = '';
  limparDatasEntrada();
  if (scanControleOpcoes) scanControleOpcoes.innerHTML = '';
  fecharOpcoesControleEntrada();
  scanQtd.value = valorPadraoQuantidadeConferencia();
  atualizarProdutoLeituraEntrada();
  renderizarItensConferencia();
  salvarProgressoConferencia();
  scanCodigo.focus();
}

function fecharModalVolumesConferencia() {
  confirmarVolumesModal.hidden = true;
  confirmarVolumesStatus.textContent = '';
}

function normalizarControleEntrada(valor) {
  return String(valor ?? '').trim();
}

function normalizarDataEntrada(valor) {
  return formatarDataInput(valor);
}

function formatarDataAlteracaoEntrada(valor) {
  const data = normalizarDataEntrada(valor);
  return data ? formatarData(data) : '-';
}

function valoresUnicosEntrada(valores) {
  return [...new Set(valores
    .map((valor) => String(valor ?? '').trim())
    .filter(Boolean))];
}

function obterAlteracoesConferenciaEntrada() {
  if (filaModoConferencia !== 'entrada') return [];

  return itensPedidoSelecionado
    .map((item) => {
      const leituras = Array.isArray(item.leituras) ? item.leituras : [];
      const detalhes = [];
      const controleOriginal = normalizarControleEntrada(item.controle);
      const fabricacaoOriginal = normalizarDataEntrada(item.dtFabricacao);
      const validadeOriginal = normalizarDataEntrada(item.dtValidade);

      const controlesLidos = valoresUnicosEntrada(leituras.map((leitura) => normalizarControleEntrada(leitura.controle)));
      const fabricacoesLidas = valoresUnicosEntrada(leituras.map((leitura) => normalizarDataEntrada(leitura.dtFabricacao)));
      const validadesLidas = valoresUnicosEntrada(leituras.map((leitura) => normalizarDataEntrada(leitura.dtValidade)));
      const controlesDiferentes = controlesLidos.filter((valor) => valor !== controleOriginal);
      const fabricacoesDiferentes = fabricacoesLidas.filter((valor) => valor !== fabricacaoOriginal);
      const validadesDiferentes = validadesLidas.filter((valor) => valor !== validadeOriginal);
      const qtdCortada = quantidadeCortadaItem(item);

      if (controlesDiferentes.length > 0) {
        detalhes.push({
          campo: 'Lote/controle recebido',
          de: `Nota: ${controleOriginal || '-'}`,
          para: `Entrada: ${controlesDiferentes.join(', ')}`
        });
      }

      if (fabricacoesDiferentes.length > 0) {
        detalhes.push({
          campo: 'Fabricacao',
          de: formatarDataAlteracaoEntrada(fabricacaoOriginal),
          para: fabricacoesDiferentes.map(formatarDataAlteracaoEntrada).join(', ')
        });
      }

      if (validadesDiferentes.length > 0) {
        detalhes.push({
          campo: 'Validade',
          de: formatarDataAlteracaoEntrada(validadeOriginal),
          para: validadesDiferentes.map(formatarDataAlteracaoEntrada).join(', ')
        });
      }

      if (qtdCortada > 0) {
        detalhes.push({
          campo: 'Corte',
          de: `${formatarQuantidade(item.qtdNeg)} negociado(s)${controleOriginal ? ` | lote ${controleOriginal}` : ''}`,
          para: `${formatarQuantidade(qtdCortada)} cortado(s)${controleOriginal ? ` | lote ${controleOriginal}` : ''}`
        });
      }

      if (item.qtdConferida > item.qtdNeg) {
        const excedente = item.qtdConferida - item.qtdNeg;
        const loteExcesso = controlesDiferentes.length > 0
          ? controlesDiferentes.join(', ')
          : controleOriginal;
        detalhes.push({
          campo: 'Quantidade maior',
          de: `${formatarQuantidade(item.qtdNeg)} negociado(s)${controleOriginal ? ` | lote ${controleOriginal}` : ''}`,
          para: `${formatarQuantidade(item.qtdConferida)} conferido(s) (${formatarQuantidade(excedente)} acima)${loteExcesso ? ` | lote recebido ${loteExcesso}` : ''}`
        });
      }

      return detalhes.length > 0 ? { item, detalhes } : null;
    })
    .filter(Boolean);
}

function fecharModalAlteracoesEntrada() {
  if (!entradaAlteracoesModal) return;
  entradaAlteracoesModal.hidden = true;
  if (entradaAlteracoesLista) entradaAlteracoesLista.innerHTML = '';
}

function obterIconeAlteracaoEntrada(campo) {
  const chave = String(campo || '').toLowerCase();
  if (chave.includes('lote') || chave.includes('controle')) return 'tag';
  if (chave.includes('fabrica') || chave.includes('validade')) return 'calendar-days';
  if (chave.includes('corte')) return 'scissors';
  if (chave.includes('quantidade')) return 'package-plus';
  return 'circle-alert';
}

function abrirModalAlteracoesEntrada(alteracoes) {
  if (!entradaAlteracoesModal || !entradaAlteracoesLista) {
    confirmarConferencia(0);
    return;
  }

  const totalDivergencias = alteracoes.reduce((total, alteracao) => total + alteracao.detalhes.length, 0);
  const itensHtml = alteracoes
    .map(({ item, detalhes }) => {
      const qtdCortada = quantidadeCortadaItem(item);
      const unidadeExibicao = obterUnidadeExibicaoItem(item);
      const resumoItem = [
        `Negociado: ${formatarQuantidade(item.qtdNeg)} ${unidadeExibicao}`.trim(),
        `Conferido: ${formatarQuantidade(item.qtdConferida)} ${unidadeExibicao}`.trim(),
        qtdCortada > 0 ? `Corte: ${formatarQuantidade(qtdCortada)} ${unidadeExibicao}`.trim() : null,
        item.controle ? `Lote da nota: ${item.controle}` : null
      ].filter(Boolean);

      return `
      <article class="entrada-alteracoes-item">
        <div class="entrada-alteracoes-item-head">
          <strong class="entrada-alteracoes-produto">
            <i data-lucide="package"></i>
            <span>
              Produto ${escaparHtml(item.codProd)} - ${escaparHtml(item.descrProd || item.descricao || '')}
              <small>${resumoItem.map(escaparHtml).join(' | ')}</small>
            </span>
          </strong>
          <span class="entrada-alteracoes-badge">${detalhes.length} ${detalhes.length === 1 ? 'divergencia' : 'divergencias'}</span>
        </div>
        <div class="entrada-alteracoes-detalhes">
          ${detalhes.map((detalhe) => `
            <div class="entrada-alteracoes-detalhe">
              <span class="entrada-alteracoes-campo">
                <i data-lucide="${obterIconeAlteracaoEntrada(detalhe.campo)}"></i>
                ${escaparHtml(detalhe.campo)}
              </span>
              <strong>${escaparHtml(detalhe.de)}</strong>
              <span class="entrada-alteracoes-seta">-></span>
              <strong class="entrada-alteracoes-depois">${escaparHtml(detalhe.para)}</strong>
            </div>
          `).join('')}
        </div>
      </article>
    `;
    })
    .join('');

  entradaAlteracoesLista.innerHTML = `
    <div class="entrada-alteracoes-resumo">
      <strong><i data-lucide="triangle-alert"></i> ${alteracoes.length} ${alteracoes.length === 1 ? 'item com divergencia' : 'itens com divergencia'}</strong>
      <span>${totalDivergencias} ${totalDivergencias === 1 ? 'alteracao encontrada' : 'alteracoes encontradas'}. Revise antes de confirmar.</span>
    </div>
    ${itensHtml}
  `;
  entradaAlteracoesModal.hidden = false;
  atualizarIcones();
}

function solicitarVolumesConferencia() {
  if (!pedidoSelecionado) {
    return;
  }

  if (filaModoConferencia === 'entrada') {
    const resumo = calcularResumoConferencia();
    if (!resumo.pronto) {
      confirmarStatus.textContent = 'Ainda existem itens divergentes.';
      return;
    }

    if (!temUsuarioLogado()) {
      confirmarStatus.textContent = 'Entre no sistema antes de confirmar.';
      return;
    }

    const alteracoes = obterAlteracoesConferenciaEntrada();
    if (alteracoes.length > 0) {
      abrirModalAlteracoesEntrada(alteracoes);
      return;
    }

    confirmarConferencia(0);
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

  confirmarVolumesStatus.textContent = '';
  const volumesAtuais = Number(pedidoSelecionado.QTDVOL || 0);
  confirmarVolumesQtd.value = Number.isInteger(volumesAtuais) && volumesAtuais > 0
    ? String(volumesAtuais)
    : '';
  confirmarVolumesModal.hidden = false;
  setTimeout(() => {
    confirmarVolumesQtd.focus();
    confirmarVolumesQtd.select();
  }, 0);
}

async function confirmarConferencia(volumes) {
  const volumesInvalidos = filaModoConferencia === 'saida' ? volumes <= 0 : volumes < 0;
  if (!pedidoSelecionado || !Number.isInteger(volumes) || volumesInvalidos) {
    confirmarVolumesStatus.innerHTML = '<span class="danger-text">Informe uma quantidade valida de volumes.</span>';
    return;
  }

  fecharModalVolumesConferencia();

  botaoConfirmarConferencia.disabled = true;
  confirmarStatus.textContent = 'Confirmando conferencia no Sankhya...';
  abrirModalProcessandoConferencia(pedidoSelecionado);

  try {
    const res = await fetch('/api/fila-conferencia/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nunota: pedidoSelecionado.NUNOTA,
        nuconf: pedidoSelecionado.nuconf,
        codUsu: usuarioLogado.codUsu,
        modo: filaModoConferencia,
        volumes,
        itens: itensPedidoSelecionado.map((item) => ({
          sequencia: item.sequencia,
          codProd: item.codProd,
          qtdConferida: item.qtdConferida,
          qtdCortada: quantidadeCortadaItem(item),
          leituras: Array.isArray(item.leituras) ? item.leituras : []
        }))
      })
    });
    const payload = await res.json();

    if (!res.ok) {
      confirmarStatus.innerHTML = montarErroConfirmacao(payload);
      renderizarResumoConferencia();
      exibirErroModalConferencia(payload);
      return;
    }

    const pedidoFinalizado = { ...pedidoSelecionado, QTDVOL: volumes };
    confirmarStatus.innerHTML = '<span class="success-text">Conferencia confirmada.</span>';
    filaPedidos = filaPedidos.filter((pedido) => pedido.NUNOTA !== pedidoSelecionado.NUNOTA);
    limparNavegacaoFilaSalva();
    limparPedidoConferencia('Pedido conferido. Selecione o proximo pedido.');
    abrirModalPosConferencia(pedidoFinalizado, payload.faturamento, payload.documentosAuxiliares);
  } catch (error) {
    console.error('Erro ao confirmar conferencia:', error);
    confirmarStatus.innerHTML = `<span class="danger-text">${error.message}</span>`;
    renderizarResumoConferencia();
    exibirErroModalConferencia(null, error);
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

    atualizarIcones();
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
  salvarNavegacaoFila({ etapa: 'pedidos', pedido: null });
  history.pushState({ tela: 'fila', etapa: 'pedidos' }, '', '#fila-conferencia');
}

function textoInicialModoFila() {
  return filaModoConferencia === 'entrada'
    ? 'Informe os filtros para buscar notas de entrada.'
    : 'Informe os filtros para buscar pedidos.';
}

function valorPadraoQuantidadeConferencia() {
  return filaModoConferencia === 'saida' ? '1' : '';
}

function atualizarModoFilaConferencia() {
  const entrada = filaModoConferencia === 'entrada';
  filaScreen.classList.toggle('fila-modo-entrada', entrada);
  botaoModoEntrada.classList.toggle('active', entrada);
  botaoModoEntrada.setAttribute('aria-checked', entrada ? 'true' : 'false');
  botaoModoEntrada.setAttribute('aria-label', entrada ? 'Modo atual: conferencia de entrada' : 'Modo atual: conferencia de saida');
  filaModoTitulo.textContent = entrada ? 'Conferencia de entrada' : 'Conferencia de saida';
  filaModoDescricao.textContent = entrada ? 'Recebimento de mercadorias' : 'Separacao e expedicao de pedidos';
  filaModoIcone.setAttribute('data-lucide', entrada ? 'package-plus' : 'package-check');
  filaTituloOperacao.textContent = entrada ? 'Conferencia de Entrada' : 'Fila de Conferencia';
  botaoBuscarFilaConferencia.textContent = entrada ? 'Buscar entradas' : 'Buscar pedidos';
  filaBuscaPedido.placeholder = entrada ? 'Numero da nota de entrada' : 'Numero do pedido ou nota fiscal';
  filaSidebarTitle.textContent = entrada ? 'Entrada em conferencia' : 'Pedido em conferencia';
  botaoAbrirRomaneio.hidden = entrada;
  if (entrada && !romaneioModal.hidden) fecharRomaneioCargas();
  scanControleField.hidden = !entrada;
  if (scanValidadeField) scanValidadeField.hidden = !entrada;
  if (scanFabricacaoField) scanFabricacaoField.hidden = !entrada;
  scanControle.disabled = !entrada || !pedidoSelecionado;
  if (scanValidade) scanValidade.disabled = !entrada || !pedidoSelecionado;
  if (scanFabricacao) scanFabricacao.disabled = !entrada || !pedidoSelecionado;
  if (!entrada) {
    scanControle.value = '';
    limparDatasEntrada();
  }
  scanQtd.value = valorPadraoQuantidadeConferencia();
  if (scanControleOpcoes) scanControleOpcoes.innerHTML = '';
  fecharOpcoesControleEntrada();
  atualizarProdutoLeituraEntrada();
  const tituloLista = filaCountPedidos.previousElementSibling;
  if (tituloLista) tituloLista.textContent = entrada ? 'Notas de entrada' : 'Pedidos';
  atualizarCaixaEntrada();
  atualizarIcones();
}

function alternarModoFilaConferencia() {
  filaModoConferencia = filaModoConferencia === 'entrada' ? 'saida' : 'entrada';
  filaPedidos = [];
  pedidoSelecionado = null;
  itensPedidoSelecionado = [];
  atualizarModoFilaConferencia();
  renderizarPedidosFila();
  limparPedidoConferencia(textoInicialModoFila());
  salvarNavegacaoFila({ etapa: 'pedidos', pedido: null });
}

function voltarParaHomeViaHistorico() {
  if (filaScreen.classList.contains('active')) {
    limparNavegacaoFilaSalva();
  }

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

  if (window.location.hash === '#fila-conferencia') {
    const restaurouFila = await restaurarNavegacaoFilaSalva();

    if (restaurouFila) {
      return;
    }

    mostrarHomeESuspenderRefresh();
    mostrarFila();
    mostrarEtapaPedidosFila();
    history.replaceState({ tela: 'fila', etapa: 'pedidos' }, '', '#fila-conferencia');
    return;
  }

  if (window.location.hash === '#consulta-produtos') {
    renderizarConsultaVazia();
    mostrarConsultaProdutos();
    history.replaceState({ tela: 'consulta-produtos' }, '', '#consulta-produtos');
    return;
  }

  if (window.location.hash === '#atualizacao-contato') {
    mostrarAtualizacaoContato();
    carregarPerfisContato();
    history.replaceState({ tela: 'atualizacao-contato' }, '', '#atualizacao-contato');
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
  atualizarIcones();

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
botaoAbrirAtualizacaoContato.addEventListener('click', abrirAtualizacaoContato);
botaoAbrirConsultaProdutos.addEventListener('click', abrirConsultaProdutos);
botaoConsultaProdutoBuscar.addEventListener('click', buscarConsultaProduto);
botaoConsultaProdutoEtiqueta.addEventListener('click', abrirSelecaoEtiquetaProduto);
consultaEtiquetaCancelar.addEventListener('click', fecharSelecaoEtiquetaProduto);
consultaEtiquetaConfirmar.addEventListener('click', confirmarSelecaoEtiquetaProduto);
consultaEtiquetaModal.addEventListener('click', (event) => {
  if (event.target === consultaEtiquetaModal) fecharSelecaoEtiquetaProduto();
});
botaoConsultaProdutoVoltar.addEventListener('click', voltarConsultaProdutos);
consultaProdutoCodigo.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    buscarConsultaProduto();
  }
});
contatoPerfil.addEventListener('change', carregarEstadosContato);
contatoEstado.addEventListener('change', carregarCidadesContato);
contatoCidade.addEventListener('change', () => carregarClientesContato(1));
contatoCompraInicial.addEventListener('change', () => {
  if (contatoCompraFinal.value && contatoCompraInicial.value > contatoCompraFinal.value) {
    contatoCompraFinal.value = contatoCompraInicial.value;
  }
  if (contatoOrigemLista === 'cidade') carregarClientesContato(1, true);
  else desenharClientesContato();
});
contatoCompraFinal.addEventListener('change', () => {
  if (contatoCompraInicial.value && contatoCompraFinal.value < contatoCompraInicial.value) {
    contatoCompraInicial.value = contatoCompraFinal.value;
  }
  if (contatoOrigemLista === 'cidade') carregarClientesContato(1, true);
  else desenharClientesContato();
});
botaoExibirContatosAtualizados.addEventListener('click', carregarClientesAtualizadosContato);
contatoBusca.addEventListener('input', agendarBuscaContato);
contatoSomenteAtivos.addEventListener('change', alternarFiltroAtivosContato);
filaFiltroStatus?.addEventListener('change', renderizarPedidosFila);
contatoPaginaPrimeira.addEventListener('click', () => irParaPaginaContato(1));
contatoPaginaAnterior.addEventListener('click', () => irParaPaginaContato(contatoPaginacao.pagina - 1));
contatoPaginaProxima.addEventListener('click', () => irParaPaginaContato(contatoPaginacao.pagina + 1));
contatoPaginaUltima.addEventListener('click', () => irParaPaginaContato(contatoPaginacao.totalPaginas));
contatoClientesLista.addEventListener('click', (event) => {
  const botaoCliente = event.target.closest('.contato-link');
  if (!botaoCliente) return;
  abrirDetalheContato(botaoCliente.dataset.codparc);
});
botaoVoltarListaContatos.addEventListener('click', voltarERecarregarListaContato);
botaoProximoClienteContatos?.addEventListener('click', abrirProximoClienteContato);
botaoCriarCardBitrix?.addEventListener('click', abrirConfirmacaoCardBitrix);
botaoCancelarBitrix?.addEventListener('click', fecharConfirmacaoCardBitrix);
botaoConfirmarBitrix?.addEventListener('click', criarCardBitrixCliente);
bitrixConfirmModal?.addEventListener('click', (event) => {
  if (event.target === bitrixConfirmModal) fecharConfirmacaoCardBitrix();
});
botaoExibirAcompanhamento.addEventListener('click', abrirConferencia);
botaoVoltarHomeAcompanhamento.addEventListener('click', voltarParaHomeViaHistorico);
botaoVoltarHomeFila.addEventListener('click', voltarParaHomeViaHistorico);
botaoVoltarHomeContato.addEventListener('click', voltarParaHomeViaHistorico);
botaoVoltarListaFila.addEventListener('click', () => {
  mostrarEtapaPedidosFila();
  limparPedidoConferencia('Selecione um pedido para iniciar.');
  buscarFilaConferencia();
});
produtoFotoFrame.addEventListener('click', abrirModalFotoProduto);
produtoFotoModalFechar.addEventListener('click', fecharModalFotoProduto);
produtoFotoModal.addEventListener('click', (event) => {
  if (event.target === produtoFotoModal) {
    fecharModalFotoProduto();
  }
});
botaoBuscarFilaConferencia.addEventListener('click', buscarFilaConferencia);
botaoModoEntrada.addEventListener('click', alternarModoFilaConferencia);
botaoAbrirRomaneio.addEventListener('click', abrirRomaneioCargas);
botaoFecharRomaneio.addEventListener('click', fecharRomaneioCargas);
botaoCancelarRomaneio.addEventListener('click', fecharRomaneioCargas);
romaneioTransportadoraTrigger.addEventListener('click', () => {
  definirSeletorTransportadorasAberto(romaneioTransportadoraOpcoes.hidden);
});
romaneioTransportadoraOpcoes.addEventListener('change', (event) => {
  const campo = event.target.closest('[data-romaneio-transportadora]');
  if (!campo) return;
  if (campo.checked) romaneioTransportadorasSelecionadas.add(String(campo.value));
  else romaneioTransportadorasSelecionadas.delete(String(campo.value));
  atualizarResumoTransportadorasRomaneio();
  carregarPedidosRomaneio();
});
botaoGerarRomaneio.addEventListener('click', gerarRomaneioCargas);
botaoImprimirRomaneio.addEventListener('click', () => {
  abrirPdfRomaneio(botaoImprimirRomaneio.dataset.ordemCarga, botaoImprimirRomaneio.dataset.empresa, botaoImprimirRomaneio);
});
romaneioLista.addEventListener('change', (event) => {
  const campo = event.target;
  if (!(campo instanceof HTMLInputElement) || campo.type !== 'checkbox') return;

  if (campo.dataset.romaneioSelecionarTodas !== undefined) {
    romaneioPedidos.forEach((pedido) => {
      pedido.selecionada = campo.checked;
    });
  } else if (campo.dataset.romaneioNota) {
    const nunota = Number(campo.dataset.romaneioNota);
    const pedido = romaneioPedidos.find((item) => Number(item.NUNOTA) === nunota);
    if (pedido) pedido.selecionada = campo.checked;
  }

  renderizarPedidosRomaneio();
});
romaneioModal.addEventListener('click', (event) => {
  if (event.target === romaneioModal) fecharRomaneioCargas();
  else if (!event.target.closest('#romaneio-transportadora')) definirSeletorTransportadorasAberto(false);
});
filaBuscaPedido.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    buscarFilaConferencia();
  }
});
botaoCancelarPreviewPedido.addEventListener('click', fecharPreviewPedido);
botaoImprimirPreviewPedido.addEventListener('click', abrirPdfPedido);
botaoAbrirSeparacaoPedido.addEventListener('click', abrirSeparacaoPedido);
botaoFecharSeparacaoPedido.addEventListener('click', fecharSeparacaoPedido);
botaoFinalizarSeparacao.addEventListener('click', abrirResumoFinalSeparacao);
botaoCancelarConfirmacaoSeparacao.addEventListener('click', fecharConfirmacaoSeparacao);
botaoConfirmarSeparacao.addEventListener('click', confirmarItemSeparacao);
separacaoLoteSelect.addEventListener('change', () => {
  if (!itemSeparacaoPendente) return;
  itemSeparacaoPendente.loteSelecionado = obterLoteSelecionadoConfirmacao();
  atualizarProdutoConfirmacaoSeparacao();
  separacaoConfirmStatus.textContent = itemSeparacaoPendente.loteSelecionado
    ? `Lote ${itemSeparacaoPendente.loteSelecionado.controle} selecionado.`
    : 'Selecione o lote que foi separado.';
});
botaoAjustarQuantidadeSeparacao.addEventListener('click', abrirAjusteQuantidadeSeparacao);
botaoCancelarAjusteSeparacao.addEventListener('click', () => {
  separacaoAjustePainel.hidden = true;
  separacaoConfirmStatus.textContent = '';
});
botaoAplicarAjusteSeparacao.addEventListener('click', aplicarAjusteQuantidadeSeparacao);
separacaoAjusteQtd.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    aplicarAjusteQuantidadeSeparacao();
  }
});
botaoCancelarFinalSeparacao.addEventListener('click', fecharResumoFinalSeparacao);
botaoConfirmarFinalSeparacao.addEventListener('click', concluirSeparacao);
botaoLimparCodigoSeparacao.addEventListener('click', () => {
  limparCodigoSeparacao({ focar: true });
  atualizarStatusSeparacao('Campo limpo. Bipe o proximo codigo.');
});
separacaoCodigo.addEventListener('input', () => {
  const somenteDigitos = separacaoCodigo.value.replace(/\D/g, '');
  separacaoCodigo.value = somenteDigitos;
  if (separacaoEmMobile()) leituraSeparacaoMobile = somenteDigitos;
});
separacaoCodigo.addEventListener('keydown', (event) => {
  if (separacaoEmMobile()) {
    if (!separacaoScreen.hidden && /^[0-9]$/.test(event.key)) {
      event.preventDefault();
      leituraSeparacaoMobile += event.key;
      separacaoCodigo.value = leituraSeparacaoMobile;
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      leituraSeparacaoMobile = '';
      processarCodigoSeparacao();
    }
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    processarCodigoSeparacao();
  }
});
separacaoItensLista.addEventListener('click', (event) => {
  if (separacaoEmMobile()) return;
  const linha = event.target.closest('[data-separacao-item]');
  if (!linha) return;
  abrirConfirmacaoSeparacao(itensSeparacao.find((item) => item.chaveSeparacao === linha.dataset.separacaoItem));
});
separacaoItensLista.addEventListener('pointerdown', (event) => {
  if (!separacaoEmMobile()) return;
  const linha = event.target.closest('[data-separacao-item]');
  if (!linha) return;
  event.preventDefault();

  const item = itensSeparacao.find((entrada) => entrada.chaveSeparacao === linha.dataset.separacaoItem);
  if (!item) return;
  const pointerId = event.pointerId;
  const timeout = setTimeout(() => {
    toqueLongoSeparacao = null;
    if (navigator.vibrate) navigator.vibrate(20);
    abrirConfirmacaoSeparacao(item);
  }, TEMPO_TOQUE_LONGO_SEPARACAO_MS);
  toqueLongoSeparacao = { pointerId, timeout };
});
function cancelarToqueLongoSeparacao(event) {
  if (!toqueLongoSeparacao) return;
  if (event?.pointerId !== undefined && event.pointerId !== toqueLongoSeparacao.pointerId) return;
  clearTimeout(toqueLongoSeparacao.timeout);
  toqueLongoSeparacao = null;
}
separacaoItensLista.addEventListener('pointerup', cancelarToqueLongoSeparacao);
separacaoItensLista.addEventListener('pointercancel', cancelarToqueLongoSeparacao);
separacaoItensLista.addEventListener('pointerleave', cancelarToqueLongoSeparacao);
separacaoItensLista.addEventListener('contextmenu', (event) => {
  if (separacaoEmMobile()) event.preventDefault();
});
separacaoItensLista.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const linha = event.target.closest('[data-separacao-item]');
  if (!linha) return;
  event.preventDefault();
  abrirConfirmacaoSeparacao(itensSeparacao.find((item) => item.chaveSeparacao === linha.dataset.separacaoItem));
});
separacaoScreen.addEventListener('click', (event) => {
  if (event.target === separacaoScreen) fecharSeparacaoPedido();
});
separacaoConfirmModal.addEventListener('click', (event) => {
  if (event.target === separacaoConfirmModal) fecharConfirmacaoSeparacao();
});
separacaoFinalModal.addEventListener('click', (event) => {
  if (event.target === separacaoFinalModal) fecharResumoFinalSeparacao();
});
botaoAbrirEntradaCaixa.addEventListener('click', abrirModalCaixaEntrada);
botaoFecharEntradaCaixa.addEventListener('click', fecharModalCaixaEntrada);
botaoContinuarEntradaCaixa.addEventListener('click', fecharModalCaixaEntrada);
botaoZerarEntradaCaixa.addEventListener('click', zerarCaixaEntradaAtual);
botaoImprimirEntradaCaixa.addEventListener('click', imprimirEtiquetasCaixaEntrada);
entradaCaixaModal.addEventListener('click', (event) => {
  if (event.target === entradaCaixaModal) fecharModalCaixaEntrada();
});
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
[pedidoPreviewDocumentos, posConferenciaDocumentos].forEach((container) => {
  container?.addEventListener('click', (event) => {
    const botaoRomaneio = event.target.closest('[data-romaneio-ordem]');
    if (botaoRomaneio) {
      abrirPdfRomaneio(botaoRomaneio.dataset.romaneioOrdem, botaoRomaneio.dataset.romaneioEmpresa, botaoRomaneio);
      return;
    }
    const botao = event.target.closest('.documento-fiscal-button');
    if (botao) abrirDocumentoFiscal(botao);
  });
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
botaoScanAdicionar.addEventListener('click', adicionarConferenciaPorCodigo);
botaoConfirmarConferencia.addEventListener('click', solicitarVolumesConferencia);
botaoCancelarVolumesConferencia.addEventListener('click', fecharModalVolumesConferencia);
botaoConfirmarVolumesConferencia.addEventListener('click', () => {
  confirmarConferencia(Number(confirmarVolumesQtd.value));
});
confirmarVolumesQtd.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmarConferencia(Number(confirmarVolumesQtd.value));
  }
});
confirmarVolumesModal.addEventListener('click', (event) => {
  if (event.target === confirmarVolumesModal) {
    fecharModalVolumesConferencia();
  }
});
botaoCancelarAlteracoesEntrada?.addEventListener('click', fecharModalAlteracoesEntrada);
botaoConfirmarAlteracoesEntrada?.addEventListener('click', () => {
  fecharModalAlteracoesEntrada();
  confirmarConferencia(0);
});
entradaAlteracoesModal?.addEventListener('click', (event) => {
  if (event.target === entradaAlteracoesModal) {
    fecharModalAlteracoesEntrada();
  }
});
scanCodigo.addEventListener('keydown', (event) => {
  if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
    event.preventDefault();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (filaModoConferencia === 'entrada') {
      atualizarProdutoLeituraEntrada();
      atualizarOpcoesControleEntrada();
      atualizarDatasEntradaPorLeitura();
      scanControle.focus();
      scanControle.select();
      abrirOpcoesControleEntrada();
    } else {
      scanQtd.focus();
      scanQtd.select();
    }
  }
});
scanCodigo.addEventListener('input', () => {
  const somenteInteiros = String(scanCodigo.value || '').replace(/\D/g, '');
  if (scanCodigo.value !== somenteInteiros) {
    scanCodigo.value = somenteInteiros;
  }

  if (filaModoConferencia === 'entrada') {
    atualizarProdutoLeituraEntrada();
    atualizarOpcoesControleEntrada();
    atualizarDatasEntradaPorLeitura();
  }
});
scanControle.addEventListener('focus', abrirOpcoesControleEntrada);
scanControle.addEventListener('input', () => {
  abrirOpcoesControleEntrada();
  atualizarDatasEntradaPorLeitura();
});
scanControleField?.addEventListener('click', (event) => {
  event.stopPropagation();
});
scanControleOpcoes?.addEventListener('click', (event) => {
  const botao = event.target.closest('.controle-lote-opcao');
  if (!botao) return;

  scanControle.value = botao.dataset.controle || '';
  atualizarDatasEntradaPorLeitura();
  fecharOpcoesControleEntrada();
  scanQtd.focus();
  scanQtd.select();
});
scanControleOpcoes?.addEventListener('mousedown', (event) => {
  if (event.target.closest('.controle-lote-opcao')) {
    event.preventDefault();
  }
});
scanControle.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    fecharOpcoesControleEntrada();
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
mobileSidebarToggle?.addEventListener('click', () => {
  alternarSidebarMobileConferencia(!filaScreen.classList.contains('mobile-sidebar-open'));
});
mobileSidebarBackdrop?.addEventListener('click', () => {
  alternarSidebarMobileConferencia(false);
});

let toqueSidebarMobile = null;
document.addEventListener(
  'touchstart',
  (event) => {
    if (!ehMobileConferencia() || !event.touches.length) return;

    const toque = event.touches[0];
    const sidebarAberta = filaScreen.classList.contains('mobile-sidebar-open');
    if (toque.clientX <= 30 || sidebarAberta) {
      toqueSidebarMobile = {
        startX: toque.clientX,
        startY: toque.clientY,
        sidebarAberta,
      };
    }
  },
  { passive: true }
);
document.addEventListener(
  'touchend',
  (event) => {
    if (!toqueSidebarMobile || !event.changedTouches.length) return;

    const toque = event.changedTouches[0];
    const deslocamentoX = toque.clientX - toqueSidebarMobile.startX;
    const deslocamentoY = Math.abs(toque.clientY - toqueSidebarMobile.startY);

    if (deslocamentoY < 70) {
      if (!toqueSidebarMobile.sidebarAberta && deslocamentoX > 56) {
        alternarSidebarMobileConferencia(true);
      }

      if (toqueSidebarMobile.sidebarAberta && deslocamentoX < -56) {
        alternarSidebarMobileConferencia(false);
      }
    }

    toqueSidebarMobile = null;
  },
  { passive: true }
);
document.addEventListener('click', () => {
  fecharMenusOrdenacaoItens();
  fecharMenusColunasContato();
  fecharOpcoesControleEntrada();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && filaScreen.classList.contains('mobile-sidebar-open')) {
    alternarSidebarMobileConferencia(false);
  }
  if (event.key === 'Escape' && bitrixConfirmModal && !bitrixConfirmModal.hidden) {
    fecharConfirmacaoCardBitrix();
  }
  if (event.key === 'Escape' && produtoFotoModal && !produtoFotoModal.hidden) {
    fecharModalFotoProduto();
  }
});
window.addEventListener('resize', () => {
  if (!ehMobileConferencia() && filaScreen.classList.contains('mobile-sidebar-open')) {
    alternarSidebarMobileConferencia(false);
  }
});

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

  if (state?.tela === 'atualizacao-contato' || window.location.hash === '#atualizacao-contato') {
    mostrarHomeESuspenderRefresh();
    mostrarAtualizacaoContato();
    carregarPerfisContato();
    return;
  }

  mostrarHomeESuspenderRefresh();
});

inicializarApp();
