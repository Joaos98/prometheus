# Prometheus

A household finance tracker built on the **snapshot model**: every Month owns its own data, and opening a Month copies the Previous Month wholesale. Nothing is defined outside the Months — no templates, no profiles, no effective-dated timelines — so editing a Month changes only that Month. It is a **share calculator**: it deliberately does not track who actually paid, transfers between members, or settlement.

## Language

**Household**:
The shared space containing everyone's data. One deployment serves one Household, with any number of members, and every amount in it is in one currency — chosen at setup and relabellable afterwards, but never converted, and never exchanged for a currency of different decimal precision.
_Avoid_: account, workspace

**Member**:
A person in the Household. Members live on the Roster and are never deleted; each opened Month holds its own list of members, so past Months keep rendering their data regardless of who is on the Roster now.
_Avoid_: user

**Viewer**:
The member whose figures a given device highlights and sorts first, chosen on that device alone. It is a convenience and nothing more: it confers no permissions, hides nothing from anyone, and is not part of the Household's data.
_Avoid_: current user, logged-in member, account

**Roster**:
The Household's list of people, each either active or inactive. Opening a Month copies the active Roster into that Month; deactivating a member affects only Months opened afterwards, and reactivating brings them back with no record of absence.
_Avoid_: member list, participants

**Month**:
A calendar month, identified by year and month (e.g. 2026-07). All income, expenses, and savings contributions are recorded as per-Month snapshots.
_Avoid_: period, cycle

**Opening a Month**:
The explicit action that brings a Month's data into existence by copying the Previous Month wholesale — its members, income rows, and Expense Snapshots, every field intact. Any Month can be opened, past or future; browsing an unopened Month never opens it, and there is no closing action.
_Avoid_: creating a month, rollover, closing a month

**Discarding a Month**:
Undoing an open: every row of that Month is removed and it becomes unopened again, free to be opened afresh from the Previous Month. The only destructive action in the Household, so it names how many entries will be lost before it proceeds.
_Avoid_: deleting a month, closing, resetting

**Previous Month**:
The most recent opened Month before a given Month — not necessarily the preceding calendar month. Unopened Months are skipped, so gaps in the record are legal and a Month after a gap still auto-fills.
_Avoid_: last month, prior month

**Drift**:
The difference between a future Month's values and its Previous Month's values as they now stand — what a Month opened ahead of time missed when an earlier Month was later corrected. Covers only rows that are still Unreviewed there: a row somebody has answered for in that Month has missed nothing, and is left alone by Drift exactly as it is by Forward Propagation. Reported neutrally as a diff the member may refresh from; it is not an error state, and it ceases once the Month becomes current.
_Avoid_: staleness, outdated, mismatch

**Forward Propagation**:
Carrying an edit from one Month into the later Months that are already open, replacing values still Unreviewed there and leaving alone anything a member has touched. Months not yet opened need no propagation — they inherit.
_Avoid_: apply to future, cascade, bulk edit

**One-Off**:
A row that belongs to its Month alone: it appeared in no earlier Month, and the next Month opened does not inherit it. A one-time cost recorded and done with — an emergency repair, a bonus. Applies to income, Expense and Savings Goal rows alike.
_Avoid_: temporary, single, non-recurring

**Ends Here**:
A row that has been running and whose last Month this is: the next Month opened does not inherit it. The same mark as One-Off and the same effect, told apart by whether the row appeared in the Previous Month — because a cost that ran for a year and then stopped was never a one-off, and a Month browsed later should not claim it was.
_Avoid_: cancelled, discontinued, deleted, One-Off (for a row with a past)

**Share**:
The portion of an Expense attributed to one Participant, as computed by that month's Split Rule. An Expense with a single Participant yields one Share equal to the full amount — this is how individual expenses are recorded.
_Avoid_: split amount, owed amount, debt

### Income

**Income Snapshot**:
A row recording one named income source for one member in one Month, with its amount and its Restricted-Use flag. Like every other row, it is inherited from the Previous Month when the Month is opened and edited only within its own Month. There is no standing record of income outside the Months.
_Avoid_: income entry, income profile, income template

**Restricted-Use Income**:
An Income Snapshot flagged as spendable only on certain things, such as a meal-voucher benefit. It never counts toward Spendable Income and so never weights a Split Rule; it is not tied to the Expenses it can actually pay for, since Prometheus does not track who paid for what.
_Avoid_: earmarked income

**Spendable Income**:
A member's total income for a Month excluding Restricted-Use Income. Always the basis for proportional splits, whatever the dashboard is set to display, and the default basis of the Leftover Balance.

### Expenses

**Expense**:
A cost the Household records, existing only as its Snapshots — there is no definition living outside the Months. Its continuity across Months is carried by a stable identity minted when it first appears; an Expense stops recurring simply by being removed from a Month, as later Months inherit that absence.
_Avoid_: expense template, expense definition, recurring expense

**Expense Snapshot**:
A row recording the name, category, amount, Participants, and Split Rule for one Expense in one Month. Editing a snapshot changes only that Month, unless the edit is propagated forward. Opening a Month inherits every field from the Previous Month's snapshot; an Expense's very first Month has nothing to inherit, so it starts as Pending.
_Avoid_: expense entry, expense amount

**Repurposing**:
Renaming an inherited Expense Snapshot to record a different cost rather than the same one under a new name. Because only the member knows which was meant, renaming asks — continuing the Expense keeps its identity and its history, repurposing mints a new one.
_Avoid_: reusing, overwriting

**Split Rule**:
The rule that decides how an Expense is divided among its Participants: proportional to income (weighted by Spendable Income), even, or custom — per-participant percentages summing to exactly 100, or fixed amounts summing to exactly the total. Stored on each Month's Expense Snapshot, and never storable in a state that fails to sum exactly. When no Participant has any Spendable Income, a proportional rule divides evenly instead and the Expense says so.
_Avoid_: split method (acceptable shorthand)

**Participants**:
The subset of a Month's members that an Expense is divided among, or that a Savings Goal is shared by. A single-Participant Expense is an individual expense. Participants are stored per Month on the Snapshot, inherited from the Previous Month.
_Avoid_: beneficiaries

### Savings Goals

**Savings Goal**:
A named target the Household saves toward, existing only as its per-Month rows — name, optional target amount, start amount, and Participants — with a stable identity carried between them. Like an Expense, it stops recurring by being marked as ending in its final Month, and past Months keep their Contributions.
_Avoid_: fund, pot

**Contribution**:
The amount one Participant puts toward one Savings Goal in one Month, entered directly by that member. Goals have no Split Rule — nothing is ever divided.
_Avoid_: goal payment, deposit, saving

**Accumulated Progress**:
What a Savings Goal has reached as of the Month being viewed: that Month's start amount plus every Contribution made in that Month or earlier, measured against that Month's target. A past Month reports the progress that existed then, never today's.
_Avoid_: goal total, saved amount, balance

### Summary

**Leftover Balance**:
A member's position for a Month: their Spendable Income minus their expense Shares minus their Savings Goal contributions. May be negative; never carries into later Months. A per-viewer dashboard toggle substitutes total Income (including Restricted-Use) for Spendable Income in this figure alone — it changes nobody's Share and is not Household data.
_Avoid_: running balance, net

**Pending**:
A row that exists for a Month but has no amount entered at all (not even zero) — most often an Expense's first Month, which has nothing to inherit. Renders as a warning on the dashboard. An explicitly entered zero is not Pending.
_Avoid_: unentered, missing

**Unreviewed**:
A row that arrived by inheritance when the Month was opened and has not since been edited or confirmed by a member. Distinct from Pending: an Unreviewed row holds a number, just not one anyone has looked at yet.
_Avoid_: unconfirmed, stale, untouched
