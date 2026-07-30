# 16 — The SQLite adapter, the port contract suite, and self-hosted Docker

**What to build:** The self-hosted build — the real app, running on the household's own hardware with real data. A small server stores and returns rows over SQLite and knows nothing about the domain: no engine import, no Split Rule logic, no validation of domain invariants. The same engine that runs the demo runs here, in the browser, behind the same storage port.

Which makes the port the thing that must be proven. One contract suite, written once and run against both adapters, so an adapter that diverges fails immediately rather than making the demo a subtly different application.

Two members are likely to be editing at the same time, so writes are row-scoped: two people editing different rows never collide. Same-row collisions resolve last-write-wins, which is acceptable once cross-row collisions are impossible.

**Blocked by:** 15

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — the contract suite is a design job and both adapters answer to it afterwards. The Docker half is routine; the suite is not.

- [ ] A Node server serves the static build and row-level CRUD over SQLite
- [ ] The server imports no domain code and enforces no domain invariants
- [ ] There is no login, no password storage, no session and no permission check anywhere
- [ ] The SQLite adapter sits behind the same storage port as the localStorage adapter, with no change to the port
- [ ] One contract suite is parameterised over both adapters and passes against each
- [ ] The contract suite proves: what was written is what loads back; row-scoped writes to different rows do not clobber each other; same-row writes are last-write-wins; a null amount round-trips as null and not as zero or absent; replacing the whole Household is atomic
- [ ] A schema migration leaves an existing database readable, and the equivalent localStorage shape migration leaves existing browser data readable
- [ ] The client refetches on window focus and polls lightly while a Month is open
- [ ] Two members editing different rows of the same Month both keep their edits
- [ ] A Docker multi-stage build produces a runnable image, and the database persists across container restarts
