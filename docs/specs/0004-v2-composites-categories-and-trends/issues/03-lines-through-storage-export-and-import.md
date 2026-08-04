# 03 — Lines through storage, export and import

**What to build:** Line Items survive both storage adapters, the export file and an import.

`month_rows` stores each row as a JSON blob (`storage/sqlite-store.ts`) and `localStorage`
holds the whole Household as JSON, so `lines` needs a **read-side default of `[]`** and no
schema migration in either adapter. A v1.2 file loaded by this build reads every Expense as
simple, which is what it is.

The port contract suite (`storage/port-contract.ts`) is the real deliverable: both adapters
run it, so a case added there is a case both must pass. Add composite coverage to it rather
than to either adapter's own tests.

The risk to test hardest is the one spec 0001 named: **`null` must survive the round trip**
at the line level as it does at the row level. A line whose amount is `null` must not come
back as `0`, as `undefined`, or as an absent key that a default turns into `0`.

Export and import: the export format gains `lines`; import accepts a file without them and
defaults to `[]`. An imported composite's amount is recomputed from its lines rather than
trusted from the file — the file could carry a stale or hand-edited total, and the engine's
invariant is that the two cannot disagree.

**Blocked by:** 01

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — mechanical, with the whole difficulty
concentrated in the null round-trip cases.

- [ ] A Household whose Expenses carry lines round-trips through the SQLite adapter unchanged
- [ ] The same through the `localStorage` adapter
- [ ] Both cases are asserted in `storage/port-contract.ts`, not in an adapter's own tests
- [ ] A line with `amount: null` round-trips as `null` in both adapters — not `0`, not
      `undefined`, not absent
- [ ] A stored Household written by v1.2, with no `lines` key anywhere, loads with every
      Expense simple and `lines: []`
- [ ] `writeRow` on a composite writes the whole row including its lines, and leaves every
      other row alone
- [ ] Export includes `lines`; a v1.2 export file imports cleanly with `lines: []`
- [ ] An imported composite's amount is recomputed from its lines, and a file carrying a
      total that disagrees with its lines is either rejected or corrected — pick one and
      say which in the comments
- [ ] Line ids survive export and import intact, so a re-imported Household still drifts and
      propagates correctly
- [ ] `npm run typecheck` is clean and the full suite passes
