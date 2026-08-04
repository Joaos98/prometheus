# 07 — Categories through storage, export and import

**What to build:** The categories list survives both adapters, the export file and an
import — and an import is checked for referential integrity, which is the first such rule in
the codebase.

`Household.categories` is Household-level, so it is written the way the roster and the
currency are: through `replaceHousehold`. `ExpenseSnapshot.category` rides along in the row
blob and needs a **read-side default of `null`**, so a v1.2 Household loads with the list
empty and every Expense uncategorised — which is the migration ADR-0012 chose. The old
string is discarded rather than converted; do not mint categories from it.

Add the coverage to `storage/port-contract.ts` so both adapters run it.

**Import validation is the new thing here.** Every Month in Prometheus owns its own data, so
until now nothing pointed outside itself except a `MemberId`, which is covered by a Month
holding its own member list. A category id is the first reference an import can get wrong. An
imported file whose Expense names a category id the file does not define must be **rejected
with a message naming the row**, not silently nulled — a silent null would quietly discard
categorisation the exporting Household had.

**Blocked by:** 05

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — round-trip plumbing, with the import check
being the part that needs its own thought.

- [ ] A Household with categories round-trips through the SQLite adapter unchanged
- [ ] The same through the `localStorage` adapter
- [ ] Both are asserted in `storage/port-contract.ts`
- [ ] A row with `category: null` round-trips as `null`, not as an absent key that a default
      misreads
- [ ] A stored Household written by v1.2 loads with `categories: []` and every Expense
      uncategorised, with its old category strings discarded
- [ ] No category is minted from an existing string anywhere in the load path
- [ ] Export includes the categories list
- [ ] An export re-imports with every row still pointing at the same category
- [ ] An import naming a category id the file does not define is rejected, with a message
      identifying the offending row
- [ ] An import with no categories key at all is accepted, with the list empty and every
      Expense uncategorised
- [ ] A v1.2 export file imports cleanly
- [ ] `npm run typecheck` is clean and the full suite passes
