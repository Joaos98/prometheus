# 05 — Proportional split

**What to build:** "Proportional to Spendable Income" becomes selectable as a Split Rule per expense, weighting Shares by each Participant's Spendable Income for that Month. When no Participant has any Spendable Income that Month, the split falls back to even and the dashboard flags the substitution so it isn't silent.

**Blocked by:** 04 — Expenses with even split and per-Month amounts

**Status:** ready-for-agent

- [ ] Shares are weighted by each Participant's Spendable Income for the displayed Month; a zero-income Participant gets a zero Share when others have income (engine seam)
- [ ] Shares always sum exactly to the expense total after rounding (engine seam)
- [ ] Changing a member's income changes proportional Shares from that change's Effective From Month onward only — earlier Months are untouched
- [ ] All-zero-income Month: the split falls back to even among Participants, and a visible flag appears on the dashboard (engine seam: flag present in output)
- [ ] The split rule is chosen per expense; existing expenses keep their current rule unchanged
