# Prometheus

A household finance tracker that computes each member's share of shared costs and their monthly leftover balance. It is a **share calculator**: it deliberately does not track who actually paid, transfers between members, or settlement — money movement happens outside the app.

## Language

**Household**:
The shared space containing everyone's data. One deployment serves one Household, with any number of members; its currency is set once at setup and never changes.
_Avoid_: account, workspace

**Member**:
A person in the Household. Members join and depart Effective From a Month and are never deleted, so past Months keep rendering their income, Shares, and Leftover Balances.
_Avoid_: user

**Share**:
The portion of a shared expense (or shared savings-goal contribution) attributed to one participant, as computed by that item's split rule.
_Avoid_: split amount, owed amount, debt

**Month**:
A calendar month, identified by year and month (e.g. 2026-07). All income, expenses, savings contributions, and summaries are recorded against a Month.
_Avoid_: period, cycle, billing cycle

**Effective From**:
The Month from which a change to income, a split rule, or participants applies — may be a past, current, or future Month. A change never alters Months earlier than its Effective From; a past Month's data can still be edited and recomputes under the rules in effect for that Month.
_Avoid_: retroactive change, locked month, closed month

**Income Source**:
A named stream of income belonging to one member. Its amount is Effective From a Month and carries forward unchanged until updated or ended; a source spanning exactly one Month is a one-off (e.g. a bonus).
_Avoid_: salary, paycheck

**Income**:
A member's total for a Month: the sum of their Income Source amounts in effect that Month.
_Avoid_: earnings

**Restricted-Use Income**:
An Income Source whose money can only be spent on certain things (e.g. a meal-voucher benefit). Flagged once on the source; excluded from the leftover balance by default, with a dashboard view toggle to include it. The app never tracks which expenses restricted money pays for.
_Avoid_: earmarked income

**Spendable Income**:
A member's Income for a Month excluding Restricted-Use Income sources. The basis for proportional splits, and the default basis of the leftover balance.

**Participants**:
The subset of household members that a shared expense or shared savings goal is divided among. Not every shared item involves every member.
_Avoid_: beneficiaries

**Split Rule**:
The rule that decides how a shared expense (or shared savings-goal contribution) is divided among its Participants: proportional to income (weighted by Spendable Income), even, or custom — per-participant percentages summing to exactly 100, or fixed amounts summing to exactly the total, one mode per item. Chosen per item, Effective From a Month. If all Participants have zero Spendable Income in a Month, a proportional split falls back to even for that Month.
_Avoid_: split method (acceptable shorthand), division rule

**Expense**:
A named cost divided among its Participants by its Split Rule; an Expense with exactly one Participant is an individual expense. Its definition is Effective From a Month and stays active until ended; its amount is entered per Month. A one-off Expense exists for a single Month. An active Expense with no amount entered for a Month is unentered — shown as pending, never silently treated as $0.
_Avoid_: bill

**Savings Goal**:
A named target that money is set aside for, with contributions divided among its Participants by its Split Rule; a goal with exactly one Participant is individual. Its definition is Effective From a Month and stays active until ended; contributions are entered per Month and follow the same rules as Expense amounts (unentered ≠ $0). The target amount is optional; an optional start amount sets the initial accumulated total without backfilling months; the app never records withdrawals — a completed goal is simply ended.
_Avoid_: fund, pot

**Leftover Balance**:
A member's position for a Month: their Spendable Income minus their expense Shares minus their Savings Goal contribution Shares. May be negative; never carries into later Months. A dashboard view toggle substitutes total Income (including Restricted-Use) for Spendable Income.
_Avoid_: running balance, net
