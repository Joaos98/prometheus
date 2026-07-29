# Inherited rows arrive Unreviewed

Making every row inherit its value (ADR-0004) moved the failure mode. Pending — a row with no amount — was the model's warning that something needed attention, but under inheritance almost nothing is ever Pending: only an Expense's first Month, or a row just added. Every other row arrives holding a plausible number. The risk is no longer a forgotten entry; it is a figure that copied itself forward and that nobody has read since.

This cannot be derived. An inherited 62 that is still genuinely 62 is identical in the data to one nobody has looked at. So an inherited row carries an **Unreviewed** mark until a member edits or explicitly confirms it, and the Month reports how many remain. Monthly entry becomes a checklist that ends at zero, and Pending keeps its narrow meaning of "no amount at all".

The mark also settles Forward Propagation, whose job shrank to already-opened later Months once inheritance covered the rest. Propagation replaces values that are still Unreviewed and skips any a member has touched, reporting what it skipped — so correcting an earlier Month cannot silently undo a decision deliberately made in a later one. Propagation means "carry this into the Months still holding the old copied value", not "overwrite the future".

## Consequences

- Propagation's effect depends on review state, so the same action can touch different Months at different times. This is intended: the alternative is destroying deliberate edits.
