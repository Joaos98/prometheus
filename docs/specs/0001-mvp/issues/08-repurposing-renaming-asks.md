# 08 — Repurposing: renaming an inherited Expense asks

**What to build:** A member opens the Month, sees an inherited "Netflix, 12", and types over it: "Gym, 40". Did the subscription get renamed, or did one cost end and another begin in its place? The data cannot tell — the two are identical in the row and demand opposite handling — so this is the one question no rule can answer, and the app asks it at the one moment it arises.

Continuing keeps the Expense's identity and its history, so trends and propagation still follow the same thread. Repurposing mints a new identity, ending the old thread there and starting a new one.

**Blocked by:** 06

**Status:** ready-for-agent

**Suggested model:** Opus, high thinking — identity semantics, where a mistake silently merges two costs' histories rather than failing.

- [x] Editing the name of an inherited Expense Snapshot asks whether the Expense continues or a different one begins
- [x] Choosing to continue keeps the stable identity, and the row remains part of the same thread across Months
- [x] Choosing to repurpose mints a new identity for this Month onward, and the old thread ends at the previous Month
- [x] The question is asked only for rows that could be either — an inherited row sharing its identity with the Previous Month — and not for a row created in this Month
- [x] Whether a row is eligible for the question is decided by the engine, not by the UI
- [x] A name may legitimately differ between Months without the identity changing
- [x] Category may also be edited per Month, and does not trigger the question
