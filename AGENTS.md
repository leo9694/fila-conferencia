# Repository Guidelines

## Project Structure & Module Organization

This is a CommonJS Node.js/Express application for Sankhya operational workflows.

- `server.js` starts the HTTP server; `routes.js` contains API routes and workflow orchestration.
- `api/` holds domain modules and integrations, including Sankhya access, entry conferences, stock counting, authorization, and report generation.
- `frontend/` contains the static browser application (`index.html`, `app.js`, CSS, and assets).
- `test/` contains Node's built-in test runner suites. Keep tests beside the matching domain name, e.g. `api/estoqueAjuste.js` → `test/estoqueAjuste.test.js`.
- `data/` stores local runtime state. Treat it as operational data, not source code.

## Build, Test, and Development Commands

```bash
npm start          # Starts the server with node server.js
npm test           # Runs all Node test suites
node --test test/conferenciaEntrada.test.js  # Runs one focused suite
npm run test:bitrix # Exercises the Bitrix integration script
```

Run the smallest relevant test file first. Run `npm test` before handing off changes that affect shared behavior, routes, or integrations.

## Coding Style & Naming Conventions

Use JavaScript with 2-space indentation, semicolons, `const` by default, and `async`/`await` for I/O. Use Portuguese domain names where they match Sankhya terminology (`conferencia`, `lote`, `estoque`) and descriptive camelCase for variables and functions. Keep SQL close to its use site and validate numeric identifiers before interpolation. Do not introduce dependencies or broad refactors without a clear need.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Name tests as behavioral sentences, for example `test('consolida linhas repetidas...', ...)`. Add a regression test for every production bug, especially around stock, lot/control, quantity conversion, and conference finalization. Mock external services; never run destructive production actions from tests.

## Commit & Pull Request Guidelines

Use concise imperative commits consistent with history: `fix: consolida notas de ajuste por tipo` or `Corrige migracao de lotes nos ajustes de estoque`. Keep each commit focused. PRs should explain the operational impact, list tests run, and include screenshots for frontend changes. Never commit `.env` files, tokens, passwords, or production data.

## Security & Configuration

Configuration belongs in local `.env*` files. Do not print secrets in logs or command output. Production Sankhya writes require explicit user authorization and a read-only verification before mutation.
