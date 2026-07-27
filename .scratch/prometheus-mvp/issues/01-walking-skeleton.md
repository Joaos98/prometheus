# 01 — Walking skeleton: stack, scaffold, end-to-end seam proof

**What to build:** Choose the tech stack and scaffold the app so a hardcoded household (two members, one shared expense split evenly) flows end-to-end: persisted through the data-layer interface, computed by the pure monthly-summary engine, rendered as a dashboard showing per-member Shares under the current Month heading. No setup screens — the household is hardcoded data served through the real data-layer interface. This ticket exists to prove the two-seam architecture before any feature work: the engine contains the domain math, the UI contains none, and all persistence sits behind the single interface the plan mandates.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] The chosen stack is recorded as an ADR in `docs/adr/` (it's the textbook lock-in decision) before scaffolding begins
- [x] App boots and renders a dashboard for the current Month showing both members and the hardcoded expense's even-split Shares, computed by the engine
- [x] The hardcoded household is served through the data-layer interface; the UI performs no domain math itself
- [x] Engine seam: a behavior test asserts the even-split Shares sum exactly to the expense total (largest-remainder, deterministic)
- [x] Data-layer seam: the contract test suite exists and runs against the self-hosted adapter
- [x] Both test suites run green from a clean checkout with a single documented command

## Comments

Implemented. Stack (TS full-stack monorepo, Vue client) chosen by the maintainer and recorded in ADR-0003. Engine seam: 4 behavior tests (even split, largest-remainder distribution, determinism, effective-dating). Data-layer seam: 3-contract suite against the SQLite adapter (round-trip, persistence across reopen, replace). End-to-end verified: `/api/summary` serves engine-computed shares from the SQLite-backed store; client renders them. `pnpm install && pnpm test` green from clean state.
