# 11 — Ending a thread: One-Off rows and removal

**What to build:** Two ways to stop something recurring, neither of which needs a flag with a lifecycle.

A member marks a row One-Off when it belongs to this Month alone — a one-time bonus, a repair, a goal that has been reached — and the next Month opened does not inherit it. Marking a long-running row One-Off in a given Month is also how it stops recurring while keeping that final Month's record intact.

Or a member simply removes a row from a Month, and later Months inherit its absence. Either way there is nothing to end, nothing to garbage-collect, and no effective-dating.

**Blocked by:** 10

**Status:** done

**Suggested model:** Sonnet, medium thinking — mostly falls out of ticket 06, which already drops One-Off rows on open.

- [x] An income row, an Expense Snapshot or a Savings Goal can be marked One-Off
- [x] Opening the next Month does not inherit any row marked One-Off in the Previous Month
- [x] The One-Off flag itself is not inherited onto anything
- [x] Marking a recurring row One-Off in its final Month keeps that Month's record and stops it recurring
- [x] Removing a row from a Month means later Months opened afterwards inherit its absence
- [x] Removing a row from one Month leaves earlier Months untouched
- [x] There is no "ended" flag, no end date, and no record with a lifecycle anywhere in the model
- [x] A One-Off row is visibly marked as such on its row
