# 05 — Leftover Balance and the pinned rail

**What to build:** The figure the household actually wants. For each member: their Spendable Income, minus their Shares, minus their Savings Goal contributions — what they have left this Month. The Viewer's own balance sits at the top of a pinned left rail with the subtraction spelled out, so when the figure moves it is obvious which input moved it. The other members' balances sit beneath it, because for a share calculator that comparison is the screen. The rail stays put while the rows scroll, so editing an expense shows its effect immediately.

Contributions read as zero until Savings Goals exist in 10; the subtraction is built with all three terms from the start.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — a subtraction over engine parts that already exist, and the rail's layout is settled by ADR-0010.

- [x] Leftover Balance for a member is Spendable Income minus the sum of their Shares across the Month's Expenses minus the sum of their Contributions
- [x] A negative Leftover Balance is a legitimate result and renders as one
- [x] A Leftover Balance never carries into a later Month
- [x] The Viewer's balance renders with its three terms shown as a subtraction, not just a total
- [x] The other members' balances render beneath it
- [x] The rail stays on screen while the centre and right columns scroll
- [x] The rail shows the Month's own facts, including which Month it was copied from
- [x] Editing an income row or an expense updates every affected balance without a reload
- [x] A Pending row contributes nothing to any balance and is not silently treated as zero
