# 01 — The One-Off mark becomes two-way, and settable at creation

**What to build:** The engine gains the ability to clear the One-Off mark and to set it as
a row is recorded. Both are additions to existing functions; nothing new is stored.

Three changes, in `domain/income.ts`, `domain/expenses.ts` and `domain/goals.ts`:

- `markIncomeOneOff`, `markExpenseOneOff` and `markGoalOneOff` become
  `setIncomeOneOff`, `setExpenseOneOff` and `setGoalOneOff`, each taking a fourth
  argument `oneOff: boolean` and writing it to the row. Every existing call site passes
  `true`. Re-export from `domain/index.ts` under the new names.
- `IncomeDraft`, `ExpenseDraft` and `GoalDraft` gain `oneOff?: boolean`, defaulting to
  `false`, which `addIncomeSnapshot`, `addExpenseSnapshot` and `addSavingsGoal` write to
  the row in place of the current hard-coded `oneOff: false`.
- `ui/household.ts`'s `markIncomeAsOneOff`, `markExpenseAsOneOff` and `markGoalAsOneOff`
  wrappers follow, taking and forwarding the boolean. Their call sites in
  `IncomePanel.vue`, `ExpensesPanel.vue` and `GoalsPanel.vue` — including the
  `EndingQuestion` flow, which marks a row in the *Previous* Month after one is removed
  here — pass `true` and are otherwise untouched. The UI's own changes are ticket 02.

**`reviewed` is left exactly as found, in both directions.** This is the whole reason the
mark does not go through `editXSnapshot`, which always sets `reviewed: true`. The existing
doc comments already argue it for marking: saying a row should not be carried into the next
Month is not saying anybody has checked its figures. Clearing a mark is the same statement
withdrawn, and confirms nothing either. Carry that reasoning into the renamed functions'
comments rather than dropping it.

Note what the two-way setter does **not** make possible: a row added with `oneOff: true`
still has a freshly minted identity, so `appearedBefore` reads `false` for it and it is a
One-Off, never an Ends Here. Inheritance is untouched — `kept()` in
`domain/inheritance.ts` already filters on the flag's value, and a cleared flag simply
means the row is inherited again.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, low thinking — a mechanical widening of three symmetrical
functions plus their drafts, with the care going into the doc comments and the tests.

- [x] `setIncomeOneOff`, `setExpenseOneOff` and `setGoalOneOff` take an `oneOff: boolean`
      and write it, replacing the three one-way `markXOneOff` functions
- [x] All three are exported from `domain/index.ts`; no `markXOneOff` symbol remains
      anywhere in `domain/`, `ui/`, `demo/` or `storage/`
- [x] Setting `oneOff` to `true` or to `false` leaves the row's `reviewed` value unchanged,
      covered by a test in each of the three row kinds
- [x] Setting it on a row that is already in that state succeeds and changes nothing else
- [x] `IncomeDraft`, `ExpenseDraft` and `GoalDraft` accept `oneOff`, defaulting to `false`
      when absent, so every existing caller behaves as it did
- [x] A row added with `oneOff: true` is not inherited when the next Month is opened
- [x] A row whose mark is cleared *is* inherited when the next Month is opened, and arrives
      Unreviewed with `oneOff: false` like any other inherited row
- [x] A row added with `oneOff: true` reads as One-Off rather than Ends Here —
      `appearedBefore` is `false` for it
- [x] The `EndingQuestion` flow still marks the Previous Month's row when a row with a past
      is removed
- [x] The full test suite passes, including `demo/seed.test.ts` and the storage port
      contract

## Comments

Built as planned: `markIncomeOneOff`, `markExpenseOneOff` and `markGoalOneOff` became
`setIncomeOneOff`, `setExpenseOneOff` and `setGoalOneOff`, each taking a fourth `oneOff:
boolean` argument and writing it, with `reviewed` left untouched in both directions per the
existing doc-comment reasoning (extended to cover clearing). `IncomeDraft`, `ExpenseDraft`
and `GoalDraft` gained an optional `oneOff`, defaulting to `false`. `ui/household.ts`'s three
wrappers took and forwarded the boolean; every call site across the three panels — the flag
click and the `EndingQuestion` flow — was updated to pass `true`, since ticket 02 owns
turning the flag into a genuine toggle and adding the add-form checkbox.

Every domain test file that called a `markXOneOff` function was updated to the new name and
signature. Added new coverage per row kind: clearing the mark, setting on a row already in
that state, `reviewed` untouched across both directions, a row drafted `oneOff: true` being
excluded from the next Month's inheritance, and (for Expenses) a cleared mark being inherited
again, Unreviewed. `domain/ending.test.ts` gained a case confirming a row marked `oneOff` at
creation still reads as One-Off rather than Ends Here (`appearedBefore` is `false`).

Checked with `npm run typecheck` (clean) and `npx vitest run` (606 tests passing, up from
597), including `demo/seed.test.ts` and the storage port contract tests unchanged.
