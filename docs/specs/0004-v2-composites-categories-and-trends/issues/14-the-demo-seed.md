# 14 — The demo seed

**What to build:** `demo/seed.ts` grows to exercise everything this spec added. It runs in
CI as a test (`demo/seed.test.ts`) and drives the domain as a member would — through the
public operations, never by constructing rows directly. That is what makes it a test rather
than a fixture, and it is why it goes last: it drives a finished engine.

It gains:

- **A categories list and a payment methods list**, with the Household's Expenses using
  them, and at least one Expense left uncategorised so the Uncategorised heading in chart 2
  has something under it.
- **At least one composite Expense** with several lines whose amounts differ month to month —
  the case the feature exists for. Include a Month where one line is Pending, so the derived
  `null` is exercised end to end rather than only in a unit test.
- **Enough Months of history** for six charts to have something to say: several members with
  different incomes, at least one goal with a target and one without, and Restricted-Use
  income on somebody so chart 1's stack is visible.
- **One unopened Month in the middle of the record**, so the broken axis is exercised by the
  seed rather than only by a unit test. This is the one seeded fact whose only purpose is a
  chart, and it is worth it: the gap rule is the trends decision most likely to regress
  silently.

What it should **not** do, following spec 0003's reasoning: it should not seed a sequence no
member would perform. Do not seed a category deletion or a clear — that is a destructive
operation tested directly in ticket 06, and driving it through the seed would test the engine
through the wrong door and leave the demo's own data mid-cleanup. Do not seed a conversion
between simple and composite for its own sake either; if one falls out of the story naturally,
keep it.

The demo is a static build people open before deciding whether to self-host, so the seeded
Household should read like a plausible one — the charts are now the first thing worth looking
at in it.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13

**Status:** done

**Suggested model:** Sonnet, medium thinking — no new decisions, but the seed has to drive
public operations only and stay readable as a story.

- [x] The seed builds its Household through public domain operations, with no row constructed
      by hand
- [x] It seeds a categories list and a payment methods list, both in use
- [x] At least one Expense is left uncategorised
- [x] It seeds at least one composite with several lines, whose amounts differ across Months
- [x] One seeded composite has a Pending line in one Month, and reads as Pending there
- [x] It seeds enough Months for every chart to draw a trend rather than a point
- [x] One Month in the middle of the record is left unopened, and the axis breaks there
- [x] Somebody has Restricted-Use income, so chart 1's stack is visible
- [x] There is a goal with a target and a goal without
- [x] No category or payment method deletion is seeded
- [x] `demo/seed.test.ts` passes, and the seeded Household exports and re-imports cleanly
- [x] `npm run build:demo` succeeds and the seeded demo renders every chart
- [x] `npm run typecheck` is clean and the full suite passes
