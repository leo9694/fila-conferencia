(function () {
  const $ = (id) => document.getElementById(id);
  const elementos = {
    form: $('transporte-form'), dataInicial: $('transporte-data-inicial'), dataFinal: $('transporte-data-final'),
    transportadora: $('transporte-transportadora'), empresa: $('transporte-empresa'), estado: $('transporte-estado'), cidade: $('transporte-cidade'),
    atualizar: $('transporte-atualizar'), status: $('transporte-status'), metrica: $('transporte-metrica-mapa'),
    mapa: $('transporte-mapa'), cidades: $('transporte-lista-cidades'), cidadesTitulo: $('transporte-cidades-titulo'), cidadesTotal: $('transporte-cidades-total'),
    ordenacao: $('transporte-ordenacao'), ranking: $('transporte-ranking'), comparar: $('transporte-comparar'), comparacao: $('transporte-comparacao'),
    detalhes: $('transporte-tabela-detalhes'), detalhesTitulo: $('transporte-detalhes-titulo'), detalhesTotal: $('transporte-detalhes-total'),
    navegacaoMapa: $('transporte-mapa-navegacao')
  };
  const kpis = ['frete', 'ctes', 'pedidos', 'peso', 'volumes', 'medio', 'percentual'].reduce((mapa, nome) => ({ ...mapa, [nome]: $(`transporte-kpi-${nome}`) }), {});
  const CHAVE_SESSAO = 'transporte-permitido';
  let permitido = false;
  let dados = null;
  let estadoDetalhado = '';
  let cidadeDetalhada = '';
  let codigoUsuarioAtual = null;
  let mapaLeaflet = null;
  let camadaMapa = null;
  let camadaRotulos = null;
  let malhaEstados = null;
  let sequenciaMapa = 0;

  function escapeHtml(valor) { return String(valor ?? '').replace(/[&<>'"]/g, (caractere) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[caractere])); }
  function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function inteiro(valor) { return Number(valor || 0).toLocaleString('pt-BR'); }
  function peso(valor) { return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 }); }
  function percentual(valor) { return `${Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`; }
  function dataBr(valor) { if (!valor) return '—'; const texto = String(valor); const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[3]}/${match[2]}/${match[1]}` : texto; }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function anoAtualInicio() { return `${new Date().getFullYear()}-01-01`; }
  function selecionarTexto(elemento, valor) { return Array.from(elemento.selectedOptions || []).map((opcao) => opcao.value).includes(valor); }
  function renderIcones() { window.lucide?.createIcons(); }

  function setStatus(texto, erro = false) { elementos.status.textContent = texto || ''; elementos.status.classList.toggle('is-error', erro); }
  function normalizarCodigoUsuario(valor) { const codigo = Number(valor); return Number.isInteger(codigo) && codigo >= 0 ? codigo : null; }
  function codigoUsuario(usuario) { return normalizarCodigoUsuario(usuario?.codUsu ?? usuario?.CODUSU ?? usuario); }
  function chaveUsuario(codigo) { return codigo === null ? null : `${CHAVE_SESSAO}:${codigo}`; }
  function permissaoConfirmada(usuario) { return Boolean(usuario?.gruposConfirmados && usuario?.permissoes?.transporte); }
  function atualizarMenu() { const menu = $('home-nav-transporte'); if (menu) menu.hidden = !permitido; }

  async function verificarAcesso(usuarioOuCodigo = codigoUsuarioAtual) {
    const usuario = usuarioOuCodigo && typeof usuarioOuCodigo === 'object' ? usuarioOuCodigo : null;
    const codigo = codigoUsuario(usuarioOuCodigo);
    const codigoAnterior = codigoUsuarioAtual;
    codigoUsuarioAtual = codigo;
    const mesmoUsuario = codigo !== null && codigo === codigoAnterior;
    const chave = chaveUsuario(codigo);
    if (codigo === null) { permitido = false; atualizarMenu(); return false; }
    if (permissaoConfirmada(usuario)) { permitido = true; sessionStorage.setItem(chave, '1'); atualizarMenu(); return true; }
    if ((mesmoUsuario && permitido) || sessionStorage.getItem(chave) === '1') { permitido = true; atualizarMenu(); return true; }
    const resposta = await fetch('/api/transporte/acesso', { credentials: 'same-origin' });
    permitido = resposta.ok;
    if (permitido) sessionStorage.setItem(chave, '1');
    atualizarMenu();
    return permitido;
  }

  function preencherSelect(elemento, valores, rotulo, manter = elemento.value) {
    elemento.innerHTML = `<option value="">${escapeHtml(rotulo)}</option>${(valores || []).map((valor) => `<option value="${escapeHtml(valor)}">${escapeHtml(valor)}</option>`).join('')}`;
    if (manter && Array.from(elemento.options).some((opcao) => opcao.value === manter)) elemento.value = manter;
  }

  function preencherComparacao(valores) {
    const selecionadas = new Set(Array.from(elementos.comparar.selectedOptions).map((opcao) => opcao.value));
    elementos.comparar.innerHTML = (valores || []).map((valor) => `<option value="${escapeHtml(valor)}"${selecionadas.has(valor) ? ' selected' : ''}>${escapeHtml(valor)}</option>`).join('');
  }

  function tooltipEstado(item) {
    if (!item) return 'Sem CT-es no período selecionado';
    return `${item.uf}\nFrete: ${moeda(item.valorFrete)}\nCT-es: ${inteiro(item.ctes)}\nPedidos: ${moeda(item.valorPedido)}\nPeso: ${peso(item.peso)} kg\nVolumes: ${inteiro(item.volumes)}\nFrete / pedidos: ${percentual(item.percentualFretePedidos)}`;
  }

  function normalizarNomeGeografico(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, ' ').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function chaveCidade(uf, cidade) {
    const nome = normalizarNomeGeografico(cidade);
    const sufixoUf = new RegExp(`\\s${String(uf || '').toUpperCase()}$`);
    return nome.replace(sufixoUf, '');
  }

  function cidadeSelecionada(uf, cidade) {
    if (!cidadeDetalhada || !cidade) return false;
    const [, cidadeSelecionada] = cidadeDetalhada.split('|');
    return chaveCidade(uf, cidade) === chaveCidade(uf, cidadeSelecionada);
  }

  function valorMetrica(item) {
    return elementos.metrica.value === 'percentual' ? Number(item?.percentualFretePedidos || 0) : Number(item?.valorFrete || 0);
  }

  function corCoropletica(valor, maximo) {
    if (!valor || !maximo) return '#edf2f1';
    const intensidade = .22 + Math.min(1, valor / maximo) * .72;
    return `rgba(8, 127, 109, ${intensidade.toFixed(2)})`;
  }

  function nomeUfAtual() {
    return malhaEstados?.features?.find((feature) => feature.properties?.uf === estadoDetalhado)?.properties?.nome || estadoDetalhado;
  }

  function dadosCidadesEstado() {
    return (dados?.cidades || []).filter((cidade) => cidade.uf === estadoDetalhado);
  }

  function garantirMapaLeaflet() {
    if (mapaLeaflet || !window.L || !elementos.mapa) return mapaLeaflet;
    mapaLeaflet = window.L.map(elementos.mapa, { zoomControl: true, attributionControl: true, preferCanvas: true });
    mapaLeaflet.attributionControl.setPrefix(false);
    mapaLeaflet.on('zoomend', atualizarVisibilidadeRotulos);
    requestAnimationFrame(() => mapaLeaflet.invalidateSize());
    return mapaLeaflet;
  }

  function limparCamadaMapa() {
    if (camadaMapa && mapaLeaflet) mapaLeaflet.removeLayer(camadaMapa);
    if (camadaRotulos && mapaLeaflet) mapaLeaflet.removeLayer(camadaRotulos);
    camadaMapa = null;
    camadaRotulos = null;
  }

  function atualizarVisibilidadeRotulos() {
    if (!mapaLeaflet || !camadaRotulos) return;
    const zoom = mapaLeaflet.getZoom();
    camadaRotulos.eachLayer((rotulo) => {
      rotulo.getElement()?.classList.toggle('is-zoom-hidden', zoom < (rotulo.options.minZoom || 0));
    });
  }

  function adicionarRotuloMapa(layer, texto, classe = '', minZoom = 0) {
    if (!camadaRotulos || !texto) return;
    window.L.marker(layer.getBounds().getCenter(), {
      interactive: false,
      keyboard: false,
      minZoom,
      icon: window.L.divIcon({
        className: `transporte-map-label ${classe}`.trim(),
        html: escapeHtml(texto)
      })
    }).addTo(camadaRotulos);
  }

  function popupEstado(item, feature) {
    const propriedades = feature.properties || {};
    if (!item) return `<strong>${escapeHtml(propriedades.nome || propriedades.uf)}</strong><br>Sem CT-es no período selecionado.`;
    return `<strong>${escapeHtml(propriedades.nome)} (${escapeHtml(propriedades.uf)})</strong><br>Frete: ${moeda(item.valorFrete)}<br>CT-es: ${inteiro(item.ctes)}<br>Pedidos: ${moeda(item.valorPedido)}<br>Peso: ${peso(item.peso)} kg<br>Frete médio: ${moeda(item.freteMedio)}<br>Frete / pedidos: ${percentual(item.percentualFretePedidos)}`;
  }

  function popupMunicipio(item, feature) {
    const nome = feature.properties?.nome || 'Município';
    if (!item) return `<strong>${escapeHtml(nome)}</strong><br>Sem CT-es no período selecionado.`;
    return `<strong>${escapeHtml(nome)}</strong><br>Frete: ${moeda(item.valorFrete)}<br>CT-es: ${inteiro(item.ctes)}<br>Pedidos: ${moeda(item.valorPedido)}<br>Peso: ${peso(item.peso)} kg<br>Volumes: ${inteiro(item.volumes)}<br>Frete médio: ${moeda(item.freteMedio)}<br>Frete por kg: ${moeda(item.fretePorKg)}<br>Frete / pedidos: ${percentual(item.percentualFretePedidos)}`;
  }

  function renderNavegacaoMapa() {
    if (!elementos.navegacaoMapa) return;
    const estadoNome = nomeUfAtual();
    const cidadeNome = cidadeDetalhada.split('|')[1];
    const partes = ['<button type="button" data-mapa-nivel="brasil">Brasil</button>'];
    if (estadoDetalhado) partes.push(`<span>/</span><button type="button" data-mapa-nivel="estado">${escapeHtml(estadoNome)}</button>`);
    if (cidadeDetalhada) partes.push(`<span>/</span><strong>${escapeHtml(cidadeNome)}</strong>`);
    elementos.navegacaoMapa.innerHTML = partes.join('');
    elementos.navegacaoMapa.querySelectorAll('[data-mapa-nivel]').forEach((botao) => botao.addEventListener('click', () => {
      if (botao.dataset.mapaNivel === 'brasil') { estadoDetalhado = ''; cidadeDetalhada = ''; }
      else cidadeDetalhada = '';
      renderMapa(); renderCidades(); renderDetalhes();
    }));
  }

  async function buscarGeojson(url) {
    const resposta = await fetch(url, { credentials: 'same-origin' });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível carregar a malha geográfica.');
    return corpo;
  }

  async function renderMapaBrasil(mapa, sequencia) {
    malhaEstados ||= await buscarGeojson('/api/transporte/malhas/estados');
    if (sequencia !== sequenciaMapa || estadoDetalhado) return;
    const porUf = new Map((dados?.estados || []).map((estado) => [estado.uf, estado]));
    const maximo = Math.max(0, ...(dados?.estados || []).map(valorMetrica));
    limparCamadaMapa();
    camadaRotulos = window.L.layerGroup().addTo(mapa);
    camadaMapa = window.L.geoJSON(malhaEstados, {
      style: (feature) => ({ color: '#ffffff', weight: 1.1, fillColor: corCoropletica(valorMetrica(porUf.get(feature.properties?.uf)), maximo), fillOpacity: 1 }),
      onEachFeature: (feature, layer) => {
        const item = porUf.get(feature.properties?.uf);
        layer.bindTooltip(popupEstado(item, feature), { sticky: true, className: 'transporte-map-tooltip' });
        adicionarRotuloMapa(layer, `${feature.properties?.nome || ''} (${feature.properties?.uf || ''})`, 'transporte-map-state-label', 5);
        layer.on({
          mouseover: () => layer.setStyle({ weight: 2.5, color: '#102d46' }),
          mouseout: () => camadaMapa?.resetStyle(layer),
          click: () => { estadoDetalhado = feature.properties?.uf || ''; cidadeDetalhada = ''; renderMapa(); renderCidades(); renderDetalhes(); }
        });
      }
    }).addTo(mapa);
    mapa.fitBounds(camadaMapa.getBounds(), { padding: [18, 18], maxZoom: 5 });
    setTimeout(atualizarVisibilidadeRotulos, 0);
  }

  async function renderMapaMunicipios(mapa, sequencia) {
    const uf = estadoDetalhado;
    const geojson = await buscarGeojson(`/api/transporte/malhas/estados/${encodeURIComponent(uf)}/municipios`);
    if (sequencia !== sequenciaMapa || estadoDetalhado !== uf) return;
    const cidades = new Map(dadosCidadesEstado().map((cidade) => [chaveCidade(uf, cidade.cidade), cidade]));
    const maximo = Math.max(0, ...[...cidades.values()].map(valorMetrica));
    limparCamadaMapa();
    camadaRotulos = window.L.layerGroup().addTo(mapa);
    let camadaCidadeSelecionada = null;
    camadaMapa = window.L.geoJSON(geojson, {
      style: (feature) => {
        const item = cidades.get(chaveCidade(uf, feature.properties?.nome));
        const selecionada = cidadeSelecionada(uf, item?.cidade);
        return {
          color: selecionada ? '#d97706' : '#ffffff',
          weight: selecionada ? 3 : .7,
          fillColor: corCoropletica(valorMetrica(item), maximo),
          fillOpacity: 1
        };
      },
      onEachFeature: (feature, layer) => {
        const item = cidades.get(chaveCidade(uf, feature.properties?.nome));
        const selecionada = cidadeSelecionada(uf, item?.cidade);
        layer.bindTooltip(popupMunicipio(item, feature), { sticky: true, className: 'transporte-map-tooltip' });
        if (item) adicionarRotuloMapa(layer, item.cidade, selecionada ? 'is-selected' : '', 6);
        if (selecionada) camadaCidadeSelecionada = layer;
        layer.on({
          mouseover: () => layer.setStyle({ weight: 2, color: '#102d46' }),
          mouseout: () => camadaMapa?.resetStyle(layer),
          click: () => {
            if (!item) return;
            cidadeDetalhada = `${uf}|${item.cidade}`;
            renderNavegacaoMapa(); renderCidades(); renderDetalhes();
          }
        });
      }
    }).addTo(mapa);
    mapa.fitBounds(camadaCidadeSelecionada?.getBounds() || camadaMapa.getBounds(), { padding: [28, 28], maxZoom: camadaCidadeSelecionada ? 10 : 8 });
    setTimeout(atualizarVisibilidadeRotulos, 0);
  }

  function renderMapa() {
    const mapa = garantirMapaLeaflet();
    if (!mapa) return;
    renderNavegacaoMapa();
    const sequencia = ++sequenciaMapa;
    const carregar = estadoDetalhado ? renderMapaMunicipios(mapa, sequencia) : renderMapaBrasil(mapa, sequencia);
    carregar.catch((erro) => {
      if (sequencia === sequenciaMapa) setStatus(erro.message, true);
    }).finally(() => requestAnimationFrame(() => mapa.invalidateSize()));
  }

  function renderKpis() {
    const resumo = dados?.resumo || {};
    const valores = { frete: moeda(resumo.valorFrete), ctes: inteiro(resumo.ctes), pedidos: moeda(resumo.valorPedido), peso: `${peso(resumo.peso)} kg`, volumes: inteiro(resumo.volumes), medio: moeda(resumo.freteMedio), percentual: percentual(resumo.percentualFretePedidos) };
    Object.entries(valores).forEach(([chave, valor]) => { if (kpis[chave]) kpis[chave].textContent = valor; });
    const periodo = $('transporte-periodo');
    if (periodo && dados?.periodo) periodo.textContent = `Período: ${dataBr(dados.periodo.inicio)} até ${dataBr(dados.periodo.fim)} · ${inteiro(resumo.ctes)} CT-es consolidados.`;
  }

  function renderCidades() {
    const cidades = (dados?.cidades || []).filter((cidade) => !estadoDetalhado || cidade.uf === estadoDetalhado);
    elementos.cidadesTitulo.textContent = estadoDetalhado ? `Cidades de ${estadoDetalhado}` : 'Cidades por estado';
    elementos.cidadesTotal.textContent = `${inteiro(cidades.length)} cidade${cidades.length === 1 ? '' : 's'}`;
    elementos.cidades.innerHTML = cidades.length ? cidades.map((cidade) => `<button type="button" class="transporte-city${cidadeDetalhada === `${cidade.uf}|${cidade.cidade}` ? ' is-selected' : ''}" data-cidade="${escapeHtml(cidade.uf)}|${escapeHtml(cidade.cidade)}"><b>${escapeHtml(cidade.cidade)} <strong>${escapeHtml(cidade.uf)}</strong></b><span>${moeda(cidade.valorFrete)} · ${inteiro(cidade.ctes)} CT-e${cidade.ctes === 1 ? '' : 's'} · ${peso(cidade.peso)} kg</span><span>Frete médio ${moeda(cidade.freteMedio)} · ${percentual(cidade.percentualFretePedidos)} dos pedidos · ${percentual(cidade.participacaoEstado)} do estado</span></button>`).join('') : '<p class="transporte-empty">Nenhuma cidade encontrada para os filtros selecionados.</p>';
    elementos.cidades.querySelectorAll('[data-cidade]').forEach((botao) => {
      botao.addEventListener('click', () => { cidadeDetalhada = botao.dataset.cidade; estadoDetalhado = cidadeDetalhada.split('|')[0]; renderMapa(); renderCidades(); renderDetalhes(); });
    });
  }

  function renderRanking() {
    const itens = dados?.transportadoras || [];
    elementos.ranking.innerHTML = itens.length ? itens.map((item) => `<button type="button" class="transporte-ranking-row" data-transportadora="${escapeHtml(item.transportadora)}"><b>${escapeHtml(item.transportadora)}</b><span>Frete<strong>${moeda(item.valorFrete)}</strong></span><span>CT-es<strong>${inteiro(item.ctes)}</strong></span><span>Pedidos<strong>${moeda(item.valorPedido)}</strong></span><span>Peso<strong>${peso(item.peso)} kg</strong></span><span>Volumes<strong>${inteiro(item.volumes)}</strong></span><span>Médio<strong>${moeda(item.freteMedio)}</strong></span><span>Frete/pedido<strong>${percentual(item.percentualFretePedidos)}</strong></span><span>Participação<strong>${percentual(item.participacaoFrete)}</strong></span></button>`).join('') : '<p class="transporte-empty">Nenhuma transportadora encontrada.</p>';
    elementos.ranking.querySelectorAll('[data-transportadora]').forEach((botao) => botao.addEventListener('click', () => { elementos.transportadora.value = botao.dataset.transportadora; carregar(); }));
  }

  function renderComparacao() {
    const selecionadas = new Set(Array.from(elementos.comparar.selectedOptions).map((opcao) => opcao.value));
    const itens = (dados?.transportadoras || []).filter((item) => selecionadas.has(item.transportadora));
    elementos.comparacao.innerHTML = itens.length > 1 ? itens.map((item) => `<div class="transporte-comparison-row"><b>${escapeHtml(item.transportadora)}</b><span>Frete<strong>${moeda(item.valorFrete)}</strong></span><span>Médio<strong>${moeda(item.freteMedio)}</strong></span><span>Por kg<strong>${moeda(item.fretePorKg)}</strong></span><span>Frete/pedido<strong>${percentual(item.percentualFretePedidos)}</strong></span><span>CT-es<strong>${inteiro(item.ctes)}</strong></span></div>`).join('') : '<p class="transporte-comparison-empty">Selecione pelo menos duas transportadoras para comparar custos, peso e volume.</p>';
  }

  function renderDetalhes() {
    const detalhes = (dados?.detalhes || []).filter((item) => {
      if (estadoDetalhado && item.estado !== estadoDetalhado) return false;
      if (cidadeDetalhada && `${item.estado}|${item.cidade}` !== cidadeDetalhada) return false;
      return true;
    });
    const titulo = cidadeDetalhada ? `CT-es de ${cidadeDetalhada.split('|')[1]}` : estadoDetalhado ? `CT-es de ${estadoDetalhado}` : 'CT-es do período';
    elementos.detalhesTitulo.textContent = titulo;
    elementos.detalhesTotal.textContent = `${inteiro(detalhes.length)} registro${detalhes.length === 1 ? '' : 's'}${dados?.detalhesLimitados ? ' · primeiros 500' : ''}`;
    elementos.detalhes.innerHTML = detalhes.length ? detalhes.map((item) => `<tr><td>${escapeHtml(item.numCte)}</td><td>${escapeHtml(dataBr(item.dataEmissao))}</td><td>${escapeHtml(item.transportadora)}</td><td>${escapeHtml(item.parceiro)}</td><td>${escapeHtml(item.numNota || '—')}</td><td class="is-money">${moeda(item.valorPedido)}</td><td class="is-number">${peso(item.peso)} kg</td><td class="is-number">${inteiro(item.volumes)}</td><td class="is-money">${moeda(item.valorFrete)}</td></tr>`).join('') : '<tr><td colspan="9" class="transporte-empty">Nenhum CT-e encontrado para este detalhamento.</td></tr>';
  }

  function render() { renderKpis(); renderMapa(); renderCidades(); renderRanking(); renderComparacao(); renderDetalhes(); renderIcones(); }
  function parametros() { return new URLSearchParams({ dataInicial: elementos.dataInicial.value, dataFinal: elementos.dataFinal.value, transportadora: elementos.transportadora.value, empresa: elementos.empresa.value, estado: elementos.estado.value, cidade: elementos.cidade.value, ordenacao: elementos.ordenacao.value }); }

  async function carregar() {
    if (!permitido) return;
    setStatus('Atualizando painel…'); elementos.atualizar.disabled = true;
    try {
      const resposta = await fetch(`/api/transporte/dashboard?${parametros()}`, { credentials: 'same-origin' });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível carregar o painel de transporte.');
      dados = corpo;
      preencherSelect(elementos.transportadora, dados.opcoes.transportadoras, 'Todas as transportadoras');
      preencherSelect(elementos.empresa, dados.opcoes.empresas, 'Todas as empresas');
      preencherSelect(elementos.estado, dados.opcoes.estados, 'Todos os estados');
      preencherSelect(elementos.cidade, dados.opcoes.cidades, 'Todas as cidades');
      preencherComparacao(dados.opcoes.transportadoras);
      if (estadoDetalhado && !dados.estados.some((estado) => estado.uf === estadoDetalhado)) { estadoDetalhado = ''; cidadeDetalhada = ''; }
      setStatus(`${inteiro(dados.resumo.ctes)} CT-es consolidados · consulta em ${Number(dados.consultaMs || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ms.`);
      render();
    } catch (erro) { setStatus(erro.message, true); }
    finally { elementos.atualizar.disabled = false; }
  }

  async function preparar() {
    if (!permitido) return;
    if (!elementos.dataInicial.value) elementos.dataInicial.value = anoAtualInicio();
    if (!elementos.dataFinal.value) elementos.dataFinal.value = hoje();
    await carregar();
  }

  elementos.form?.addEventListener('submit', (event) => { event.preventDefault(); estadoDetalhado = ''; cidadeDetalhada = ''; carregar(); });
  [elementos.transportadora, elementos.empresa, elementos.estado, elementos.cidade, elementos.ordenacao].forEach((elemento) => elemento?.addEventListener('change', () => { estadoDetalhado = ''; cidadeDetalhada = ''; carregar(); }));
  elementos.metrica?.addEventListener('change', renderMapa);
  elementos.comparar?.addEventListener('change', renderComparacao);

  window.transporteDashboardController = {
    get permitido() { return permitido; }, verificarAcesso, preparar,
    limparSessao() { permitido = false; dados = null; estadoDetalhado = ''; cidadeDetalhada = ''; codigoUsuarioAtual = null; atualizarMenu(); }
  };
}());
