# 13 — Chart 5: share of household spending per member

**What to build:** Each member's total Shares as a percentage band over time.

This is the only chart in the set that draws the **output of the Split Rule machinery** —
the thing that makes Prometheus not a generic budget tracker, and which nothing in the app
currently shows across Months. The dashboard shows how one Expense divided; this shows what
that added up to.

Per Month, each member's total across every Share they carry, as a proportion of the
Household's expense total. Viewer emphasised and first, as everywhere else in the view.

**The percentages must total exactly 100**, apportioned by largest remainder through
`apportion` in `domain/apportion.ts` — the function spec 0003 extracted for precisely this
kind of use. Every other total in this codebase is exact, and a band summing to 101 beside a
rail that never misses by a unit is not a rounding choice.

Two cases the chart has to handle rather than assume away:

- A Month whose expense total is **zero or has no entered amounts at all** has no
  proportions to show. Draw nothing for that Month rather than dividing by zero or splitting
  it evenly.
- A member who is in the Month but carries **no Shares** holds 0%. They should still appear
  in the legend, not silently vanish for that Month — a member bearing nothing is a fact
  about the Month, not an absence.

Membership changes across Months: a member added in March has no band before March, and one
deactivated in June keeps their bands up to June. The band is drawn per Month from that
Month's own members, which is what the snapshot model already guarantees.

**Blocked by:** 10

**Status:** done

**Suggested model:** Sonnet, medium thinking — one chart, with the exactness discipline and
the membership cases being where the work is.

- [x] Each member's total Shares per Month draws as a proportion of the Household's expense
      total
- [x] The proportions total exactly 100 in every Month, via `apportion`
- [x] The Viewer's band is emphasised and ordered first
- [x] A member in the Month with no Shares reads as 0% and still appears in the legend
- [x] A Month with an expense total of zero draws nothing rather than dividing by zero
- [x] A Month with no entered expense amounts at all draws nothing
- [x] A member added partway through the record has no band before their first Month
- [x] A member deactivated partway keeps their bands up to their last Month
- [x] Composite Expenses contribute through their Shares like any other Expense
- [x] The chart breaks across unopened Months and marks Pending Months, per ticket 10
- [x] Every figure comes from `domain/`
- [x] `npm run typecheck` is clean and the full suite passes
