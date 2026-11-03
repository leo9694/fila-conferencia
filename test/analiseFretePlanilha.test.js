const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/analise-frete.js'), 'utf8');

function elemento(tag) {
  return {
    tag, children: [], classList: { add() {} },
    addEventListener() {},
    appendChild(node) { this.children.push(node); },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    set textContent(value) { this.children = [String(value)]; },
    get textContent() { return this.children.map((node) => typeof node === 'string' ? node : node.textContent).join(''); }
  };
}

function renderizar(linhas) {
  const tbody = elemento('tbody');
  const document = {
    getElementById: () => tbody,
    createElement: elemento,
    createTextNode: (text) => String(text)
  };
  const api = vm.runInNewContext(source.slice(0, source.indexOf('  function atualizarTextoTransportadoras()')) + 'return { render }; }());', { document });
  api.render(linhas);
  return tbody.children;
}

const nota = {
  NUMNOTA: 83369, CODTIPOPER: 35, NUNOTA: 3886788, CODEMP: 1, NOMEEMP: 'NORTE SUL SEMENTES',
  DATA_PEDIDO: '2026-10-30', CODPARC: 10283, CLIENTE: 'AGROVETERINARIA JAVALI',
  CIDADE: 'NOVA MUTUM', TRANSPORTADORA: 'CARVALIMA', VLRNOTA: 816.13,
  VLRFRETE: 0, PESO: 16.415, QTDVOL: 3, CIF_FOB: 'C'
};

test('planilha separa os dados da nota e conserva valores zero e ausência de CT-e', () => {
  const [row] = renderizar([{ ...nota, ctes: [], simulacoes: [] }]);
  assert.equal(row.children.length, 13);
  const texto = row.children.map((cell) => cell.textContent);
  assert.deepEqual(texto.slice(0, 5), ['83369', '30/10/2026', '10283 - AGROVETERINARIA JAVALI', 'NOVA MUTUM', 'CARVALIMA']);
  assert.equal(texto[6], '16,415');
  assert.equal(texto[7], '3');
  assert.equal(texto[10], 'Sem CT-e emitido vinculado');
  assert.equal(texto[11], '—');
});

test('notas agrupadas compartilham tabela e CT-es sem repetir frete ou diferença', () => {
  const chave = '1'.repeat(44);
  const rows = renderizar([{ ...nota, notasDetalhes: [nota, { ...nota, CODTIPOPER: 10, NUMNOTA: 83370 }],
    agrupadoCte: true, real: 200, ctes: [
      { NUM_CTE: 123, CHAVEACESSO: chave, TRANSPORTADORA_CTE: 'CARVALIMA', FRETE_CTE_TOTAL: 200, STATUS_IMPORTACAO: 2 },
      { NUM_CTE: 124, CHAVEACESSO: 'invalida', TRANSPORTADORA_CTE: 'OUTRA', FRETE_REAL: 30, STATUS_IMPORTACAO: 0 }
    ], simulacoes: [{ codigo: 5, tabela: 'CARVALIMA MT', regiao: 'R6 POLO', valor: 99.91, diferenca: 100.09 },
      { codigo: 6, tabela: 'ALTERNATIVA', regiao: '', erro: true, diferenca: null }] }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].children.length, 13);
  assert.equal(rows[1].children.length, 8);
  assert.equal(rows[1].children[0].textContent, '83370');
  for (const cell of rows[0].children.slice(8)) assert.equal(cell.rowSpan, 2);
  assert.match(rows[0].children[9].textContent, /99,91.*Cálculo indisponível/);
  assert.deepEqual(rows[0].children[10].children[0].children, ['123']);
  assert.equal(rows[0].children[10].children[1].textContent, '124');
  assert.equal(rows[0].children[11].textContent, (200).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  assert.equal(rows[0].children[12].children.length, 2);
});

test('planilha conserva o aviso de grupo incompleto e mostra apenas o valor rateado', () => {
  const [row] = renderizar([{ ...nota, grupoIncompleto: true, compartilhado: true, real: 10,
    ctes: [{ NUM_CTE: 2, FRETE_REAL: 10 }], simulacoes: [] }]);
  assert.equal(row.children[11].textContent, (10).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  assert.equal(row.children[12].textContent, 'CT-e com notas fora do período');
});

test('planilha destaca apenas as diferenças positivas acima de 50 reais', () => {
  const [row] = renderizar([{ ...nota, ctes: [], simulacoes: [-75, 50, 50.01, null].map((diferenca) => ({ diferenca })) }]);
  const valores = row.children[12].children;
  assert.deepEqual(valores.map((valor) => valor.className === 'analise-frete-diferenca-alta'), [false, false, true, false]);
});
