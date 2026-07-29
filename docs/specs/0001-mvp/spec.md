# Spec 0001 — Prometheus MVP

Status: ready-for-agent

Covers the whole MVP as listed in [the system plan](../../prometheus-system-plan.md) §4. Vocabulary is [CONTEXT.md](../../CONTEXT.md); visual language is [the design brief](../../prometheus-redesign-brief.md); the decisions behind the model, and the alternatives rejected, are in [docs/adr/](../adr/). The repository currently contains no code, so this spec describes a build from nothing.

## Problem Statement

A household — two partners, a group of roommates, any small group sharing money — tracks its finances in a spreadsheet. Every month someone copies last month's tab, edits the numbers that changed, and fixes the formulas that broke. It mostly works, and it fails in specific ways:

- **Splitting is hard-coded into formulas.** Rent divides by income, groceries divide evenly, one person's gym membership divides not at all. Each of those is a hand-written formula, so changing how one expense divides means editing cells, and changing it for one month only means editing cells and remembering to change them back.
- **Nobody can tell which numbers were checked.** A copied tab arrives full of last month's figures. Every one of them looks entered. The salary that changed in March is still February's salary until somebody happens to notice.
- **History is fragile.** Correcting an old month re-runs its formulas against today's inputs, so last year's tab quietly stops saying what it said last year. Meanwhile deactivating a member, or adding one, breaks every past tab's layout.
- **Rounding is nobody's job.** Split three ways, €100 becomes three €33.33s and a missing cent, and the same person absorbs it every time.
- **The leftover figure is the point and it is the least trustworthy cell.** What each person has left after their shares and their savings is the number the household actually wants, and it depends on every formula upstream of it.

## Solution

A self-hosted webapp for one Household, built on the **snapshot model**: every Month owns its own data, and **opening a Month copies the Previous Month wholesale**. Nothing is defined outside a Month — no templates, no profiles, no effective-dated timelines — so editing a Month changes that Month and nothing else, and a Month browsed a year later still says what it said.

Against the four failures above:

- Each **Expense Snapshot** carries its own **Split Rule** and its own **Participants**, chosen per Month from proportional-to-**Spendable-Income**, even, or custom (percentages or fixed amounts). Changing August's split leaves July alone, with no ceremony and nothing to change back.
- Inherited rows arrive **Unreviewed**. The Month reports how many remain, and monthly entry becomes a checklist that ends at zero. **Pending** keeps its narrow meaning: no amount at all.
- Money is integer minor units and **Shares always sum to exactly the Expense**, with remainder cents placed by largest remainder against a stable member order.
- The **Leftover Balance** — Spendable Income minus Shares minus Contributions — is spelled out as that subtraction in a pinned rail, so the figure and its inputs are on screen together while rows are edited.

Prometheus is a **share calculator**. It does not track who actually paid, transfers between members, or settlement.

Two builds of one application, differing only in the data layer: a **self-hosted** deployment with real data on the household's own hardware, and a **public demo** that is static, browser-storage-only and ships seeded with a sample Household. Export from the demo and import into a deployment is the on-ramp.

## User Stories

### Setting up

1. As a household setting up Prometheus, I want to choose the Household's currency once, so that every amount in the app is unambiguous without me labelling any of them.
2. As a household setting up Prometheus, I want to relabel the currency later without any amount being converted, so that fixing a wrong choice at setup does not corrupt my figures.
3. As a household setting up Prometheus, I want to be prevented from switching to a currency with different decimal precision, so that stored minor units never silently change meaning.
4. As a household setting up Prometheus, I want to add the Roster — everyone who shares money here — so that Months have people to divide expenses among.
5. As a household setting up Prometheus, I want to pick which Month to start from, so that I can begin at the month I actually have figures for rather than today.
6. As a household setting up Prometheus, I want that first Month to open empty rather than warn me it inherited nothing, so that the one Month with nothing before it is not treated as an error.
7. As a household that has just set up, I want to enter income, expenses and goals once and have every later Month build on it, so that setup cost is paid a single time.

### The Roster

8. As a member, I want to add someone to the Roster, so that Months opened afterwards include them.
9. As a member, I want to deactivate someone who has left, so that Months opened afterwards no longer include them while every past Month keeps rendering exactly as it did.
10. As a member, I want deactivation never to delete a person, so that a Month from before they left still names them and still shows their figures.
11. As a member, I want to reactivate someone who returns, so that they appear in Months opened afterwards with no record of the absence.
12. As a member, I want the Roster to be separate from a Month's list of members, so that changing the Roster today cannot alter what any Month says.

### Opening, browsing and discarding Months

13. As a member, I want to browse a Month I have not opened without opening it, so that looking at the record never changes it.
14. As a member, I want to see plainly that a Month is unopened and what opening it would copy from, so that I know what I am about to get.
15. As a member, I want to open a Month explicitly, so that the moment its data comes into existence is a decision I made.
16. As a member, I want opening a Month to copy the Previous Month wholesale — members, Income Snapshots, Expense Snapshots, Savings Goals, every field — so that I only have to touch what changed.
17. As a member, I want the Previous Month to be the nearest *opened* Month before this one, so that a gap in the record does not force a Month to start from nothing.
18. As a member, I want to open a Month in the past, so that I can enter history I skipped.
19. As a member, I want to open a Month in the future, so that I can plan ahead.
20. As a member, I want there to be no closing action, so that a Month never becomes read-only and a correction is always possible.
21. As a member, I want rows marked One-Off in the Previous Month not to be inherited, so that a cost I ended stays ended.
22. As a member, I want to discard a Month I opened by mistake, so that it becomes unopened again and can be opened afresh.
23. As a member, I want discarding to tell me how many entries will be lost before it proceeds, so that the one destructive action in the app cannot be taken casually.

### Income

24. As a member, I want to record income as rows on the Month, one per named source, so that a second job or a bonus is visible as itself rather than folded into a total.
25. As a member, I want each Income Snapshot to belong to one member, so that the split has something to weight by.
26. As a member, I want income rows to inherit on open like everything else, so that a salary that did not change needs no entry.
27. As a member, I want to flag an income source as Restricted-Use, so that a meal-voucher benefit stops inflating what I can actually spend.
28. As a member, I want Restricted-Use Income never to count toward Spendable Income, so that it never weights a proportional Split Rule.
29. As a member, I want Restricted-Use Income not to be tied to the expenses it could pay for, so that the app does not drift into payment tracking.
30. As a member, I want to mark an income row One-Off, so that a one-time bonus does not recur next Month.
31. As a member, I want to add an income source mid-history, so that a new job is entered in the Month it started.
32. As a member, I want to remove an income row, so that later Months inherit its absence and I never have to end it twice.

### Expenses and Split Rules

33. As a member, I want to record an expense with a name, category, amount, Participants and Split Rule, so that one row carries everything about how that cost lands.
34. As a member, I want to split an expense proportionally to Spendable Income, so that the person earning more carries more of the rent.
35. As a member, I want to split an expense evenly, so that costs where income is irrelevant divide the obvious way.
36. As a member, I want to split an expense by custom percentages, so that an arrangement we agreed on can be entered as we agreed it.
37. As a member, I want to split an expense by custom fixed amounts, so that "you put in 200, I cover the rest" can be entered directly.
38. As a member, I want percentages to be required to total exactly 100 and fixed amounts to total exactly the expense, so that a split that does not add up cannot be saved.
39. As a member, I want to be told what is wrong while a split does not add up, so that I can fix it rather than guess.
40. As a member, I want an expense with a single Participant to be how an individual cost is recorded, so that there is no second concept to learn.
41. As a member, I want to change Participants on one Month's snapshot, so that a month somebody was away divides among the people who were here.
42. As a member, I want a proportional split to divide evenly and say so when no Participant has any Spendable Income, so that a month with no income still produces Shares.
43. As a member, I want Shares to sum to exactly the expense amount every time, so that the household's totals reconcile.
44. As a member, I want remainder cents placed by largest remainder against a stable member order, so that nobody systematically absorbs the rounding and the same Month always renders the same Shares.
45. As a member, I want to see each Participant's Share previewed on the expense row, so that I can judge a split without opening anything.
46. As a member, I want an expense's continuity across Months to be carried by a stable identity, so that propagation and history can follow the same cost across name changes.
47. As a member, I want renaming an inherited expense to ask whether this is the same cost or a different one, so that overwriting "Netflix, 12" with "Gym, 40" does not silently inherit Netflix's history.
48. As a member choosing "the same expense", I want the identity and history kept, so that a renamed subscription stays one thread.
49. As a member choosing "a different expense" (Repurposing), I want a new identity minted, so that the new cost starts its own history and the old one ends cleanly.
50. As a member, I want to stop an expense recurring by removing it from a Month, so that ending a cost needs no flag.
51. As a member, I want to stop an expense recurring by marking it One-Off in its final Month, so that I can keep the last month's record while ending the thread.
52. As a member, I want an expense's first Month to be Pending rather than zero, so that "nothing to inherit" is not mistaken for "costs nothing".
53. As a member, I want name and category to be allowed to differ between Months, so that a row can be corrected without arguing with history.

### Savings Goals

54. As a member, I want to create a Savings Goal with a name, so that we can track what we are saving toward.
55. As a member, I want a goal's target amount to be optional, so that saving without a fixed number is supported.
56. As a member, I want to set a goal's start amount, so that money already saved before Prometheus is counted.
57. As a member, I want to choose a goal's Participants, so that a goal only two of us are saving for is not everybody's.
58. As a member, I want to enter each Participant's Contribution directly, so that nothing about a goal is ever divided by a rule.
59. As a member, I want Accumulated Progress measured as of the Month I am viewing — that Month's start amount plus every Contribution in that Month or earlier — so that a past Month reports the progress that existed then.
60. As a member, I want progress measured against that Month's target, so that raising the target later does not rewrite last year's progress.
61. As a member, I want a goal to stop recurring by being marked One-Off in its final Month, so that reaching a target ends the goal while past Contributions stay.
62. As a member, I want goals to inherit their name, target, start amount and Participants on open, so that only the Contributions need entering each Month.
63. As a member, I want a goal row to show every member of the Month rather than only its Participants, with non-Participants greyed and named as such, so that "who is not saving for this" is answerable from the dashboard.
64. As a member, I want a goal row collapsed to show accumulated progress against target and the Month's total contribution, so that the right column stays scannable.
65. As a member, I want to expand a goal row to see every member's Contribution, the start amount, and Accumulated Progress as of this Month, so that the detail is available without a separate screen.

### The Month dashboard

66. As a member, I want the whole of a Month to fit one ordinary desktop window, so that a monthly review does not involve losing sight of half of it.
67. As a member, I want the Month's name centred in the header, so that the three columns start level and the title does not shift as the header's other content changes width.
68. As the Viewer, I want my Leftover Balance in a pinned left rail with its subtraction spelled out — Spendable Income, minus Shares, minus Contributions — so that I can see which input moved when the figure moves.
69. As the Viewer, I want the other members' Leftover Balances beneath mine in the rail, so that the comparison a share calculator exists for is always on screen.
70. As the Viewer, I want the rail to stay put while the rows scroll, so that editing an expense shows me its effect immediately.
71. As a member, I want Expenses in the widest, centre column, so that the rows carrying the most information get the most room.
72. As a member, I want each expense row to carry its name, Split Rule, Participants count, review state and per-member Share preview, so that the row answers the questions I have about it.
73. As a member, I want Income and Savings Goals sharing the right column, so that the two lighter panels do not each claim a column of their own.
74. As a member, I want to see the whole Month as it stands rather than only the rows needing attention, so that reviewing August tells me what August says.
75. As a member, I want the Month's own facts in the rail — which Month it was copied from, and the Drift standing against later opened Months — so that where this Month came from is not a mystery.
76. As a member, I want the dashboard to hold when the layout is too narrow for three columns by collapsing to one, so that a smaller window degrades rather than breaks.

### Review state

77. As a member, I want every inherited row to arrive Unreviewed, so that a copied figure is visibly a copied figure.
78. As a member, I want editing a row to clear its Unreviewed mark, so that reviewing is the same act as working.
79. As a member, I want to confirm a row that is correct as inherited without editing it, so that "still 62" is one click rather than a retyped 62.
80. As a member, I want the Month to report how many rows remain Unreviewed, so that monthly entry is a checklist with an end.
81. As a member, I want the review meter in the pinned rail rather than a footer, so that the count does not scroll away from the rows it describes.
82. As a member, I want review marks on the rows themselves, in place, so that I can see which specific row still needs me.
83. As a member, I want a Pending row — no amount at all — rendered as a warning, so that the one genuine error state looks like one.
84. As a member, I want an explicitly entered zero not to count as Pending, so that "this cost nothing this month" is a real answer.
85. As a member, I want Unreviewed and Pending to be visibly different things, so that "holds a copied number" and "holds no number" are not confused.

### Forward Propagation

86. As a member correcting an earlier Month, I want to carry the correction into later Months that are already open, so that fixing a rent increase once fixes it everywhere it was copied.
87. As a member propagating, I want values that are still Unreviewed replaced, so that untouched copies of the old figure are the ones that change.
88. As a member propagating, I want values a member has touched left alone, so that a deliberate decision in a later Month is never silently undone.
89. As a member propagating, I want to be told what was skipped and where, so that I can go and look at the Months that kept their own answer.
90. As a member, I want propagation to need nothing for Months not yet opened, so that the future costs me no thought — it inherits.
91. As a member, I want propagation to match rows by their stable identity, so that a renamed expense is still found.

### Drift

92. As a member with a Month opened ahead of time, I want it to report its difference from the Previous Month as it now stands, so that correcting July shows me what August missed.
93. As a member, I want Drift reported as a neutral diff rather than a warning, so that a deliberate edit in a future Month is not flagged as a mistake.
94. As a member, I want to refresh a drifted value from the Previous Month, so that acting on the diff is one step.
95. As a member, I want Drift to cover everything a Month contains — amounts, participants, split rules, membership — so that the diff is not narrower than the copy that produced it.
96. As a member, I want Drift to cease once the Month becomes current, so that it does not linger as a permanent annotation.

### Viewer and display preferences

97. As a member at a shared machine, I want to pick which member the dashboard highlights and sorts first, so that my own figures are where I look.
98. As a member, I want that choice to live on this device only and grant nothing, so that it is a convenience rather than a login.
99. As a member, I want the Viewer to default to nobody, so that a fresh device does not pretend to know who I am.
100. As the Viewer, I want to toggle whether Restricted-Use Income counts toward the Leftover Balance, so that I can see both "what I can spend on anything" and "what came in".
101. As the Viewer, I want that toggle to change nobody's Share, so that a display preference cannot move real figures.
102. As the Viewer, I want the toggle beside the Leftover Balance it affects, so that the figure and its setting are together.
103. As a member, I want neither the Viewer nor the toggle stored as Household data, so that they never travel in an export or between devices.

### Navigation and history

104. As a member, I want to move to the next and previous Month directly, so that comparing consecutive Months is fast.
105. As a member, I want to jump to any Month by year and month, so that reaching last November is not eleven clicks.
106. As a member, I want opened and unopened Months distinguished in navigation, so that I can see the shape of the record at a glance.
107. As a member, I want every figure in a past Month to be that Month's own truth, computed from its own rows, so that browsing history is trustworthy.

### Export, import and deployment

108. As a self-hoster, I want to export the whole Household as a JSON file, so that I have a backup without touching Docker volumes.
109. As a self-hoster, I want to import a Household from JSON, so that a backup is actually a restore.
110. As a self-hoster, I want to be told what an import will replace before it happens, so that restoring cannot quietly destroy the current data.
111. As a self-hoster, I want an import of a file the app cannot read to fail cleanly and change nothing, so that a bad file is not a half-migration.
112. As a self-hoster, I want to run Prometheus on my own hardware with one container, so that deployment is an evening rather than a project.
113. As a self-hoster, I want no login, no accounts and no permissions, so that the household is not administering itself.
114. As two members editing different rows at once, I want both edits kept, so that sharing the app in real time works.

### The demo

115. As someone evaluating Prometheus, I want a public demo I can open without installing anything, so that I can decide whether to self-host.
116. As someone evaluating Prometheus, I want the demo fully functional rather than a screenshot tour, so that I am judging the real thing.
117. As someone evaluating Prometheus, I want the demo to arrive seeded with a sample household — mixed Split Rules, real Leftover Balances, a goal partway to target — so that the first screen shows what the app does.
118. As someone evaluating Prometheus, I want my demo changes to persist in my browser and to be reset on request, so that I can experiment and start over.
119. As someone evaluating Prometheus, I want to export what I built in the demo and import it into my own deployment, so that the trial is not thrown away.
120. As someone evaluating Prometheus, I want the demo to need no backend, so that it is not a service that can go down or see my data.

### Vocabulary and correctness

121. As a member, I want the app's words to be the Household's words — Month, Share, Leftover Balance, Unreviewed — so that CONTEXT.md is the same language on screen and in the code.
122. As a developer, I want one engine computing every rule for both builds, so that the demo cannot diverge from the self-hosted app.
123. As a developer, I want the domain free of framework and I/O imports, so that the rules are testable without a browser or a server.
124. As a developer, I want the storage port expressed in domain operations rather than as a mirror of an HTTP API, so that the localStorage adapter is not a fetch shim faking HTTP.
125. As a developer, I want the demo seed to drive the real domain the way a member would, so that a change that breaks the model breaks the seed loudly.

## Implementation Decisions

### Shape of the system

- **One repository, plain directories** — `domain/`, `storage/`, `ui/`, `server/`. Not a pnpm monorepo; the boundaries that matter are enforced by the storage port and by keeping `domain/` free of framework and I/O imports (ADR-0008).
- **TypeScript throughout. Vue 3 + Vite** for the UI, building both targets. Vitest for tests. Docker multi-stage for self-hosting; the demo is a static Vite build.
- **The domain engine runs client-side in both builds** (ADR-0007). Split Rules, largest-remainder rounding, Leftover Balance, Accumulated Progress, Drift and Forward Propagation all execute in the browser. The self-hosted server stores and returns rows and imports no domain code.
- **The whole Household loads into memory.** A Household's entire history is a few thousand rows, so cross-Month work — Accumulated Progress as of a Month, Previous Month resolution, Drift — is in-memory traversal rather than a query problem.

### The domain model

- **No entity lives outside a Month.** No Expense table, no Savings Goal table, no Income Profile, no Expense Template, no registry of any kind (ADR-0003, ADR-0004). A Household is: currency, Roster, and a set of opened Months. A Month is: its own member list, Income Snapshots, Expense Snapshots, Savings Goals with their Contributions.
- **Continuity is a stable identity on the row**, minted when a row first appears and copied by inheritance and propagation. It identifies a thread across Months; it is not a record with a lifecycle, and nothing creates, ends or garbage-collects it.
- **Months are keyed by year and month** (`2026-07`). Unopened Months are absent, not empty — the distinction between "no Month" and "an opened Month with no rows" is load-bearing, because the first Month of a Household is legitimately the latter.
- **Previous Month is derived, never stored**: the greatest Month key less than the target that is present in the Household. Gaps are legal.
- **Money is integer minor units** of the Household's single currency, everywhere, with no floating point in the engine (ADR-0002). The currency carries a decimal precision; relabelling is allowed, changing precision is not.
- **`amount` is nullable and null means Pending** — no amount entered at all. An explicit `0` is a value. This distinction must survive serialisation in both adapters and in export JSON.
- **Review state is a per-row flag** set on inheritance and cleared by edit or explicit confirmation. It is Household data (it must be the same for everyone looking at the Month), unlike the Viewer.

### Opening a Month

- Opening is one engine operation: given a Household and a target Month key, produce the new Month by deep-copying the Previous Month's rows — every field, including Participants, Split Rule, name, category, goal target and start amount — assigning fresh Contribution values of nothing, preserving each row's stable identity, marking every copied row Unreviewed, and dropping rows flagged One-Off.
- The One-Off flag itself is not inherited (there is nothing to inherit it onto).
- A Month's member list is copied from the Previous Month's member list, not re-derived from the Roster — except for the Household's very first Month, which takes the active Roster. This is what keeps a past Month rendering after the Roster changes.
- Opening with no Previous Month yields an opened Month containing the active Roster and no rows. This is not Pending and not an error.
- **Discarding** removes the Month key entirely and reports the number of rows it will remove before proceeding. It is the only destructive operation.

### Split Rules and Shares

- A Split Rule is a discriminated union stored on each Expense Snapshot. The shape, which came out of prototyping:

  ```ts
  type SplitRule =
    | { kind: 'even' }
    | { kind: 'proportional' }                          // weighted by Spendable Income
    | { kind: 'percentage'; byMember: Record<MemberId, number> }  // must total exactly 100
    | { kind: 'fixed'; byMember: Record<MemberId, Minor> }        // must total exactly the amount
  ```

  `proportional` stores no weights — it reads the Month's Spendable Income at computation time, so correcting an income figure updates the split without touching the expense.
- **Share computation is a pure function** of (amount, Participants, Split Rule, the Month's Spendable Income per member, member order) returning a Share per Participant that sums to exactly the amount. Largest remainder: floor each Share, then distribute leftover cents one each in descending fractional part, ties broken by the Month's stable member order.
- `proportional` with zero total Spendable Income across all Participants **falls back to `even`** and the result reports that it did, so the UI can say so. The stored rule is unchanged.
- **Validity is enforced at the boundary**: a `percentage` or `fixed` rule that does not total exactly cannot be saved, and there is no code path that writes one. Changing an expense's amount while a `fixed` rule is attached must therefore be a single operation that validates both together.
- A Pending expense (null amount) produces no Shares. It contributes nothing to any Leftover Balance and is flagged instead.

### Derived figures

- **Spendable Income** per member per Month: sum of that member's Income Snapshots excluding Restricted-Use.
- **Leftover Balance** per member per Month: Spendable Income minus the sum of that member's Shares across the Month's Expenses minus the sum of their Contributions. May be negative. Never carries forward. The Viewer's restricted-use toggle substitutes total Income for Spendable Income **in this figure only** — it is applied as a display parameter at the call site, never stored, and never reaches Share computation.
- **Accumulated Progress** for a goal as of a Month: that Month's start amount plus every Contribution to that goal identity in that Month or any earlier Month, measured against that Month's target.

### Renaming an inherited Snapshot

- Editing the name of a Snapshot that is still Unreviewed, or that was inherited, prompts: continue this Expense, or begin a different one. Continue keeps the identity. Repurpose mints a new identity for the row in this Month onward, ending the old thread here.
- The prompt is raised by the UI, but which rows are eligible for it — inherited, identity shared with the Previous Month — is a question the engine answers.

### Forward Propagation

- One engine operation: given a source Month, a row identity and the field(s) edited, walk every *opened* Month after the source in order, and for each row matching that identity, replace the value if the row is Unreviewed, skip if it is not. Returns the list of Months changed and the list skipped, with reasons.
- Propagation walks forward through consecutive opened Months and stops at nothing — a Month that kept its own value does not block the ones after it.
- Unopened Months are not touched and need no handling; they inherit.

### Drift

- One engine query: for an opened Month, compute what opening it *now* from its Previous Month would produce, and diff that against what it holds. Reported as a neutral per-row, per-field diff with a refresh action per difference.
- Drift covers every field the copy covers, including membership.
- A Month that is not after the current Month reports no Drift.

### The storage port

- Expressed in **domain operations, not HTTP verbs** (ADR-0007): load the Household, open a Month, write a row, delete a row, replace the whole Household (import). Two adapters — HTTP against the SQLite-backed server, and `localStorage` — with no shared assumption of request/response semantics.
- **Writes are row-scoped**, not whole-Household, so two members editing different rows never collide (ADR-0008). Same-row collisions are last-write-wins. The client refetches on window focus and polls lightly while a Month is open.
- Export is a serialisation of the in-memory Household; import replaces it wholesale after validating the file, and reports what will be replaced first. A file that fails validation changes nothing.
- Every schema change is paid twice: a SQLite migration and a `localStorage` shape migration. This is a known, accepted, recurring cost.

### The server

- A small Node process: static files plus row-level CRUD over SQLite via `better-sqlite3`. No domain knowledge, no engine import, no validation of domain invariants — invariants are enforced client-side, which is acceptable given no auth, a private network, one Household and a single known client (ADR-0007).
- No accounts, no sessions, no permissions (ADR-0006).

### The demo

- Static Vite build with the `localStorage` adapter, seeded by **a program that drives the real domain the way a member would** (ADR-0009): create the Household, open a Month, enter income, add Expenses with mixed Split Rules, open the next Month, correct amounts, contribute to a goal. Not fixture rows. Resetting the demo re-runs it.
- The seed must exercise opening, inheritance, propagation and Drift, so that it doubles as an integration test.

### UI

- Month dashboard is the three-column layout of ADR-0010: pinned left rail (Viewer's Leftover Balance with its subtraction and the restricted-use toggle, other members' Leftover Balances, review meter, Month facts including copied-from and Drift), Expenses in the widest centre column, Income and Savings Goals sharing the right column. Month name centred in the header. Below ~1240px the columns collapse to one and the rail unpins.
- Goal rows list every member of the Month with non-Participants greyed and named as such; collapsed shows progress against target and the Month's total contribution, expanded shows every member's Contribution, the start amount and Accumulated Progress as of this Month.
- Visual language per the design brief: dark only, `#12141C` page, `#1A1D28` surfaces, 0.5px `#262A38` hairlines rather than shadows, `#E8935C`/`#F0A868` fire accent for primary actions and key totals, `#7DC9E8` sparingly for goal progress, two font weights, 12px card radius.
- The UI uses the domain's vocabulary verbatim and respects the *Avoid* lists in CONTEXT.md — no "user", "account", "period", "rollover", "bulk edit", "debt".

## Testing Decisions

### What makes a good test here

A good test states a rule of the domain in the domain's own words and would survive any reasonable reimplementation of the code beneath it. It sets up a Household, performs an operation a member could perform, and asserts on what a member could see: the Shares on an Expense, a Leftover Balance, which rows came out Unreviewed, what a diff reports. It does not reach for internal helpers, assert on the shape of intermediate values, or know how rounding is implemented — only that Shares sum exactly and that the cent went to the largest remainder.

The bar for this codebase: **a test should read as a sentence from CONTEXT.md.** "Opening a Month copies the Previous Month wholesale" is a test. "`copyRow` is called once per row" is not.

### Seams

**Two seams, agreed with the developer.**

**1. The domain engine's public API** — the primary seam and where nearly every test lives. Pure functions and operations over a Household value, no I/O, no framework, no mocks needed anywhere. Tested through it:

- Opening: inherits every field; drops One-Off; marks copied rows Unreviewed; preserves identities; first Month takes the active Roster; a Month after a gap inherits from the nearest opened Month; opening with no Previous Month yields an empty opened Month, not Pending.
- Previous Month resolution across gaps, and at the start and end of the record.
- Discarding: the Month becomes absent again, the reported row count matches, reopening copies afresh.
- Split Rules: all four kinds; Shares sum to exactly the amount for every rule at awkward amounts and participant counts; largest remainder places cents on the largest fractional parts with ties broken by member order; determinism — same Month data, same Shares, twice; `proportional` with zero Spendable Income falls back to even and reports it; invalid `percentage`/`fixed` rules are rejected; changing an amount under a `fixed` rule validates both together.
- Restricted-Use Income excluded from Spendable Income, and therefore from proportional weighting.
- Leftover Balance, including negative results, and the restricted-use display substitution changing the balance while leaving every Share identical.
- Pending: null amount produces no Shares and is flagged; explicit zero is a value and is not Pending.
- Accumulated Progress as of a Month, against that Month's target, unaffected by later Months' Contributions or later target changes.
- Review state: inheritance sets it, edit clears it, explicit confirmation clears it, the Month's count is right.
- Forward Propagation: replaces Unreviewed, skips touched, reports both, matches by identity across a rename, crosses a Month that kept its own value, ignores unopened Months.
- Drift: reports divergence from the Previous Month across every field including membership; a refresh resolves one difference; no Drift for a non-future Month.
- Repurposing: continuing keeps the identity and the thread, repurposing mints a new one and ends the old at that Month.
- Export/import round-trips a Household with no loss, including null-vs-zero amounts and review state; an invalid file is rejected and changes nothing.

**2. One storage-port contract suite, run against both adapters** (mandated by ADR-0008). One set of tests, parameterised over the HTTP/SQLite adapter and the `localStorage` adapter, asserting that both honour the port's domain contract identically: load returns what was written; row-scoped writes to different rows do not clobber each other; same-row writes are last-write-wins; a null amount survives a round-trip as null and not as zero or absent; replace-whole-Household is atomic; migrations leave existing data readable. Written once, so an adapter that diverges fails immediately.

**Not a seam: the demo seed program** (ADR-0009), which drives seam 1 as a member would and therefore functions as the end-to-end integration test — create, open, enter, open again, correct, propagate, drift. It is run in CI as a test, not just built as sample data.

**No UI-level tests in the MVP.** The dashboard is verified by running the app against the seed.

### Prior art

There is none — the repository has no code. This spec establishes the prior art, so the first tests written set the pattern the rest follow: engine tests as sentences over a Household value, and one parameterised contract suite for the port.

## Out of Scope

Everything on the system plan's V2 list:

- **Composite expenses** (multiple variable sub-items rolling up into one total). ADR-0010 notes the centre column's spare vertical room is headroom for these; the layout anticipates them, the MVP does not build them.
- **Savings projections** (estimated time to target from recent contributions).
- **Visual trends over time** (income vs. expenses, spending by category, goal progress charts).
- **Categories as first-class entities** for expenses, income sources and goals. Expense Snapshots carry a category field in the MVP; managing a category vocabulary is V2.

Also out of scope, and deliberately so:

- **Payment tracking of any kind** — who actually paid, transfers between members, settlement, marking a Share as paid. Prometheus is a share calculator. Restricted-Use Income is specifically *not* tied to the expenses it could pay for for this reason.
- **Authentication, accounts, sessions, permissions, per-member views** (ADR-0006). This is the constraint to revisit first if the app were ever exposed beyond a private network.
- **Multiple Households per deployment**, and multiple currencies or conversion within one.
- **Scheduling forward-looking changes.** A raise is entered in the Month it takes effect, or in an already-opened future Month (ADR-0004 consequence). There is no effective-dating anywhere, and reintroducing it is what this model exists to avoid.
- **Templates, profiles, or any standing definition outside a Month** (ADR-0003, ADR-0004), including an "ended" flag on a recurring row.
- **Server-side domain logic**, validation or computation (ADR-0007).
- **Scheduled work, notifications, background jobs.** The server is deliberately dumb; ADR-0007 records that this becomes a liability if any of these are ever wanted.
- **Real-time collaborative editing** beyond row-scoped writes plus focus refetch and light polling. Same-row last-write-wins is accepted.
- **A narrow-screen design.** Below ~1240px the layout collapses to one column and stops being pinned; a genuine mobile design is not specified (ADR-0010 consequence).
- **A light theme** (design brief: dark by default, light not required).
- **Rosters larger than about four members** rendering well in the rail. ADR-0010 records that the other-members list needs its own treatment past that; the panel columns are unaffected.
- **Public internet exposure of the self-hosted build.**

## Further Notes

- Where this spec and the system plan disagree, the ADRs decide. The four binding documents are currently consistent with each other: the system plan, CONTEXT.md and the design brief all reflect ADR-0003 and ADR-0004, and neither Expense Templates nor the Income Profile survives anywhere except in the ADRs that removed them and in CONTEXT.md's *Avoid* lists, where they belong.
- ADR-0001 and the Consequences sections of ADR-0003 and ADR-0004 still describe Templates and Profiles in the present tense, and ADR-0003/0004 note a departure from an MVP list that has since been updated. These are left as written — an ADR records a decision as it was made, and ADR-0004 already states which parts of ADR-0001 it supersedes. Read them as history, not as current requirements.
- The riskiest thing in this spec is the **null-vs-zero amount**. Pending is defined as "no amount at all, not even zero", and that distinction has to survive the engine, both storage adapters, export JSON and the UI's number inputs. It is the most likely place for a silent bug, which is why it appears in both seams' test lists.
- The second riskiest is **`fixed` split rules against a changing amount**. A fixed rule is only valid relative to a specific total, so amount and rule cannot be edited independently. ADR-0003 records that Templates were dropped partly because they could mint an invalid snapshot at birth — the same trap exists on any edit path that changes an amount without revalidating the rule.
- **Build the engine first, against seam 1, with no UI and no storage.** Every hard decision in this spec is a domain decision, and all of them are testable with no adapter and no browser. The storage port and its contract suite come second; the dashboard, whose layout is already settled by ADR-0010, comes third; the demo seed last, where it can drive a finished engine.
- ADR-0010's layout was settled by prototyping six variants against a seeded three-member Month. The seeded-Month approach is worth reusing for any UI question this spec leaves open.
