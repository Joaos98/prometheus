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

**Status:** done

**Suggested model:** Opus, medium thinking — a layout decision ADR-0010 already constrains,
plus a form that has to surface a validation refusal without losing the member's input.

- [x] A composite renders as one row with its name and derived total, collapsed
- [x] Expanding shows every line with its name and amount; collapsing hides them again
- [x] Expansion state is per-device and per-row, and is not written to the Household
- [x] Several composites in one Month do not push the rail or the right column out of view at
      the layout's target width
- [x] The line editor adds, renames, retypes and removes lines, with the running total
      updating as it goes
- [x] The amount field is not typeable while the Expense holds lines
- [x] A line may be left without a figure, and the composite then shows the Pending warning
- [x] The expansion makes it visible which line has no figure
- [x] A line edit that would invalidate a `fixed` rule shows the engine's refusal and does
      not discard what the member typed
- [x] "Itemise" on a simple Expense produces one line carrying the former amount, named after
      the Expense
- [x] Deleting the last line returns the form to a typed amount holding the former sum
- [x] The One-Off mark, the Unreviewed mark and the row's tags sit on the parent and behave
      exactly as they do on a simple Expense
- [x] A composite counts as one row in the Month's unreviewed count
- [x] `MonthDrift.vue` reports a `lines` difference as one entry, refreshable in one action
- [x] `npm run typecheck` is clean and the full suite passes

**Line edits land as they are made, rather than on the form's Save.** This was the ticket's
one real design question, and the engine answered it: ticket 01 built the four line
operations to change one line at a time precisely so the amount they derive and the Split
Rule standing against it are judged together. A staged list replayed on Save would apply as
a sequence, and a refusal partway would leave exactly the half-applied edit
`requireConsistentRule` documents itself as preventing. The cost is that Cancel does not
undo a line already added — which is what every other immediate row action in the panel
already does.

`MonthDrift.vue` needed **no change**. It renders whatever fields Drift reports through
`labelOf`/`valueOf`, and ticket 02 already taught `ui/drift.ts` to read `lines`; its refresh
was always whole-row. Verified in the browser rather than assumed: a composite reports one
entry reading *Line Items · No Line Items · Groceries €665.80, Fruit and veg …*, and one
"Take the other reading" lands the whole list.

`ExpensesPanel.vue`'s row markup was restructured so the disclosure is a **sibling** of the
edit button rather than inside it — a button within a button is invalid HTML, and the row
body was already one big button.

Two things the first cut got wrong, both found in review and fixed before commit. **Itemise
read the stored amount while its button gated on the typed field**, so a corrected figure
was silently dropped and a Pending row could offer an action the engine would refuse; it now
lands the typed figure first and itemises second, which cannot half-apply in any way that
loses it. And **an unreadable line amount was swallowed into `null`**, landing a Pending line
with no message — `readAmount`'s refusal now reaches the member where an invalid split's
does.

Scope held: "Itemise" is offered on the **edit** form only, since `itemiseExpense` needs a
row to itemise; a brand-new Expense is recorded first and itemised after. A simple Expense
shows exactly one way in — itemise where there is a figure, a named line where there is
none, which is the Pending case the engine already supports.

Checked with `npm run typecheck` (clean) and `npx vitest run` (720 tests passing, up from
713), plus the demo build driven in the browser: every checklist item above was exercised
against the running dashboard, including the three-column layout holding with three
composites expanded.
