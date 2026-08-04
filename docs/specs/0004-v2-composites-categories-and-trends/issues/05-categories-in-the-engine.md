# 05 — Categories in the engine

**What to build:** The category vocabulary as a Household-level list, and
`ExpenseSnapshot.category` as a nullable id into it. Not the delete flow — that is ticket
06 — and not storage or UI.

Read [ADR-0012](../../../adr/0012-categories-as-stored-entities.md) first. The decision that
governs every choice here is that a category is a **label on a row, not a party to it**:
nothing computes with it, and renaming one relabels every Month at once, past Months
included, on the same footing as relabelling the currency.

In `domain/types.ts`:

- `CategoryId = string`, and `Category` — `{ id: CategoryId; name: string }`. No active
  flag: ADR-0012 chose delete over retirement.
- `Household` gains `categories: Category[]`.
- `ExpenseSnapshot.category` changes from `string` to `CategoryId | null`.

In a new `domain/categories.ts`: add, rename, and a query for where a category is used —
which rows in which Months — since ticket 06's confirmation needs a row count and a Month
range and ticket 08 needs to know whether a delete is immediate.

Setting a category on an Expense goes through the existing edit path, so it sets `reviewed`
like any other edit. That is right: choosing a category *is* touching the row. The exception
is ticket 06's clear, which is not an edit.

**The existing free strings are dropped.** The list starts empty and every existing row
becomes uncategorised. ADR-0012 records why, and the release note carries the cost: a v1.2
Household loses its category strings on upgrade.

Note what stays as it is: `category` remains a compared `DriftField`, now comparing ids.
Inheritance carries it like any other field.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — a new entity and a field type change, with
the reasoning already settled in ADR-0012.

- [ ] `Category` carries an id and a name, and no active flag
- [ ] `Household.categories` exists and is `[]` for a freshly set-up Household
- [ ] `ExpenseSnapshot.category` is `CategoryId | null`, and `null` is a permanent legal
      value rather than a transient one
- [ ] A category can be added, and its id is minted through `domain/identity.ts`
- [ ] Renaming a category changes what every Month renders, past Months included, and changes
      no row
- [ ] Two categories may not share a name — decide and enforce case sensitivity, and say
      which in the comments
- [ ] The usage query returns the rows and the Months that reference a given category
- [ ] Setting a category on an Expense sets `reviewed`, as any edit does
- [ ] `category` is still a compared `DriftField`, comparing ids
- [ ] Opening a Month inherits each Expense's category id unchanged
- [ ] A Household set up fresh has no categories and every Expense uncategorised
- [ ] `npm run typecheck` is clean and the full suite passes
