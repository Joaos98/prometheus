# Stack: TypeScript, Vue 3, Vite, SQLite, one plain repo

TypeScript throughout, since the domain engine runs in the browser and is the heart of the application. **Vue 3** for the UI, built with **Vite** for both targets. The self-hosted server is a small Node process serving static files and row-level CRUD over **SQLite** (`better-sqlite3`), with no domain knowledge (ADR-0007). **Vitest** for engine behaviour tests and the storage-port contract suite, run against both adapters. **Docker** multi-stage build for self-hosting; the demo is a static Vite build with the `localStorage` adapter.

**One repository with plain directories** — `domain/`, `storage/`, `ui/`, `server/` — not a pnpm monorepo. The boundaries that matter are enforced by the storage port and by keeping the domain free of framework and I/O imports, neither of which needs workspace tooling. This is one application with two build targets, not a package ecosystem, and the monorepo overhead buys nothing at this size.

Writes are row-scoped rather than whole-Household, so two members editing different rows never collide; the client refetches on window focus and polls lightly while a Month is open. Same-row collisions resolve last-write-wins, which is acceptable once cross-row collisions are impossible.
