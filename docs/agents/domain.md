# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase. Prometheus is **single-context** — one `CONTEXT.md` and one `docs/adr/` at the repo root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the binding ubiquitous language.
- **`docs/adr/`** — read the ADRs that touch the area you're about to work in.
- **`prometheus-system-plan.md`** — what the system does and why.
- **`prometheus-redesign-brief.md`** — the visual language, for any UI work.

These four are the only requirements source. There is no prior implementation to consult: the repo was deliberately reset to a clean slate on 2026-07-28 and all earlier code, tickets and stack choices are discarded. Don't cite old commits as precedent.

## File structure

```
/
├── CONTEXT.md
├── prometheus-system-plan.md
├── prometheus-redesign-brief.md
├── docs/
│   ├── adr/
│   │   ├── 0001-month-lifecycle.md
│   │   └── …
│   ├── specs/            ← the issue tracker (see issue-tracker.md)
│   └── agents/           ← this config
└── …
```

## Use the glossary's vocabulary

When your output names a domain concept — an issue title, a test name, a type, a variable, a UI string — use the term as defined in `CONTEXT.md`, and honour its **_Avoid_** list. Those lists are binding, not advisory: no "user" for Member, no "account" or "workspace" for Household, no "period" or "cycle" for Month, no "rollover" for opening a Month, no "bulk edit" or "cascade" for Forward Propagation, no "debt" or "owed amount" for Share.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Read superseded ADR text as history

ADRs record decisions as they were made, and the early ones have been partly superseded:

- **ADR-0001** describes opening a Month as snapshotting Income Profiles and creating Expense Snapshots from Expense Templates, and defines Drift against those. **ADR-0003** deletes Expense Templates, **ADR-0004** deletes the Income Profile and redefines Drift as divergence from the Previous Month, explicitly superseding ADR-0001 on that point.
- The **Consequences** sections of ADR-0003 and ADR-0004 note a departure from the system plan's MVP list. That list has since been updated and no longer names either concept.

**There are no templates, profiles, or standing definitions of any kind outside a Month.** If an ADR's older text suggests otherwise, the later ADR wins. Don't build a registry, a template table, or an "ended" flag.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (the domain runs in the browser) — but worth reopening because…_
