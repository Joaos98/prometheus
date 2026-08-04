# Categories are stored entities, not strings on a row

The MVP shipped `ExpenseSnapshot.category` as a free string typed per row per Month, and
deferred any management of it. **Categories now live as a Household-level list, and a row
holds an id into it.** Renaming a category relabels every Month at once, including past
ones.

## Why this does not contradict ADR-0003 and ADR-0004

The obvious objection is that a Household-level list is a standing definition outside a
Month, which is the thing this model exists to refuse. It reads that way and it is not what
those decisions say.

ADR-0003 and ADR-0004 remove standing definitions that **mint row content**: Expense
Templates and the Income Profile carried amounts, Participants and Split Rules into a Month,
so a Month's figures were partly authored somewhere else and a Template could mint an
invalid snapshot at birth. A category carries no amount, decides nothing about a Month, and
is inert with respect to every computation in the engine. Removing the whole list would
change no figure anywhere.

Prometheus already stores a Household-level vocabulary of exactly this kind: **the
currency**, which CONTEXT.md describes as "chosen at setup and relabellable afterwards".
Relabelling the currency changes how every past Month renders and nobody reads that as the
snapshot model being violated, because the Months' numbers are untouched. Renaming a
category is the same act on a different label.

## Why the rename is retroactive

The alternative was to follow the **Roster** rather than the currency: a Household-level
list that each Month copies the relevant entries out of, so a rename affects only Months
opened afterwards. That is the stricter reading of the snapshot model, and it was rejected.

The Roster is copied because a Month genuinely needs to know **who it was for** — a member
deactivated in March must not vanish from January's figures, and the copy is what protects
them. A category is a label on a row, not a party to it, and nothing about a past Month
depends on the label having been spelled a particular way.

The cost of the strict reading falls on the charts this vocabulary exists for. A trend
spanning a rename would draw the old name and the new one as two series, and the member who
renamed a category to fix it would have made the chart worse. Retroactive relabelling is the
behaviour that makes a category vocabulary worth storing at all.

## Why delete, and never retire

A category is deleted, not retired. There is no active flag.

Deleting one no row references is immediate. Deleting one in use is refused, and the member
is shown the cost in rows and Months — *"used by 34 rows across 11 Months, June 2025 –
August 2026"* — with the option to clear it from every referencing row and then delete.

Retirement was the expected answer, by analogy with the Roster, and it invents a second
state for the entity: a picker that filters, an import rule, a UI for both states, and a
category that exists but cannot be chosen. Delete-and-clear invents nothing, because `null`
is already a legal category: a cleared row lands in a state the model handles and renders
already.

It is destructive and irreversible, and it writes into Months that are settled history — the
second operation in the app permitted to do that, after Discarding a Month. It borrows that
action's discipline, which is to name the cost in entries before it proceeds. Export is the
only recovery, and the confirmation says so.

## Consequences

- **Both storage adapters migrate**, and the export format gains the list. Import must check
  that every referenced category id exists, which is the first referential integrity rule in
  the codebase that is not satisfied by a Month owning its own data.
- **The MVP's category strings are dropped.** The list starts empty and every existing row
  becomes uncategorised. Minting a category per distinct string was rejected: it preserves
  the typos along with the data, and starting empty makes building the vocabulary a
  deliberate act. A Household upgrading from v1.2 loses its category strings; exporting
  first is the only way to keep them.
- **Uncategorised is `null`, not an entity** — a permanent legal state, matching
  `amount: null` and `target: null`, and grouped in charts under a heading nobody can rename
  because it is not a category.
- **The clear is not atomic.** ADR-0008 makes writes row-scoped and last-write-wins, so
  clearing N rows is N writes. The order is fixed — clear every row, then delete — and a run
  that fails partway leaves a half-cleared category that still cannot be deleted, which is a
  retry rather than a corrupt state.
- **The clear does not set `reviewed`.** Nobody reviewed anything, and the Unreviewed count
  is the number a monthly review is actually run against. This is the reasoning spec 0003's
  `setXOneOff` already carries, applied to a second write path that is not an edit.
- **The clear cannot produce Drift**, which is worth recording because the opposite is the
  intuitive guess. Drift compares what a Month holds against what a fresh open would *now*
  produce, both computed from the household as it currently stands. A complete clear moves
  both sides together, so they still agree; a category neither side referenced changes
  neither. Only a partially-applied clear can show any, and that is the ordering rule above.
- **Categories are for Expenses only.** Income and Savings Goals are declined, not deferred:
  a vocabulary earns its keep where there are enough rows to group and a chart worth drawing,
  and only Expenses have either. Extending the machinery to another row kind later is a
  field and a picker.
- **Payment methods reuse this decision wholesale** — a second list of the same shape, with
  the same delete-and-clear, the same nullable id and the same `reviewed` treatment.
