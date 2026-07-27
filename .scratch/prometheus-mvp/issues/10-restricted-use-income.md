# 10 — Restricted-Use Income and the dashboard toggle

**What to build:** Flag an income source as Restricted-Use once, as a property of the source itself (e.g. a meal-voucher benefit). Spendable Income excludes restricted sources everywhere: as the basis of proportional splits and as the default basis of the Leftover Balance. The dashboard shows restricted amounts separately per member, and a view toggle switches the displayed Leftover Balance between excluding and including restricted income — a pure view switch that writes no data. The app never tracks which expenses restricted money pays for (ADR-0001).

**Blocked by:** 05 — Proportional split

**Status:** ready-for-agent

- [x] An income source can be flagged Restricted-Use once, at source setup
- [x] Spendable Income = Income − Restricted-Use Income, per member per Month (engine seam)
- [x] Proportional splits use Spendable Income as their basis
- [x] The dashboard displays each member's restricted amounts separately from spendable amounts
- [x] The toggle switches the displayed Leftover Balance between the two bases without writing any data
- [x] No expense-matching or spending-from-restricted concept exists anywhere
