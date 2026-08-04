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

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — irreversible, cross-Month, non-atomic, and
carrying two exceptions that exist to protect numbers elsewhere in the app.

- [ ] Deleting an unused category removes it and changes no row
- [ ] Deleting a category in use is refused, and the refusal carries the row count and the
      Month range
- [ ] The clear-then-delete operation removes the category from every referencing row in
      every Month, and then removes the category
- [ ] Rows that referenced it end with `category: null`
- [ ] Rows that referenced a *different* category are untouched
- [ ] **No cleared row has its `reviewed` value changed**, in any Month, covered by an
      explicit test
- [ ] No cleared row has any other field changed
- [ ] A complete clear produces no category Drift in any future Month, covered by an explicit
      test
- [ ] The clear runs before the delete, and a failure partway leaves the category present and
      still undeletable
- [ ] Re-running a partially-applied clear completes it
- [ ] Clearing writes rows through `writeRow` rather than replacing the Household, and the
      comments record the reasoning above as still holding — or argue against it
- [ ] `npm run typecheck` is clean and the full suite passes
