# Prometheus

A household finance tracker for a small group sharing money — two partners, a house of
roommates — built on the **snapshot model**: every Month owns its own data, and opening a
Month copies the previous one wholesale. Nothing is defined outside a Month, so editing
August changes August and nothing else, and a Month browsed a year later still says what
it said.

It answers one question: **what has each of us got left this month, after our share of
what we spend together and what we put aside.** It is a share calculator, and deliberately
not a payment tracker — it does not record who actually paid, transfers between members,
or settlement.

What it does:

- Each expense carries its own **Split Rule** — proportional to income, even, custom
  percentages, or fixed amounts — chosen per Month. Changing how August's rent divides
  leaves July alone.
- Rows copied into a new Month arrive **Unreviewed**, and the Month says how many are
  left, so entering the month's figures is a checklist that ends at zero.
- Money is integer minor units, and shares always sum to exactly the expense, with
  remainder cents placed by largest remainder rather than always landing on the same
  person.
- Correcting an earlier Month can be **carried forward** into Months already opened, and
  it replaces only what nobody has touched.

## Try it

The demo is the whole application with its data in your browser — no server, nothing sent
anywhere — and it arrives holding a sample household.

```bash
npm install && npm run dev -- --mode demo
```

## Self-host it

One container, one SQLite file, one evening.

```bash
docker compose up -d
```

Then open <http://localhost:8080> and set the Household up. Port 8080 is popular and
something else may already have it, in which case the page will not load while the logs
look perfectly healthy — `PROMETHEUS_PORT=8090 docker compose up -d` moves it.

There is no login, because there are **no accounts and no permissions at all**. Everyone
who can reach it can see and edit everything. Keep it on your own network; it is not built
to face the public internet.

Your data is the `household` volume. If you would rather not think about volumes, the
Household file button exports the whole thing as JSON, and importing it is the restore.

## Work on it

```bash
npm install
npm run dev        # the app, empty, keeping its Household in the browser
npm test           # every test, including the demo seed as an integration test
npm run typecheck
```

The layout is four plain directories and no build-tool ceremony:

| | |
|---|---|
| `domain/` | the engine — split rules, rounding, inheritance, drift, propagation. No framework imports and no I/O, so every rule is testable on its own. |
| `storage/` | the port, expressed in domain operations, and its two adapters: SQLite over HTTP, and `localStorage`. One contract suite runs against both. |
| `ui/` | Vue 3. The dashboard, and nothing that decides anything. |
| `server/` | static files plus row-level CRUD. It holds no domain knowledge on purpose. |

Both builds run the same engine in the browser, which is what stops the demo and the
self-hosted app from drifting apart.

## The design record

The thinking is written down, and the documents are binding rather than decorative:

- **[CONTEXT.md](CONTEXT.md)** — the vocabulary. Every term the app uses on screen is
  defined here, each with a list of words to avoid. `Month`, `Share`, `Leftover Balance`,
  `Unreviewed` and `Pending` mean exactly one thing each.
- **[prometheus-system-plan.md](prometheus-system-plan.md)** — what it is for, and what it
  is deliberately not for.
- **[prometheus-redesign-brief.md](prometheus-redesign-brief.md)** — the visual language.
- **[docs/adr/](docs/adr/)** — the decisions and the alternatives turned down, including
  why there are no templates, no profiles and no effective-dated anything.
- **[docs/specs/](docs/specs/)** — the MVP spec and the nineteen tickets it was built in.
  Each ticket keeps its acceptance criteria and the notes made while building it.

An ADR records a decision as it was made, so read the older ones as history. Where a
document and the ADRs disagree, the ADRs decide.
