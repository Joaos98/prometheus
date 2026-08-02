# Prometheus

A household finance tracker built on the snapshot model. See `prometheus-system-plan.md` for what it does, `CONTEXT.md` for the binding vocabulary, and `docs/adr/` for the decisions behind the model.

The MVP is built and shipped as v1.0: `docs/specs/0001-mvp/spec.md` is `done`, and so is every one of its nineteen tickets. `docs/specs/0002-v1-1-dashboard-refinements/` is `done` too, shipped as v1.1 — five UI refinements to the dashboard, with no domain or storage change between them. What comes next is `docs/roadmap.md`, from v1.2 down. The code lives in `domain/` (the engine, free of framework and I/O), `storage/` (the port and its two adapters), `ui/` (Vue 3), `server/` (static files plus row CRUD over SQLite) and `demo/` (the seed, which drives the domain as a member would and runs in CI as a test).

## Agent skills

### Issue tracker

Local markdown, tracked in git: specs and issues live under `docs/specs/`, not in `.scratch/` and not on any external tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, written to a `Status:` line in each spec or issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one root `CONTEXT.md` plus `docs/adr/`. The glossary's _Avoid_ lists are binding, and some early ADR text is superseded. See `docs/agents/domain.md`.
