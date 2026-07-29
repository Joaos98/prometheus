# Prometheus

A household finance tracker built on the snapshot model. See `prometheus-system-plan.md` for what it does, `CONTEXT.md` for the binding vocabulary, and `docs/adr/` for the decisions behind the model.

The repo is currently a deliberate clean slate — the design record is complete, no application code exists yet. `docs/specs/0001-mvp.md` is the spec to build from.

## Agent skills

### Issue tracker

Local markdown, tracked in git: specs and issues live under `docs/specs/`, not in `.scratch/` and not on any external tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, written to a `Status:` line in each spec or issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one root `CONTEXT.md` plus `docs/adr/`. The glossary's _Avoid_ lists are binding, and some early ADR text is superseded. See `docs/agents/domain.md`.
