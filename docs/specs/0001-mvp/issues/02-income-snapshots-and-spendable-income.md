# 02 — Income Snapshots and Spendable Income

**What to build:** A member records what came in this Month as one row per named source — a salary, a second job, a benefit — each belonging to one member. Sources that can only be spent on certain things, like a meal-voucher benefit, are flagged Restricted-Use, and from then on they never count toward Spendable Income. The Month shows each member's Spendable Income with Restricted-Use excluded. Income rows live in the dashboard's right column.

There is no standing record of what anyone earns: income exists only as rows on a Month.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] An Income Snapshot records a name, an owning member, an amount and a Restricted-Use flag, and can be added, edited and removed within its Month
- [ ] Spendable Income for a member is the sum of that member's Income Snapshots for the Month excluding Restricted-Use ones
- [ ] Restricted-Use Income is not tied to any expense it could pay for — there is no such association anywhere in the model
- [ ] An amount of null (nothing entered), an amount of zero, and an absent row are three distinct states, and all three survive a round-trip through the storage port and the localStorage adapter unchanged
- [ ] A row with a null amount is Pending; a row with an explicitly entered zero is not
- [ ] Income rows render in the right column, grouped so each member's sources are legible
- [ ] Editing a Month's income changes that Month only
