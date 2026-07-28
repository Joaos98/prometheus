# Prometheus

A self-hosted household finance tracker built on the **snapshot model** — every Month owns its data as an independent row. Couples, roommates, or small groups track income, shared expenses, and savings goals. Editing a month touches only that month. A serverless demo build with browser storage is planned for portfolio showcase.

## How it works

**The snapshot model.** Unlike traditional budget apps that use effective-dating (timelines of changes), Prometheus stores every Month as a self-contained snapshot. July's data is a row. Editing July changes July. August is its own row. No timelines, no hidden entries, no ceremony when you change a split rule.

**Income profile.** Each member sets up recurring income sources (name, amount, restricted-use flag) in their profile. When a new Month opens, the profile snapshots into that Month's income rows. Editing the profile changes future months only — past months keep what was captured.

**Expense templates.** An expense is created as a template with default participants and split rule. Each Month stores its own amount. Amounts auto-fill from the previous Month. Editing a month's expense changes only that month. First-month expenses appear as pending until an amount is entered.

**Split rules.** Three methods per expense: even, proportional to spendable income, or custom (percentages or fixed amounts per participant).

**Savings goals.** No split rules — each participant enters their contribution directly each Month. Accumulated progress = start amount + sum of all contributions. Targets are optional.

**Leftover Balance.** Per member, per Month: Spendable Income minus expense Shares minus goal contributions. Negative values display plainly. A dashboard toggle includes/excludes restricted-use income.

## Features

- Household setup with currency picker and member management
- Income profile (multiple named sources per member, restricted-use flag)
- Expense templates with default participants and three split methods
- Per-Month expense amounts with auto-previous fill
- Savings goals with per-member contributions (no split rules)
- Dashboard: per-member leftover, income, expense shares, goal progress
- Month navigation with history browsing
- Forward propagation toggle (apply a change to all forward months)
- Pending flags for unentered expenses and unentered goal contributions

## Tech stack

| Layer | Technology |
|-------|-----------|
| Engine (domain core) | TypeScript — pure, zero dependencies |
| Data layer | TypeScript interface + better-sqlite3 adapter (self-hosted) + localStorage adapter (demo) |
| API server | Express 5 (TypeScript) |
| Frontend | Vue 3 + Vite + TypeScript |
| Testing | Vitest at both seams |
| Package manager | pnpm workspace monorepo |
| Deployment | Docker (multi-stage build) |
| Demo | Static Vite build + localStorage, fully functional in the browser |

## Deployment

**Self-hosted:** Docker multi-stage build. Single container with Express serving the Vue app and API, embedded SQLite for persistence.

**Demo:** Static Vite build with a localStorage DataStore adapter. Same engine and Vue UI — fully functional in the browser with no backend. Hostable for free on any static host.

## Domain model

See `CONTEXT.md` for the complete glossary of domain terms.

See `.scratch/prometheus-snapshot/spec-snapshot.md` for the full specification with user stories and implementation decisions.
