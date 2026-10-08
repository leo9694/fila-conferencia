(function (root) {
  function criarChatRealtime({ EventSource, clientId, onError = () => {} }) {
    const assinantes = new Set();
    const eventos = new Set();
    const ultimosEstados = new Map();
    let source = null;
    const entregar = (assinante, evento, mensagem) => {
      try { assinante.callbacks.get(evento)?.(mensagem); } catch (error) { onError(error); }
    };
    const registrar = (evento) => {
      if (!source || eventos.has(evento)) return;
      eventos.add(evento);
      source.addEventListener(evento, (mensagem) => {
        if (evento === 'connection' || evento === 'call:connection') ultimosEstados.set(evento, mensagem);
        for (const assinante of [...assinantes]) entregar(assinante, evento, mensagem);
      });
    };
    return {
      clientId,
      subscribe() {
        const assinante = { callbacks: new Map(), onerror: null };
        assinantes.add(assinante);
        if (!source) {
          source = new EventSource(`/api/chat/events?clientId=${encodeURIComponent(clientId)}`);
          source.onerror = (error) => {
            ultimosEstados.clear();
            for (const item of [...assinantes]) {
              try { item.onerror?.(error); } catch (erro) { onError(erro); }
            }
          };
        }
        let fechado = false;
        return {
          addEventListener(evento, callback) {
            if (fechado) return;
            assinante.callbacks.set(evento, callback);
            registrar(evento);
            if (ultimosEstados.has(evento)) entregar(assinante, evento, ultimosEstados.get(evento));
          },
          set onerror(callback) { assinante.onerror = callback; },
          close() {
            if (fechado) return;
            fechado = true;
            assinantes.delete(assinante);
            assinante.callbacks.clear();
            if (!assinantes.size) { source.close(); source = null; eventos.clear(); ultimosEstados.clear(); }
          }
        };
      }
    };
  }
  if (typeof module === 'object' && module.exports) module.exports = { criarChatRealtime };
  else root.chatRealtime = criarChatRealtime({ EventSource: root.EventSource,
    clientId: root.crypto?.randomUUID?.() || `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    onError: (error) => console.error('Falha no evento de tempo real:', error.message) });
})(typeof window === 'object' ? window : globalThis);
