# Months are opened explicitly, and any Month can be opened

A Month holds no data until a member explicitly opens it; browsing an unopened Month is a pure read. Opening snapshots the current Income Profiles and creates Expense Snapshots from the active Expense Templates, with amounts auto-filled from the Previous Month — defined as the nearest *opened* Month before it, so gaps in the record are legal and never force a Month to start Pending.

Any Month can be opened, past or future. The known hazard of opening a future Month is that its snapshot freezes income and amounts that may later change — which corrupts not just the income line but every proportional Share in that Month, since those weight by Spendable Income. Rather than forbid future Months, a future Month reports **Drift**: a neutral diff of its snapshot against the current Profiles and Templates, with the option to refresh. The failure is made visible instead of prevented.

## Considered Options

- **Lazy materialisation on first visit** — rejected: viewing becomes a write, and the order you happen to browse in determines what gets frozen.
- **Restricting opens to past and current Months** — rejected: it makes the stale-snapshot bug structurally impossible, but at the cost of all forward planning. The Drift diff buys back the safety without the restriction.
- **Styling Drift as a warning** — rejected: it cannot distinguish a stale value from a deliberate edit, so it would fire on intentional changes and need dismissal state. Warning styling stays reserved for Pending, which is a genuine error state.
