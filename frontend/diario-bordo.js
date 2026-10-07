(function () {
  const $ = (id) => document.getElementById(id);
  const form = $('diario-registro-form');
  const filtros = $('diario-filtros');
  const modal = $('diario-modal');
  const escape = (valor) => String(valor ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const numero = (valor) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const data = (valor) => valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Em andamento';
  function dataInput(valor = new Date()) {
    const date = new Date(valor);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  let registros = [];
  let pagina = 1;
  let selecionado = null;
  let carregando = false;
  let salvando = false;
  let cadastros = { rotas: [], carros: [], motoristas: [] };
  const cadastroModal = $('diario-cadastro-modal');
  const cadastroForm = $('diario-cadastro-form');
  let salvandoCadastro = false;
  let buscaUsuarioVersao = 0;
  let tipoCadastro = 'rotas';
  const tipoModal = $('diario-tipo-modal');
  const excluirModal = $('diario-excluir-modal');
  let exclusao = null;
  let excluindo = false;

  async function api(caminho = '', body, metodo = body ? 'POST' : 'GET') {
    const response = await fetch(`/api/empresa/diario-bordo${caminho}`, { method: metodo, headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    const resultado = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(resultado.error || 'Não foi possível acessar o diário. Confira sua sessão e tente novamente.');
    return resultado;
  }

  function renderizar() {
    $('diario-total-km').textContent = `${numero(window.diarioBordoQuilometragem.totalPercorrido(registros))} km`;
    const filtro = Object.fromEntries(new FormData(filtros));
    const busca = filtro.busca.trim().toLocaleLowerCase('pt-BR');
    const lista = registros.filter((item) => {
      const dia = dataInput(item.saida).slice(0, 10);
      return (!filtro.inicio || dia >= filtro.inicio) && (!filtro.fim || dia <= filtro.fim)
        && (!filtro.situacao || (filtro.situacao === 'aberto' ? !item.retorno : item.retorno))
        && (!busca || [item.placa, item.veiculo, item.motorista, item.empresa, item.origem, item.destino, item.finalidade].join(' ').toLocaleLowerCase('pt-BR').includes(busca));
    });
    $('diario-em-uso').textContent = lista.filter((item) => !item.retorno).length;
    $('diario-encerradas').textContent = lista.filter((item) => item.retorno).length;
    $('diario-distancia').textContent = `${numero(window.diarioBordoQuilometragem.totalPercorrido(lista))} km`;
    const paginas = Math.max(1, Math.ceil(lista.length / 25));
    pagina = Math.min(pagina, paginas);
    $('diario-linhas').innerHTML = lista.slice((pagina - 1) * 25, pagina * 25).map((item) => `<tr>
      <td>${escape(data(item.saida))}<small>${item.retorno ? escape(data(item.retorno)) : 'Ainda não devolvido'}</small></td>
      <td><strong>${escape(item.placa)}</strong><small>${escape(item.veiculo)}${item.empresa ? ` · ${escape(item.empresa)}` : ''}</small></td>
      <td>${escape(item.motorista)}</td><td>${escape(item.origem)} → ${escape(item.destino)}</td>
      <td>${window.diarioBordoQuilometragem.distanciaViagem(item) === null ? 'Sem distância cadastrada' : `${numero(window.diarioBordoQuilometragem.distanciaViagem(item))} km (ida e volta)`}<small>${item.distanciaIda ? `${numero(item.distanciaIda)} km até o destino · ${item.retorno ? 'Concluída' : 'Prevista'}` : 'Registro antigo: não contabilizado'}</small></td>
      <td><span class="diario-bordo-tag ${item.retorno ? '' : 'aberto'}">${item.retorno ? 'Encerrado' : 'Em uso'}</span><div><button type="button" data-detalhes="${escape(item.id)}">Detalhes</button>${!item.retorno ? `<button type="button" data-devolver="${escape(item.id)}">Devolver</button>` : ''}</div></td>
      </tr>`).join('') || '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>';
    $('diario-pagina').textContent = `Página ${pagina} de ${paginas} · ${lista.length} registros`;
    $('diario-anterior').disabled = pagina === 1;
    $('diario-proxima').disabled = pagina === paginas;
  }

  async function carregar() {
    if (carregando) return;
    carregando = true;
    $('diario-atualizar').disabled = true;
    $('diario-status').textContent = 'Carregando diário de bordo…';
    try {
      [registros, cadastros] = await Promise.all([api(), api('/cadastros')]);
      renderizar();
      $('diario-status').textContent = 'Distância calculada pelo destino × 2 (ida e volta). Somente viagens devolvidas entram nos totais percorridos. Registros antigos sem distância cadastrada não são contabilizados.';
    } catch (error) { $('diario-status').textContent = error.message; }
    finally { carregando = false; $('diario-atualizar').disabled = false; }
  }

  function campo(nome, titulo, tipo = 'text', valor = '', obrigatorio = true) {
    return `<label>${escape(titulo)}<input name="${nome}" type="${tipo}" value="${escape(valor)}" ${obrigatorio ? 'required' : ''} ${tipo === 'number' ? 'min="0" max="9999999" step="0.01"' : 'maxlength="1000"'}></label>`;
  }
  const observacoes = (nome) => `<label class="diario-wide">OBSERVAÇÕES<textarea name="${nome}" maxlength="1000" placeholder="Condições do veículo, ocorrências ou outras informações"></textarea></label>`;
  function selecionarCadastro(nome, titulo, tipo, descricao, obrigatorio = false) {
    return `<label>${titulo}<select name="${nome}" ${obrigatorio ? 'required' : ''}><option value="">${obrigatorio ? 'Selecione um cadastro' : 'Preenchimento manual'}</option>${cadastros[tipo].map((item) => `<option value="${escape(item.id)}">${escape(descricao(item))}</option>`).join('')}</select></label>`;
  }
  function resumoSelecionados() {
    const carro = cadastros.carros.find((item) => item.id === form.elements.carroId.value);
    const motorista = cadastros.motoristas.find((item) => item.id === form.elements.motoristaId.value);
    const viagens = carro ? registros.filter((item) => item.placa === carro.placa) : [];
    const distancia = window.diarioBordoQuilometragem.totalPercorrido(viagens);
    $('diario-selecionados').innerHTML = `<div><strong>Veículo selecionado</strong>${carro ? `<p>${escape(carro.placa)} · ${escape(carro.veiculo)}</p><p>Empresa: ${escape(carro.empresa || 'Não informada')}</p><p>Total percorrido no diário: <strong>${numero(distancia)} km</strong></p>` : '<p>Selecione um carro cadastrado.</p>'}</div><div><strong>Motorista selecionado</strong>${motorista ? `<p>${escape(motorista.nome)}</p><p>CNH: ${motorista.cnh ? escape(`•••••••${motorista.cnh.slice(-4)}`) : 'Não informada'} · Categoria: ${escape(motorista.categoriaCnh || 'Não informada')}</p><p>Usuário Sankhya: ${motorista.codUsu !== null && motorista.codUsu !== undefined ? escape(`${motorista.codUsu} - ${motorista.nomeUsuario}`) : 'Não vinculado'}</p>` : '<p>Selecione um motorista cadastrado.</p>'}</div>`;
  }
  function abrirRegistro(item = null) {
    selecionado = item;
    form.reset();
    form.hidden = false;
    $('diario-detalhes').hidden = true;
    $('diario-form-status').textContent = '';
    $('diario-modal-titulo').textContent = item ? `Devolução · ${item.placa}` : 'Registrar saída do veículo';
    $('diario-salvar').textContent = item ? 'Confirmar devolução' : 'Registrar saída';
    $('diario-campos').innerHTML = item
      ? campo('retorno', 'DATA / HORA DA DEVOLUÇÃO', 'datetime-local', dataInput()) + observacoes('observacoesRetorno')
      : selecionarCadastro('carroId', 'CARRO CADASTRADO', 'carros', (carro) => `${carro.placa} · ${carro.veiculo}`, true) + selecionarCadastro('motoristaId', 'MOTORISTA CADASTRADO', 'motoristas', (motorista) => motorista.nome, true) + '<div id="diario-selecionados" class="diario-wide diario-bordo-selecionados"></div>' + selecionarCadastro('rotaId', 'DESTINO CADASTRADO', 'rotas', (rota) => `${rota.nome} · ${rota.distanciaIda ? `${numero(rota.distanciaIda)} km (ida)` : 'Distância não cadastrada'}`, true) + campo('saida', 'DATA / HORA DA SAÍDA', 'datetime-local', dataInput()) + '<div id="diario-rota-resumo" class="diario-wide">Origem: Norte Sul Sementes MT (Empresa 1). Selecione o destino.</div>' + campo('finalidade', 'FINALIDADE') + observacoes('observacoes');
    if (!item) {
      resumoSelecionados();
      if (!cadastros.carros.length || !cadastros.motoristas.length) $('diario-form-status').textContent = 'Cadastre um carro e um motorista pelo botão Cadastros antes de registrar a saída.';
    }
    modal.showModal();
    form.querySelector('select, input')?.focus();
  }

  $('diario-nova-saida').addEventListener('click', () => abrirRegistro());
  $('diario-campos').addEventListener('change', (event) => {
    const selecionadoId = event.target.value;
    if (event.target.name === 'carroId') {
      resumoSelecionados();
      return;
    }
    if (event.target.name === 'motoristaId') {
      resumoSelecionados();
      return;
    }
    if (event.target.name === 'rotaId') {
      const rota = cadastros.rotas.find((item) => item.id === selecionadoId);
      $('diario-rota-resumo').textContent = `Origem: Norte Sul Sementes MT (Empresa 1). ${rota ? `Destino: ${rota.destino} · ${rota.distanciaIda ? `${numero(rota.distanciaIda)} km de ida + ${numero(rota.distanciaIda)} km de volta = ${numero(window.diarioBordoQuilometragem.distanciaViagem(rota))} km` : 'Distância não cadastrada: recadastre este destino.'}` : 'Selecione o destino.'}`;
      return;
    }
  });
  function fechar() { if (!salvando) modal.close(); }
  $('diario-fechar').addEventListener('click', fechar);
  $('diario-cancelar').addEventListener('click', fechar);
  modal.addEventListener('cancel', (event) => { if (salvando) event.preventDefault(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (salvando) return;
    salvando = true;
    $('diario-salvar').disabled = true;
    $('diario-form-status').textContent = 'Salvando…';
    const dados = Object.fromEntries(new FormData(form));
    try {
      const campoData = selecionado ? 'retorno' : 'saida';
      dados[campoData] = new Date(dados[campoData]).toISOString();
      const registro = await api(selecionado ? `/${selecionado.id}/devolucao` : '', dados);
      registros = [registro, ...registros.filter((item) => item.id !== registro.id)].sort((a, b) => b.saida.localeCompare(a.saida));
      pagina = 1;
      renderizar();
      modal.close();
      $('diario-status').textContent = selecionado ? 'Devolução registrada com sucesso.' : 'Saída registrada com sucesso.';
    } catch (error) { $('diario-form-status').textContent = error.message; }
    finally { salvando = false; $('diario-salvar').disabled = false; }
  });
  $('diario-linhas').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const item = registros.find((registro) => registro.id === (button.dataset.detalhes || button.dataset.devolver));
    if (!item) return;
    if (button.dataset.devolver) { abrirRegistro(item); return; }
    form.hidden = true;
    $('diario-detalhes').hidden = false;
    $('diario-modal-titulo').textContent = `Detalhes · ${item.placa}`;
    const responsavel = (usuario) => usuario ? `${usuario.codUsu ?? '—'} · ${usuario.nome || 'Usuário'}` : '—';
    const distancia = window.diarioBordoQuilometragem.distanciaViagem(item);
    const detalhes = { 'Veículo': `${item.placa} · ${item.veiculo}`, 'Empresa': item.empresa || '—', 'Motorista': item.motorista, 'Origem': item.origem, 'Destino / rota': item.destino, 'Finalidade': item.finalidade, 'Saída': data(item.saida), 'Retorno': data(item.retorno), 'Distância de ida': item.distanciaIda ? `${numero(item.distanciaIda)} km` : 'Não cadastrada (registro antigo)', 'Ida e volta': distancia === null ? 'Não contabilizado' : `${numero(distancia)} km · ${item.retorno ? 'Concluída' : 'Prevista'}`, 'Observações da saída': item.observacoes || '—', 'Observações da devolução': item.observacoesRetorno || '—', 'Saída registrada por': responsavel(item.criadoPor), 'Devolução registrada por': responsavel(item.devolvidoPor), 'Registro criado em': data(item.criadoEm) };
    detalhes['Usuário Sankhya do motorista'] = item.codUsuMotorista !== null && item.codUsuMotorista !== undefined ? `${item.codUsuMotorista} · ${item.nomeUsuarioMotorista}` : 'Não vinculado';
    detalhes['Rota cadastrada'] = item.nomeRota || '—';
    $('diario-detalhes').innerHTML = Object.entries(detalhes).map(([titulo, valor]) => `<div><dt>${escape(titulo)}</dt><dd>${escape(valor)}</dd></div>`).join('');
    modal.showModal();
  });
  filtros.addEventListener('submit', (event) => {
    event.preventDefault();
    if (filtros.elements.inicio.value && filtros.elements.fim.value && filtros.elements.inicio.value > filtros.elements.fim.value) { $('diario-status').textContent = 'A data final deve ser igual ou posterior à inicial.'; return; }
    pagina = 1;
    renderizar();
  });
  $('diario-atualizar').addEventListener('click', carregar);
  $('diario-anterior').addEventListener('click', () => { pagina--; renderizar(); });
  $('diario-proxima').addEventListener('click', () => { pagina++; renderizar(); });
  function listarCadastros() {
    const tipo = tipoCadastro;
    $('diario-cadastro-lista').innerHTML = cadastros[tipo].map((item) => `<li><span>${escape(tipo === 'carros' ? `${item.placa} · ${item.veiculo} · ${item.empresa || 'Sem empresa'}` : tipo === 'rotas' ? `${item.nome} · ${item.origem} → ${item.destino}` : `${item.nome} · CNH ${item.cnh ? `•••••••${item.cnh.slice(-4)}` : 'não informada'} · ${item.categoriaCnh || 'Categoria não informada'} · ${item.codUsu === null ? 'Sem vínculo com usuário' : `Usuário ${item.codUsu} - ${item.nomeUsuario}`}`)}</span><button type="button" class="diario-danger" data-excluir-cadastro="${escape(item.id)}" aria-label="Excluir ${escape(item.placa || item.nome)}" title="Excluir cadastro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></li>`).join('') || '<li>Nenhum cadastro.</li>';
  }
  function prepararCadastro() {
    buscaUsuarioVersao++;
    const tipo = tipoCadastro;
    $('diario-cadastro-titulo').textContent = { rotas: 'Cadastro de destinos / rotas', carros: 'Cadastro de carros', motoristas: 'Cadastro de motoristas' }[tipo];
    $('diario-cadastro-status').textContent = '';
    $('diario-cadastro-campos').innerHTML = tipo === 'carros'
      ? campo('placa', 'PLACA') + campo('veiculo', 'VEÍCULO / MODELO') + campo('empresa', 'EMPRESA', 'text', '', false)
      : tipo === 'rotas' ? '<p class="diario-wide">Origem fixa: Norte Sul Sementes MT (Empresa 1)</p>' + campo('nome', 'NOME DO DESTINO / ROTA') + campo('destino', 'DESTINO / PERCURSO') + campo('distanciaIda', 'DISTÂNCIA ATÉ O DESTINO (KM DE IDA)', 'number')
        : campo('nome', 'NOME COMPLETO') + '<label>CNH<input name="cnh" type="text" inputmode="numeric" pattern="[0-9]{11}" minlength="11" maxlength="11" required placeholder="11 números"></label><label>CATEGORIA DA CNH<select name="categoriaCnh" required><option value="">Selecione</option>' + ['ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE'].map((categoria) => `<option value="${categoria}">${categoria}</option>`).join('') + '</select></label><div class="diario-wide diario-bordo-busca-usuario"><label>BUSCAR USUÁRIO NO SANKHYA<input id="diario-usuario-busca" type="search" maxlength="100" placeholder="Código ou nome do usuário"></label><button type="button" id="diario-usuario-buscar">Buscar</button></div><label class="diario-wide">USUÁRIO VINCULADO (OPCIONAL)<select name="codUsu"><option value="">Sem vínculo</option></select></label>';
    listarCadastros();
  }
  $('diario-cadastros').addEventListener('click', () => tipoModal.showModal());
  $('diario-tipo-fechar').addEventListener('click', () => tipoModal.close());
  tipoModal.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cadastro-tipo]');
    if (!button) return;
    tipoCadastro = button.dataset.cadastroTipo;
    tipoModal.close();
    prepararCadastro();
    cadastroModal.showModal();
    $('diario-cadastro-salvar').disabled = true;
    try { cadastros = await api('/cadastros'); listarCadastros(); }
    catch (error) { $('diario-cadastro-status').textContent = error.message; }
    finally { $('diario-cadastro-salvar').disabled = false; }
  });
  function fecharCadastro() { if (!salvandoCadastro) { buscaUsuarioVersao++; cadastroModal.close(); } }
  $('diario-cadastro-fechar').addEventListener('click', fecharCadastro);
  $('diario-cadastro-cancelar').addEventListener('click', fecharCadastro);
  cadastroModal.addEventListener('cancel', (event) => { if (salvandoCadastro) event.preventDefault(); else buscaUsuarioVersao++; });
  $('diario-cadastro-campos').addEventListener('click', async (event) => {
    if (event.target.id !== 'diario-usuario-buscar') return;
    const versao = ++buscaUsuarioVersao;
    const button = event.target;
    button.disabled = true;
    $('diario-cadastro-status').textContent = 'Buscando usuários no Sankhya…';
    try {
      const usuarios = await api(`/usuarios?busca=${encodeURIComponent($('diario-usuario-busca').value)}`);
      if (versao !== buscaUsuarioVersao) return;
      const select = cadastroForm.elements.codUsu;
      const atual = select.value;
      const opcaoAtual = select.selectedOptions[0]?.outerHTML || '';
      select.innerHTML = '<option value="">Sem vínculo</option>' + usuarios.map((usuario) => `<option value="${escape(usuario.codUsu)}">${escape(usuario.codUsu)} - ${escape(usuario.nome)}</option>`).join('');
      if (atual && !usuarios.some((usuario) => String(usuario.codUsu) === atual)) select.insertAdjacentHTML('beforeend', opcaoAtual);
      select.value = atual;
      $('diario-cadastro-status').textContent = usuarios.length ? `${usuarios.length} usuários encontrados (até 50). Selecione o usuário desejado.` : 'Nenhum usuário encontrado.';
    } catch (error) { if (versao === buscaUsuarioVersao) $('diario-cadastro-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('diario-cadastro-campos').addEventListener('keydown', (event) => {
    if (event.target.id === 'diario-usuario-busca' && event.key === 'Enter') {
      event.preventDefault();
      $('diario-usuario-buscar').click();
    }
  });
  cadastroForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (salvandoCadastro) return;
    const tipo = tipoCadastro;
    salvandoCadastro = true;
    $('diario-cadastro-salvar').disabled = true;
    $('diario-cadastro-status').textContent = 'Salvando cadastro…';
    try {
      const item = await api(`/cadastros/${tipo}`, Object.fromEntries(new FormData(cadastroForm)));
      cadastros[tipo].push(item);
      prepararCadastro();
      $('diario-cadastro-status').textContent = 'Cadastro salvo com sucesso.';
    } catch (error) { $('diario-cadastro-status').textContent = error.message; }
    finally { salvandoCadastro = false; $('diario-cadastro-salvar').disabled = false; }
  });
  $('diario-cadastro-lista').addEventListener('click', (event) => {
    const button = event.target.closest('[data-excluir-cadastro]');
    if (!button || salvandoCadastro) return;
    const item = cadastros[tipoCadastro].find((registro) => registro.id === button.dataset.excluirCadastro);
    if (!item) return;
    exclusao = { tipo: tipoCadastro, id: item.id };
    $('diario-excluir-descricao').textContent = `Deseja excluir o cadastro de ${item.placa || item.nome}?`;
    $('diario-excluir-status').textContent = '';
    excluirModal.showModal();
    $('diario-excluir-cancelar').focus();
  });
  function cancelarExclusao() { if (!excluindo) excluirModal.close(); }
  $('diario-excluir-fechar').addEventListener('click', cancelarExclusao);
  $('diario-excluir-cancelar').addEventListener('click', cancelarExclusao);
  excluirModal.addEventListener('cancel', (event) => { if (excluindo) event.preventDefault(); });
  $('diario-excluir-confirmar').addEventListener('click', async () => {
    if (excluindo || !exclusao) return;
    excluindo = true;
    $('diario-excluir-confirmar').disabled = true;
    $('diario-excluir-status').textContent = 'Excluindo cadastro…';
    try {
      await api(`/cadastros/${exclusao.tipo}/${encodeURIComponent(exclusao.id)}`, undefined, 'DELETE');
      cadastros[exclusao.tipo] = cadastros[exclusao.tipo].filter((item) => item.id !== exclusao.id);
      listarCadastros();
      excluirModal.close();
      $('diario-cadastro-status').textContent = 'Cadastro excluído. O histórico das viagens foi preservado.';
    } catch (error) { $('diario-excluir-status').textContent = error.message; }
    finally { excluindo = false; $('diario-excluir-confirmar').disabled = false; }
  });
  window.diarioBordoController = { preparar() {
    registros = [];
    cadastros = { rotas: [], carros: [], motoristas: [] };
    renderizar();
    carregar();
  } };
})();
