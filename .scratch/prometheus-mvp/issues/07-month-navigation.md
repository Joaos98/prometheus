# 07 — Month navigation and history browsing

**What to build:** Move backward and forward through Months from the dashboard — previous/next controls plus a direct jump to a chosen Month. Every Month renders from the definitions in effect for it (income values, split rules, participants) together with that Month's entered amounts. The current Month is the default landing view; future Months can be opened and have amounts entered in advance.

**Blocked by:** 04 — Expenses with even split and per-Month amounts

**Status:** ready-for-agent

- [ ] Previous/next Month navigation and a direct jump-to-Month control on the dashboard
- [ ] Browsing a past Month shows the income values, split rules, and participants in effect for that Month — not their current values
- [ ] Amounts can be entered for future Months in advance
- [ ] A Month containing unentered expenses is visibly marked incomplete in the browse view
- [ ] Engine seam: rendering Month M uses exactly the state effective in M — changes effective before or after M never leak in
