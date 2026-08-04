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

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — chart 6's edge cases are where this goes wrong:
gaps, first Months, and categories appearing or disappearing.

- [ ] Chart 2 draws spending per category per Month, stacked
- [ ] Uncategorised rows group under their own heading, which cannot be renamed or deleted
- [ ] A category's colour is stable across the record and survives a rename
- [ ] A chart spanning a rename shows one series, not two
- [ ] A composite contributes its derived total under its parent's category
- [ ] A Month with every row uncategorised draws entirely under the Uncategorised heading
- [ ] Chart 6 draws the change by category against the Previous Month, for the Month selected
      on the dashboard
- [ ] Navigating to another Month moves chart 6
- [ ] The Month being compared against is named, and is the Previous *opened* Month
- [ ] A category present in only one of the two Months reads as a change from or to nothing
- [ ] A Month with no Previous Month says so rather than drawing an empty chart
- [ ] Rises and falls are distinguishable without relying on colour alone
- [ ] Both charts read their figures from `domain/`
- [ ] `npm run typecheck` is clean and the full suite passes
