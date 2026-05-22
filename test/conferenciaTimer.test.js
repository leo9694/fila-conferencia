const test = require('node:test');
const assert = require('node:assert/strict');

const { atualizarTempoConferencia } = require('../api/conferenciaTimer');

test('mantem o inicio da conferencia enquanto o pedido estiver em andamento', () => {
  const memoria = {};
  const inicio = new Date('2026-03-31T10:00:00Z');
  const depois = new Date('2026-03-31T10:07:00Z');

  const primeiro = atualizarTempoConferencia(memoria, {
    NUNOTA: 123,
    STATUS_CONFERENCIA: 'EM ANDAMENTO'
  }, inicio);

  const segundo = atualizarTempoConferencia(memoria, {
    NUNOTA: 123,
    STATUS_CONFERENCIA: 'EM ANDAMENTO'
  }, depois);

  assert.equal(primeiro.iniciadoEm.toISOString(), '2026-03-31T10:00:00.000Z');
  assert.equal(segundo.iniciadoEm.toISOString(), '2026-03-31T10:00:00.000Z');
  assert.equal(segundo.tempoTotalMinutos, null);
});

test('calcula e preserva o tempo total quando o pedido e concluido', () => {
  const memoria = {};
  const inicio = new Date('2026-03-31T09:00:00Z');
  const fim = new Date('2026-03-31T09:18:00Z');
  const depois = new Date('2026-03-31T09:30:00Z');

  atualizarTempoConferencia(memoria, {
    NUNOTA: 456,
    STATUS_CONFERENCIA: 'EM CONFERENCIA'
  }, inicio);

  const concluido = atualizarTempoConferencia(memoria, {
    NUNOTA: 456,
    STATUS_CONFERENCIA: 'CONFERIDO'
  }, fim);

  const conferidoNovamente = atualizarTempoConferencia(memoria, {
    NUNOTA: 456,
    STATUS_CONFERENCIA: 'CONFERIDO'
  }, depois);

  assert.equal(concluido.tempoTotalMinutos, 18);
  assert.equal(conferidoNovamente.tempoTotalMinutos, 18);
});

test('remove o registro quando o pedido volta para aguardando', () => {
  const memoria = {};
  const inicio = new Date('2026-03-31T08:00:00Z');

  atualizarTempoConferencia(memoria, {
    NUNOTA: 789,
    STATUS_CONFERENCIA: 'EM ANDAMENTO'
  }, inicio);

  const aguardando = atualizarTempoConferencia(memoria, {
    NUNOTA: 789,
    STATUS_CONFERENCIA: 'AGUARDANDO CONFERENCIA'
  }, new Date('2026-03-31T08:05:00Z'));

  assert.equal(aguardando.iniciadoEm, null);
  assert.equal(aguardando.tempoTotalMinutos, null);
  assert.equal(memoria[789], undefined);
});
