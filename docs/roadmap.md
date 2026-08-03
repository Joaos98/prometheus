# Roadmap

Spec 0001 is the MVP, and it shipped as **v1.0**; spec 0002 is the first five items below,
and it shipped as **v1.1**; spec 0003 is the v1.2 block, refined and waiting to be built.
This is the list of what comes after v1.0 — not a set of tickets. Except where an item
names a spec, nothing here is `ready-for-agent`: it still has to be written up under
`docs/specs/`, with acceptance criteria, before an agent can pick it up.

**Status:** needs-triage — every item on this page that has not been promoted to a spec.
The v1.1 block is kept for the record: it is `done`, not work waiting. So is the v1.2
block, which is `ready-for-agent` as spec 0003 and includes one item refinement rejected.

The grouping into v1.1, v1.2 and so on is a first guess at sequencing, not a commitment:
items are grouped by what they touch, roughly cheapest and most contained first. Move
things between versions freely as they get refined.

## v1.1 — UI only, no domain or schema change — **shipped**

**Built as [spec 0002](specs/0002-v1-1-dashboard-refinements/spec.md), `done`, all five
tickets `done`.** The design questions behind each item were put to the maintainer and
answered; the spec records the decisions and what was rejected, and each ticket's comments
record what was built and how it was checked. In brief:

- **Settings as modals** — Roster, Household file, Currency and Demo, one modal per
  masthead button, so opening one no longer pushes the Month down the page.
- **Hide the Split Rule choice on a single-Participant Expense**, and store Even for it.
  The row reads `Individual expense · 1 Participant`.
- **Filter the Expenses list by Participant** — its own picker, persisted per device,
  never moving on its own.
- **Centre the "not opened" card** in a Month nobody has opened, on both axes.
- **Remove the "Viewer: nobody" option**, which never described a screen the rail was
  already leading with somebody on.

## v1.2 — touches the domain, not the stored shape

This changes what the engine offers and what a form can set, but stores nothing new.
Dearer than v1.1, which is UI alone, and short of a migration.

**Promoted to [spec 0003](specs/0003-v1-2-one-off-marks-and-income-totals/spec.md),
`ready-for-agent`, four tickets** — two items, not the three below: the third was rejected
during refinement and is kept here with its reasoning. The spec records what was decided
and what was declined.

- **One-Off and Ends Here: settable at creation, and clearable.** Marking a row so that
  the next Month opened does not inherit it is a second step after adding it; this lets it
  be set on the same form, so a one-time cost is one action instead of two. The other half
  is that it cannot be taken back off — a row marked by mistake stays marked, and nothing
  clears it. One mark carries both readings, so whatever clears it clears either. The mark
  itself is already on every row, which is why this stores nothing new. (Refined: at
  creation the mark can only ever read One-Off, since a row being added has a minted
  identity and so has no Previous Month to have ended a run in.)
- ~~**Open an empty Month instead of copying the Previous Month.**~~ **Rejected.** A future
  Month opened empty reports every row of the Previous Month as Drift `missing`, so the
  rail offers to refresh them in one at a time — the empty open undone by the feature next
  to it. Suppressing that means storing that the Month was opened empty, which is the one
  thing this item exists not to do, and which ADR-0008 prices twice: once in the SQLite
  migration, once in the `localStorage` shape. Restricting it to Months that are not in the
  future would dodge Drift for nothing stored, but by then both cases it named are already
  served: a Household's very first Month opens empty already (`firstMonth` in
  `domain/month.ts`), and a clean slate is removing the rows, whose absence every later
  Month inherits. What was on offer was a shortcut, not a capability. CONTEXT.md's
  definition of **Opening a Month** therefore stands unamended.
- **The household's total Spendable Income, shown beneath the per-member figures** in the
  Income panel, with each member's share of it as a percentage sitting beside their own
  figure in their section header. It is in v1.2 rather than v1.1 because the percentages
  are apportioned by largest remainder to total exactly 100, which is the engine's
  discipline and belongs in the engine: every other total in this codebase is exact, and
  a panel reading 101% beside a rail that never misses by a unit is not a rounding
  choice, it is a different codebase. The figure is Spendable Income and does not follow
  the rail's Restricted-Use toggle, which CONTEXT.md settles. A Pending row counts as
  nothing, so the total understates while any income is Pending and says so the way the
  rail already does; with no Spendable Income at all there are no percentages to show.

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
