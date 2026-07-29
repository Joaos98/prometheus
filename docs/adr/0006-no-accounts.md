# There are no accounts, and that is deliberate

One deployment serves one Household, running on the household's own hardware and not meant to be reachable from the internet. There is therefore **no login, no password storage, no sessions, and no permissions**: anyone who can reach the app can see and edit every member's data. A household sharing a machine on their own network does not need protecting from each other, and adding authentication would mean real surface — credential storage, resets, session handling — defending against a threat this deployment model does not have.

Every screen presents all members side by side; for a share calculator that comparison *is* the screen, so there is nothing a per-member view would improve.

A **Viewer** preference exists purely for comfort: a member id in browser `localStorage`, set from a Roster dropdown in the header, which highlights and sorts that member's own figures first. It is not Household data, never leaves the device, defaults to nobody, and grants nothing. Each device answers independently.

This is recorded because "no auth" reads as an oversight rather than a decision, and because it is the constraint that would have to be revisited first if the app were ever exposed beyond a private network.
