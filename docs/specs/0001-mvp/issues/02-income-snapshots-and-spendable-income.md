# 02 — Income Snapshots and Spendable Income

**What to build:** A member records what came in this Month as one row per named source — a salary, a second job, a benefit — each belonging to one member. Sources that can only be spent on certain things, like a meal-voucher benefit, are flagged Restricted-Use, and from then on they never count toward Spendable Income. The Month shows each member's Spendable Income with Restricted-Use excluded. Income rows live in the dashboard's right column.

There is no standing record of what anyone earns: income exists only as rows on a Month.

**Blocked by:** 01

**Status:** done

- [x] An Income Snapshot records a name, an owning member, an amount and a Restricted-Use flag, and can be added, edited and removed within its Month
- [x] Spendable Income for a member is the sum of that member's Income Snapshots for the Month excluding Restricted-Use ones
- [x] Restricted-Use Income is not tied to any expense it could pay for — there is no such association anywhere in the model
- [x] An amount of null (nothing entered), an amount of zero, and an absent row are three distinct states, and all three survive a round-trip through the storage port and the localStorage adapter unchanged
- [x] A row with a null amount is Pending; a row with an explicitly entered zero is not
- [x] Income rows render in the right column, grouped so each member's sources are legible
- [x] Editing a Month's income changes that Month only

## Comments

Built on ticket 01's seams.

- `domain/income.ts` — `addIncomeSnapshot`, `editIncomeSnapshot`, `removeIncomeSnapshot` and `spendableIncome`, with 27 tests. An edit names the fields it changes; naming `amount: null` is how a row goes back to Pending.
- `domain/rows.ts` — `isPending` and the `RowChange` return shape (the Household as it now stands, plus the one row that changed, which is what the port writes). Expenses and goals will share both.
- The null-vs-zero distinction is asserted in both seams: the engine tests, and adapter tests proving nothing entered, an entered zero and no row at all come back as three different things.
- `ui/components/IncomePanel.vue` — the right column, grouped per member with that member's Spendable Income, Restricted-Use tagged and greyed, Pending rendered as a warning rather than as an amount.

Restricted-Use has no association with any Expense anywhere in the model, as the ticket requires. That is a property of what the types do not contain, so it is recorded here rather than asserted as a test.
