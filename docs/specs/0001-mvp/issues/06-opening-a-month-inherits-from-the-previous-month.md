# 06 — Opening a Month inherits from the Previous Month

**What to build:** The one rule the whole model reduces to. A member opens a new Month and everything arrives from the Previous Month — members, income rows, expenses, every field including Participants and Split Rule — so only what actually changed needs touching. The Previous Month is the nearest *opened* Month before this one, not necessarily the preceding calendar one, so a gap in the record is harmless and a Month after a gap still fills itself.

Nothing is defined outside a Month. There are no templates, no profiles, no standing definitions of any kind, and no "ended" flag — an expense stops recurring by being absent, and later Months inherit that absence.

**Blocked by:** 02, 03

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — the model's centre of gravity. Every ticket from 09 onward inherits whatever this one gets right or wrong. Worth running in the same session as 13 and 14, which are the same idea twice more.

- [x] Opening a Month copies every field of the Previous Month's rows: amount, name, category, Participants, Split Rule, and the Restricted-Use flag
- [x] Each copied row keeps the stable identity of the row it came from
- [x] The new Month's member list is copied from the Previous Month's member list, not re-derived from the current Roster
- [x] The Previous Month is resolved as the nearest opened Month before the target; unopened Months are skipped and a gap does not force a Month to start empty
- [x] Opening a Month in the past works, and opening a Month in the future works
- [x] There is no closing action, and no Month ever becomes read-only
- [x] A row appearing for the first time, with nothing to inherit, is Pending — a null amount, not zero
- [x] Editing an inherited row changes only the Month it is in
- [x] Opening is a single engine operation over a Household value, testable with no adapter and no UI
- [x] The dashboard names which Month this one was copied from

## Comments

Unreviewed marks on copied rows (09), dropping One-Off rows (11) and resetting a Goal's
Contributions (10) are the three parts of the copy those tickets add; `inheritMonth` is
the one place each of them belongs.

Nothing in the UI reaches a second Month yet, so inheritance is not visible in the app
until 12 adds navigation. The rail's copied-from line, this ticket's only dashboard
criterion, was already in place from 05.
