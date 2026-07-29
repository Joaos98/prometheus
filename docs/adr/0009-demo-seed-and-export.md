# The demo is seeded by a program that drives the domain

The demo exists to show what Prometheus does, and an empty dashboard shows none of it — Shares dividing under different rules, Leftover Balances, a goal partway to target. It therefore ships populated.

The sample Household is **not** hand-written rows. A small seed program drives the real domain the way a member would: create the Household, open a Month, enter income, add Expenses with mixed Split Rules, open the next Month, correct a couple of amounts, contribute to a goal. Static fixture data would mirror the schema and rot quietly as it moved, failing without a crash and untested because it is "only sample data". A seed that goes through the domain cannot drift — a change that breaks the model breaks the seed loudly — and it exercises opening, inheritance, propagation and Drift end to end, making it an integration test that happens to double as the shop window. Resetting the demo re-runs it.

The whole Household also exports to a JSON file and imports back, in both builds. This is close to free, since the Household is already a single in-memory object that both storage adapters serialise, and it answers two things at once: self-hosters get a backup that does not require touching Docker volumes, and the demo stops being a dead end — export what you were trying, import it into your own deployment.
