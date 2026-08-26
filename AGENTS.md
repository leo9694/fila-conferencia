# Repository Guidelines

## Project Structure

This is a CommonJS Node.js/Express application for Sankhya operational workflows.

- `server.js` starts the HTTP server; `routes.js` orchestrates API workflows.
- `api/` contains domain modules and Sankhya, WhatsApp, and Bitrix integrations.
- `frontend/` contains the static browser app, styles, scripts, and assets.
- `test/` contains suites using Node's built-in test runner.
- `data/` stores runtime state and must not be treated as source code.

Match tests to the domain file, for example `api/estoqueAjuste.js` with `test/estoqueAjuste.test.js`.

## Commands

```bash
npm start                                      # Start the application
npm test                                       # Run every test
node --test test/conferenciaEntrada.test.js    # Run one focused suite
npm run test:bitrix                            # Exercise Bitrix integration
```

Run the smallest relevant test first. Run the full suite when shared routes, integrations, or cross-domain behavior change.

## Coding Style

Use JavaScript with 2-space indentation, semicolons, `const` by default, and `async`/`await` for I/O. Use descriptive camelCase names and Portuguese terminology where it matches the Sankhya domain (`conferencia`, `lote`, `estoque`). Keep SQL near its use and validate identifiers before interpolation. Avoid unnecessary dependencies.

## Testing

Use `node:test` and `node:assert/strict`. Name tests as behavioral sentences, such as `test('consolida linhas repetidas...', ...)`. Add regression coverage for production bugs, especially stock, control/lot, unit conversion, and conference finalization. Mock external services; tests must never mutate production.

## Efficient Agent Workflow

Prioritize focused investigation and low token usage without reducing quality. Search with `rg`, then read only files, functions, routes, and tests directly related to the request. Avoid rereading unchanged files or exploring the whole repository without evidence that it is necessary.

Make minimal, objective edits. Do not perform unrelated refactors, formatting sweeps, dependency upgrades, or architectural changes. For complex bugs, investigate enough to identify the cause before editing; never guess merely to save tokens. Preserve user changes and operational data. Keep updates and final responses short, stating the outcome, changed files, and tests run. Never trade correctness, security, or data integrity for speed.

## Commits, PRs, and Security

Use focused imperative commits, such as `fix: consolida notas de ajuste por tipo`. PRs must explain operational impact, tests, and include screenshots for UI changes. Never commit credentials, `.env` files, tokens, passwords, or production data. Production writes require explicit authorization and read-only verification first.

# Diretrizes de desenvolvimento

## Prioridade

A prioridade é entregar uma solução correta, segura e consistente com a arquitetura existente.

Economize contexto e processamento sempre que isso não comprometer a qualidade da implementação.

## Escopo

- Foque exclusivamente na tarefa solicitada.
- Não faça melhorias, refatorações ou mudanças não relacionadas sem necessidade.
- Prefira alterações localizadas e o menor patch que resolva corretamente o problema.
- Preserve comportamentos existentes que não façam parte da solicitação.

## Investigação

- Antes de abrir arquivos grandes, use buscas por funções, classes, IDs, textos, rotas ou referências relacionadas à tarefa.
- Leia inicialmente apenas os trechos relevantes.
- Expanda a investigação para outros arquivos somente quando existir dependência técnica, dúvida de arquitetura ou risco de regressão.
- Não deixe de investigar algo necessário apenas para economizar tokens.
- Evite reler repetidamente arquivos ou trechos já analisados.
- Reutilize as informações já obtidas durante a tarefa.

## Qualidade

- Entenda o fluxo existente antes de alterar comportamentos.
- Preserve os padrões e a arquitetura já utilizados pelo projeto.
- Considere estados de erro, casos extremos e integrações afetadas.
- Evite soluções temporárias ou gambiarras quando houver uma solução consistente com o projeto.
- Não sacrifique qualidade apenas para reduzir tempo, contexto ou uso de tokens.

## Alterações

- Faça o menor patch possível.
- Não reorganize, renomeie ou formate código não relacionado à tarefa.
- Preserve rotas, permissões, IDs, handlers, APIs e contratos existentes, salvo quando a tarefa solicitar explicitamente mudanças neles.
- Não altere backend quando a solicitação for somente de frontend, exceto se houver dependência técnica real.
- Não altere frontend quando a solicitação for somente de backend, exceto se houver dependência técnica real.
- Preserve alterações já existentes no projeto feitas pelo usuário ou por outros agentes.

## Testes

- Execute primeiro o teste mais específico relacionado à alteração.
- Execute testes adicionais somente quando houver impacto compartilhado ou risco real de regressão.
- Builds ou suítes completas podem ser executados quando tecnicamente necessários.
- Não execute testes pesados repetidamente sem necessidade.

## Comandos e dependências

- Não execute `npm install`, atualizações de pacotes ou instalação de dependências sem necessidade técnica.
- Não adicione dependências novas se a solução puder ser implementada adequadamente com o que já existe.
- Se uma nova dependência for realmente necessária, explique o motivo antes de adicioná-la.
- Não execute comandos destrutivos ou que alterem dados operacionais sem autorização explícita.

## Produção e segurança

- Não altere ambiente de produção sem autorização explícita.
- Não modifique credenciais, tokens, chaves, secrets ou configurações sensíveis sem autorização.
- Não apague dados, registros, arquivos ou configurações existentes salvo quando solicitado explicitamente.

## Controle de contexto e custo

- Para tarefas pequenas, priorize uma investigação localizada.
- Não analise o projeto inteiro quando buscas direcionadas forem suficientes.
- Evite leituras extensas de arquivos grandes quando uma busca localizada resolver.
- Não continue explorando o projeto depois que houver evidência suficiente para implementar a solução corretamente.
- Se ocorrerem várias compactações automáticas de contexto em uma tarefa pequena, verifique se a investigação está se repetindo e pare de explorar desnecessariamente.
- Compactação de contexto não deve ser motivo para reduzir a qualidade ou ignorar uma dependência técnica necessária.

## Finalização

Quando a tarefa estiver resolvida:

1. Revise o diff gerado.
2. Verifique possíveis regressões relacionadas à mudança.
3. Confirme que não houve alterações fora do escopo.
4. Informe resumidamente quais arquivos foram modificados e o que mudou.
5. Pare a execução.

Não continue investigando, refatorando ou melhorando outras partes do projeto depois que a solicitação estiver corretamente concluída.
