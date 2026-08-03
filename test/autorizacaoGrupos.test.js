const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAutorizacaoGrupos, numeroUsuario } = require('../api/autorizacaoGrupos');

test('numeroUsuario aceita somente identificadores inteiros validos', () => {
  assert.equal(numeroUsuario('72'), 72);
  assert.equal(numeroUsuario(0), 0);
  assert.equal(numeroUsuario('1 OR 1=1'), null);
  assert.equal(numeroUsuario(-1), null);
});

test('consulta o grupo Sankhya com codigo validado e usa cache', async () => {
  const consultas = [];
  const autorizacao = criarAutorizacaoGrupos({
    executeQuery: async (sql) => {
      consultas.push(sql);
      return [{ NOMEGRUPO: ' Diretoria ' }];
    }
  });

  assert.equal(await autorizacao.pertenceAoGrupo(72, 'diretoria'), true);
  assert.equal(await autorizacao.pertenceAoGrupo(72, 'Diretoria'), true);
  assert.equal(consultas.length, 1);
  assert.match(consultas[0], /TSIUSU/);
  assert.match(consultas[0], /TSIGRU/);
  assert.match(consultas[0], /USU\.CODUSU = 72/);
});

test('middleware bloqueia quem nao pertence ao grupo', async () => {
  const autorizacao = criarAutorizacaoGrupos({ executeQuery: async () => [{ NOMEGRUPO: 'Operadores' }] });
  const resposta = {
    statusCode: null,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let chamouNext = false;

  await autorizacao.exigirGrupo('Diretoria')(
    { usuario: { codUsu: 72 } },
    resposta,
    () => { chamouNext = true; }
  );

  assert.equal(chamouNext, false);
  assert.equal(resposta.statusCode, 403);
});

test('permite acesso quando o usuario pertence a qualquer grupo autorizado', async () => {
  const autorizacao = criarAutorizacaoGrupos({ executeQuery: async () => [{ NOMEGRUPO: 'Gerente' }] });
  const resposta = {
    statusCode: null,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let chamouNext = false;

  await autorizacao.exigirAlgumGrupo(['Gerente', 'Diretoria'])(
    { usuario: { codUsu: 18 } },
    resposta,
    () => { chamouNext = true; }
  );

  assert.equal(chamouNext, true);
  assert.equal(resposta.statusCode, null);
});

test('bloqueia usuario fora dos grupos autorizados', async () => {
  const autorizacao = criarAutorizacaoGrupos({ executeQuery: async () => [{ NOMEGRUPO: 'Operadores' }] });
  const resposta = {
    statusCode: null,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let chamouNext = false;

  await autorizacao.exigirAlgumGrupo(['Gerente', 'Diretoria'])(
    { usuario: { codUsu: 72 } },
    resposta,
    () => { chamouNext = true; }
  );

  assert.equal(chamouNext, false);
  assert.equal(resposta.statusCode, 403);
  assert.match(resposta.payload.erro, /Gerente ou Diretoria/);
});
