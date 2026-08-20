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
