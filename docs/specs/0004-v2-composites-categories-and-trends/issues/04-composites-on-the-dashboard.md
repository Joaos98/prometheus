# 04 — Composites on the dashboard

**What to build:** A composite reads and edits on the Month dashboard. This is the ticket
that spends ADR-0010's headroom.

In `ExpensesPanel.vue`: a composite renders as **one row** showing its name and derived
total, with a disclosure that expands its lines beneath it. **Collapsed by default** — the
centre column's spare vertical room is a fixed budget, and several composites expanded at
once would push Shares off the screen and bring back the spreadsheet feel ADR-0010 rejected.
The expansion state is per-row and per-device; it is not Household data and is not stored
with the Month.

In `ExpenseForm.vue`: a line editor — add, rename, retype, remove, with the running total
shown as it changes. The total is **never typeable** while lines exist. Where a line edit
would invalidate a `fixed` Split Rule, the form surfaces the engine's refusal in the same
place and the same way it already surfaces an invalid split on an amount change; the member
resolves it by saying who absorbs the difference.

The two transitions need an affordance each: a simple Expense gains an "itemise" action that
turns its typed amount into the first line, and deleting the last line returns the form to a
typed amount. Both preserve the figure (ticket 01) — the UI must not zero or clear anything
on the way through.

A composite still carries one `oneOff` mark, one `reviewed` state and one row's worth of
tags. `OneOffMark.vue`, `UnreviewedMark.vue` and the Pending tag are unchanged and sit on
the parent. A Pending composite — no lines, or any line without a figure — renders the
existing Pending warning; the expansion shows which line is missing its figure.

`MonthDrift.vue` reports a composite's `lines` difference as one entry, using whatever
wording the existing field list uses. Naming which lines moved is out of scope for this
ticket.

**Blocked by:** 01, 03

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — a layout decision ADR-0010 already constrains,
plus a form that has to surface a validation refusal without losing the member's input.

- [ ] A composite renders as one row with its name and derived total, collapsed
- [ ] Expanding shows every line with its name and amount; collapsing hides them again
- [ ] Expansion state is per-device and per-row, and is not written to the Household
- [ ] Several composites in one Month do not push the rail or the right column out of view at
      the layout's target width
- [ ] The line editor adds, renames, retypes and removes lines, with the running total
      updating as it goes
- [ ] The amount field is not typeable while the Expense holds lines
- [ ] A line may be left without a figure, and the composite then shows the Pending warning
- [ ] The expansion makes it visible which line has no figure
- [ ] A line edit that would invalidate a `fixed` rule shows the engine's refusal and does
      not discard what the member typed
- [ ] "Itemise" on a simple Expense produces one line carrying the former amount, named after
      the Expense
- [ ] Deleting the last line returns the form to a typed amount holding the former sum
- [ ] The One-Off mark, the Unreviewed mark and the row's tags sit on the parent and behave
      exactly as they do on a simple Expense
- [ ] A composite counts as one row in the Month's unreviewed count
- [ ] `MonthDrift.vue` reports a `lines` difference as one entry, refreshable in one action
- [ ] `npm run typecheck` is clean and the full suite passes
