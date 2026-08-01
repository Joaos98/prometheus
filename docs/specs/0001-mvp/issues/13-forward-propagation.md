# 13 — Forward Propagation

**What to build:** A member corrects the rent in July and finds August and September were already open, still holding the old copied figure. Propagation carries the correction into those Months — but only into the values still Unreviewed there. Anything a member has deliberately touched is left alone, and the app reports what it skipped and where, so correcting an earlier Month can never silently undo a decision made in a later one.

Propagation means "carry this into the Months still holding the old copied value", not "overwrite the future". Months not yet opened need nothing at all: they inherit.

**Blocked by:** 08, 09

**Status:** done

**Suggested model:** Opus, high thinking — walks every later opened Month, decides row by row on review state, and has to report what it skipped and why. Cheaper if ticket 06 is still in context.

- [x] Propagating an edit walks every opened Month after the source, in order
- [x] A matching value that is still Unreviewed is replaced
- [x] A matching value a member has edited or confirmed is left alone
- [x] The result reports which Months were changed and which were skipped, with the reason
- [x] A Month that kept its own value does not stop propagation reaching the Months after it
- [x] Rows are matched by stable identity, so a renamed Expense is still found
- [x] A row repurposed in a later Month is a different identity and is not matched
- [x] Months that have not been opened are not touched and need no handling
- [x] Propagation is a single engine operation over a Household value, returning what it changed and skipped, testable with no adapter and no UI
- [x] A Month that does not hold the row at all does not stop propagation reaching the Months after it

## Comments

**A Month missing the row is not the end of the thread** — from ticket 08, which walks
the later Months the same way and got this wrong twice before it was caught.

The walk must pass over a Month that does not hold the identity, not stop at it.
"Propagation stops at nothing" is already a criterion above for a Month that kept its
own value; the same holds for a Month that has no such row. A member can take a row out
of one Month while the Months after it are already open, which leaves a gap in the
middle of a thread whose later rows are still on it — an identity travels no way but
inheritance, so a later Month holding it is on the thread whatever the Months between
say. Stopping at the gap silently drops every Month beyond it, which reads as a
propagation that worked.

The mirror of it is worth the same care: eligibility questions of the form "did this row
come from before?" must not be answered by looking one Month back. Ticket 08's
`inherited` in `domain/repurposing.ts` asks every earlier opened Month for exactly this
reason, and its comments say why.

**A third skip reason turned up while building this: `refused`.** A later Month can hold
a row the edit cannot legally stand in — Ana leaves, October opens without her, and
correcting the Participants in July names somebody October has never had. Throwing there
would abandon the whole walk for one Month's sake, so the engine catches the DomainError,
records it against that Month with the sentence the engine gave, and carries on. The
Months either side are unaffected.

That sentence is currently the raw engine wording, which for this case reads
`<uuid> is not a member of 2026-10` — a member identity and a Month key rather than a
name and a Month. It is the one member-facing string here that is not in the Household's
own words. Worth fixing where `requireMember` raises it, which would improve it
everywhere at once rather than only in the propagation report.

**Repurposing does not offer to carry the new name forward.** Ticket 08 hands that to
propagation, and the engine can do it, but the composable's `repurposeExpense` does not
return the freshly minted identity, so the panel has nothing to propagate against. None
of this ticket's criteria cover it; it wants the 08 seam widened by one return value.
