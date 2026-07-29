# The domain runs in the browser; the server only persists

The self-hosted build and the public demo must be the same application differing only in their data layer. The demo has no backend, so every computation — Split Rules, largest-remainder rounding, Leftover Balance, Accumulated Progress, Drift — has to run in the browser there. Computing them on the server for the self-hosted build would mean two implementations of the same rules, guaranteed to diverge, and the demo would stop being the app and become something that resembles it.

So there is **one engine, running client-side in both builds**, behind a **storage port expressed in domain terms** — load a Household, read Months, write rows — with two adapters: HTTP to a SQLite-backed server for self-hosted, and `localStorage` for the demo. The server has no domain knowledge and does not import the engine.

The port must be defined in domain operations, not as a mirror of an HTTP API. Designing the REST endpoints first and making `localStorage` imitate them produces a fetch shim faking HTTP inside the browser — the failure mode where the demo genuinely does make the app worse.

This is affordable because of what the data is: a Household's entire history is a few thousand rows, so the whole thing loads into memory. Cross-Month work like as-of goal progress becomes trivial rather than a query problem.

## Consequences

- Invariants are enforced client-side only. Acceptable here: no authentication, a private network, one Household, and the only client is our own UI — there is no adversarial caller to defend against.
- Schema changes must be handled twice, once as a SQLite migration and once as a `localStorage` shape migration. This is the demo's real and recurring cost.
- The deliberately dumb server would become a liability if scheduled work, notifications, multi-Household, or authentication were ever wanted. All are currently out of scope.
