# 03 — Expense Snapshots, Participants, and an even Split Rule

**What to build:** A member records a cost the household shares: a name, a category, an amount, and the Participants it divides among. The row shows each Participant's Share, and those Shares always sum to exactly the amount — no missing cent, and no member systematically absorbing the rounding. An expense with a single Participant is how an individual cost is recorded; there is no separate concept to learn.

Even splitting only in this ticket. The other Split Rules arrive in 04, but the Share machinery and its exactness guarantee are established here.

**Blocked by:** 01

**Status:** done

**Suggested model:** Opus, high thinking — the first Shares code. Both the exact-sum rounding and the test voice that ticket 04 copies are set here.

- [x] An Expense Snapshot records a name, category, amount, Participants and Split Rule, and can be added, edited and removed within its Month
- [x] Participants are a subset of the Month's members, stored on the Snapshot
- [x] A single-Participant Expense yields one Share equal to the full amount
- [x] Shares sum to exactly the Expense amount for every combination of amount and Participant count, including amounts that do not divide evenly
- [x] Remainder cents are allocated by largest remainder: each Share floors to a whole cent, leftover cents go one each to the Participants with the largest fractional parts, ties broken by a stable member order
- [x] The same Month data renders the same Shares every time — no dependence on anything outside the Month
- [x] A Pending Expense (null amount) produces no Shares and is flagged rather than treated as zero
- [x] Null, zero and absent amounts remain three distinct states through the storage port and the localStorage adapter
- [x] Each expense row shows its name, Split Rule, Participants count and the per-member Share preview, in the widest centre column
- [x] An Expense's continuity across Months is carried by a stable identity minted when it first appears; there is no Expense entity or registry table anywhere

## Comments

Built.

- `domain/shares.ts` — `sharesOf(month, expense)`, the machinery ticket 04 extends. Largest remainder in exact `bigint` arithmetic: floor each Share, then hand the leftover units one each to the largest fractional parts, ties falling to the Month's member order. `divide` already takes a weight per Participant, so a weighted rule inherits the exactness rather than reimplementing it. The `switch` on `splitRule.kind` is exhaustive, so adding a rule without computing it is a compile error.
- Exactness is asserted as a property, not an anecdote: every amount from 0 to 500 against one, two and three Participants, plus negatives, zero, and a Pending Expense yielding no Shares at all.
- `domain/expenses.ts` — add, edit and remove, with Participants validated as members of that Month and stored in the Month's order, each named once. An edit keeps the Expense's identity.
- `domain/rows.ts` grew the helpers income and expenses now share (`openedMonth`, `requireName`, `requireAmount`, `requireMember`, `withMonth`), and `ui/members.ts` holds the name lookup all three panels were repeating.

Nothing anywhere is an Expense entity: the identity is a field on the row, minted on first appearance, and no code reads it as a key into anything.
