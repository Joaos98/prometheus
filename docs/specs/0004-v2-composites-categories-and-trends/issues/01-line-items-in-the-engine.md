# 01 — Line Items in the engine

**What to build:** The domain half of composite expenses. An `ExpenseSnapshot` may hold
Line Items; its amount becomes derived when it does. No storage, no UI, no Drift — those
are tickets 02, 03 and 04.

In `domain/types.ts`:

- `LineItem` — `{ id: RowId; name: string; amount: Minor | null }`. Nothing else: no
  Participants, no Split Rule, no category, no `reviewed`, no `oneOff`. ADR-0013 records
  why, and the doc comment should carry that reasoning rather than restate the shape.
- `ExpenseSnapshot` gains `lines: LineItem[]`. Empty means simple.

In `domain/expenses.ts`:

- A composite's amount is **computed, never stored as a typed figure**. Whatever
  representation you choose for the stored `amount` of a composite, the invariant is that
  the two can never disagree — the union was rejected in favour of enforcing this by
  construction (spec, *`lines` is a field on `ExpenseSnapshot`*).
- The derived amount is `null` when there are no lines, or when **any** line's amount is
  `null`; otherwise the sum. A null line is not zero.
- Add, edit and remove operations for lines. Each one goes through
  `requireConsistentRule` (`domain/split-rules.ts`) with the amount the Expense **would**
  have, exactly as `editExpenseSnapshot` already does — a line edit moves the total, and a
  `fixed` rule is only valid against a specific one.
- **Transitions preserve the figure.** Adding a first line to an Expense with a typed
  amount turns that amount into the first line, named after the Expense. Deleting the last
  line hands the running total back as the typed amount. A `fixed` rule survives both,
  because the total is unchanged across them.

`domain/index.ts` re-exports the new operations and the `LineItem` type.

Note what is deliberately **not** here: no per-line `reviewed`, no per-line `oneOff`, and no
Repurposing prompt on a line rename. A composite is one row in the review model. Ticket 04
owns the dashboard's expansion; ticket 02 owns Drift.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Opus, high thinking — the derived amount, the null propagation and the
joint rule validation are three invariants that interact, and two of them are the items spec
0001 named as its riskiest.

- [x] `LineItem` carries an id, a name and `Minor | null`, and nothing else
- [x] `ExpenseSnapshot.lines` exists and defaults to `[]` for every existing construction path
- [x] A composite's amount is the sum of its lines, and no path can store a typed amount that
      disagrees with that sum
- [x] A composite with no lines is Pending
- [x] A composite with any line whose amount is `null` is Pending — not a sum treating that
      line as zero
- [x] A composite whose lines are all `0` has an amount of `0` and is **not** Pending
- [x] Adding, editing or removing a line revalidates the Split Rule against the resulting
      amount, and is refused where a `fixed` rule would no longer total
- [x] Adding a line to a composite with a `fixed` rule succeeds when the rule is supplied
      alongside and still totals to the new sum
- [x] Adding a first line to an Expense with a typed amount produces one line carrying that
      amount, named after the Expense, and leaves a `fixed` rule valid
- [x] Deleting the last line of a composite leaves a simple Expense whose typed amount is the
      former sum, and leaves a `fixed` rule valid
- [x] Deleting the last line of a composite whose sum was `null` leaves a Pending Expense
- [x] Line ids are minted through `domain/identity.ts` and are unique within an Expense
- [x] Renaming a line changes nothing but the name — no Repurposing question, no identity
      minted
- [x] Editing a line leaves the Expense's `reviewed` and `oneOff` untouched by the line
      operation itself
- [x] Inheriting a composite into a newly opened Month carries every line, ids intact
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

Four operations rather than three. The transition and the addition were split:
`itemiseExpense` turns a typed amount into one line named after the Expense and moves no
money, and `addLineItem` takes a drafted line, itemising first when the Expense is still
simple so the recorded figure survives as a line of its own. They were one function behind
an optional draft at first, which made a call's meaning depend on its arity and gave the two
branches disjoint preconditions — the checklist item above wants exactly one line out of the
transition, and that is `itemiseExpense`. `editLineItem` and `removeLineItem` complete the
set. All four share one private `changeLines`, and all four take an optional `splitRule`,
because every one of them can move the total and a `fixed` rule only totals to one amount.

The derived amount lives in `consistent()`, which now also has `editExpenseSnapshot`,
`confirmExpenseSnapshot` and `setExpenseOneOff` routed through it via a new `writeExpense`.
Before that, three writers built the row and landed it in the Month by hand, and the
invariant held only because each happened to copy `amount` and `lines` together — safe, but
on convention rather than on the chokepoint the ADR nominated, and tickets 05 and 09 add
fields to this same row. `editExpenseSnapshot` now refuses a named `amount` on a composite
outright rather than silently recomputing over it; Forward Propagation gets that for free as
a `refused` skip carrying the message.

**One reading worth flagging.** *"Editing a line leaves the Expense's `reviewed` and
`oneOff` untouched by the line operation itself"* was read as "no per-line marks, and no
reaching into the parent's marks as a side effect of line-ness". `oneOff` is left exactly as
found. `reviewed` is **cleared**, as every edit in this module does — a line edit changes
what the Expense cost, ADR-0013 says reviewing a composite *is* reading its lines, and
`propagation.ts` already states the rule as "a member typing a figure has reviewed it". The
alternative reading would leave an inherited composite Unreviewed after a member corrected
one of its figures, and force a separate confirm. Tested both ways round in
`domain/expenses.test.ts`.

`inheritExpense` copies lines per-line rather than sharing the array, keeping the module's
"every copy is deep" promise. `isComposite` went to `domain/rows.ts` beside `isPending` and
`isOneOff`; `totalOfLines` is exported for ticket 03, which needs it to recompute an
imported composite's amount.

`domain/transfer.ts` gets `lines: []` and a comment saying so. Export already serialises
lines through `JSON.stringify`, so **an export taken now and read back loses what a composite
was made of** until ticket 03 lands — deliberate, and marked in the file rather than left to
look like an oversight.

Checked with `npm run typecheck` (clean) and `npx vitest run` (670 tests passing, up from
645), including `demo/seed.test.ts` and the storage port contract tests.
