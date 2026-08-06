# 11 — Charts 1, 3 and 4: income vs expenses, goal progress, Leftover Balance

**What to build:** The three charts that need no category, on ticket 10's axis.

**Chart 1 — income vs expenses over time.** Household totals per Month. Income is drawn as
**one stacked series**: Spendable Income with Restricted-Use Income stacked above it, so the
full height is total Income and the band is what is actually spendable. The difference
between them is the whole point of the distinction and should be readable at a glance
without comparing two panels.

This is why the view has no Restricted-Use toggle. The toggle exists because the Leftover
Balance is one number and a number shows one value; a chart has room for both. CONTEXT.md's
confinement of the toggle to "this figure alone" stands.

**Chart 3 — goal progress.** Accumulated Progress against target per goal, as of each Month
— which is the figure `domain/progress.ts` already computes, and it is the Month's own
progress, never today's. A goal with no target has no line to measure against; draw the
progress and omit the target rather than inventing one.

**Chart 4 — Leftover Balance per member over time.** The app's headline number. It charts on
**Spendable Income**, which CONTEXT.md calls its default basis. Viewer emphasised and first.
It may be negative, so the scale has to cross zero and say so.

Every figure comes from the engine. No chart recomputes money in a Vue component: if a total
is not already exposed, expose it from `domain/` and test it there.

**Blocked by:** 10

**Status:** done

**Suggested model:** Sonnet, medium thinking — three charts on an axis that already exists,
with the care going into where the numbers come from.

- [x] Chart 1 draws household income and expense totals per Month
- [x] Income is stacked Spendable / Restricted-Use, full height being total Income
- [x] No part of chart 1 reads the Restricted-Use toggle
- [x] Chart 3 draws each goal's Accumulated Progress as of each Month, never as of today
- [x] A goal with no target draws its progress with no target line
- [x] A goal that ended still shows the Months it ran for
- [x] Chart 4 draws each member's Leftover Balance, on Spendable Income
- [x] Chart 4's scale accommodates negative values and marks zero
- [x] The Viewer's series is emphasised and first in chart 4
- [x] Every figure drawn comes from `domain/`; no money arithmetic happens in a component
- [x] All three break across unopened Months and mark Pending Months, per ticket 10
- [x] `npm run typecheck` is clean and the full suite passes
