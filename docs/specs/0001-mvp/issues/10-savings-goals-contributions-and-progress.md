# 10 — Savings Goals, Contributions and Accumulated Progress

**What to build:** A household saves toward named things. A goal has a name, an optional target, a start amount so money saved before Prometheus still counts, and Participants — because a goal two of us are saving for is not everybody's. Each Participant enters their own Contribution directly: goals have no Split Rule and nothing about them is ever divided.

Progress is measured as of the Month being viewed, never as of today. Browsing last November shows what the goal had reached last November, against the target as it stood then. Contributions now feed the Leftover Balance's third term.

Goal rows list **every member of the Month**, not only Participants, with non-Participants greyed and named as such — a list that silently omitted people would leave "who is not in this goal" unanswerable from the dashboard.

**Blocked by:** 05, 06

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — Accumulated Progress reads across Months, and the collapsing goal row is the fiddliest piece of UI in the MVP.

- [x] A Savings Goal records a name, an optional target, a start amount and Participants, with a stable identity carried between Months
- [x] Each Participant's Contribution for the Month is entered directly, per member
- [x] Goals have no Split Rule and no division of any kind
- [x] Accumulated Progress as of a Month is that Month's start amount plus every Contribution to that goal identity in that Month or any earlier Month
- [x] Progress is measured against that Month's target, so changing the target later does not rewrite an earlier Month's progress
- [x] Contributions made in later Months do not affect an earlier Month's reported progress
- [x] Contributions are subtracted in each member's Leftover Balance
- [x] Opening a Month inherits each goal's name, target, start amount and Participants
- [x] A goal row lists every member of the Month, with non-Participants greyed and named as non-Participants
- [x] Collapsed, a goal row shows Accumulated Progress against target and the Month's total contribution
- [x] Expanded, it shows every member's Contribution, the start amount, and Accumulated Progress as of this Month
- [x] Goals render in the right column alongside income
