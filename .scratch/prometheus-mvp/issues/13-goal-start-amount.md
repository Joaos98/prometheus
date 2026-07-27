# 13 — Goal start amount: optional initial balance

**What to build:** When creating a savings goal, the user can set an optional start amount — the goal's accumulated total before any monthly contributions are recorded. This avoids backfilling months for money already saved before Prometheus started tracking the goal. The accumulation display shows `startAmount + sum of contributions`. The start amount is a property of the goal definition, set once at creation; it is not a per-Month contribution and does not affect the Leftover Balance.

**Blocked by:** 11 — Savings goals

**Status:** ready-for-agent

- [x] A Savings Goal can carry an optional `startAmountCents` set at creation
- [x] Accumulated progress = startAmount + Σ contributions (engine seam)
- [x] The goal add form displays a start amount input — optional, with the target amount field
- [x] Start amount persists across app restarts via the data layer
- [x] DOCS: `CONTEXT.md`'s Savings Goal definition updated to mention the start amount

## Comments

Implemented. Engine: startAmountCents on SavingsGoal, goalProgress includes it in accumulatedCents. Data layer: start_amount_cents column with migration, addGoal/getGoals/replaceHousehold updated, contract test for persistence. Server: POST /api/goals accepts startAmountCents. Client: start amount input in goal add form. CONTEXT.md updated.
