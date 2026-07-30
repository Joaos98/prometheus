# 04 — Proportional and custom Split Rules

**What to build:** The feature Prometheus exists to be deliberate about. Each Expense picks its own way of dividing: proportional to Spendable Income so the person earning more carries more of the rent, evenly where income is irrelevant, or custom — per-participant percentages, or fixed amounts where "you put in 200, I cover the rest" is the natural way to say it. A member switches an Expense between rules and sees the Shares change. A split that does not add up cannot be saved, and the app says what is wrong while it doesn't.

The shape of the rule, from the prototype that settled it:

```ts
type SplitRule =
  | { kind: 'even' }
  | { kind: 'proportional' }                                   // weighted by Spendable Income
  | { kind: 'percentage'; byMember: Record<MemberId, number> }  // must total exactly 100
  | { kind: 'fixed'; byMember: Record<MemberId, Minor> }        // must total exactly the amount
```

`proportional` deliberately stores no weights — it reads the Month's Spendable Income when Shares are computed, so correcting an income figure updates every proportional split without anyone touching an expense.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — the hardest domain ticket. A `fixed` rule against a changing amount is the second risk the spec names by hand.

- [x] All four rules compute Shares that sum to exactly the Expense amount, under the largest-remainder rules established in 03
- [x] A proportional split weights by Spendable Income, so Restricted-Use Income never influences it
- [x] Correcting a member's income changes every proportional Share in that Month with no edit to any Expense
- [x] A percentage rule whose values do not total exactly 100 cannot be saved, and the shortfall or excess is named
- [x] A fixed rule whose values do not total exactly the Expense amount cannot be saved, and the difference is named
- [x] Changing an Expense's amount while a fixed rule is attached validates amount and rule together in one operation — there is no path that leaves a fixed rule inconsistent with its amount
- [x] A proportional rule where no Participant has any Spendable Income divides evenly instead, and the Expense says so; the stored rule is unchanged
- [x] Changing a rule in one Month leaves every other Month's rule untouched
- [x] The Split Rule is visible on the expense row and changeable from it

## Comments

Built. Three decisions worth recording, because none of them is stated in the spec:

1. **Percentages are held to two decimal places.** The rule shape says `number`, and floating point cannot be trusted to total exactly 100 — `33.33 + 33.33 + 33.34` does not. So a percentage is converted to a whole number of hundredths on the way in, refused if anything finer was meant, and totalled as integers. `33.33 + 33.33 + 33.34` is exactly 10000 hundredths and saves; `33.333` is refused rather than rounded.
2. **A fixed rule cannot be attached to a Pending Expense.** A fixed rule is only meaningful relative to a total, and a Pending Expense has none, so there is nothing for the values to add up to.
3. **Income that went backwards weighs nothing in a proportional split.** A negative Spendable Income would otherwise produce a negative Share of the rent. It is clamped to zero for weighting only; if that leaves no weight anywhere, the even fallback takes over as specified.

The interlock the ticket is most concerned with is structural rather than defensive: `requireConsistentRule` is given the Expense **as it would stand** after an edit, never a half-applied one, and both `addExpenseSnapshot` and `editExpenseSnapshot` route through it. Changing an amount out from under a fixed rule is therefore not a path that is checked — it is a path that does not exist.

`splitOf` returns the Shares together with `dividedEvenlyInstead`, so the fallback is reported rather than inferred; `sharesOf` is the same thing for callers that only want the figures.
