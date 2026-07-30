# 18 — The demo seed and the demo build

**What to build:** A public demo someone can open without installing anything, to see what Prometheus does before deciding whether to self-host. Static, browser storage only, no backend — so nothing can go down and nobody's data goes anywhere.

An empty dashboard shows none of what makes this app worth having, so it ships populated: Shares dividing under different rules, real Leftover Balances, a goal partway to target. The sample Household is **not** hand-written rows. A seed program drives the real domain the way a member would — create the Household, open a Month, enter income, add Expenses with mixed Split Rules, open the next Month, correct a couple of amounts, contribute to a goal. Fixture data would mirror the schema and rot quietly, failing without crashing and untested because it is "only sample data". A seed that goes through the domain cannot drift: a change that breaks the model breaks the seed loudly.

Which makes it an integration test that happens to double as the shop window, so it runs in CI as one.

**Blocked by:** 13, 14, 15

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — the seed is the end-to-end integration test rather than sample data, so it has to drive the engine the way a member would.

- [ ] The demo is a static build with the localStorage adapter and no backend
- [ ] The demo is fully functional — every MVP behaviour works, not a subset
- [ ] The sample Household is produced by a program that drives the domain through the same operations a member uses, not by hand-written fixture rows
- [ ] The seed exercises opening a Month, inheritance, Forward Propagation and Drift end to end
- [ ] The seeded Household shows at least two different Split Rules in use, a non-zero Leftover Balance per member, and a Savings Goal partway to its target
- [ ] The seed runs in CI as an integration test and fails loudly when a domain change breaks it
- [ ] A visitor's changes persist in their browser
- [ ] Resetting the demo re-runs the seed and restores the sample Household
- [ ] A visitor can export what they built and import it into a self-hosted deployment
- [ ] The demo and the self-hosted build differ only in their data layer — the same engine runs in both
