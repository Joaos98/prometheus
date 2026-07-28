# Prometheus

A self-hosted household finance tracker built on the **snapshot model** — every Month owns its data as an independent row. Couples, roommates, or small groups track income, shared expenses, and savings goals. Editing a month touches only that month. A serverless demo build with browser storage is available for trying the app without deploying anything.

<details open>
<summary><b>Table of contents</b></summary>

- [Features & roadmap](#features--roadmap)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Running locally (dev)](#running-locally-dev)
- [Self-hosting (Docker)](#self-hosting-docker)
- [Demo build](#demo-build)
- [Testing](#testing)
</details>

## Features & roadmap

| Feature | Status |
|---------|--------|
| Household setup (currency, members with join/depart dates) | ✅ MVP |
| Income profile with named sources + restricted-use flag, snapshotted per Month | ✅ MVP |
| Expense templates (default participants/split) + per-Month snapshots | ✅ MVP |
| Three split methods per expense (even, proportional, custom) | ✅ MVP |
| Per-Month expense amounts, auto-previous for recurring costs, pending flagging | ✅ MVP |
| Savings goals with per-member contributions (no split rules) | ✅ MVP |
| Dashboard: per-member income, expense shares, goal contributions, leftover | ✅ MVP |
| Leftover breakdown with restricted-income toggle | ✅ MVP |
| Goal progress: accumulated vs. target | ✅ MVP |
| Month navigation with history browsing (each Month independently editable) | ✅ MVP |
| Docker self-hosted deployment | ✅ MVP |
| Serverless demo with browser storage (fully functional, no backend) | ✅ MVP |
| Forward propagation toggle (edit one month, apply to all forward months) | V2 |
| Composite expenses (sub-items rolling into one total) | V2 |
| Visual trends over time | V2 |

## Screenshots

<!-- TODO: add screenshots -->


## Tech stack

| Layer | Technology |
|-------|-----------|
| Engine (domain core) | TypeScript — pure, zero dependencies, shared by server and demo |
| Data layer | TypeScript interface + better-sqlite3 adapter (server) + localStorage adapter (demo) |
| API server | Express 5 (TypeScript) |
| Frontend | Vue 3 + Vite + TypeScript |
| Testing | Vitest at both seams (engine behavior + data-layer contract) |
| Package manager | pnpm workspace monorepo |
| Deployment | Docker (multi-stage: Vite build → Express server → Node image) |
| Demo | Static Vite build + localStorage + same engine code, hosted for free (serverless) |

## Project layout

```
prometheus/
├── packages/
│   ├── engine/           @prometheus/engine — pure domain core (~150 lines)
│   │   └── src/          types, computeMonthlySummary, splits, rounding
│   └── data/             @prometheus/data — persistence layer
│       └── src/          DataStore interface, SqliteStore, contract suite
├── apps/
│   └── self-hosted/      @prometheus/self-hosted — runnable application
│       └── src/
│           ├── server/   Express API (TypeScript)
│           └── client/   Vue 3 SPA (pages, components, composables)
├── Dockerfile            Multi-stage build
└── docker-compose.yml
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

# Terminal 2 — Vue dev server (Vite proxies /api to Express, port :5173)
pnpm --filter @prometheus/self-hosted dev:client
```

The database is created at `apps/self-hosted/prometheus.db` on first run.

## Self-hosting (Docker)

```bash
docker build -t prometheus .
docker run -p 3000:3000 -v prometheus-data:/data prometheus
```

The database persists in a Docker volume. Override with environment variables:

```bash
docker run -p 8080:8080 -e PORT=8080 -e PROMETHEUS_DB=/data/my-household.db prometheus
```

Or with Docker Compose:

```bash
docker compose up -d
```

## Demo build

A fully functional, serverless version that stores all data in the browser (`localStorage`). Uses the same engine and Vue UI — swaps the data layer from SQLite to a browser-storage adapter at build time.

```bash
pnpm --filter @prometheus/self-hosted build:demo
```

Output is a static `dist/` folder — deploy anywhere (GitHub Pages, Netlify, Vercel) for free indefinitely.

## Testing

```bash
pnpm test        # engine behavior + data-layer contract + client smoke
pnpm typecheck   # full project typecheck
```
