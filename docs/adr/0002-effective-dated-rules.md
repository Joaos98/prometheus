# Rule changes are effective-dated; history is protected by the model, not by locks

Every change to income, a split rule, or participants applies from a given Month onward and never alters earlier Months. A past Month's data can still be edited; it recomputes under the rules that were in effect for that Month. Chosen over locked/frozen months (which force corrections into the wrong Month) and over always-recompute (which silently rewrites history when rules change).

Effective From may be any Month — past, current, or future. Future-dating schedules known changes; past-dating deliberately rewrites the affected Months, which is allowed because it is visible and deliberate rather than silent. The guarantee is narrower than "history never changes": a change never touches Months earlier than its own Effective From.
