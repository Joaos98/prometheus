# 12 — Discarding a Month, and Month navigation

**What to build:** Moving around the record. A member steps to the next or previous Month, or jumps straight to any year and month, and can see at a glance which Months have been opened and which haven't — the shape of the history. Browsing an unopened Month never opens it, so looking is always safe.

And undoing an open: discarding a Month removes every row of it and returns it to unopened, free to be opened afresh from the Previous Month. It is the only destructive action in the Household, so it names how many entries will be lost before it proceeds.

**Blocked by:** 06

**Status:** done

**Suggested model:** Opus, medium thinking — the only destructive operation in the Household, and it has to name what it will destroy before it proceeds.

- [x] A member can move to the next and previous Month directly
- [x] A member can jump to any Month by year and month
- [x] Opened and unopened Months are distinguished in navigation
- [x] Browsing an unopened Month is a pure read and does not open it
- [x] An unopened Month shows what opening it would copy from
- [x] Discarding a Month removes all of its rows and returns it to unopened
- [x] Discarding names the number of entries that will be lost before it proceeds
- [x] A discarded Month can be opened again and copies the Previous Month afresh
- [x] Discarding a Month leaves every other Month untouched
- [x] Every figure shown for a past Month is computed from that Month's own rows

## Comments

Stepping through the calendar needed a name that is not the Previous Month, which is a
bound term meaning the nearest *opened* Month before this one. `monthAfter` and
`monthBefore` are the calendar's neighbours and say nothing about whether either has
been opened — which is exactly what navigation wants, since an unopened Month is
somewhere a member may go and look.

`discardMonth` removes the Month key rather than emptying the Month, because unopened
and opened-but-empty are different states the model leans on. The count of what will be
lost is a separate query, `entryCount`, so the wording lives with the member and the
engine stays free of it. The storage port grew `discardMonth`, its one operation that is
neither row-scoped nor a whole-Household replace: absence cannot be said one row at a
time.

The Months after a discarded one keep what they already inherited — they are not
re-derived — and simply inherit across the gap the next time one of them is opened.

The last criterion needed no new code: `leftoverBalancesOf`, `splitOf` and
`unreviewedCount` take a Month and nothing else, so a past Month's figures cannot read
another Month's rows. `accumulatedProgress` is the one query that spans Months, and 10
already fixes it as of the Month being viewed.

Ticket 19 owns the narrow-window collapse; the masthead still overflows below about
440px, which navigation did not introduce and does not worsen.

Navigation turned out to make a whole class of latent panel state reachable for the
first time. Every panel keeps what a member is halfway through — the row being edited,
an amount typed but not saved, a rename waiting to be answered — and none of it was
scoped to a Month, because until now there was no way to leave one. Stepping to the next
Month left the form open over the new Month's row, and the next save wrote there: an
edit meant for July landed on August. The dashboard now keys the panels on the Month, so
moving builds them afresh.

The discard question is guarded twice on purpose. The key already rebuilds it, but an
armed destructive action should not rest on where a component happens to sit in the
tree, so it also clears itself when the Month changes. Answering yes destroys the Month
the member was looking at when they were told the number, or nothing.
