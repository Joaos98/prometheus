# 05 — Leftover Balance and the pinned rail

**What to build:** The figure the household actually wants. For each member: their Spendable Income, minus their Shares, minus their Savings Goal contributions — what they have left this Month. The Viewer's own balance sits at the top of a pinned left rail with the subtraction spelled out, so when the figure moves it is obvious which input moved it. The other members' balances sit beneath it, because for a share calculator that comparison is the screen. The rail stays put while the rows scroll, so editing an expense shows its effect immediately.

Contributions read as zero until Savings Goals exist in 10; the subtraction is built with all three terms from the start.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Leftover Balance for a member is Spendable Income minus the sum of their Shares across the Month's Expenses minus the sum of their Contributions
- [ ] A negative Leftover Balance is a legitimate result and renders as one
- [ ] A Leftover Balance never carries into a later Month
- [ ] The Viewer's balance renders with its three terms shown as a subtraction, not just a total
- [ ] The other members' balances render beneath it
- [ ] The rail stays on screen while the centre and right columns scroll
- [ ] The rail shows the Month's own facts, including which Month it was copied from
- [ ] Editing an income row or an expense updates every affected balance without a reload
- [ ] A Pending row contributes nothing to any balance and is not silently treated as zero
