# 03 — Largest remainder extracted, and the household's income total

**What to build:** The engine half of the Income panel's new figures. Two pieces: pulling
largest remainder out of `domain/shares.ts` so it has one home, and adding the two income
questions the panel will ask.

**`domain/apportion.ts`.** The body of `divide` in `domain/shares.ts` moves here as:

```ts
export function apportion(total: number, weights: bigint[]): number[]
```

Pure arithmetic — no members, no money, no `Minor`. It floors each weight's share in exact
integer arithmetic and hands the leftover units one each to the largest fractional
remainders, ties broken by position, so the result sums to exactly `total`. `floorDivide`
and `compare` come with it. Keep `floorDivide`'s negative handling: an Expense amount may
be negative, so the total may be, and the existing rounding-toward-negative-infinity
behaviour is what keeps remainders positive.

`divide` stays in `shares.ts` and becomes the thin wrapper that calls `apportion` and pairs
the result with Participants in the Month's member order. **`sharesOf` and `splitOf` must
behave identically** — this is a refactor, and `shares.test.ts` and `split-rules.test.ts`
should pass untouched. Move the exactness tests that are really about the arithmetic into
`apportion.test.ts`; leave the ones about Split Rules where they are.

**`domain/income.ts`** gains two functions, beside `spendableIncome` and `totalIncome`:

- `householdSpendableIncome(month: Month): Minor` — the sum of every member's Spendable
  Income for the Month. A Pending row counts as nothing, exactly as `spendableIncome`
  already has it, so the total understates while any income is Pending. Restricted-Use is
  excluded throughout: CONTEXT.md settles under **Leftover Balance** that the rail's toggle
  substitutes total Income "in this figure alone".
- `spendableIncomeShares(month: Month): { member: MemberId; percent: number }[] | undefined`
  — each member's share of that total as a whole percent, apportioned with `apportion(100, …)`
  so the percentages sum to exactly 100. In the Month's own member order, one entry per
  member of the Month including any at zero.

  It returns `undefined` when there are no percentages that could be true: when the total
  is not positive, or when **any** member's Spendable Income is negative. Do not clamp
  negatives to zero the way a proportional Split Rule does — that would give a member 100%
  beside a figure larger than the total, and this figure is a readout rather than a
  weighting. Say why in the doc comment; it is the one place the two treatments of a
  negative income deliberately differ.

  A Household of one member with positive income correctly gets `[{ member, percent: 100 }]`.
  Whether that is worth rendering is the UI's question, not the engine's.

Export both from `domain/index.ts`, along with `apportion`.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, medium thinking — the extraction must be behaviour-preserving
and the refusal conditions need to be got exactly right.

- [x] `domain/apportion.ts` exports `apportion(total, weights)`, returning shares summing
      to exactly `total` for any weights, including a negative `total`
- [x] `divide` in `shares.ts` calls it and `sharesOf` / `splitOf` behave identically —
      `shares.test.ts` and `split-rules.test.ts` pass with no change to their assertions
- [x] `apportion.test.ts` covers the arithmetic directly: exact division, remainders
      distributed to the largest fractional parts, ties falling by position, equal weights
      giving an even division, and a zero weight receiving zero
- [x] `householdSpendableIncome` returns the sum of every member's Spendable Income,
      excluding Restricted-Use rows and counting a Pending row as nothing
- [x] `spendableIncomeShares` returns whole-percent figures summing to exactly 100, in the
      Month's member order, one per member including members at zero
- [x] Three members with equal Spendable Income give 34, 33 and 33, the extra point falling
      to the *first* by member order — not the last, see Comments — and the same way on
      every call
- [x] It returns `undefined` when the total is zero, when the total is negative, and when
      any single member's Spendable Income is negative even though the total is positive
- [x] A one-member Household with positive income gets a single entry of 100
- [x] `apportion`, `householdSpendableIncome` and `spendableIncomeShares` are exported from
      `domain/index.ts`
- [x] The full test suite passes, including `demo/seed.test.ts`

## Comments

Built as planned: `apportion(total, weights)` in `domain/apportion.ts` carries the exact body
of the old `divide`, including `floorDivide` and `compare`. `shares.ts`'s `divide` is now a
thin wrapper — `apportion(amount, weights)` paired with `participants` in Month member order
— and `shares.test.ts` / `split-rules.test.ts` pass with their existing assertions untouched.
The arithmetic-only tests (exact division, leftover placement, negative totals, the
sum-for-every-input property, zero weights) moved to `apportion.test.ts`, called directly on
`apportion` rather than through an Expense; `shares.test.ts` kept only the one tie-break test
that exercises `divide`'s member-order pairing specifically.

`income.ts` gained `householdSpendableIncome` (sum of `spendableIncome` across
`month.members`) and `spendableIncomeShares` (`apportion(100, …)` over each member's
Spendable Income, refusing with `undefined` when the total is not positive or any member's
income is negative). Both exported from `domain/index.ts` alongside `apportion` itself.

**One checklist number was wrong and got corrected rather than followed literally.** This
ticket's checklist said three equal incomes should give "33, 33 and 34, with the extra point
falling to the *last* member by order." Tracing the existing, untouched `divide` arithmetic
by hand (and confirming empirically) shows the leftover unit always goes to the *first* tied
weight — that is what `shares.test.ts`'s own tie-break test already asserts (`ana`, first in
member order, gets the extra cent over `bruno`/`cleo`). `spec.md`'s prose agrees: it says the
income percentages use "the same determinism `sharesOf` already relies on for tie-breaking."
Since `apportion` is one shared implementation and both an untouched passing test and the
spec's own reasoning point at "extra to first," that is what got built and tested — 34, 33,
33 — rather than inventing a second, opposite tie-break rule to match the checklist's literal
numbers.

Checked with `npx vue-tsc --noEmit` (clean) and `npx vitest run` (622 tests passing, up from
606), including `demo/seed.test.ts`.
