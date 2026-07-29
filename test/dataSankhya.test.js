const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../routes');

test('normaliza data da API Sankhya no formato DDMMYYYY HH:mm:ss', () => {
  assert.equal(
    routes._internals.normalizarDataSankhya('13052026 00:00:00'),
    '2026-05-13T00:00:00'
  );
});

test('normaliza data brasileira quando recebida com barras', () => {
  assert.equal(
    routes._internals.normalizarDataSankhya('13/05/2026 08:30:15'),
    '2026-05-13T08:30:15'
  );
});

test('grava data do Sankhya no fuso horario configurado da operacao', () => {
  assert.equal(
    routes._internals.formatarDataHoraSankhya(new Date('2026-07-24T17:53:00.000Z')),
    '24/07/2026 13:53:00'
  );
});

test('permite gravar conclusao no fuso da sessao Sankhya', () => {
  assert.equal(
    routes._internals.formatarDataHoraSankhya(
      new Date('2026-07-29T14:05:00.000Z'),
      'America/Sao_Paulo'
    ),
    '29/07/2026 11:05:00'
  );
});

test('interpreta inicio da conferencia no fuso da operacao', () => {
  assert.equal(
    routes._internals.normalizarInicioConferencia('29072026 05:52:45'),
    '2026-07-29T09:52:45.000Z'
  );
});

test('interpreta fim gravado pelo Sankhya no fuso da sessao', () => {
  assert.equal(
    routes._internals.normalizarFimConferencia('29072026 10:55:58'),
    '2026-07-29T13:55:58.000Z'
  );
});
