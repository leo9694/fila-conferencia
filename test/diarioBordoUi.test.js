const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const quilometragem = require('../frontend/diario-bordo-quilometragem');

function formulario() {
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/diario-bordo.js'), 'utf8');
  const elementos = new Map();
  const $ = (id) => {
    if (!elementos.has(id)) elementos.set(id, {});
    return elementos.get(id);
  };
  const form = { elements: { carroId: { value: '' }, motoristaId: { value: '' } }, reset() {}, querySelector() { return { focus() {} }; } };
  const cadastros = {
    carros: [{ id: 'carro-1', placa: 'ABC1234', veiculo: 'Strada', empresa: 'Empresa 1' }],
    motoristas: [{ id: 'motorista-1', nome: 'Motorista de teste', cnh: '12345678901', categoriaCnh: 'AB', codUsu: 72, nomeUsuario: 'Teste' }],
    rotas: [{ id: 'rota-1', nome: 'Cliente', distanciaIda: 2 }]
  };
  const contexto = vm.createContext({ $, form, cadastros, registros: [], selecionado: null,
    window: { diarioBordoQuilometragem: quilometragem }, modal: { showModal() {} },
    escape: (valor) => String(valor ?? ''), numero: (valor) => String(valor), dataInput: () => '2026-10-08T08:00' });
  vm.runInContext(fonte.slice(fonte.indexOf('  function campo('), fonte.indexOf("  $('diario-nova-saida').addEventListener")), contexto);
  return { contexto, $, form };
}

test('formulário compacto preserva os campos da saída sem cartões vazios', () => {
  const { contexto, $ } = formulario();
  vm.runInContext('abrirRegistro()', contexto);
  const html = $('diario-campos').innerHTML;
  for (const nome of ['carroId', 'motoristaId', 'rotaId', 'saida', 'finalidade', 'observacoes']) {
    assert.match(html, new RegExp(`name="${nome}"`));
  }
  assert.doesNotMatch(html, /diario-selecionados|Veículo selecionado|Motorista selecionado/);
  assert.equal($('diario-carroId-resumo').hidden, true);
  assert.equal($('diario-motoristaId-resumo').hidden, true);
});

test('mostra informações compactas do cadastro selecionado sem expor a CNH completa', () => {
  const { contexto, $, form } = formulario();
  vm.runInContext('abrirRegistro()', contexto);
  form.elements.carroId.value = 'carro-1';
  form.elements.motoristaId.value = 'motorista-1';
  vm.runInContext('resumoSelecionados()', contexto);
  assert.equal($('diario-carroId-resumo').hidden, false);
  assert.match($('diario-carroId-resumo').textContent, /Empresa 1/);
  assert.equal($('diario-motoristaId-resumo').hidden, false);
  assert.match($('diario-motoristaId-resumo').textContent, /•••••••8901 · AB · Usuário 72/);
  assert.doesNotMatch($('diario-motoristaId-resumo').textContent, /12345678901/);
});

test('devolução mantém apenas seus campos próprios e não exige cadastros de saída', () => {
  const { contexto, $ } = formulario();
  vm.runInContext("abrirRegistro({ placa: 'ABC1234' })", contexto);
  assert.match($('diario-campos').innerHTML, /name="retorno"/);
  assert.match($('diario-campos').innerHTML, /name="observacoesRetorno"/);
  assert.doesNotMatch($('diario-campos').innerHTML, /name="carroId"/);
});

test('histórico separa as oito colunas e preserva ações com exclusão restrita à diretoria', () => {
  const { contexto, $ } = formulario();
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/diario-bordo.js'), 'utf8');
  Object.assign(contexto, { filtros: {}, pagina: 1, podeExcluirRegistro: false,
    data: (valor) => valor,
    FormData: class { *[Symbol.iterator]() { yield ['busca', '']; } },
    registros: [{ id: 'viagem-1', saida: '2026-10-08T08:00:00Z', retorno: null, placa: 'ABC1234',
      veiculo: 'Strada', motorista: 'Teste', origem: 'Empresa 1', destino: 'Cliente', distanciaIda: 2 }]
  });
  vm.runInContext(fonte.slice(fonte.indexOf('  function renderizar()'), fonte.indexOf('  async function carregar()')), contexto);
  vm.runInContext('renderizar()', contexto);
  const html = $('diario-linhas').innerHTML;
  assert.equal((html.match(/<td /g) || []).length, 8);
  for (const coluna of ['Saída', 'Retorno', 'Veículo', 'Motorista', 'Rota', 'Quilometragem', 'Situação', 'Ações']) {
    assert.ok(html.includes(`data-label="${coluna}"`));
  }
  assert.match(html, /data-devolver="viagem-1"/);
  assert.doesNotMatch(html, /data-excluir-registro/);
  contexto.podeExcluirRegistro = true;
  vm.runInContext('renderizar()', contexto);
  assert.match($('diario-linhas').innerHTML, /data-excluir-registro="viagem-1"/);
});

test('cadastros compactos preservam os campos e validações de rota, carro e motorista', () => {
  const { contexto, $ } = formulario();
  const fonte = fs.readFileSync(path.join(__dirname, '../frontend/diario-bordo.js'), 'utf8');
  Object.assign(contexto, { buscaUsuarioVersao: 0, tipoCadastro: 'rotas', listarCadastros() {} });
  vm.runInContext(fonte.slice(fonte.indexOf('  function prepararCadastro()'), fonte.indexOf("  $('diario-cadastros').addEventListener")), contexto);
  for (const [tipo, campos] of Object.entries({ rotas: ['nome', 'destino', 'distanciaIda'], carros: ['placa', 'veiculo', 'empresa'], motoristas: ['nome', 'cnh', 'categoriaCnh', 'codUsu'] })) {
    contexto.tipoCadastro = tipo;
    vm.runInContext('prepararCadastro()', contexto);
    const html = $('diario-cadastro-campos').innerHTML;
    for (const campo of campos) assert.ok(html.includes(`name="${campo}"`));
    if (tipo === 'rotas') {
      assert.match(html, /Norte Sul Sementes MT \(Empresa 1\)/);
      assert.match(html, /type="number"/);
    }
    if (tipo === 'motoristas') {
      assert.match(html, /pattern="\[0-9\]\{11\}"/);
      assert.match(html, /id="diario-usuario-buscar"/);
      assert.match(html, /value="AB"/);
      assert.match(html, /value="">Sem vínculo/);
    }
  }
});
