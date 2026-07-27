# Prometheus

A self-hosted household finance tracker that replaces spreadsheets with flexible split rules. Couples, roommates, or small groups track income, shared expenses, and savings goals — each member sees their monthly leftover after everything is accounted for.

<details open>
<summary><b>Table of contents</b></summary>

- [Features & roadmap](#features--roadmap)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Running locally (dev)](#running-locally-dev)
- [Self-hosting (production)](#self-hosting-production)
- [Testing](#testing)
</details>

## Features & roadmap

| Feature | Status |
|---------|--------|
| Household setup (currency, members with join/depart dates) | ✅ MVP |
| Persistent income sources + one-off income + restricted-use flag | ✅ MVP |
| Shared expenses with 3 split methods (even, proportional to income, custom) | ✅ MVP |
| Per-month expense amounts, pending flagging, end effective dates | ✅ MVP |
| Savings goals with targets, start balances, and shared split rules | ✅ MVP |
| Dashboard: balance cards, expense summary, goal progress, leftover breakdown | ✅ MVP |
| Month navigation with history browsing (past months use rules in effect then) | ✅ MVP |
| Change split rules / participants effective from any month, with back-date warning | ✅ MVP |
| Composite expenses (variable sub-items rolling into one total) | V2 |
| Expected vs. actual amounts, savings projections, visual trends | V2 |
| New-month carry-over convenience | V2 |
| Net worth view, unusual-month flagging, what-if reallocation | Stretch |
| Export (CSV/PDF), bill reminders, annual summary | Stretch |
| Public serverless demo (same codebase, mock data, no backend) | Stretch |

## Screenshots

<!-- TODO: add screenshots of the Overview, Income, Expenses, Goals, and Members pages -->


## Tech stack

| Layer | Technology |
|-------|-----------|
| Engine (domain core) | TypeScript — pure, zero dependencies |
| Data layer | TypeScript interface + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) adapter |
| API server | [Express](https://expressjs.com/) 5 |
| Frontend | [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + TypeScript |
| Testing | [Vitest](https://vitest.dev/) at both seams |
| Package manager | [pnpm](https://pnpm.io/) workspace monorepo |

## Project layout

```
prometheus/
├── packages/
│   ├── engine/           @prometheus/engine — pure domain core
│   │   └── src/          types, computeMonthlySummary, validation
│   └── data/             @prometheus/data — persistence layer
│       └── src/          DataStore interface, SqliteStore, contract suite
├── apps/
│   └── self-hosted/      @prometheus/self-hosted — runnable application
│       └── src/
│           ├── server/   Express API
│           └── client/   Vue 3 SPA (pages, components, composables)
├── docs/
│   └── adr/              Architectural Decision Records
├── CONTEXT.md            Domain glossary
└── README.md
```

## Getting started

**Prerequisites:** Node.js 22+ and pnpm.

```bash
npm install -g pnpm
pnpm install
```

## Running locally (dev)

Two terminals from the repo root:

```bash
# Terminal 1 — API server (Express on :3000)
pnpm --filter @prometheus/self-hosted dev:server

# Terminal 2 — Vue dev server (Vite, proxies /api to Express)
pnpm --filter @prometheus/self-hosted dev:client
```

Open the Vite URL (usually `http://localhost:5173`). The database is created at `apps/self-hosted/prometheus.db` on first run.

## Self-hosting (production)

```bash
pnpm build
pnpm start
```

The app listens on port 3000. Use environment variables to override:

```bash
PORT=8080 PROMETHEUS_DB=/data/prometheus.db pnpm start
```

Everything is self-contained — one Node process, one embedded SQLite database, no external services.

## Testing

```bash
pnpm test        # engine + data layer + client smoke
pnpm typecheck   # full project typecheck
```
