# A Line Item is a name and an amount; the Expense keeps the split

A composite Expense holds **Line Items**, and a Line Item carries a name, an amount and a
stable identity — nothing else. The parent Expense keeps its Participants and its Split
Rule, and its amount is the sum of its lines rather than a typed figure.

**An Expense still yields one set of Shares.** CONTEXT.md's **Share**, **Split Rule** and
**Participants** entries are untouched by composites, and so is everything downstream of
them: `sharesOf`, the Leftover Balance, the rail.

## The alternative, and what it costs

The obvious richer model is a Line carrying its own Participants and Split Rule, with the
parent as a grouping whose amount is the sum. It answers a real case: a shared supermarket
run where one line was only for one person.

It was rejected because it dissolves the Expense as the unit of division. The parent's Split
Rule becomes meaningless — there is nothing left for it to divide — so **Share** stops being
"the portion of an Expense attributed to one Participant" and becomes the portion of a line.
Every consumer of a Share flattens across two levels, the dashboard has to render a set of
Shares per line, and validation runs per line against a per-line total. That is a different
domain model, not a feature added to this one.

The case it serves is already served. A single-Participant Expense **is** how an individual
cost is recorded — CONTEXT.md says so under **Share** and **Participants** — so the line
that was only for one person is its own Expense, which is what it actually is. What
composites are for is the other thing: a bill whose *parts move* and whose division does
not.

A middle option, where lines default to the parent's Participants and rule but may override
either, was rejected as the worst of both: it carries the two-level model's full cost in
inheritance, Drift, propagation and validation, and adds a per-line "is this overridden"
state to every one of them.

## Why a Line has an identity but no marks

A Line carries a `RowId` so that it inherits as itself: Drift can report *Fruit 12.00 →
15.00* instead of reading a rename as a delete plus an add, and Forward Propagation can
carry a corrected line without replacing the list.

It carries no `reviewed` and no `oneOff`. **A composite is one row in the review model** —
one tick, one mark, one entry in the Unreviewed count. Reviewing it means opening it and
reading its lines, which is what reviewing any row is, with more numbers behind it.

Per-line `reviewed` is the truest reading of "entry is a checklist that ends at zero", and
it makes a composite stop being one row everywhere else: the meter, the rail, the row's own
mark and the dashboard each need a notion of partial review, and Drift — which consults
`isReviewed` per row (ADR-0011) — needs a second level of it.

Per-line One-Off has an answer already in the model. A row stops recurring by being removed
from a Month, whose absence every later Month inherits. A line that should not come back is
deleted next Month; that is the mechanism, not a gap in it.

Identity without marks also means a Line rename asks nothing. **Repurposing does not apply
to a Line**: nothing accumulates per Line — no history view, no progress figure, nothing
that reads it across Months except the diff — so getting the answer "wrong" costs one
oddly-worded difference in a Drift report. Asking a question with no consequence behind it
would train members to dismiss the one that has.

## Consequences

- **`lines` is a field on `ExpenseSnapshot`**, empty for a simple Expense, rather than a
  discriminated union or a fourth `RowKind`. The invariant a union would enforce is enforced
  by construction: a composite's amount is computed and never stored, so there is nothing to
  contradict. `month_rows` holds each row as JSON and `localStorage` holds the Household as
  JSON, so this needs a read-side default of `[]` and no schema migration.
- **A Line's amount may be `null`**, and a composite with no lines or any null line is
  Pending. Spec 0001's riskiest item — the null-vs-zero distinction — now has to hold at two
  levels. It buys the case the feature exists for: a line whose figure is not yet known
  makes the composite read incomplete rather than cheap.
- **Every path that mutates a line goes through `requireConsistentRule`.** The amount is
  derived, so a line edit changes it, and a `fixed` rule is only valid against a specific
  total. Adding a line to a fixed-split composite therefore forces the member to say who
  absorbs it — a real decision about money, and the same one they face typing a new total
  today. Rescaling the fixed figures automatically was rejected: no edit path in this
  codebase silently changes a number a member typed.
- **Converting preserves the figure both ways.** A typed amount becomes the first line,
  named after the Expense; deleting the last line hands the running total back as a typed
  amount. A `fixed` rule survives both transitions because the total is unchanged across
  them. Making the mode permanent at creation was rejected: itemising an existing Expense
  would then mean deleting it and minting a new identity, which is Repurposing in reverse.
- **Drift gains one field, `lines`.** A composite reports as one changed row and refreshing
  takes the whole list, as it already takes a whole row. Per-line differences were rejected
  because a per-line refresh would have no per-line `reviewed` mark to respect, which is the
  rule Drift is built on; excluding lines entirely was rejected because a composite corrected
  in an earlier Month would then report nothing.
- **A Line has no category and no payment method.** Those live on the Expense, so a
  composite is one row in the category vocabulary as it is in the review model.
- **ADR-0010's headroom is now spent.** The centre column's spare vertical room was recorded
  there as anticipating composites; the expenses list uses it to expand a composite in
  place. Composites render collapsed by default so that several of them in one Month do not
  push the rest of the list off the screen.
