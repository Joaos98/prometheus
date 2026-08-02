# 05 — Filter the Expenses list by Participant

**What to build:** A Participant picker in the Expenses panel header, narrowing the list to Expenses that member is in. It is the longest list on the dashboard and there is currently no way to ask what one person is actually in.

Its own control, not the Viewer. Changing the Viewer reorders the whole rail, which is far too large a side effect for wanting a shorter list, and it cannot ask what somebody else is in without claiming to be them.

The choice persists across Months and across a reload, held beside the Viewer in `ui/device-preferences.ts`. It lives deliberately outside the subtree `MonthDashboard.vue` keys on the Month: that key exists to stop half-typed edits landing in the wrong Month, a correctness risk a lens does not carry, and re-picking the filter every Month would defeat the cross-Month review the feature exists for.

The panel header says how many of how many it is showing. The rail's Leftover Balances, review meter and entry count stay Month-wide, so a filtered panel showing three rows beside a rail saying eight entries has to account for itself.

**The filter never moves on its own.** An Expense saved with Participants outside it leaves the list, and the count is what explains where it went. Clearing the filter at that moment was considered and rejected: a lens that repositions itself is less predictable than one that occasionally hides something.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, medium thinking — straightforward, with one discipline: the filter is a view over the panel and reaches no figure anywhere else.

- [x] A Participant picker sits in the Expenses panel header, defaulting to everyone
- [x] Choosing a member narrows the list to Expenses that member is a Participant of
- [x] The choice persists across Month navigation
- [x] The choice persists across a reload, stored on this device only
- [x] The choice is independent of the Viewer, and changing either leaves the other alone
- [x] The panel header states how many Expenses of how many are shown while filtered
- [x] The rail's Leftover Balances, review meter and entry count stay Month-wide, unaffected by the filter
- [x] An Expense saved with Participants outside the filter leaves the list, and the count reflects it
- [x] The filter changes on no action but an explicit pick
- [x] A member no longer on the Roster, or absent from the viewed Month, does not strand the filter in a state showing nothing unexplained
- [x] The filter appears in no export and is not Household data
- [x] Income and Savings Goals panels are unchanged

## Comments

**Built.** `ui/expense-filter.ts` holds the lens — the narrowing, the count sentence, and the picker's options — and `expenseFilter` sits beside the Viewer in `ui/device-preferences.ts` under `prometheus.expense-filter`. Being a singleton preference rather than panel state is what carries it across the Month subtree's remount.

Where the filtered member is absent from the viewed Month, the picker lists them anyway so it is never blank, the header says `Showing 0 of 7`, and the list says which member it found nothing for. The filter still does not move.

Verified in the running demo: filtering to Mira dropped the two-Participant row and read `Showing 6 of 7`; the choice survived Month navigation and a reload; the rail's entry count and review meter stayed at the Month-wide 12 and 5-of-12 throughout; taking a member off an Expense while filtered to them dropped that row and moved the count to `Showing 5 of 7` without touching the filter; and a stored filter naming somebody off the Roster showed as "Unknown member" with `Showing 0 of 7` rather than an unexplained empty list.
