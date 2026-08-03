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

**Status:** done

**Suggested model:** Sonnet, low thinking — one component, one new row and one new figure
per header, with the conditions already decided.

- [x] The Income panel shows a Household total Spendable Income row beneath the member
      sections, labelled **Total Spendable Income**
- [x] Each member's section header shows their whole-percent share beside their figure
- [x] The percentages shown on screen add up to exactly 100
- [x] No percentages render when any member's Spendable Income is negative or the total is
      not positive, and the total row still renders in those cases
- [x] With one member in the Month, neither the total row nor a percentage renders, and the
      panel is visually identical to v1.1
- [x] With any income row Pending, a note beneath the total reads "Pending rows are not yet
      counted — this total is not final.", and both the total and the percentages still show
- [x] The note is absent when nothing in the Month is Pending
- [x] The per-member figure and the rest of the panel are otherwise unchanged, including the
      Restricted-Use tag and the row controls
- [x] The layout holds at the 1240px collapse and below without the page scrolling
      horizontally
- [x] `demo/seed.ts` renders the total and three percentages for Ada, Bruno and Mira, and
      `demo/seed.test.ts` asserts that the three percentages sum to exactly 100

## Comments

Built as planned. `IncomePanel.vue` gained `householdSpendableIncome(props.month)` and
`spendableIncomeShares(props.month)`, both wired through `computed()`. Each member's header
grew a `.figures` wrapper holding an optional percent span (`percentOf(member.id)`, rendered
only when `spendableIncomeShares` returns a defined entry for that member) beside the
existing Spendable Income figure. A new `section.member.household-total` sits after the
member sections, reusing the existing `.member` class so it picks up the same top-border
separator via the `.member + .member` selector, with the total in the same `.figure.spendable`
style and the label in the same `.section-label small spendable-label` style the per-member
sections use.

The total row and every percentage are gated on `members.value.length > 1` — with one member
the panel renders exactly as it did before this ticket, per the ticket's own reasoning that
`spendableIncomeShares` will correctly answer 100 for a lone member but that is not
information worth showing. The Pending note checks `props.month.income.some(isPending)`
directly (not tied to whether percentages render, since both the total and percentages stay
visible while Pending, per the ticket) and uses the rail's exact wording with `.note.muted`
styling.

`demo/seed.ts` already had three members (Ada, Bruno, Mira) with different incomes from the
MVP, so no seed change was needed; `demo/seed.test.ts` gained one assertion that
`spendableIncomeShares` on the arrival Month returns three entries summing to exactly 100.

Checked in the browser against the demo build (`npm run dev -- --mode demo`): Ada 49%
(€3,440.00), Bruno 30% (€2,100.00), Mira 21% (€1,425.00), Household €6,965.00 — no Pending
note, since nothing in that Month's income is Pending. No horizontal scroll at 1240px or
1000px viewport widths. No console errors. Checked with `npx vue-tsc --noEmit` (clean) and
`npx vitest run` (625 tests passing, up from 624).
