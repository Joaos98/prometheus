# 12 — Discarding a Month, and Month navigation

**What to build:** Moving around the record. A member steps to the next or previous Month, or jumps straight to any year and month, and can see at a glance which Months have been opened and which haven't — the shape of the history. Browsing an unopened Month never opens it, so looking is always safe.

And undoing an open: discarding a Month removes every row of it and returns it to unopened, free to be opened afresh from the Previous Month. It is the only destructive action in the Household, so it names how many entries will be lost before it proceeds.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] A member can move to the next and previous Month directly
- [ ] A member can jump to any Month by year and month
- [ ] Opened and unopened Months are distinguished in navigation
- [ ] Browsing an unopened Month is a pure read and does not open it
- [ ] An unopened Month shows what opening it would copy from
- [ ] Discarding a Month removes all of its rows and returns it to unopened
- [ ] Discarding names the number of entries that will be lost before it proceeds
- [ ] A discarded Month can be opened again and copies the Previous Month afresh
- [ ] Discarding a Month leaves every other Month untouched
- [ ] Every figure shown for a past Month is computed from that Month's own rows
