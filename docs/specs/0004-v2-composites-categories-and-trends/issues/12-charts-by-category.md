# 12 — Charts 2 and 6: spending by category, and what moved

**What to build:** The two charts that group by category. These are the reason the category
vocabulary is stored rather than derived, so they are the ones that prove ADR-0012 paid off.

**Chart 2 — spending by category over time.** Stacked, on ticket 10's axis. Rows with no
category group under an **Uncategorised** heading which is not a category and cannot be
renamed or deleted — the model's `null`, rendered.

Colour is per category and stable across the record, so a rename does not change a colour and
a chart spanning a rename shows **one series, not two**. That is the behaviour ADR-0012's
retroactive rename exists to buy; assert it.

A composite Expense contributes its **derived total under the parent's category**. A Line has
no category of its own, so a composite is one row here exactly as it is in the review model.

**Chart 6 — month-over-month change by category.** A diverging bar of what rose and what
fell against the Previous Month, for the **Month currently selected on the dashboard** —
navigating Months moves it. Not a time series: no shared axis, no gaps to break.

The comparison is against the **Previous Month** as the domain defines it — the most recent
*opened* Month, which need not be the preceding calendar one. Say which Month is being
compared against, since after a gap it will not be the obvious one.

A category present in one Month and absent in the other is a change from or to nothing, not
an omission. With no Previous Month at all, the chart has nothing to say and should say that
rather than drawing an empty frame.

**Blocked by:** 08, 10

**Status:** done

**Suggested model:** Opus, medium thinking — chart 6's edge cases are where this goes wrong:
gaps, first Months, and categories appearing or disappearing.

- [x] Chart 2 draws spending per category per Month, stacked
- [x] Uncategorised rows group under their own heading, which cannot be renamed or deleted
- [x] A category's colour is stable across the record and survives a rename
- [x] A chart spanning a rename shows one series, not two
- [x] A composite contributes its derived total under its parent's category
- [x] A Month with every row uncategorised draws entirely under the Uncategorised heading
- [x] Chart 6 draws the change by category against the Previous Month, for the Month selected
      on the dashboard
- [x] Navigating to another Month moves chart 6
- [x] The Month being compared against is named, and is the Previous *opened* Month
- [x] A category present in only one of the two Months reads as a change from or to nothing
- [x] A Month with no Previous Month says so rather than drawing an empty chart
- [x] Rises and falls are distinguishable without relying on colour alone
- [x] Both charts read their figures from `domain/`
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

Two charts, and one new engine module behind both: `domain/spending.ts` totals a Month's
Expenses by category and reports what moved against the Previous Month. It sits apart from
`domain/categories.ts`, which labels rows and computes with no amount at all. A composite
needed nothing of its own — `amount` already is the derived total, and no code here reads
`lines`.

Three decisions worth naming:

- **Colour is a category's place in the vocabulary**, not its place in a chart. Indexing the
  drawn subset would have let chart 2 and chart 6 disagree about the same category; the
  vocabulary's order is what a rename leaves alone, so it is what a colour hangs off.
  `--category-1…8` are new tokens, and the first the app has spent beyond its two accents.
  None of them is `--fire`, `--fire-bright` or `--ice`: all three already mean something,
  and the last is what the chart directly above draws Spendable Income in.
- **A category nothing was spent under in an opened Month is zero, not a gap.** These layers
  are stacked, so a gap in a lower one would take every layer above it — and it would be
  saying the wrong thing anyway. Only a Month nobody opened is unknown. `TrendSeries`'
  doc comment said otherwise and has been corrected.
- **A category that did not move is dropped from chart 6 by the view, not by the engine.**
  Two Months holding the same figure is something the engine knows; a bar of no length is
  not a way to say it.

Chart 6 reads `viewing` from the dashboard, which is why `App.vue` now passes it in. It is
not held to the shared axis — a Month ahead of the calendar is left out of a time series and
is still a Month a member can be standing in. `ui/components/ChangeChart.vue` draws it: a
diverging bar with rises right of zero and falls left, each figure signed, so direction and
sign both say which way it went before colour is reached. It has no band to hatch the way
the charts on the axis mark an incomplete Month, so the view names in words whichever of
the two Months holds Pending rows — the spec's rule is that the Month says so, and a
comparison drawn from part of one side's rows has to say which side.

The placeholder chart ticket 11 left behind is gone. Checked against the demo in the browser
across all four states — a Month that moved, the earliest Month, an unopened Month, and
navigating between Months.
