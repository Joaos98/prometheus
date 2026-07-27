# Prometheus

Household finance tracker — a share calculator for income, shared expenses, and savings goals. See `CONTEXT.md` for the domain language and `docs/adr/` for binding decisions.

## Setup

Requires Node.js 22+ and pnpm (`npm install -g pnpm`).

```
pnpm install
```

## Test

Both seams (engine behavior tests, data-layer contract suite) plus client smoke tests, from a clean checkout:

```
pnpm test
```

## Typecheck

```
pnpm typecheck
```

## Run (dev)

Two terminals:

```
pnpm --filter @prometheus/self-hosted dev:server
pnpm --filter @prometheus/self-hosted dev:client
```

The client dev server proxies `/api` to the API server.

## Layout

- `packages/engine` — pure, dependency-free domain core (monthly-summary engine)
- `packages/data` — data-layer interface + better-sqlite3 adapter + contract suite
- `apps/self-hosted` — Express API + Vue 3 client
