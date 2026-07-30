# 07 — Managing the Roster after setup

**What to build:** People join a household and people leave. A member adds someone to the Roster and the Months opened afterwards include them. A member deactivates someone who has left, and from then on Months opened afterwards no longer include them — while every Month that already exists keeps rendering exactly as it did, still naming them and still showing their figures. Nobody is ever deleted. Someone who returns is reactivated and appears in Months opened afterwards, with no record of the absence.

This is where the snapshot model earns its keep, and where the design decision in 06 — a Month copies its member list from the Previous Month rather than re-deriving it from the Roster — becomes visible and testable.

**Blocked by:** 06

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — small, and the guarantee that past Months keep rendering is already carried by ticket 06's member copying.

- [x] A member can be added to the Roster after setup, and appears in Months opened afterwards
- [x] A member can be deactivated, and is absent from Months opened afterwards
- [x] Deactivating a member changes nothing about any already-opened Month: its member list, its Shares, its Leftover Balances and its Contributions are all unchanged
- [x] A deactivated member is never deleted, and a past Month still names them
- [x] A deactivated member can be reactivated and appears in Months opened afterwards, with no record of the absence anywhere
- [x] The Roster is visibly distinct from a Month's list of members, and changing it never alters what any Month says
- [x] Opening a Month with no Previous Month takes the active Roster; opening one with a Previous Month takes that Month's members

## Comments

`addMember`/`deactivateMember`/`reactivateMember` (domain/household.ts) mutate only the
Roster. `inheritMonth` (domain/inheritance.ts) now takes the Roster and reconciles the
Previous Month's member list against it when a Month is opened — carrying over anyone
still active, dropping anyone since deactivated, and appending anyone added or
reactivated since, in Roster order. This only runs at the moment of opening, so no
already-opened Month is ever touched by a Roster change.

This changes ticket 06's `takes its members from the Previous Month rather than from
the Roster` test in `domain/month.test.ts`: that test asserted a Month opened after an
out-of-band Roster deactivation would still carry the deactivated member, which is
exactly what this ticket asks to stop happening. Updated it to assert the member is now
dropped, and added a companion test confirming the already-opened Month is untouched.

UI: a "Roster" toggle in the dashboard masthead (`ui/views/MonthDashboard.vue`) opens
`ui/components/RosterPanel.vue` — add, deactivate, reactivate — writing the whole
Household back via `store.replaceHousehold`, the same path `relabelCurrency` uses, since
the Roster isn't a Month row.
