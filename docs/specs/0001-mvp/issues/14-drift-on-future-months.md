# 14 — Drift on future Months

**What to build:** A member opens August in July to plan ahead, then corrects July's rent. August was copied before the correction and now holds a figure that no longer matches where it came from — and because proportional Shares weight by Spendable Income, a stale income line quietly corrupts every proportional Share in that Month too.

Rather than forbid opening future Months, the failure is made visible: a future Month reports its difference from the Previous Month as it now stands, as a **neutral diff** the member may refresh from. Not a warning — warning styling would fire on deliberate edits, which it cannot distinguish from stale ones, and that styling stays reserved for Pending. Drift ceases once the Month is no longer in the future.

**Blocked by:** 09, 10

**Status:** done

**Suggested model:** Opus, high thinking — recomputes a hypothetical open and diffs it against what the Month holds, across every field including membership. Cheaper if 06 and 13 are still in context.

- [x] A future Month reports the difference between what it holds and what opening it now from its Previous Month would produce
- [x] The diff covers every field the copy covers — amounts, names, categories, Participants, Split Rules, Restricted-Use flags, goal targets and start amounts — and membership
- [x] Drift is presented neutrally, never as an error or a warning
- [x] A member can refresh an individual difference from the Previous Month
- [x] A deliberate edit in a future Month shows in the diff without being flagged as a mistake, and needs no dismissal state
- [x] A Month that is not in the future reports no Drift
- [x] The rail's Month facts show the Drift standing against later opened Months
- [x] Drift is a query over a Household value that changes nothing, testable with no adapter and no UI

## Comments

**Drift cascades one Month at a time, and that is the model rather than a shortcut.** It is
divergence from the Previous Month (ADR-0004), so correcting July shows up in August and
stops there: September still agrees with what *it* copied, which was August. September
drifts in its turn, once August has been refreshed. There is a test saying so, because the
first thing anybody will expect is that a correction lights up every Month ahead of it.

**A Month with no Previous Month reports nothing.** Opening it now would give the active
Roster and no rows, so a literal diff would report every row it holds as one a fresh open
would drop — which is false about a Month whose rows were entered into it directly, and
would offer to refresh them all away.

**Membership drift is reported but not refreshable one difference at a time.** Taking a new
member list means reconciling every row against it — dropping an income row of somebody who
has left, narrowing Participants, standing down a Split Rule that no longer adds up — which
is inheritance, not a row edit. The panel says so and points at discarding and reopening.
`inheritMonth` already does exactly this work, so a whole-Month refresh is a small addition
if it is ever wanted.

**`now` is a parameter, not a clock.** The engine has no way to know what Month the calendar
is on and does not guess; the dashboard passes `thisMonth()`. That is also what makes "a
Month that is not in the future reports no Drift" testable without mocking time.
