(function (root) {
  function distanciaViagem(registro) {
    if (!Number.isFinite(registro.distanciaIda) || registro.distanciaIda <= 0) return null;
    return Math.round(registro.distanciaIda * 2 * 1000000) / 1000000;
  }
  function totalPercorrido(registros) {
    return registros.reduce((total, item) => total + (item.retorno ? distanciaViagem(item) ?? 0 : 0), 0);
  }
  const api = { distanciaViagem, totalPercorrido };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.diarioBordoQuilometragem = api;
})(typeof window === 'undefined' ? globalThis : window);
