# Money is integer minor units; remainders go by largest remainder

All amounts are stored and computed as integer minor units (cents) of the Household's single currency — never floating point. Splitting an Expense is therefore exact integer arithmetic that leaves an integer remainder of cents to place, rather than a float sum that fails to equal the total often enough to matter.

Shares must sum to exactly the Expense amount under every Split Rule. Remainder cents are allocated by the largest-remainder method: each Share floors to a whole cent, then the leftover cents go one each to the Participants with the largest fractional parts, with ties broken by a stable member order. This is deterministic — the same Month data always renders the same Shares — and no Participant is ever off their exact share by more than one cent.

## Considered Options

- **A single Participant absorbing the whole remainder** — rejected: systematic, always the same person, on every Expense.
- **Rotating the tiebreak by Month** — rejected: identical inputs would produce different Shares in different Months, which is confusing when comparing Months side by side, and it makes the engine's output depend on something other than the Month's data.
- **Allocating the remainder to the highest-income Participant** — rejected: it couples rounding to income, so correcting an income figure silently reshuffles cents across unrelated Expenses.
