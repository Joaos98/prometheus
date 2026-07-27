# 05 — Proportional split

**What to build:** "Proportional to Spendable Income" becomes selectable as a Split Rule per expense, weighting Shares by each Participant's Spendable Income for that Month. When no Participant has any Spendable Income that Month, the split falls back to even and the dashboard flags the substitution so it isn't silent.

**Blocked by:** 04 — Expenses with even split and per-Month amounts

**Status:** ready-for-agent

- [x] Shares are weighted by each Participant's Spendable Income for the displayed Month; a zero-income Participant gets a zero Share when others have income (engine seam)
- [x] Shares always sum exactly to the expense total after rounding (engine seam)
- [x] Changing a member's income changes proportional Shares from that change's Effective From Month onward only — earlier Months are untouched
- [x] All-zero-income Month: the split falls back to even among Participants, and a visible flag appears on the dashboard (engine seam: flag present in output)
- [x] The split rule is chosen per expense; existing expenses keep their current rule unchanged

## Comments

Implemented. Engine: SplitRule union extended to include `{ method: "proportional" }`; `computeProportionalShares` distributes Shares weighted by income with largest-remainder rounding; all-zero-income falls back to even with `fallbackExpenses` flag in the summary. 4 new behavior tests: weighted distribution, exact-sum rounding, zero-income participant, all-zero fallback. Data layer: `addExpense` now accepts `splitRule` parameter. Server: POST /api/expenses validates splitRule. Client: split rule selector (even/proportional) in expense form, fallback flag display on dashboard. E2E verified: 60/40 proportional split from 600k/400k incomes.
