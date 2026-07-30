# 07 — Managing the Roster after setup

**What to build:** People join a household and people leave. A member adds someone to the Roster and the Months opened afterwards include them. A member deactivates someone who has left, and from then on Months opened afterwards no longer include them — while every Month that already exists keeps rendering exactly as it did, still naming them and still showing their figures. Nobody is ever deleted. Someone who returns is reactivated and appears in Months opened afterwards, with no record of the absence.

This is where the snapshot model earns its keep, and where the design decision in 06 — a Month copies its member list from the Previous Month rather than re-deriving it from the Roster — becomes visible and testable.

**Blocked by:** 06

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — small, and the guarantee that past Months keep rendering is already carried by ticket 06's member copying.

- [ ] A member can be added to the Roster after setup, and appears in Months opened afterwards
- [ ] A member can be deactivated, and is absent from Months opened afterwards
- [ ] Deactivating a member changes nothing about any already-opened Month: its member list, its Shares, its Leftover Balances and its Contributions are all unchanged
- [ ] A deactivated member is never deleted, and a past Month still names them
- [ ] A deactivated member can be reactivated and appears in Months opened afterwards, with no record of the absence anywhere
- [ ] The Roster is visibly distinct from a Month's list of members, and changing it never alters what any Month says
- [ ] Opening a Month with no Previous Month takes the active Roster; opening one with a Previous Month takes that Month's members
