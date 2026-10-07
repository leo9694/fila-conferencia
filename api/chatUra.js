function configurarUra(setores, enabled) {
  if (!enabled) return { enabled: false };
  const options = {};
  for (const [digit, name] of [['1', 'Financeiro'], ['2', 'Vendas'], ['3', 'Compras']]) {
    const setor = setores.find((item) => String(item.nome || '').trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (!setor) throw Object.assign(new Error(`Crie o setor ${name} antes de ativar a URA.`), { status: 400 });
    options[digit] = { name, agentIds: setor.atendentes.map(String) };
  }
  return { enabled: true, options };
}

module.exports = { configurarUra };
