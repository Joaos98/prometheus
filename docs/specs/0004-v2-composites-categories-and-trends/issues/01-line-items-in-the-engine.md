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

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — the derived amount, the null propagation and the
joint rule validation are three invariants that interact, and two of them are the items spec
0001 named as its riskiest.

- [ ] `LineItem` carries an id, a name and `Minor | null`, and nothing else
- [ ] `ExpenseSnapshot.lines` exists and defaults to `[]` for every existing construction path
- [ ] A composite's amount is the sum of its lines, and no path can store a typed amount that
      disagrees with that sum
- [ ] A composite with no lines is Pending
- [ ] A composite with any line whose amount is `null` is Pending — not a sum treating that
      line as zero
- [ ] A composite whose lines are all `0` has an amount of `0` and is **not** Pending
- [ ] Adding, editing or removing a line revalidates the Split Rule against the resulting
      amount, and is refused where a `fixed` rule would no longer total
- [ ] Adding a line to a composite with a `fixed` rule succeeds when the rule is supplied
      alongside and still totals to the new sum
- [ ] Adding a first line to an Expense with a typed amount produces one line carrying that
      amount, named after the Expense, and leaves a `fixed` rule valid
- [ ] Deleting the last line of a composite leaves a simple Expense whose typed amount is the
      former sum, and leaves a `fixed` rule valid
- [ ] Deleting the last line of a composite whose sum was `null` leaves a Pending Expense
- [ ] Line ids are minted through `domain/identity.ts` and are unique within an Expense
- [ ] Renaming a line changes nothing but the name — no Repurposing question, no identity
      minted
- [ ] Editing a line leaves the Expense's `reviewed` and `oneOff` untouched by the line
      operation itself
- [ ] Inheriting a composite into a newly opened Month carries every line, ids intact
- [ ] `npm run typecheck` is clean and the full suite passes
