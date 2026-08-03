# 04 — The Income panel says what the Household earns

**What to build:** `IncomePanel.vue` gains a total Spendable Income line beneath the
per-member sections, and each member's section header gains their share of it as a whole
percent.

```
Ana                    62%   €2,480.00
  Spendable Income
Bruno                  38%   €1,520.00
  Spendable Income
──────────────────────────────────────
Household                    €4,000.00
  Total Spendable Income
```

**The total.** `householdSpendableIncome(month)`, formatted with the Household's currency
by the panel's existing `money` helper, in a row beneath the last member's section and
separated from it the way the member sections are separated from each other. Its label
reads **Total Spendable Income**, in the same `.section-label` style the per-member
sections use for **Spendable Income**.

**The percentages.** `spendableIncomeShares(month)`, one figure per member, sitting in that
member's section header beside their own figure. Render nothing at all when it returns
`undefined` — the total still shows.

**A Household of one member shows neither the total row nor the percentage.** One member's
Spendable Income is the Household's, and 100% is not information. This is v1.1's own
reasoning on the single-Participant Split Rule applied again: do not render a thing that can
only say one thing. With one member the panel looks exactly as it does today. This
suppression is the panel's, not the engine's — `spendableIncomeShares` will answer 100 and
is right to.

**Pending.** When any income row in the Month is Pending, a note beneath the total says so,
in the rail's own wording and the same muted `.note` styling:

> Pending rows are not yet counted — this total is not final.

Both the total and the percentages are still shown. They describe the income entered so
far, which is incomplete rather than false, and the rail already treats the identical
condition as a note rather than a suppression.

**Unchanged:** the per-member figure is still an unconditional `spendableIncome` and does
not follow the rail's Restricted-Use toggle, which CONTEXT.md settles under **Leftover
Balance**. Nothing in the rail changes. No new `localStorage` key, no per-device preference
— this is not a toggle.

**Blocked by:** 03 — `householdSpendableIncome` and `spendableIncomeShares`

**Status:** ready-for-agent

**Suggested model:** Sonnet, low thinking — one component, one new row and one new figure
per header, with the conditions already decided.

- [ ] The Income panel shows a Household total Spendable Income row beneath the member
      sections, labelled **Total Spendable Income**
- [ ] Each member's section header shows their whole-percent share beside their figure
- [ ] The percentages shown on screen add up to exactly 100
- [ ] No percentages render when any member's Spendable Income is negative or the total is
      not positive, and the total row still renders in those cases
- [ ] With one member in the Month, neither the total row nor a percentage renders, and the
      panel is visually identical to v1.1
- [ ] With any income row Pending, a note beneath the total reads "Pending rows are not yet
      counted — this total is not final.", and both the total and the percentages still show
- [ ] The note is absent when nothing in the Month is Pending
- [ ] The per-member figure and the rest of the panel are otherwise unchanged, including the
      Restricted-Use tag and the row controls
- [ ] The layout holds at the 1240px collapse and below without the page scrolling
      horizontally
- [ ] `demo/seed.ts` renders the total and three percentages for Ada, Bruno and Mira, and
      `demo/seed.test.ts` asserts that the three percentages sum to exactly 100
