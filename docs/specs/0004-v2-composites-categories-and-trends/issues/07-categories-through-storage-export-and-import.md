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

**Status:** done

**Suggested model:** Sonnet, medium thinking — round-trip plumbing, with the import check
being the part that needs its own thought.

- [x] A Household with categories round-trips through the SQLite adapter unchanged
- [x] The same through the `localStorage` adapter
- [x] Both are asserted in `storage/port-contract.ts`
- [x] A row with `category: null` round-trips as `null`, not as an absent key that a default
      misreads
- [x] A stored Household written by v1.2 loads with `categories: []` and every Expense
      uncategorised, with its old category strings discarded
- [x] No category is minted from an existing string anywhere in the load path
- [x] Export includes the categories list
- [x] An export re-imports with every row still pointing at the same category
- [x] An import naming a category id the file does not define is rejected, with a message
      identifying the offending row
- [x] An import with no categories key at all is accepted, with the list empty and every
      Expense uncategorised
- [x] A v1.2 export file imports cleanly
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

**The legacy/v2 boundary is the presence of the `categories` key, not its emptiness.**
`storage/stored.ts`'s `fromStored` now keys off `household.categories === undefined` — true
only for a document that never had the field at all. A v2 Household that has genuinely
chosen an empty vocabulary (`categories: []`, explicitly present) is a different, legal
state, and its rows' category ids are trusted. The same rule reads a file in
`domain/transfer.ts`: `readCategories` returns `legacy: true` only when the file's
`categories` key is `undefined`, and a legacy read never trusts a row's `category` string
regardless of what it says — it is always `null`. A non-legacy file (even one with an empty
`categories` list) validates every row's `category` against the list and rejects a row
naming an id the file does not define, identifying the row by name.

**SQLite's `categories` column has no default, deliberately.** Migration 3 adds it as a bare
`alter table household add column categories text` — nullable, no default — so a database
that predates it reads back `null` there, which `fromStored` reads as "no `categories` key",
exactly like a document store missing the field. A `not null default '[]'` column would have
collapsed that distinction: every pre-migration database would read as a v2 Household with a
deliberately empty vocabulary, and the discard-old-strings rule would never fire for anyone
upgrading from before this ticket. `putHousehold` writes the column itself, once, after
`writeDocument` — `writeDocument` is also called by migration 2's document-to-relational
conversion, against a `household_next` table that does not have the column yet at that point
in the migration sequence, so it stays deliberately silent on `categories` and only ever
writes `currency` and `roster`.

**One consequence of that split, pinned in `sqlite-store.test.ts`.** A database that reaches
its current shape by way of the old document-to-relational conversion (migration 2) is read
back as if it were a v1.2 Household regardless of what its document actually held —
`categories` is simply never carried across that specific path, by the design above. Both
affected tests were adjusted to expect the discard rather than a round-trip, with a comment
explaining why; no real Household reaches shape 3 this way except through that one historical
conversion, which is the same reasoning migration 2 was written under before this ticket
existed.

**`domain/transfer.test.ts`'s fixtures now use real categories.** The shared Household
fixture used `category: 'Home'` as a placeholder string that named nothing in
`household.categories` (empty, pre-ticket-05). Import's new referential check would reject
that file, so the fixture now calls `addCategory` for real entries and every Expense
references one of their minted ids.

**Import also enforces the case-insensitive name uniqueness `domain/categories.ts` already
enforces on every edit** (`requireUniqueName`), not just id-distinctness: `readCategories`
rejects a file whose categories share a name once case is folded, so an import can never
produce a vocabulary the app itself would refuse to build.

**No narrower port operation for categories alone.** Ticket 06's closing comments floated
one — a `HouseholdStore` operation that writes just the category list, instead of the
whole-Household `replaceHousehold` every other Household-level change already goes through.
This ticket's checklist doesn't call for it, categories round-trip correctly through the
existing `replaceHousehold` path in both adapters and the export format, and the concurrency
argument against `replaceHousehold` applies equally to the Roster and the currency already —
adding a bespoke narrower operation for just this one field would be inconsistent with those.
Left as it is.
