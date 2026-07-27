# 08 — Effective-dated changes: schedule and back-date

**What to build:** Every change to income, a Split Rule, or Participants offers an Effective From Month — past, current, or future (defaulting to the current Month). Back-dating deliberately recomputes exactly the affected range; before confirming, the UI shows which Months will recompute so the rewrite is visible and deliberate, never silent. Future-dated changes appear on the dashboard as scheduled until their Month arrives. This turns ADR-0002 from implicit behavior into a user-visible capability.

**Blocked by:** 07 — Month navigation and history browsing

**Status:** ready-for-agent

- [ ] Every change form (income, split rule, participants) offers an Effective From Month defaulting to the current Month
- [ ] Back-dating to Month M recomputes Months ≥ M and leaves earlier Months untouched (engine seam)
- [ ] Before confirming a back-dated change, the UI lists the Months that will recompute
- [ ] Future-dated changes apply to their target Month's rendering and are listed as scheduled on the dashboard until then
- [ ] Engine seam: identical inputs produce identical outputs across recomputation after any back-dated change (determinism holds)
