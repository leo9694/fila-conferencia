(function () {
  const $ = (id) => document.getElementById(`email-frete-${id}`);
  const assunto = $('modelo-assunto');
  const mensagem = $('modelo-mensagem');
  const anexarDanfe = $('modelo-danfe');
  const dialogoLink = $('link-dialogo');
  const textoLink = $('link-texto');
  const urlLink = $('link-url');
  const botaoSalvar = $('modelo-salvar');
  const botaoAlternar = $('automacao-alternar');
  const anterior = $('fila-anterior');
  const proxima = $('fila-proxima');
  const linhas = $('fila-linhas');
  const periodo = $('fila-periodo');
  const dataInicial = $('fila-inicio');
  const dataFinal = $('fila-fim');
  const colunasHistorico = document.querySelectorAll('[data-email-frete-historico]');
  const intervalos = { aguardando: {}, historico: {} };
  const rotulos = {
    pendente: 'Aguardando envio', enviando: 'Enviando', enviado: 'Enviado',
    falha: 'Falha no envio', revisar: 'Revisar envio'
  };
  let sessao = new AbortController();
  let filaAtual = null;
  let ativa = false;
  let carregada = false;
  let modeloSalvo = null;
  let visao = 'aguardando';
  let pagina = 1;
  let selecaoLink;

  function status(id, texto, erro = false) {
    const elemento = $(`${id}-status`);
    elemento.textContent = texto;
    elemento.classList.toggle('is-error', erro);
  }

  async function solicitar(rota, { method = 'GET', body, signal = sessao.signal } = {}) {
    const resposta = await fetch(`/api/transporte/email-frete/${rota}`, {
      method, signal, credentials: 'same-origin',
      ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível acessar os dados da automação.');
    return dados;
  }

  function mostrarEstado(valor) {
    ativa = valor;
    botaoAlternar.textContent = ativa ? 'Pausar automação' : 'Ativar automação';
    status('automacao', ativa ? 'Automação ativa' : 'Automação pausada');
  }

  function renderizarFila(dados) {
    const filtro = intervalos[visao];
    if (!filtro.exibido || (dataInicial.value === filtro.exibido.inicio && dataFinal.value === filtro.exibido.fim)) {
      dataInicial.value = dados.intervalo.inicio;
      dataFinal.value = dados.intervalo.fim;
    }
    filtro.exibido = dados.intervalo;
    const dataHora = (valor) => valor && new Date(valor).toLocaleString('pt-BR', { timeZone: dados.fusoHorario });
    linhas.replaceChildren();
    for (const nota of dados.itens) {
      const linha = linhas.insertRow();
      const valores = [
        nota.nota || `Nº único ${nota.nunota}`, nota.dataFaturamento?.split('-').reverse().join('/'), nota.empresa, nota.cliente,
        nota.transportadora, nota.destinatario || nota.email,
        rotulos[nota.status] || 'Aguardando ordem de carga'
      ];
      if (visao === 'historico') valores.push(nota.ordem, dataHora(nota.detectadaEm), dataHora(nota.enviadoEm));
      for (const valor of valores) linha.insertCell().textContent = valor || '—';
      const celulaStatus = linha.cells[6];
      if (nota.status) celulaStatus.classList.add(`is-${nota.status}`);
      if (nota.motivo || nota.danfeAnexado) {
        const detalhe = document.createElement('small');
        detalhe.textContent = nota.motivo || 'DANFE anexado';
        celulaStatus.appendChild(detalhe);
      }
    }
    pagina = dados.pagina;
    $('fila-pagina').textContent = `Página ${pagina}`;
    anterior.disabled = pagina <= 1;
    proxima.disabled = !dados.temMais;
    status('fila', dados.itens.length ? `${dados.itens.length} registro(s) nesta página` : 'Nenhuma nota nesta página.');
  }

  async function carregarFila(paginaSolicitada = pagina, silencioso = false) {
    filaAtual?.abort();
    const pedido = new AbortController();
    filaAtual = pedido;
    const consulta = new URLSearchParams({ visao, pagina: String(paginaSolicitada) });
    const intervalo = intervalos[visao].aplicado;
    if (intervalo) {
      consulta.set('inicio', intervalo.inicio);
      consulta.set('fim', intervalo.fim);
    }
    if (!silencioso) status('fila', 'Consultando notas…');
    try {
      const dados = await solicitar(`fila?${consulta}`, { signal: pedido.signal });
      if (!pedido.signal.aborted) renderizarFila(dados);
    } catch (erro) {
      if (!pedido.signal.aborted) status('fila', erro.message || 'Não foi possível consultar as notas.', true);
    } finally {
      if (filaAtual === pedido) filaAtual = null;
    }
  }

  function limparGrade() {
    pagina = 1;
    $('fila-pagina').textContent = 'Página 1';
    linhas.replaceChildren();
    anterior.disabled = true;
    proxima.disabled = true;
  }

  function mostrarVisao(valor) {
    visao = valor;
    const historico = valor === 'historico';
    $('fila-rotulo-inicio').textContent = historico ? 'Detectada de' : 'Faturamento de';
    $('fila-coluna-transportadora').textContent = historico ? 'Transportadora da carga' : 'Transportadora prevista';
    periodo.setAttribute('aria-label', historico ? 'Filtrar pela data de detecção da carga' : 'Filtrar pela data de faturamento');
    const filtro = intervalos[visao].exibido;
    dataInicial.value = filtro?.inicio || '';
    dataFinal.value = filtro?.fim || '';
    linhas.closest('table').classList.toggle('is-historico', historico);
    colunasHistorico.forEach((coluna) => { coluna.hidden = !historico; });
    for (const opcao of ['aguardando', 'historico']) {
      $(`fila-${opcao}`).setAttribute('aria-pressed', String(opcao === valor));
    }
    limparGrade();
  }

  function selecionarVisao(valor) {
    mostrarVisao(valor);
    return carregarFila();
  }

  async function preparar() {
    const signal = sessao.signal;
    const fila = carregarFila();
    if (!carregada) {
      try {
        const dados = await solicitar('automacao', { signal });
        if (signal.aborted) return;
        carregada = true;
        modeloSalvo = dados.modelo;
        assunto.value = dados.modelo.assunto;
        mensagem.value = dados.modelo.mensagem;
        anexarDanfe.checked = dados.modelo.anexarDanfe === true;
        mostrarEstado(dados.ativa);
        botaoAlternar.disabled = false;
        botaoSalvar.disabled = false;
      } catch (erro) {
        if (!signal.aborted) status('automacao', erro.message, true);
      }
    }
    await fila;
  }

  $('modelo-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (botaoSalvar.disabled) return;
    const signal = sessao.signal;
    botaoSalvar.disabled = true;
    try {
      const salvo = await solicitar('automacao/modelo', {
        method: 'PUT', body: { assunto: assunto.value, mensagem: mensagem.value, anexarDanfe: anexarDanfe.checked }, signal
      });
      if (!signal.aborted) {
        modeloSalvo = salvo;
        status('modelo', 'Modelo salvo.');
      }
    } catch (erro) {
      if (!signal.aborted) status('modelo', erro.message, true);
    } finally {
      if (!signal.aborted) botaoSalvar.disabled = false;
    }
  });

  function selecaoMensagem() {
    return { inicio: mensagem.selectionStart, fim: mensagem.selectionEnd };
  }

  function inserirNaMensagem(trecho, { inicio, fim } = selecaoMensagem()) {
    if (mensagem.value.length - (fim - inicio) + trecho.length > mensagem.maxLength) {
      status('modelo', 'A mensagem ultrapassaria o limite de 8.000 caracteres.', true);
      return false;
    }
    mensagem.setRangeText(trecho, inicio, fim, 'end');
    status('modelo', '');
    return true;
  }

  $('modelo-negrito').addEventListener('click', () => {
    const { inicio, fim } = selecaoMensagem();
    const trecho = mensagem.value.slice(inicio, fim);
    if (!inserirNaMensagem(`**${trecho}**`)) return;
    mensagem.focus();
    if (!trecho) mensagem.setSelectionRange(inicio + 2, inicio + 2);
  });

  $('modelo-link').addEventListener('click', () => {
    selecaoLink = selecaoMensagem();
    const trecho = mensagem.value.slice(selecaoLink.inicio, selecaoLink.fim);
    const enderecoSelecionado = /^https?:\/\/\S+$/i.test(trecho);
    textoLink.value = enderecoSelecionado ? '' : trecho.replace(/\s+/g, ' ');
    urlLink.value = enderecoSelecionado ? trecho : '';
    urlLink.setCustomValidity('');
    dialogoLink.showModal();
    urlLink.focus();
  });

  urlLink.addEventListener('input', () => urlLink.setCustomValidity(''));
  $('link-cancelar').addEventListener('click', () => dialogoLink.close());
  $('link-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const endereco = urlLink.value.trim();
    const exemplo = endereco.replace(/{{\s*\w+\s*}}/g, 'variavel');
    let url;
    try { url = new URL(exemplo); } catch { url = null; }
    if (!/^https?:\/\/\S+$/i.test(exemplo) || !url || url.username || url.password) {
      urlLink.setCustomValidity('Informe um endereço válido que comece com http:// ou https://.');
      urlLink.reportValidity();
      return;
    }
    const rotulo = (textoLink.value.trim() || endereco).replace(/([\\\]])/g, '\\$1');
    const destino = endereco.replace(/[()]/g, (caractere) => caractere === '(' ? '%28' : '%29');
    if (!inserirNaMensagem(`[${rotulo}](${destino})`, selecaoLink)) return;
    dialogoLink.close();
    mensagem.focus();
  });

  document.querySelectorAll('[data-email-frete-variavel]').forEach((botao) => {
    botao.addEventListener('click', () => {
      if (inserirNaMensagem(`{{${botao.dataset.emailFreteVariavel}}}`)) mensagem.focus();
    });
  });

  botaoAlternar.addEventListener('click', async () => {
    if (!ativa && (assunto.value.trim() !== modeloSalvo?.assunto || mensagem.value.trim() !== modeloSalvo?.mensagem ||
        anexarDanfe.checked !== (modeloSalvo?.anexarDanfe === true))) {
      $('editor').open = true;
      status('automacao', 'Salve o modelo editado antes de ativar a automação.', true);
      return;
    }
    const signal = sessao.signal;
    botaoAlternar.disabled = true;
    status('automacao', ativa ? 'Pausando automação…' : 'Verificando o SMTP e ativando a automação…');
    try {
      const dados = await solicitar('automacao/estado', { method: 'PUT', body: { ativa: !ativa }, signal });
      if (!signal.aborted) mostrarEstado(dados.ativa);
    } catch (erro) {
      if (!signal.aborted) status('automacao', erro.message, true);
    } finally {
      if (!signal.aborted) botaoAlternar.disabled = false;
    }
  });

  $('fila-aguardando').addEventListener('click', () => selecionarVisao('aguardando'));
  $('fila-historico').addEventListener('click', () => selecionarVisao('historico'));
  $('fila-atualizar').addEventListener('click', () => carregada ? carregarFila() : preparar());
  periodo.addEventListener('submit', (event) => {
    event.preventDefault();
    if (dataInicial.value > dataFinal.value) {
      status('fila', 'A data inicial deve ser anterior ou igual à data final.', true);
      return;
    }
    intervalos[visao].aplicado = { inicio: dataInicial.value, fim: dataFinal.value };
    limparGrade();
    carregarFila();
  });
  anterior.addEventListener('click', () => carregarFila(pagina - 1));
  proxima.addEventListener('click', () => carregarFila(pagina + 1));
  function atualizarVisaoAtiva(alvo) {
    if (visao !== alvo) return;
    if (!document.hidden && !filaAtual && window.location.hash === '#transporte/email-frete' &&
        document.getElementById('transporte-screen').classList.contains('active')) carregarFila(pagina, true);
  }
  setInterval(() => atualizarVisaoAtiva('aguardando'), 60_000);
  setInterval(() => atualizarVisaoAtiva('historico'), 15_000);

  function limparSessao() {
    sessao.abort();
    sessao = new AbortController();
    filaAtual?.abort();
    filaAtual = null;
    carregada = false;
    modeloSalvo = null;
    mostrarEstado(false);
    intervalos.aguardando = {};
    intervalos.historico = {};
    mostrarVisao('aguardando');
    assunto.value = '';
    mensagem.value = '';
    anexarDanfe.checked = false;
    dialogoLink.close();
    $('editor').open = false;
    botaoSalvar.disabled = botaoAlternar.disabled = true;
    for (const id of ['automacao', 'modelo', 'fila']) status(id, '');
  }

  window.emailFreteAutomacaoController = { preparar, limparSessao };
}());
