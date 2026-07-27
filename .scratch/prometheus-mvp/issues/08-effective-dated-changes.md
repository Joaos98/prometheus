# 08 — Effective-dated changes: schedule and back-date

**What to build:** Every change to income, a Split Rule, or Participants offers an Effective From Month — past, current, or future (defaulting to the current Month). Back-dating deliberately recomputes exactly the affected range; before confirming, the UI shows which Months will recompute so the rewrite is visible and deliberate, never silent. Future-dated changes appear on the dashboard as scheduled until their Month arrives. This turns ADR-0002 from implicit behavior into a user-visible capability.

**Blocked by:** 07 — Month navigation and history browsing

**Status:** ready-for-agent

- [x] Every change form (income, split rule, participants) offers an Effective From Month defaulting to the current Month
- [x] Back-dating to Month M recomputes Months ≥ M and leaves earlier Months untouched (engine seam)
- [x] Before confirming a back-dated change, the UI lists the Months that will recompute
- [x] Future-dated changes apply to their target Month's rendering and are listed as scheduled on the dashboard until then
- [x] Engine seam: identical inputs produce identical outputs across recomputation after any back-dated change (determinism holds)

## Comments

Implemented. Data layer: changeExpenseSplitRule and changeExpenseParticipants — each ends the old expense and creates a new one with the updated rule/participants effective from the chosen Month. Server: POST /api/expenses/:id/change-split and .../change-participants. Client: income source end now takes an effective-from input; each expense shows Change Split and Change Participants inline forms with effective-from and backdate warning (shows which Months will recompute); scheduled expenses with future effective-from are listed on the dashboard.
