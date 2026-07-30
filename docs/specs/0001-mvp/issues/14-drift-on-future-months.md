# 14 — Drift on future Months

**What to build:** A member opens August in July to plan ahead, then corrects July's rent. August was copied before the correction and now holds a figure that no longer matches where it came from — and because proportional Shares weight by Spendable Income, a stale income line quietly corrupts every proportional Share in that Month too.

Rather than forbid opening future Months, the failure is made visible: a future Month reports its difference from the Previous Month as it now stands, as a **neutral diff** the member may refresh from. Not a warning — warning styling would fire on deliberate edits, which it cannot distinguish from stale ones, and that styling stays reserved for Pending. Drift ceases once the Month is no longer in the future.

**Blocked by:** 09, 10

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — recomputes a hypothetical open and diffs it against what the Month holds, across every field including membership. Cheaper if 06 and 13 are still in context.

- [ ] A future Month reports the difference between what it holds and what opening it now from its Previous Month would produce
- [ ] The diff covers every field the copy covers — amounts, names, categories, Participants, Split Rules, Restricted-Use flags, goal targets and start amounts — and membership
- [ ] Drift is presented neutrally, never as an error or a warning
- [ ] A member can refresh an individual difference from the Previous Month
- [ ] A deliberate edit in a future Month shows in the diff without being flagged as a mistake, and needs no dismissal state
- [ ] A Month that is not in the future reports no Drift
- [ ] The rail's Month facts show the Drift standing against later opened Months
- [ ] Drift is a query over a Household value that changes nothing, testable with no adapter and no UI
