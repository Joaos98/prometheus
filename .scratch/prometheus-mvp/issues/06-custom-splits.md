# 06 — Custom splits with exact-sum validation

**What to build:** The custom Split Rule, in exactly one mode per expense: percent mode (per-participant percentages that must total exactly 100) or amount mode (per-participant fixed amounts that must total exactly the expense's total). Invalid sums are rejected at entry with a message naming the actual sum and the required sum. Amount mode suits fixed bills: when entering a Month's amount for an amount-mode expense, the entry is rejected unless it equals the sum of the fixed Shares — variable-total items use percent mode.

**Blocked by:** 04 — Expenses with even split and per-Month amounts

**Status:** ready-for-agent

- [ ] Percent mode: rule entry is rejected unless the percentages total exactly 100; Shares follow the percentages and sum exactly to each Month's total after rounding (engine seam)
- [ ] Amount mode: rule entry is rejected unless the amounts total exactly the expense's total at that time
- [ ] A Month's amount entry for an amount-mode expense is rejected unless it equals the sum of the fixed Shares (engine seam)
- [ ] One mode per expense; changing mode or values is an Effective From change that leaves earlier Months untouched
- [ ] Rejection messages state the actual sum and the required sum
- [ ] Engine seam tests cover every rejection case and the exact-sum guarantee for both modes
