# 03 — Expense Snapshots, Participants, and an even Split Rule

**What to build:** A member records a cost the household shares: a name, a category, an amount, and the Participants it divides among. The row shows each Participant's Share, and those Shares always sum to exactly the amount — no missing cent, and no member systematically absorbing the rounding. An expense with a single Participant is how an individual cost is recorded; there is no separate concept to learn.

Even splitting only in this ticket. The other Split Rules arrive in 04, but the Share machinery and its exactness guarantee are established here.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] An Expense Snapshot records a name, category, amount, Participants and Split Rule, and can be added, edited and removed within its Month
- [ ] Participants are a subset of the Month's members, stored on the Snapshot
- [ ] A single-Participant Expense yields one Share equal to the full amount
- [ ] Shares sum to exactly the Expense amount for every combination of amount and Participant count, including amounts that do not divide evenly
- [ ] Remainder cents are allocated by largest remainder: each Share floors to a whole cent, leftover cents go one each to the Participants with the largest fractional parts, ties broken by a stable member order
- [ ] The same Month data renders the same Shares every time — no dependence on anything outside the Month
- [ ] A Pending Expense (null amount) produces no Shares and is flagged rather than treated as zero
- [ ] Null, zero and absent amounts remain three distinct states through the storage port and the localStorage adapter
- [ ] Each expense row shows its name, Split Rule, Participants count and the per-member Share preview, in the widest centre column
- [ ] An Expense's continuity across Months is carried by a stable identity minted when it first appears; there is no Expense entity or registry table anywhere
