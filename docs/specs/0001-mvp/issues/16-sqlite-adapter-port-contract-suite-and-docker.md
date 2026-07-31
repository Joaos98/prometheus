# 16 — The SQLite adapter, the port contract suite, and self-hosted Docker

**What to build:** The self-hosted build — the real app, running on the household's own hardware with real data. A small server stores and returns rows over SQLite and knows nothing about the domain: no engine import, no Split Rule logic, no validation of domain invariants. The same engine that runs the demo runs here, in the browser, behind the same storage port.

Which makes the port the thing that must be proven. One contract suite, written once and run against both adapters, so an adapter that diverges fails immediately rather than making the demo a subtly different application.

Two members are likely to be editing at the same time, so writes are row-scoped: two people editing different rows never collide. Same-row collisions resolve last-write-wins, which is acceptable once cross-row collisions are impossible.

**Blocked by:** 15

**Status:** done

**Suggested model:** Opus, medium thinking — the contract suite is a design job and both adapters answer to it afterwards. The Docker half is routine; the suite is not.

- [x] A Node server serves the static build and row-level CRUD over SQLite
- [x] The server imports no domain code and enforces no domain invariants
- [x] There is no login, no password storage, no session and no permission check anywhere
- [x] The SQLite adapter sits behind the same storage port as the localStorage adapter, with no change to the port
- [x] One contract suite is parameterised over both adapters and passes against each
- [x] The contract suite proves: what was written is what loads back; row-scoped writes to different rows do not clobber each other; same-row writes are last-write-wins; a null amount round-trips as null and not as zero or absent; replacing the whole Household is atomic
- [x] A schema migration leaves an existing database readable, and the equivalent localStorage shape migration leaves existing browser data readable
- [x] The client refetches on window focus and polls lightly while a Month is open
- [x] Two members editing different rows of the same Month both keep their edits
- [ ] A Docker multi-stage build produces a runnable image, and the database persists across container restarts

## Comments

**`ui/household.ts` clobbers its own state once a write actually takes time**, and this
ticket is where that starts to bite. Every operation there reads `household.value`, awaits
the store, then assigns a Household derived from the value it read *before* the await. Two
operations in flight together therefore lose the earlier one's change from what the app is
showing, even though both rows reach storage correctly.

It cannot happen today: localStorage does no real I/O, so the continuation runs in a
microtask no DOM event can interleave with. An adapter that goes over the network removes
exactly that protection, and the criterion above — "two members editing different rows both
keep their edits" — is the one this fails, on a single client with one member clicking twice.

Row-scoped writes make the *store* safe from cross-row collisions; this is the same problem
one layer up, in the client's own copy. Worth fixing as part of this ticket rather than
before it, since the contract suite is what will demonstrate it.

---

**Fixed by carrying changes out one at a time.** Every operation in `ui/household.ts` now
goes through a queue, so the read, the store's answer and the assignment back cannot be
interleaved by another operation. `ui/household.test.ts` drives the app over a deliberately
slow store and fails without the queue. The same queue is what keeps the refetch honest: a
poll never lands on top of a change still in flight.

---

**The Docker criterion is written but not exercised.** `Dockerfile`, `compose.yaml` and the
`build:self-hosted` script are in place, and the bundled server was run directly against a
SQLite file — it serves the built app, stores rows, and the file is still there after the
process goes. The image itself has not been built: Docker Desktop on the development machine
is returning I/O errors from its own storage metadata and cannot build or run anything. Left
unticked deliberately; `docker build -t prometheus .` is the check outstanding.
