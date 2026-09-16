// Interpretador restrito: nunca executa JavaScript ou SQL recebido do cadastro.
function calcularFormulaFrete(formula, variaveis) {
  const texto = String(formula || '').toUpperCase();
  if (!texto || texto.length > 8000) throw new Error('Fórmula ausente ou inválida.');
  const tokens = texto.match(/\d+(?:\.\d+)?|[A-Z_][A-Z_0-9]*|>=|<=|<>|!=|[+*/(),<>=-]|\S/g) || [];
  let pos = 0;
  const exigir = (t) => { if (tokens[pos++] !== t) throw new Error('Fórmula não suportada.'); };
  function primario() {
    const t = tokens[pos++];
    if (t === '+' || t === '-') return (t === '-' ? -1 : 1) * primario();
    if (t === '(') { const v = comparacao(); exigir(')'); return v; }
    if (/^\d+(\.\d+)?$/.test(t || '')) return Number(t);
    if (tokens[pos] === '(') {
      pos++;
      const args = [comparacao()];
      while (tokens[pos] === ',') { pos++; args.push(comparacao()); }
      exigir(')');
      if (t === 'IF' && args.length === 3) return args[0] ? args[1] : args[2];
      if (t === 'TRUNC' && (args.length === 1 || args.length === 2)) {
        const escala = 10 ** (args[1] || 0);
        return Math.trunc(args[0] * escala) / escala;
      }
      if (t === 'MAX' && args.length) return Math.max(...args);
      if (t === 'MIN' && args.length) return Math.min(...args);
      throw new Error('Função de frete não suportada.');
    }
    if (!Object.hasOwn(variaveis, t) || variaveis[t] == null || !Number.isFinite(Number(variaveis[t]))) {
      throw new Error('Variável de frete indisponível.');
    }
    return Number(variaveis[t]);
  }
  function produto() {
    let v = primario();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++]; const d = primario();
      v = op === '*' ? v * d : v / d;
    }
    return v;
  }
  function soma() {
    let v = produto();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++]; const d = produto();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  }
  function comparacao() {
    const a = soma(); const op = tokens[pos];
    if (!['>', '<', '>=', '<=', '=', '<>', '!='].includes(op)) return a;
    pos++; const b = soma();
    return Number(op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b
      : op === '<=' ? a <= b : op === '=' ? a === b : a !== b);
  }
  const valor = comparacao();
  if (pos !== tokens.length || !Number.isFinite(valor) || valor < 0) throw new Error('Resultado de frete inválido.');
  return valor;
}

module.exports = { calcularFormulaFrete };
