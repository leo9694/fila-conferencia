function semControleAdicional(tipo) {
  return String(tipo ?? '').trim().toUpperCase() === 'N';
}

function validarRastreabilidadeNovoItem({ tipoControle, controle, dtFabricacao, dtValidade }) {
  if (semControleAdicional(tipoControle)) return;
  if (!String(controle || '').trim()) throw new Error('Informe o lote/controle do novo item.');
  if (!dtFabricacao || !dtValidade) throw new Error('Informe a data de fabricacao e a data de validade do novo lote.');
}

module.exports = { semControleAdicional, validarRastreabilidadeNovoItem };
