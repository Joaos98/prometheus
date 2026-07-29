# 06 — Opening a Month inherits from the Previous Month

**What to build:** The one rule the whole model reduces to. A member opens a new Month and everything arrives from the Previous Month — members, income rows, expenses, every field including Participants and Split Rule — so only what actually changed needs touching. The Previous Month is the nearest *opened* Month before this one, not necessarily the preceding calendar one, so a gap in the record is harmless and a Month after a gap still fills itself.

Nothing is defined outside a Month. There are no templates, no profiles, no standing definitions of any kind, and no "ended" flag — an expense stops recurring by being absent, and later Months inherit that absence.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Opening a Month copies every field of the Previous Month's rows: amount, name, category, Participants, Split Rule, and the Restricted-Use flag
- [ ] Each copied row keeps the stable identity of the row it came from
- [ ] The new Month's member list is copied from the Previous Month's member list, not re-derived from the current Roster
- [ ] The Previous Month is resolved as the nearest opened Month before the target; unopened Months are skipped and a gap does not force a Month to start empty
- [ ] Opening a Month in the past works, and opening a Month in the future works
- [ ] There is no closing action, and no Month ever becomes read-only
- [ ] A row appearing for the first time, with nothing to inherit, is Pending — a null amount, not zero
- [ ] Editing an inherited row changes only the Month it is in
- [ ] Opening is a single engine operation over a Household value, testable with no adapter and no UI
- [ ] The dashboard names which Month this one was copied from
