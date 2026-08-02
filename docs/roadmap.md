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

## v1.2 — touches the domain, not the stored shape

This changes what the engine offers and what a form can set, but stores nothing new: the
mark it is about is already on every row. Dearer than v1.1, which is UI alone, and short
of a migration.

- **One-Off and Ends Here: settable at creation, and clearable.** Marking a row so that
  the next Month opened does not inherit it is a second step after adding it; this lets it
  be set on the same form, so a one-time cost is one action instead of two. The other half
  is that it cannot be taken back off — a row marked by mistake stays marked, and nothing
  clears it. One mark carries both readings, so whatever clears it clears either.

## v1.3 — needs a design decision before it can be estimated

- **Reordering Expenses, Income sources and Savings Goals.** Before this is a ticket,
  something has to decide how order is stored and persisted, and square that with
  ADR-0008's row-scoped, last-write-wins writes — a reorder touches many rows at once, and
  what "last write wins" means for that has no answer yet. It is also the only item short
  of V2 that stores something new, so it is paid twice per ADR-0008: once in the SQLite
  migration, once in the `localStorage` shape.

## V2

V2 is what `prometheus-system-plan.md` §4 and spec 0001's *Out of Scope* already name —
composite expenses (the main one), savings projections, visual trends over time, and
categories as first-class entities — together with the item below. Nothing above is V2:
this page is the smaller work between v1.0 and V2, not a replacement for it.

- **Payment methods on an Expense** — "Credit Card", "Pix", and so on. Informational only:
  Prometheus stays a share calculator, and a payment method is not who paid or whether
  they did. Worth being deliberate that this does not become the payment tracking the
  spec rules out.
