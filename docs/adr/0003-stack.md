# Stack: TypeScript full-stack monorepo (pnpm, pure-TS engine, Express, Vue)

Prometheus is built as a TypeScript monorepo with pnpm workspaces: a pure, dependency-free `engine` package containing all domain math; a `data` package holding the data-layer interface and a better-sqlite3 adapter for the self-hosted build; and a `self-hosted` app pairing an Express API with a Vue 3 + Vite + TypeScript client. Tests use Vitest at both seams.

## Considered Options

- **Java 21 + Spring Boot backend with a Vue frontend** — the maintainer's initial preference. Rejected because the Stretch serverless demo build needs the monthly-summary engine running in the browser; a Java engine would force a second JS implementation of the domain math, with drift risk between the two.
- **Next.js all-in-one** — rejected because server actions and API routes blur the data-layer seam the plan mandates, and a static serverless demo build fights the framework's assumptions.
- **Go backend + TS frontend** — rejected: two languages, and the engine would need a WASM port or reimplementation for the demo build.

The deciding constraint: the demo build (Stretch) is static and serverless, so the engine must run in the browser. A single-language TypeScript stack lets the same `engine` package serve the self-hosted build, the tests, and — later — the demo, unchanged.
