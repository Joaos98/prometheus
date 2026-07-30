# 09 — Unreviewed rows and the review meter

**What to build:** Once everything inherits, the risk stops being the forgotten entry and becomes the figure that copied itself forward and that nobody has read since. An inherited 62 that is genuinely still 62 is identical in the data to one nobody has looked at, so it cannot be derived — the row has to carry the mark.

Every row that arrives by inheritance is Unreviewed until a member edits it or explicitly confirms it. The Month reports how many remain, in a meter in the pinned rail rather than a footer that scrolls away from the rows it describes, and the rows themselves carry their mark in place. Monthly entry becomes a checklist that ends at zero.

**Blocked by:** 05, 06

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — a flag set on inheritance and cleared by edit or confirmation, once ticket 06 exists.

- [ ] Opening a Month marks every copied row Unreviewed
- [ ] Editing a row clears its Unreviewed mark
- [ ] A member can confirm a row that is correct as inherited without editing it, and that clears the mark too
- [ ] The Month reports how many rows remain Unreviewed, and the count reaches zero when every row has been edited or confirmed
- [ ] The review meter is in the pinned rail
- [ ] Each row shows its own review state, in place
- [ ] A Pending row — no amount at all — renders as a warning
- [ ] An explicitly entered zero is not Pending and does not render as a warning
- [ ] Unreviewed and Pending are visibly different states, and a row can be Unreviewed while holding a perfectly good number
- [ ] Review state is Household data, the same for everyone looking at the Month, and survives a round-trip through the storage port
