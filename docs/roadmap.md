# Roadmap

Spec 0001 is the MVP, and it shipped as **v1.0**. This is the list of what comes after it —
not a set of tickets. Nothing here is `ready-for-agent`: every item below needs refining,
the way ticket work under `docs/specs/` is refined, before it becomes a spec an agent can
pick up. Triage it, give it acceptance criteria, and write it up under `docs/specs/` first.

**Status:** needs-triage — every item on this page

The grouping into v1.1, v1.2 and so on is a first guess at sequencing, not a commitment:
items are grouped by what they touch, roughly cheapest and most contained first. Move
things between versions freely as they get refined.

## v1.1 — UI only, no domain or schema change

- **Settings as modals.** Roster, Household file and Currency management move from cards
  that appear inline on the dashboard into modals, so opening one does not push the Month
  itself down the page.
- **Hide the Split Rule choice on a single-Participant Expense.** An Expense with one
  Participant has nothing to divide, so there is nothing to choose between — CONTEXT.md
  already says a single-Participant Expense is how an individual cost is recorded.
- **Filter the Expenses list by Participant** (and whatever else turns out to matter once
  this is refined).
- **The household's total Spendable Income, shown beneath the per-member figures** in the
  Income panel, with each member's share of it as a percentage.

## v1.2 — touches the domain and the row shape

A schema change here is paid twice per ADR-0008 — once in the SQLite migration, once in
the `localStorage` shape migration — so these cost more than v1.1's list even where the
UI change looks small.

- **One-Off, settable at creation.** Today marking an Expense or Income Snapshot One-Off
  is a second step after adding it; this lets it be set on the same form, so a one-time
  cost is one action instead of two. Changing it after creation stays an edit, as today, however,
  as it currently stands, after an income is marked as One Off, there's no way to un-mark it.
  This should also be addressed.
- **Payment methods on an Expense** — "Credit Card", "Pix", and so on. Informational only:
  Prometheus stays a share calculator, and a payment method is not who paid or whether
  they did. Worth being deliberate that this does not become the payment tracking the
  spec rules out.

## v1.3 — needs a design decision before it can be estimated

- **Reordering Expenses, Income sources and Savings Goals.** Before this is a ticket,
  something has to decide how order is stored and persisted, and square that with
  ADR-0008's row-scoped, last-write-wins writes — a reorder touches many rows at once, and
  what "last write wins" means for that has no answer yet.

## V2 is unchanged

None of the above is V2. V2 is still what `prometheus-system-plan.md` §4 and spec 0001's
*Out of Scope* already name: composite expenses (the main one), savings projections,
visual trends over time, and categories as first-class entities. This page is the smaller
work between v1.0 and V2, not a replacement for it.
