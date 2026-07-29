# Expense Templates are dropped; Months inherit from the Previous Month

The system plan specified Expense Templates holding default Participants and Split Rule, with a new Month taking its amount from the Previous Month but its Participants and Split Rule from the Template. That dual sourcing was rejected: it silently reverts deliberate monthly decisions (a split changed for one Month reverts the next), and it can produce an invalid snapshot at birth (a Template pinning fixed amounts of 500/300 landing on an amount of 850, with no save to block because nothing was saved).

**Opening a Month inherits every field — amount, Participants, Split Rule, name, category — from the nearest opened Previous Month.** With that in place the Template has no remaining job: which Expenses exist is decided by the Previous Month, and an Expense stops recurring by being removed from a Month, since later Months inherit its absence. This deletes the "ended" flag, which was effective-dating under another name.

There is therefore **no Expense entity and no registry table.** Continuity is carried by a stable identity minted when an Expense first appears and copied by inheritance and propagation — an identifier on the snapshot row, not a record with a lifecycle. Name and category live on each row and may legitimately differ between Months. Forward propagation and per-Expense trends match on that identity; nothing needs creating, ending, or garbage-collecting.

Identity alone cannot distinguish a rename from a repurpose — overwriting "Netflix, 12" with "Gym, 40" is indistinguishable in the data from renaming the same cost, and the two demand opposite handling. That difference is intent, so **editing an inherited Snapshot's name asks** whether the Expense continues or a new one begins. It is the one question no rule can answer, asked only at the one moment it arises.

## Consequences

- Drift (ADR-0001) narrows to income only: with no Templates, the sole standing definition left to compare a future Month against is the Income Profile.
- This departs from the MVP list in the system plan, which names Expense Templates explicitly.
