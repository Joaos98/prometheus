# 02 — Lines in Drift and Forward Propagation

**What to build:** A composite that differs from its Previous Month reports as one changed
row, and a corrected composite propagates forward like any other.

In `domain/drift.ts`:

- `DriftField` gains `'lines'`. The union is opt-in and `expenseFields` lists what it
  checks, so this is one member and one comparison.
- Two line lists agree when they hold the same ids in the same order with the same names
  and the same amounts. Match by id — that is what line identity is for — so a renamed line
  reads as a changed line rather than as a delete plus an add.
- **Refreshing takes the whole line list**, as refreshing already takes a whole row.
  `refreshFromPreviousMonth` needs no per-line entry point, and `RowDrift.id` continues to
  identify a row of a Month.

In `domain/propagation.ts`: a corrected composite carries its lines into later Months that
are still Unreviewed there, and leaves alone any a member has touched — the existing rule,
with `lines` now among the fields it carries.

Two things this ticket must **not** do. It must not report each line as its own difference:
a per-line refresh would have no per-line `reviewed` mark to respect, which is the rule
ADR-0011 built Drift on. And it must not exclude lines from comparison: a composite whose
figures were all corrected in an earlier Month would then report nothing, which is the exact
failure Drift exists to make visible.

**Blocked by:** 01

**Status:** done

**Suggested model:** Sonnet, medium thinking — a field added to an opt-in union and a list
comparison, with the care going into the id-matching and the refresh path.

- [x] `DriftField` includes `'lines'`
- [x] A composite whose line amounts differ from a fresh open reports `changed` with `lines`
      among its fields
- [x] A composite whose lines were renamed, added to or removed from reports the same way —
      one row, one difference
- [x] A composite that agrees with a fresh open reports nothing
- [x] A composite that is Reviewed in the future Month reports nothing, whatever its lines
      say — the existing rule, unchanged
- [x] Refreshing takes the whole inherited line list, ids intact, and leaves the row
      Unreviewed as every refresh does
- [x] Refreshing a composite through the existing `refreshFromPreviousMonth` signature works
      with no per-line argument
- [x] A refreshed composite's amount is the sum of the lines it took
- [x] Forward Propagation carries a corrected composite's lines into later Unreviewed Months
      and skips Months where the row has been answered for
- [x] A simple Expense that became composite, and a composite that became simple, both drift
      and propagate correctly across the change
- [x] `npm run typecheck` is clean and the full suite passes

`refreshFromPreviousMonth` needed no new code: `inheritExpense` (ticket 01) already copies a
composite's lines wholesale, each keeping its id, and `landed`/`rowForMembers` already route
through it — so refresh carrying "the whole line list" was already true before this ticket
touched anything. This ticket added the comparison (`sameLines`/`sameLine`, matched by id) and
the `'lines'` member to `DriftField`.

Forward Propagation needed a new path: `ExpenseEdits` (ticket 01) deliberately excludes
`lines`, so `editExpenseSnapshot` can't carry a corrected line list. Added `LineCarry` and
`carryLines` in `domain/expenses.ts` — used only by the new `propagateExpenseLines`, never by
the member-facing edit surface — and it carries `amount` alongside `lines` so a composite
that lost its last line still hands the typed total forward, not just the line list.

`ui/drift.ts`'s `DriftField`-exhaustive switch/map gained a `'lines'` case so the build stayed
green; full composite rendering in the Drift panel is dashboard territory (ticket 04).

Checked with `npm run typecheck` (clean) and `npx vitest run` (694 tests passing, up from
670).
