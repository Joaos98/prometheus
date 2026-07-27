# Prometheus MVP — Household Finance Tracker

Status: ready-for-agent

## Problem Statement

A household — two partners, roommates, or any small group sharing finances — tracks income, shared and individual expenses, and savings goals in a spreadsheet. The spreadsheet fights them at every turn:

- **Splits are hand-maintained formulas.** Different expenses need different split methods (rent proportional to income, groceries even, the streaming service custom), and each formula is a fragile cell expression that breaks when someone edits the wrong row.
- **History rewrites itself.** Change an income figure or a split formula and every past month silently recomputes — or worse, half-recomputes. Nobody trusts last quarter's numbers.
- **Forgotten entries are invisible.** Skip a month's electricity bill and that month just looks cheaper. Nothing signals the gap.
- **Restricted income pollutes the picture.** A meal-voucher benefit sits in the same column as salary, inflating how much "free" money a member appears to have — money that can't pay rent.
- **One-off items have no home.** A bonus or a repair gets mashed into a recurring row and has to be un-mashed the following month.

## Solution

Prometheus replaces the spreadsheet with a webapp built around three ideas:

1. **Set it up once, then just enter amounts.** Members, income sources, expenses, and savings goals are persistent definitions with an Effective From Month. Income carries forward until changed; recurring expenses and goals stay active until ended. The monthly ritual is: enter this month's actual amounts, review the dashboard.
2. **How things split is a first-class, per-item choice.** Every shared expense and shared savings goal picks its own Participants and Split Rule — proportional to Spendable Income, even, or custom (percentages or fixed amounts). One reusable concept, not two separate features.
3. **History is stable by construction.** All changes are effective-dated: they apply from a chosen Month onward and never silently alter earlier Months. Past Months stay reviewable and correctable, and recompute deterministically under the rules that were in effect for them.

The dashboard gives each member a clear monthly position: income in, their Share of every expense and goal contribution, and their Leftover Balance — with a view toggle for Restricted-Use Income.

Prometheus is a **share calculator** (ADR-0001): it computes who bears what share. Who actually paid, transfers between members, and settlement happen outside the app.

## User Stories

### Household & members

1. As a household member, I want to create the household and set its currency once at setup, so that every amount in the app shares one currency.
2. As a household member, I want the currency to be unchangeable after setup, so that historical amounts are never silently re-denominated.
3. As a household member, I want to add members to the household, so that each person's finances are tracked individually.
4. As a household member, I want to rename a member, so that the display stays correct when names or preferences change.
5. As a household member, I want to record a new member as joining Effective From a specific Month, so that Months before they joined don't include them.
6. As a household member, I want to record a member as departing Effective From a specific Month, so that they drop out of active expenses and goals going forward.
7. As a household member, I want departed members to remain visible in past Months' summaries, so that history still shows their real income, Shares, and Leftover Balances.

### Income

8. As a household member, I want to add an income source for a member with an amount and an Effective From Month, so that it's recorded once.
9. As a household member, I want income to carry forward unchanged Month to Month, so that I never re-enter a salary that hasn't changed.
10. As a household member, I want to update an income source's amount Effective From a chosen Month, so that earlier Months keep the old amount.
11. As a household member, I want to end an income source Effective From a Month, so that a job change stops it cleanly going forward.
12. As a household member, I want a member to have multiple income sources, so that a salary plus a side income are tracked separately.
13. As a household member, I want to record a one-off income for a single Month, so that a bonus is captured without disturbing ongoing sources.
14. As a household member, I want to flag an income source as Restricted-Use once, at setup, so that its limited spendability is remembered permanently.
15. As a household member, I want Restricted-Use Income excluded from Spendable Income by default, so that figures representing freely usable money stay honest.

### Expenses

16. As a household member, I want to create a recurring expense Effective From a Month, so that it's defined once.
17. As a household member, I want recurring expenses to stay active until ended, so that I never re-create rent each month.
18. As a household member, I want to choose the Participants of a shared expense, so that costs involving only some members are split only among them.
19. As a household member, I want to split a shared expense proportionally to Spendable Income, so that the higher earner bears more of it.
20. As a household member, I want to split a shared expense evenly, so that equal-use costs divide equally.
21. As a household member, I want a custom split entered as per-participant percentages that must total exactly 100, so that unequal arrangements are expressible.
22. As a household member, I want a custom split entered as per-participant fixed amounts that must total exactly the expense's total, so that exact-amount arrangements are expressible.
23. As a household member, I want invalid custom splits rejected at entry with a clear message, so that Shares always sum exactly to the total.
24. As a household member, I want an individual expense to just be an expense with one Participant, so that I never configure splits for personal costs.
25. As a household member, I want to turn an individual expense into a shared one by editing its Participants, so that a couch bought for one becoming everyone's is an edit, not a migration.
26. As a household member, I want to enter each active expense's actual amount per Month, so that variable bills reflect reality.
27. As a household member, I want to record a one-off expense for a single Month, so that a repair or gift is captured without creating a recurring item.
28. As a household member, I want to end an expense Effective From a Month, so that a cancelled subscription stops appearing going forward but stays in history.
29. As a household member, I want active expenses with no amount entered for a Month flagged as unentered, so that a forgotten bill can't silently make the month look cheaper.
30. As a household member, I want to explicitly enter $0 for a genuinely-zero bill as a distinct act, so that "zero" and "forgotten" are never confused.

### Savings goals

31. As a household member, I want to create an individual savings goal with an optional target amount, so that personal targets are tracked.
32. As a household member, I want to create a savings goal shared among chosen Participants with its own Split Rule, so that one member can comfortably contribute more than another toward the same goal.
33. As a household member, I want to enter goal contributions per Month, so that tight months and great months are both recorded as they actually happened.
34. As a household member, I want each Month's contribution divided among Participants by the goal's Split Rule, so that each member's set-aside is computed consistently with expenses.
35. As a household member, I want to see each goal's accumulated contributions against its target, so that progress is visible.
36. As a household member, I want to end a goal when it's completed or abandoned, so that it stops appearing going forward while history keeps it.
37. As a household member, I want unentered contributions flagged the same way as unentered expenses, so that a skipped month of saving is visible.

### Dashboard

38. As a household member, I want a monthly dashboard showing each member's income, expense Shares, contribution Shares, and Leftover Balance, so that everyone's position is clear at a glance.
39. As a household member, I want to see exactly how each shared expense and goal contribution split among its Participants for the Month, so that the math is transparent and disputable.
40. As a household member, I want Restricted-Use Income shown separately on the dashboard, so that it's visible without inflating spendable figures.
41. As a household member, I want a view toggle for whether Restricted-Use Income counts toward the Leftover Balance, so that I can see the position both ways without changing any data.
42. As a household member, I want a negative Leftover Balance displayed plainly as negative, so that overspending is information, not a hidden error.
43. As a household member, I want a Month with unentered expenses or contributions visibly marked incomplete on the dashboard, so that I know its totals aren't final.
44. As a household member, I want a proportional split that fell back to even (because no Participant had Spendable Income that Month) flagged as such, so that the substitution isn't silent.

### Changes & history

45. As a household member, I want to change an expense's or goal's Split Rule Effective From a chosen Month, so that earlier Months keep the split they had.
46. As a household member, I want to change an item's Participants Effective From a chosen Month, so that participation changes don't disturb history.
47. As a household member, I want to schedule a future-dated change, so that a known raise starting in October is entered in July and applies itself.
48. As a household member, I want to back-date a change deliberately and see the affected Months recompute, so that legitimate corrections (a split that should have changed in June) don't require hand-editing every Month.
49. As a household member, I want to browse past Months' summaries, so that I can compare and review history.
50. As a household member, I want past Months rendered under the rules in effect for them, so that later changes never silently rewrite history.
51. As a household member, I want to edit a past Month's data — a forgotten expense, a wrong amount — and see that Month recompute under its own rules, so that corrections land in the right Month.
52. As a household member, I want departed members still rendered in past Months they were part of, so that history is complete.

### System

53. As a household member, I want the app's data to persist between sessions on our own hardware, so that the household's records are durable and private.
54. As a household member, I want the app to serve exactly our household and not be publicly reachable, so that our finances stay private.
55. As a maintainer, I want all data access behind a single internal interface, so that a future serverless demo build can swap in mock data at build time without touching the rest of the app.

## Implementation Decisions

- **Three modules, two seams.**
  - **Monthly-summary engine** — a pure, stateless domain core. Input: the household's data (members, income sources with Effective From history, expenses, goals, split rules, per-Month amounts) plus a target Month. Output: the complete monthly summary — per-member Income and Spendable Income, every active item's Shares, per-member Leftover Balances, and unentered/fallback flags. No I/O, no persistence, no UI dependencies.
  - **Data layer** — a single internal interface through which all persistence flows, per the plan's architectural mandate. One self-hosted adapter for the real app; a future demo mock adapter (Stretch) must satisfy the same contract. Implementations are swapped at build time.
  - **UI shell** — setup flows, monthly amount entry, dashboard, history browsing. Thin: it orchestrates load → engine → render and contains no domain math.
- **Shares are always derived, never persisted.** Stability of past Months comes from effective-dating plus determinism (ADR-0002), not from snapshots. The engine must be fully deterministic: identical inputs always produce identical Shares, including rounding outcomes.
- **Rounding:** largest-remainder apportionment to whole minor currency units (cents), ties broken by a stable member order. Shares always sum exactly to the item's total.
- **Effective-dating mechanics:** every changeable definition carries an Effective From Month and an optional end Month; Effective From may be past, current, or future. Resolving "the state in effect for Month M" is the engine's job; the data layer stores the full timelines.
- **Custom splits** are stored as a mode (percent or amount) plus per-participant values; validation enforces exact sums (100% or the expense total) at entry. One mode per item.
- **Proportional splits** weight by each Participant's Spendable Income for that Month; if all Participants have zero Spendable Income, the split falls back to even for that Month and the summary flags it.
- **Unentered ≠ $0:** the absence of an amount record for an active item in a Month is a distinct state from an explicitly entered zero. Summaries surface unentered items as pending.
- **Members are never deleted** once referenced by any Month; departure is effective-dated (ADR-0002). A member referenced by nothing (setup mistake) may be truly removed.
- **No settlement features anywhere** — no "who paid", no IOUs, no transfers (ADR-0001).
- **No auth, no multi-household:** one deployment serves one Household, privately self-hosted. Currency is set at setup and immutable.
- **Stack is deliberately undecided** — this spec is stack-agnostic. Binding constraints on whatever stack is chosen: the engine must be a pure, isolated module testable without the app; the data layer must sit behind a single interface. The first implementation tickets should pin the stack.

## Testing Decisions

- **What makes a good test here:** tests assert external behavior only — construct input data, call the seam, assert on outputs. No assertions on internals, no mocking the unit under test. Test names use glossary vocabulary (Share, Effective From, Leftover Balance…).
- **Engine seam (exhaustive behavior coverage):**
  - Each Split Rule: proportional (incl. Restricted-Use exclusion from the basis), even, custom-percent, custom-amount.
  - Custom split validation: sums other than exactly 100% / exactly the total are rejected.
  - Rounding: Shares always sum exactly to the total; cent distribution follows largest-remainder; identical inputs give identical results across repeated computation.
  - All-zero-income proportional fallback to even, with the flag present in output.
  - Restricted-Use Income: excluded from Spendable Income and default Leftover Balance; included via the toggle view.
  - Unentered amounts surfaced as pending; explicit $0 not flagged.
  - One-off income and expenses appear in exactly their Month and nowhere else.
  - Effective-dating: mid-history changes leave earlier Months untouched; future-dated changes apply from their Month; back-dated changes recompute exactly the affected range; past-Month data edits recompute that Month under its own rules.
  - Member join/depart: absent before joining, present in history after departing, excluded from active items after departure.
  - Leftover Balance: formula (Spendable Income − expense Shares − contribution Shares), negative values, no carry-over between Months.
- **Data-layer seam:** one contract test suite (create/read/update, timeline queries, amount records) executed against each adapter that exists, starting with the self-hosted one. This suite is what guarantees the future build-time swap is safe.
- **UI:** smoke tests only — the shell renders and wires the two seams together. No domain behavior is asserted through the UI.
- **Prior art:** none — this is a greenfield repo. These suites become the project's first tests and set its testing pattern; keep them at the seams and free of implementation detail from day one.

## Out of Scope

- **Settlement, payments, who-actually-paid, IOUs, transfers** — permanently, per ADR-0001.
- **Multi-currency** — explicitly excluded by the plan.
- **V2 features:** composite expenses (sub-items rolling up to a total), expected-vs-actual comparisons, savings projections, visual trends, and the new-month carry-over convenience. The model is shaped to absorb these later — composite expenses only change how a Month's amount is produced (derived from sub-items instead of entered), nothing downstream.
- **Stretch features:** net worth view, unusual-month flagging, what-if reallocation, export (CSV/PDF/annual), bill reminders, and the public serverless demo build itself (the data-layer interface only ensures it remains possible).
- **Auth, user accounts, permissions, multi-household** — one private deployment per household.

## Further Notes

- Origin: `prometheus-system-plan.md`, refined through a grill-with-docs session. The binding vocabulary is `CONTEXT.md`; the binding constraints are ADR-0001 (share calculator, no settlement) and ADR-0002 (effective-dated rules, any-Month Effective From). Implementation must use glossary terms in code and UI copy, and must not drift toward the glossary's `_Avoid_` synonyms.
- Determinism is a hard requirement, not a nicety: ADR-0002 makes past Months recomputable, which is only trustworthy if recomputation is bit-for-bit repeatable.
- The tech stack decision is pending and belongs to the implementation phase; it should be the first thing resolved when tickets are created from this spec.
