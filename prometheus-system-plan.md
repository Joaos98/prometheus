# Prometheus

### Household Finance Tracker — System Plan

## 1. Overview

A webapp for a household — two partners, a group of roommates, or any small group sharing finances — to replace a spreadsheet-based system for tracking income, shared and individual expenses, and savings goals. Each month rolls up into a clear leftover balance per person.

The core idea that sets this apart from a generic budget tracker: **how a shared expense gets divided is a decision the system should support flexibly**, not a fixed assumption. Different households split things different ways — proportional to income, evenly, or something custom — and the split, and even who's included in it, can vary case by case.

Prometheus uses a **snapshot model**, and it reduces to one rule: **opening a Month copies the Previous Month wholesale.** Nothing is defined outside a Month. There are no templates, no profiles, and no effective-dated timelines — a Month's rows are its own, and editing them changes that Month alone.

This document says what the system does and why. The vocabulary is fixed in [CONTEXT.md](./CONTEXT.md); the decisions behind the design, and the alternatives rejected, are in [docs/adr/](./docs/adr/). Where this document and those disagree, they are wrong to disagree — fix it.

## 2. Core Concepts

- **Household** — the shared space containing everyone's data, with any number of members. One deployment serves one Household, and every amount is in a single currency.
- **Roster and Members** — the household's people. Opening a Month copies the active Roster into it, so each Month knows who was in it; deactivating someone affects only Months opened afterwards, and past Months are untouched.
- **Snapshot model** — every Month stores its own independent data. July's data is July's. Editing July changes July. August is its own set of rows.
- **Opening a Month** — Months hold nothing until explicitly opened; browsing an unopened Month is a pure read. Opening copies the Previous Month — members, income, expenses, goals, every field. Any Month can be opened, past or future, and there is no closing action.
- **Previous Month** — the most recent *opened* Month, which need not be the preceding calendar one. Gaps in the record are legal and harmless.
- **Income** — recorded as rows on the Month, one per named source, inherited like everything else. There is no standing record of what anyone earns outside the Months.
- **Restricted-Use Income** — some income, like a meal-voucher benefit, can only be spent on certain things. Flagged once, it never counts toward Spendable Income and so never weights a split. It is deliberately not tied to the expenses it could actually pay for — that would be payment tracking.
- **Expenses** — a row per Month recording name, category, amount, Participants and Split Rule. Continuity across Months is carried by a stable identity on the row; an expense stops recurring by being removed from a Month, or by being marked One-Off in its final Month.
- **Split Rule** — how an Expense divides among its Participants: proportional to Spendable Income, evenly, or custom — percentages totalling exactly 100, or fixed amounts totalling exactly the expense. An invalid split can never be saved.
- **Participants** — the subset of a Month's members an Expense divides among. A single-Participant Expense is how an individual expense is recorded; there is no separate concept for it.
- **Savings Goals** — per-Month rows holding name, optional target, start amount and Participants, with each participant entering their contribution directly. No split rules. Progress is measured as of the Month being viewed, never as of today.
- **Leftover Balance** — a member's position for a Month: Spendable Income minus their Shares minus their contributions. May be negative; never carries forward.
- **Pending** — a row with no amount at all, which now means a genuinely new expense rather than a forgotten one. Renders as a warning.
- **Unreviewed** — a row that arrived by inheritance and that nobody has looked at yet. Since everything inherits a plausible number, this, not Pending, is the real risk of a monthly review — so a Month reports how many rows remain unreviewed, and entry becomes a checklist that ends at zero.
- **Drift** — a Month opened ahead of time can be left behind when an earlier Month is corrected. Future Months report the difference from their Previous Month as a neutral diff, never as an error.
- **Forward Propagation** — carrying an edit into later Months that are *already* open, replacing values still Unreviewed and leaving deliberate edits alone. Months not yet opened need nothing; they inherit.

## 3. The Split Rule Idea

This is the feature worth being deliberate about:

- Each Expense picks its own splitting method and its own set of participants, rather than the household being locked into one approach.
- At minimum: **proportional to Spendable Income**, an **even split**, and a **custom split** — per-participant percentages or fixed amounts, whichever is more convenient for that case.
- Because each Month's row carries its own rule and participants, changing how an expense divides in August leaves July untouched. The snapshot model handles this without ceremony.
- Shares always sum to exactly the expense. Amounts are integer minor units, and remainder cents are distributed by largest remainder, so nobody systematically absorbs the rounding.
- Where proportional splitting is impossible because no participant has any Spendable Income, the expense divides evenly and says so.

## 4. Feature Roadmap

### MVP

- Set up a Household: currency, Roster, and the Month to start from
- Open any Month, past or future; discard one to undo an open
- Income recorded per Month, with restricted-use sources flagged
- Expenses per Month with Participants, Split Rule, and stable identity across Months
- Everything inherits from the Previous Month on open; One-Off rows do not
- Renaming an inherited expense asks whether it is the same expense or a different one
- Three split methods: even, proportional to Spendable Income, custom (percentages or fixed amounts)
- Forward propagation into already-opened Months, respecting deliberate edits
- Savings goals with optional target and start amount; contributions entered per member per Month
- A monthly dashboard: per-member income, Shares, contributions, and Leftover Balance
- Unreviewed and Pending both surfaced; Drift shown on future Months
- A per-viewer toggle for whether restricted-use income counts toward the Leftover Balance
- Month navigation and history browsing
- Export and import the whole Household as JSON
- Self-hosting deployment
- Public demo — fully functional, browser storage, no backend, seeded with a sample household

### V2

- Composite expenses (multiple variable sub-items rolling up into one total)
- Visual trends over time (income vs. expenses, spending by category, goal progress)
- Categories for expenses, income sources, and goals

## 5. Deployment Model

- The real app is **self-hosted** — it runs on the household's own hardware, for private use, with real data. It isn't meant to be publicly reachable from the internet, and it has no accounts, no logins and no permissions: everyone who can reach it can see and edit everything.
- The **public demo is a separate build**, not the same running instance: static, browser storage only, hosted for free. It exists to let people see and try the app before deciding whether to self-host, and exporting from it and importing into a deployment is the on-ramp.
- These two builds are the same application, differing only in the data layer. The domain runs in the browser in both; the self-hosted server only stores and returns rows.

## 6. Key User Flows (High Level)

1. **Set up** — choose a currency, add the Roster, and pick the Month to start from. That first Month opens empty, since nothing precedes it; enter income, expenses and goals once.
2. **Monthly entry** — open the Month. Everything arrives from the Previous Month, marked Unreviewed. Work down the list, correcting what changed and confirming what didn't, until nothing is unreviewed.
3. **Review** — see the dashboard: how expenses split out, each member's Leftover Balance, goal progress as of that Month.
4. **Adjust as needed** — change a split, add or remove participants, add an expense, mark one as One-Off to end it. Changes stay in their Month unless propagated forward.
5. **Look back** — browse past Months to compare. Every figure shown is that Month's own truth.
6. **Try before deploying** — open the demo, explore a sample household in the browser, and export it if you decide to self-host.
