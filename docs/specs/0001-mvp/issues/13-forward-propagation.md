# 13 — Forward Propagation

**What to build:** A member corrects the rent in July and finds August and September were already open, still holding the old copied figure. Propagation carries the correction into those Months — but only into the values still Unreviewed there. Anything a member has deliberately touched is left alone, and the app reports what it skipped and where, so correcting an earlier Month can never silently undo a decision made in a later one.

Propagation means "carry this into the Months still holding the old copied value", not "overwrite the future". Months not yet opened need nothing at all: they inherit.

**Blocked by:** 08, 09

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — walks every later opened Month, decides row by row on review state, and has to report what it skipped and why. Cheaper if ticket 06 is still in context.

- [ ] Propagating an edit walks every opened Month after the source, in order
- [ ] A matching value that is still Unreviewed is replaced
- [ ] A matching value a member has edited or confirmed is left alone
- [ ] The result reports which Months were changed and which were skipped, with the reason
- [ ] A Month that kept its own value does not stop propagation reaching the Months after it
- [ ] Rows are matched by stable identity, so a renamed Expense is still found
- [ ] A row repurposed in a later Month is a different identity and is not matched
- [ ] Months that have not been opened are not touched and need no handling
- [ ] Propagation is a single engine operation over a Household value, returning what it changed and skipped, testable with no adapter and no UI
