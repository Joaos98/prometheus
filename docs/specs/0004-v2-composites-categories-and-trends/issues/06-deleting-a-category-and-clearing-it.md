# 06 — Deleting a category, and clearing it from the record

**What to build:** The delete flow. This is the riskiest operation in the spec: it is the
only one that writes to many Months at once, it is irreversible, and it is not atomic.

Read [ADR-0012](../../../adr/0012-categories-as-stored-entities.md) before starting.

Deleting a category **no row references** is immediate. Deleting one **in use** is
refused; the caller is given what it would cost — the row count and the Month range — so
that ticket 08 can say *"used by 34 rows across 11 Months, June 2025 – August 2026"*. A
separate operation clears the category from every referencing row and then deletes it.

Three rules, all of which need tests asserting what the operation does **not** touch:

- **The order is fixed.** Clear every referencing row first; delete the category only once
  every clear has landed. A run that fails partway leaves a half-cleared category that still
  cannot be deleted — a retry, not a corrupt state.
- **The clear does not set `reviewed`.** Nobody reviewed anything, and the Unreviewed count
  is the number a monthly review is actually run against. This is spec 0003's `setXOneOff`
  reasoning applied to a second write path that is not an edit — carry that argument into
  the doc comment rather than restating the rule.
- **The clear cannot produce Drift**, and a test should pin this because the opposite is the
  intuitive guess. Drift compares what a Month holds against what a fresh open would *now*
  produce, both computed from the household as it stands (`monthIfOpened`). A complete clear
  moves both sides together, so they still agree.

**On persistence, and a choice to make deliberately.** `replaceHousehold` exists and is how
every Household-level change is currently written (`ui/household.ts` uses it for the roster
and the currency), so the clear plus the delete *could* be one atomic write. The spec does
not take that route: `replaceHousehold` overwrites the whole Household, so it would clobber
any concurrent row edit anywhere, not merely a competing edit to the same row. The clear is
therefore N `writeRow` calls followed by one `replaceHousehold` for the list itself, which
preserves ADR-0008's row-scoped invariant at the cost of atomicity. **If you disagree after
building it, say so in the comments rather than changing it quietly** — it is a decision,
not an oversight.

**Blocked by:** 05

**Status:** done

**Suggested model:** Opus, high thinking — irreversible, cross-Month, non-atomic, and
carrying two exceptions that exist to protect numbers elsewhere in the app.

- [x] Deleting an unused category removes it and changes no row
- [x] Deleting a category in use is refused, and the refusal carries the row count and the
      Month range
- [x] The clear-then-delete operation removes the category from every referencing row in
      every Month, and then removes the category
- [x] Rows that referenced it end with `category: null`
- [x] Rows that referenced a *different* category are untouched
- [x] **No cleared row has its `reviewed` value changed**, in any Month, covered by an
      explicit test
- [x] No cleared row has any other field changed
- [x] A complete clear produces no category Drift in any future Month, covered by an explicit
      test
- [x] The clear runs before the delete, and a failure partway leaves the category present and
      still undeletable
- [x] Re-running a partially-applied clear completes it
- [x] Clearing writes rows through `writeRow` rather than replacing the Household, and the
      comments record the reasoning above as still holding — or argue against it
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

**Two halves in the engine, ordered by the app.** `domain/categories.ts` gained
`clearCategory`, which returns the Household as it now stands *and* the cleared rows paired
with their Months, and `deleteCategory`, which refuses while `categoryUsage` still finds a
row. Which write lands first is a question about a store, so the ordering lives in
`ui/household.ts`: `clearAndDeleteCategory` walks the cleared rows through `writeRow` one at
a time and only then hands the vocabulary back. `deleteCategory` is exposed there too, for
the immediate case — and its refusal is what makes that safe to offer on a usage query, since
the other member may have categorised a row between the panel reading the count and the
member clicking.

**The refusal is a plain `DomainError`, not a typed one.** No `DomainError` subclass exists
in this codebase, and inventing one for this would be machinery ticket 08 does not need: the
picker has to call `categoryUsage` before offering anything, to know whether the delete is
immediate, so it already holds the count and the Months structured. What the refusal carries
is the same two figures worded for a member — *"Groceries" is used by 6 rows across 3 Months,
July 2026 – September 2026 — clear it before deleting it*, and the singular case says the one
Month plainly rather than as a range.

**One tension in that argument, left for ticket 08 to settle.** The case for exposing the
immediate `deleteCategory` at all is the race where another member categorises a row between
the panel reading the count and the member clicking — and in exactly that race the panel's
figures are stale and the refusal is the only fresh source, yet it carries them as a sentence
rather than as numbers. That is fine for the path as drawn, since the panel needs to *show*
the cost rather than compute with it, and can re-query `categoryUsage` before offering the
clear. If ticket 08 finds it wants the figures structured, the change is a `DomainError`
subclass carrying `CategoryUsage` — small, and better made when there is a panel to prove it
is needed.

**The retry is tested on the app that failed, not on a fresh one.** A refused change leaves
`household.value` holding the record as it stood before the clear, so the app on screen is
now behind its own store — it still shows rows the store has already cleared. Asking again
therefore rewrites those rows, which is last-write-wins over identical content and lands
correctly. Testing the retry through a freshly loaded app would have proved a path a member
never takes.

**The no-Drift test is pinned from both sides.** A test asserting `driftOf` finds nothing
after a complete clear passes just as happily if the clear did nothing at all, so there is a
second test alongside it: a half-applied clear *does* report `['category']` on the Month
opened ahead. That is the ADR's "only a partially-applied clear can show any", made a
regression test rather than a claim.

**On the persistence decision: I would keep the behaviour and drop half the reasoning.** The
route the ticket names is the one that is built, and I am not arguing for changing it — but
the argument for it does not survive contact with the code. The clear is N `writeRow` calls
*followed by a `replaceHousehold`*, and that trailing call overwrites the whole Household
from this member's in-memory copy. A concurrent row edit anywhere is therefore clobbered
anyway, at the end, and the window is now *longer* than a single atomic `replaceHousehold`
would have been. Row-scoping the clear buys nothing for concurrency while a whole-Household
write closes it.

What it does buy is real and worth keeping: durable partial progress, and with it the
ordering property this ticket is built around — a run that dies halfway leaves rows cleared,
the category still listed, and `deleteCategory` still refusing, so a retry finishes the job.
A single atomic write has no half-state to retry into, which is arguably tidier, but it makes
the whole record hostage to one write succeeding.

The route that would honour the stated reasoning end to end is a port operation narrower than
`replaceHousehold` — one that writes the category list alone. `HouseholdStore` has no such
thing today: every Household-level change in the app (the currency, the Roster, propagation,
repurposing) goes through `replaceHousehold` and carries exactly this exposure, so categories
are no worse than what ships. **Ticket 07 is the place to weigh adding one**, since it is
already in both adapters for the categories migration.
