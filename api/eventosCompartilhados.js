const { EventEmitter } = require('node:events');

// Um único listener do EventEmitter por evento; assinantes são distribuídos aqui.
function criarEventosCompartilhados() {
  const emitter = new EventEmitter();
  const eventos = new Map();
  return {
    on(evento, callback) {
      let grupo = eventos.get(evento);
      if (!grupo) {
        grupo = { callbacks: new Set() };
        grupo.dispatch = (...args) => {
          for (const callback of [...grupo.callbacks]) {
            if (!grupo.callbacks.has(callback)) continue;
            try { callback(...args); } catch (error) { console.error('Falha em assinante de tempo real:', error.message); }
          }
        };
        eventos.set(evento, grupo);
        emitter.on(evento, grupo.dispatch);
      }
      grupo.callbacks.add(callback);
    },
    off(evento, callback) {
      const grupo = eventos.get(evento);
      if (!grupo) return;
      grupo.callbacks.delete(callback);
      if (!grupo.callbacks.size) { emitter.off(evento, grupo.dispatch); eventos.delete(evento); }
    },
    emit(evento, ...args) { return emitter.emit(evento, ...args); },
    listenerCount(evento) { return eventos.get(evento)?.callbacks.size || 0; }
  };
}

function criarProcessadorCompartilhado(processar) {
  const cache = new WeakMap();
  return (evento, payload) => {
    if (!payload || typeof payload !== 'object') return Promise.resolve().then(() => processar(evento, payload));
    let eventos = cache.get(payload);
    if (!eventos) { eventos = new Map(); cache.set(payload, eventos); }
    if (!eventos.has(evento)) eventos.set(evento, Promise.resolve().then(() => processar(evento, payload)));
    return eventos.get(evento);
  };
}

module.exports = { criarEventosCompartilhados, criarProcessadorCompartilhado };
