# 09 — One-off income and expenses

**What to build:** Record one-off income (a bonus, a freelance gig) and one-off expenses (a repair, a gift) for a single Month without creating persistent definitions. Each appears in exactly its Month's summary, never carries forward, and remains visible when browsing that Month in history.

**Blocked by:** 07 — Month navigation and history browsing

**Status:** ready-for-agent

- [ ] One-off income: member, name, amount, Month — included in that Month's Income only; adjacent Months show no trace of it
- [ ] One-off expense: name, amount, Month, Participants, Split Rule — divided among Participants like any expense, for that Month only
- [ ] One-off expenses support every split method available to recurring expenses at the time they're created
- [ ] Both kinds render correctly when browsing their Month in history
- [ ] Engine seam: a one-off affects exactly its own Month's summary and no other
