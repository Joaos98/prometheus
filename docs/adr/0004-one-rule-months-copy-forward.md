# Nothing is defined outside a Month: opening one copies the Previous Month

Having dropped Expense Templates (ADR-0003), the Income Profile could not survive the same argument. Every reason for the Template's removal applied to it unchanged: the Previous Month's income row already records what a member earns, so a second standing definition only creates a place for the two to disagree.

The model therefore reduces to a single rule: **opening a Month copies the Previous Month wholesale** — members, income rows, Expense Snapshots, every field intact. There are no templates, no profiles, no definitions of any kind living outside the Months. A row's continuity across Months is carried by a stable identity copied along with it; everything else is per-Month data, edited only within its Month.

This also gives Drift a better definition than ADR-0001 could. Comparing a future Month against Templates and Profiles could never detect a stale expense *amount*, because Templates held no amounts. Comparing it against its Previous Month's current values does: open August in July, then correct July's rent or salary, and August visibly differs. **Drift is divergence from the Previous Month**, superseding the definition in ADR-0001, and it now covers everything a Month contains.

## Consequences

- Raises and other forward-looking changes cannot be scheduled in advance; they are entered in the Month they take effect, or in an already-opened future Month.
- This is the second deliberate departure from the system plan, which names the Income Profile as an MVP feature.
