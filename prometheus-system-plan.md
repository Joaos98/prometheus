# Prometheus

### Household Finance Tracker — System Plan

## 1. Overview

A webapp for a household — two partners, a group of roommates, or any small group sharing finances — to replace a spreadsheet-based system for tracking income, shared and individual expenses, and savings goals. Each month rolls up into a clear "leftover balance" per person.

The core idea that sets this apart from a generic budget tracker: **how a shared expense (or shared savings goal) gets divided is a decision the system should support flexibly**, not a fixed assumption. Different households split things different ways — proportional to income, evenly, or something custom — and the split (and even who's included in it) can vary case by case.

This document is a high-level starting point: what the system should do and why, not how it's built. Data structures, schemas, and technical architecture are left for the implementation phase.

---

## 2. Core Concepts

- **Household** — the shared space containing everyone's data. Can be two people or a larger group. There's no fixed or maximum member count baked into the design.
- **Members** — the individual people in the household.
- **Income** — what each member brings in each month. A member can have more than one income source. Income is treated as **persistent by default**: once set, it carries forward unchanged month to month until the member explicitly updates it — no need to re-enter the same salary every month.
- **Expenses** — recurring costs, either shared or belonging to one member individually.
- **Participants** — for a shared expense, the subset of household members actually involved in it. Not every shared cost necessarily involves every member. This is distinct from the split method itself.
- **Split** — the rule that decides how a shared expense (or a shared savings goal's contributions) is divided *among its participants*. Needs to support at least: proportional to income, evenly, and a custom split (e.g. fixed amounts or percentages per participant — useful when one person can realistically contribute more than another).
- **Composite expenses** — some shared costs (like rent) aren't a single number — they're made up of several variable pieces each month (rent, condo fee, utilities, one-off charges) that need to be totaled before they can be split.
- **Restricted-use income** — some income (like a meal-voucher-style benefit) can only be spent on certain things. A member flags an income *source* as restricted-use once, at setup; this flag (and whether it counts toward the "leftover balance" or is excluded/shown separately) is a property of the source itself, not something reconsidered each month.
- **Savings goals** — named targets that money gets set aside for. A goal can belong to one member or be shared by a subset of members. Shared goals follow the same split-logic idea as expenses — e.g. one person might comfortably contribute more than another toward the same goal, rather than assuming an even split.
- **Currency** — set once per household at setup. All income, expenses, and goals are assumed to be in that single currency; multi-currency support (and the exchange-rate/conversion complexity it implies) is explicitly out of scope for now.
- **Monthly summary** — the rollup for a given month: income in, expenses out (shared share + individual), savings set aside, and what's left over — per member.

---

## 3. The Split Rule Idea

This is the feature worth being deliberate about, even at a conceptual level:

- The same underlying idea — "divide an amount among a chosen set of people, by a chosen method" — applies to both **shared expenses** and **shared savings goal contributions**. It's worth designing as one reusable concept rather than two separate ones.
- Each shared expense (or shared goal) should be able to pick its own splitting method and its own set of participants, rather than the whole household being locked into one approach.
- At minimum: **proportional to income**, **even split**, and a **custom split** should all be selectable. For a custom split, the user can enter either a fixed amount or a percentage per participant — whichever is more convenient for that case.
- Because income can change month to month (until a member updates it, it stays fixed), a proportional split is stable in practice — it only shifts when someone actually changes their income, not arbitrarily month to month.
- Past months' actual splits should stay stable and reviewable even if the rule, the participants, or the underlying numbers change later — history shouldn't silently rewrite itself.

---

## 4. Composite Expenses — The Idea

Some expenses aren't one flat number:
- They're made of several sub-costs that vary month to month (some may not even appear every month, like a one-off fee).
- The individual pieces need to be totaled first, and only then does the "how do we split this, and among whom" logic apply.
- This pattern isn't unique to rent — it's a general shape ("a total made of several variable parts") that's likely to show up for other costs too, so it's worth treating as a reusable idea rather than a one-off special case.

---

## 5. Feature Roadmap

### MVP
- Set up a household with any number of members
- Set a household currency at setup
- Record income per member, persisting month to month until manually changed; support flagging an income source as restricted-use
- Define shared and individual recurring expenses; for shared ones, choose participants and a split method (proportional, even, or custom)
- Enter simple monthly expense amounts
- Set up savings goals (individual, or shared among a chosen subset of members) with their own split method for contributions
- A monthly dashboard showing each member's income, expense share, savings, and leftover balance — with a toggle for whether restricted-use income counts toward that balance
- Ability to look back at past months

### V2
- Support for composite expenses (multiple variable sub-items rolling up into one total, then split)
- Comparing expected vs. actual amounts for variable expenses
- Simple projections for savings goals (e.g. estimated time to reach a target based on recent contributions)
- Visual trends over time (income vs. expenses, spending by category, goal progress)
- A faster way to start a new month by carrying over recurring items from the last one

### Stretch
- Broader net worth view (beyond just savings — assets and debts)
- Flagging unusual months (an expense noticeably higher than its recent average)
- A "what-if" tool for reallocating savings contributions between goals
- Exporting a report (CSV or PDF), or an annual summary
- Reminders for upcoming bills
- A public demo, separate from the real self-hosted app: pre-loaded with fake household data, for showing the project off as a portfolio piece. This should be **serverless** — no backend or database of its own — so it can be hosted for free indefinitely. This implies one architectural principle worth following from the start: the app's data access should sit behind a single internal layer rather than being called directly from the UI, so a "real" version (talking to an actual backend) and a "demo" version (reading/writing mock data locally, nothing persisted) can share the same interface and be swapped at build time without touching the rest of the app.

---

## 6. Deployment Model

- The real app is **self-hosted** — it runs on the household's own hardware, for private use, with real data. It isn't meant to be publicly reachable from the internet.
- The **public demo is a separate build**, not the same running instance: static, serverless, fake data only, hosted for free. It exists purely to let people see and try the app before deciding whether to self-host it themselves.
- These two builds share the same codebase and UI, differing only in the data layer (see the note under Stretch above).

---

## 7. Key User Flows (High Level)

1. **Set up** — add household members, set the household currency, add income sources (flagging restricted-use ones), recurring expenses (choosing participants and a split method for shared ones), and savings goals (with a split method for shared ones).
2. **Monthly entry** — each month, confirm or update income (only if it changed), log actual expenses, and log savings contributions.
3. **Review** — see the dashboard: how shared expenses and goal contributions split out, and each member's leftover balance.
4. **Adjust as needed** — change a split method, participants, or add/retire an expense or goal as circumstances change.
5. **Look back** — browse past months to see trends and compare.