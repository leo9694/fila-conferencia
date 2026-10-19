const EstoqueOperacoes = (() => {
  function iniciar({ aoCriarSessao, formatarQuantidade }) {
    const el = (id) => document.getElementById(`estoque-operacoes-${id}`);
    const botao = el('menu-toggle');
    const menu = el('menu');
    const dialogo = el('dialogo');
    const empresa = el('empresa');
    const local = el('local');
    const produto = el('produto');
    const resultados = el('produtos');
    const mensagem = el('mensagem');
    const acao = el('continuar');
    const posicoes = el('posicoes');
    const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let modo = 'individual';
    let selecionado = null;
    let itens = [];
    let ocupado = false;
    let versao = 0;
    let buscaVersao = 0;
    let timer = null;

    function avisar(texto, erro = false) {
      mensagem.textContent = texto;
      mensagem.classList.toggle('is-warning', erro);
    }

    function fecharMenu() {
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }

    function invalidarProduto() {
      clearTimeout(timer);
      buscaVersao++;
      selecionado = null;
      produto.value = '';
      resultados.innerHTML = '';
      itens = [];
      posicoes.innerHTML = '';
      acao.disabled = true;
    }

    function fechar() {
      if (ocupado) return;
      versao++;
      invalidarProduto();
      dialogo.close();
      botao.focus();
    }

    function bloquear(valor) {
      ocupado = valor;
      dialogo.setAttribute('aria-busy', String(valor));
      empresa.disabled = valor;
      local.disabled = valor || modo !== 'individual' || !empresa.value;
      produto.disabled = valor || !empresa.value || (modo === 'individual' && !local.value);
      acao.disabled = valor || !selecionado;
      el('fechar').disabled = valor;
      posicoes.querySelectorAll('button, input').forEach((campo) => { campo.disabled = valor; });
      resultados.querySelectorAll('button').forEach((campo) => { campo.disabled = valor; });
    }

    async function json(url, opcoes) {
      const resposta = await fetch(url, { cache: 'no-store', ...opcoes });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
      return dados;
    }

    async function abrir(novoModo) {
      fecharMenu();
      modo = novoModo;
      const atual = ++versao;
      invalidarProduto();
      empresa.innerHTML = '<option value="">Carregando empresas...</option>';
      local.innerHTML = '<option value="">Selecione o local</option>';
      el('local-campo').hidden = modo !== 'individual';
      el('titulo').textContent = modo === 'individual' ? 'Ajuste individual de estoque' : 'Fabricação e validade';
      acao.textContent = modo === 'individual' ? 'Abrir contagem deste produto' : 'Carregar estoques';
      avisar(modo === 'individual'
        ? 'Selecione empresa e local, depois o produto. A contagem incluirá todos os lotes, inclusive com saldo zero.'
        : 'Selecione empresa e produto. Serão exibidos todos os estoques positivos; salve as datas por posição.');
      dialogo.showModal();
      bloquear(true);
      try {
        const dados = await json('/api/estoque-contagem/config?incluirZerados=1');
        if (atual !== versao) return;
        empresa.innerHTML = '<option value="">Selecione a empresa</option>' + dados.empresas.map((item) =>
          `<option value="${Number(item.codEmp)}">${Number(item.codEmp)} - ${escapar(item.empresa)}</option>`).join('');
      } catch (erro) {
        if (atual === versao) avisar(erro.message, true);
      } finally {
        if (atual === versao) { bloquear(false); empresa.focus(); }
      }
    }

    async function trocarEmpresa() {
      invalidarProduto();
      const atual = ++versao;
      local.innerHTML = '<option value="">Selecione o local</option>';
      if (modo !== 'individual' || !empresa.value) { bloquear(false); return; }
      bloquear(true);
      try {
        const dados = await json(`/api/estoque-contagem/locais?empresa=${encodeURIComponent(empresa.value)}&incluirZerados=1`);
        if (atual !== versao) return;
        local.innerHTML += dados.itens.map((item) => `<option value="${Number(item.codLocal)}">${Number(item.codLocal)} - ${escapar(item.descrLocal)}</option>`).join('');
      } catch (erro) {
        if (atual === versao) avisar(erro.message, true);
      } finally {
        if (atual === versao) bloquear(false);
      }
    }

    async function buscarProduto(atual) {
      const texto = produto.value.trim();
      if (!texto) { resultados.innerHTML = ''; return; }
      resultados.textContent = 'Pesquisando produtos...';
      try {
        const dados = await json(`/api/produtos/pesquisa?busca=${encodeURIComponent(texto)}`);
        if (atual !== buscaVersao || !dialogo.open) return;
        resultados.innerHTML = dados.produtos.length ? dados.produtos.map((item, i) =>
          `<button type="button" data-produto="${i}">${Number(item.CODPROD)} - ${escapar(item.DESCRPROD)}${item.REFERENCIA ? ` · ${escapar(item.REFERENCIA)}` : ''}</button>`).join('')
          : '<span>Nenhum produto encontrado.</span>';
        resultados.querySelectorAll('[data-produto]').forEach((opcao) => opcao.addEventListener('click', () => {
          selecionado = dados.produtos[Number(opcao.dataset.produto)];
          produto.value = `${selecionado.CODPROD} - ${selecionado.DESCRPROD}`;
          resultados.innerHTML = '';
          acao.disabled = false;
          acao.focus();
        }));
      } catch (erro) {
        if (atual === buscaVersao) resultados.textContent = erro.message;
      }
    }

    function desenharPosicoes() {
      posicoes.innerHTML = itens.length ? `<table class="consulta-table"><thead><tr>
        <th>Local</th><th>Lote</th><th>Tipo / parceiro</th><th>Estoque</th><th>Fabricação</th><th>Validade</th><th>Ação</th>
        </tr></thead><tbody>${itens.map((item, i) => `<tr data-posicao="${i}">
          <td>${escapar(item.CODLOCAL)} - ${escapar(item.DESCRLOCAL)}</td><td>${escapar(String(item.CONTROLE || '').trim() || 'Sem lote')}</td>
          <td>${escapar(item.TIPO)} / ${escapar(item.CODPARC)}</td><td>${escapar(formatarQuantidade(item.ESTOQUE))}</td>
          <td><input type="date" data-fabricacao value="${escapar(item.DTFABRICACAO || '')}" aria-label="Fabricação da posição ${i + 1}"></td>
          <td><input type="date" data-validade value="${escapar(item.DTVAL || '')}" aria-label="Validade da posição ${i + 1}"></td>
          <td><button type="button" data-salvar="${i}">Salvar datas</button><span class="estoque-operacao-salvo" role="status"></span></td>
        </tr>`).join('')}</tbody></table>` : '<p>Nenhum estoque positivo encontrado para este produto nesta empresa.</p>';
      posicoes.querySelectorAll('[data-salvar]').forEach((salvar) => salvar.addEventListener('click', () => salvarDatas(Number(salvar.dataset.salvar))));
    }

    async function continuar() {
      if (ocupado || !selecionado || !empresa.value || (modo === 'individual' && !local.value)) return;
      bloquear(true);
      try {
        if (modo === 'individual') {
          const dados = await json('/api/estoque-contagem/sessoes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ajusteIndividual: true, empresa: empresa.value, local: local.value, codProd: selecionado.CODPROD })
          });
          bloquear(false);
          fechar();
          await aoCriarSessao(dados.sessao.id);
        } else {
          const dados = await json(`/api/estoque-contagem/datas?empresa=${encodeURIComponent(empresa.value)}&codProd=${Number(selecionado.CODPROD)}`);
          itens = dados.itens;
          desenharPosicoes();
          avisar(`${itens.length} posições com saldo positivo. As alterações de datas são gravadas no Sankhya ao clicar em Salvar datas.`);
        }
      } catch (erro) {
        avisar(erro.message, true);
      } finally { bloquear(false); }
    }

    async function salvarDatas(indice) {
      if (ocupado) return;
      const item = itens[indice];
      const linha = posicoes.querySelector(`[data-posicao="${indice}"]`);
      const fabricacao = linha.querySelector('[data-fabricacao]').value;
      const validade = linha.querySelector('[data-validade]').value;
      if (fabricacao && validade && validade < fabricacao) { avisar('A validade não pode ser anterior à fabricação.', true); return; }
      bloquear(true);
      linha.querySelector('.estoque-operacao-salvo').textContent = '';
      try {
        const dados = await json('/api/estoque-contagem/datas', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            empresa: item.CODEMP, codProd: item.CODPROD, codLocal: item.CODLOCAL, codParc: item.CODPARC,
            controle: item.CONTROLE, tipo: item.TIPO, dtFabricacao: fabricacao, dtValidade: validade,
            fabricacaoAnterior: item.DTFABRICACAO || null, validadeAnterior: item.DTVAL || null
          })
        });
        itens[indice] = { ...item, ...dados.item };
        linha.querySelector('.estoque-operacao-salvo').textContent = 'Salvo no Sankhya';
        avisar('Fabricação e validade gravadas e verificadas. Quantidades e lote não foram alterados.');
      } catch (erro) { avisar(erro.message, true); }
      finally { bloquear(false); }
    }

    botao.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      botao.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) menu.querySelector('button').focus();
    });
    menu.querySelectorAll('[data-operacao]').forEach((opcao) => opcao.addEventListener('click', () => abrir(opcao.dataset.operacao)));
    document.addEventListener('click', (event) => { if (!menu.contains(event.target) && !botao.contains(event.target)) fecharMenu(); });
    menu.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); fecharMenu(); botao.focus(); } });
    el('fechar').addEventListener('click', fechar);
    dialogo.addEventListener('cancel', (event) => { event.preventDefault(); fechar(); });
    dialogo.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); fechar(); } });
    empresa.addEventListener('change', trocarEmpresa);
    local.addEventListener('change', () => { invalidarProduto(); bloquear(false); produto.focus(); });
    produto.addEventListener('input', () => {
      clearTimeout(timer);
      selecionado = null;
      acao.disabled = true;
      itens = [];
      posicoes.innerHTML = '';
      resultados.innerHTML = '';
      const atual = ++buscaVersao;
      timer = setTimeout(() => buscarProduto(atual), 300);
    });
    produto.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); clearTimeout(timer); buscarProduto(++buscaVersao); }
    });
    acao.addEventListener('click', continuar);
  }
  return { iniciar };
})();
