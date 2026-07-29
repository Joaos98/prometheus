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

- [ ] All four rules compute Shares that sum to exactly the Expense amount, under the largest-remainder rules established in 03
- [ ] A proportional split weights by Spendable Income, so Restricted-Use Income never influences it
- [ ] Correcting a member's income changes every proportional Share in that Month with no edit to any Expense
- [ ] A percentage rule whose values do not total exactly 100 cannot be saved, and the shortfall or excess is named
- [ ] A fixed rule whose values do not total exactly the Expense amount cannot be saved, and the difference is named
- [ ] Changing an Expense's amount while a fixed rule is attached validates amount and rule together in one operation — there is no path that leaves a fixed rule inconsistent with its amount
- [ ] A proportional rule where no Participant has any Spendable Income divides evenly instead, and the Expense says so; the stored rule is unchanged
- [ ] Changing a rule in one Month leaves every other Month's rule untouched
- [ ] The Split Rule is visible on the expense row and changeable from it
