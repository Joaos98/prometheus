# 02 — One-Off on the add forms, and a flag that toggles

**What to build:** The dashboard side of the two-way mark. A member can say a row is
One-Off while recording it, and can unmark a row afterwards.

**On the add forms.** `IncomeForm.vue`, `ExpenseForm.vue` and `GoalForm.vue` each gain a
checkbox reading **One-Off**, with the sense the row control's tooltip already uses — this
Month alone, and the next Month opened does not inherit it. Its value goes into the draft
as `oneOff`.

The checkbox appears **only when adding**. All three components serve both adding and
editing, and on an existing row the flag toggle below is the control. Two reasons it is not
in both: there would be no rule a member could infer for which of the two controls to use,
and the form's save goes through `editXSnapshot`, which sets `reviewed: true` — so changing
only the checkbox and saving would silently confirm a row nobody had checked.

It always reads **One-Off**, never **Ends Here**. A row being added has a freshly minted
identity, so `appearedBefore` is `false` for it by construction and Ends Here is not a
reading it can have.

**On the row.** `OneOffMark.vue` loses its `v-if="!isOneOff(row)"` in all three panels and
becomes a toggle:

- It renders whether or not the row is marked, carries `aria-pressed`, and is styled to
  read as pressed when marked — reuse whatever the existing row controls use for an active
  state rather than introducing a new one.
- Marked, its `aria-label` and `data-tip` flip to the unmark reading: the row is marked
  and clicking lets the next Month inherit it again.
- Unmarked, its label and tooltip are exactly what they are today, still choosing between
  the One-Off and Ends Here wording on `ending`.
- Clicking calls the store wrapper with the opposite of the row's current value.

The text tag beside the row's name is **unchanged**. `One-Off` / `Ends Here` via
`endingTag` stays as the statement of fact; the flag is the control. Do not make the tag
clickable — every other tag on a row (`Restricted-Use`, `Pending`) is inert, and one
clickable tag among them is an affordance nobody can predict.

**Blocked by:** 01 — the drafts and the two-way setter it calls

**Status:** done

**Suggested model:** Sonnet — one shared component changed in three panels plus a checkbox
on three forms; the judgement is in the pressed state and the flipped wording.

- [x] Adding an income source, an Expense or a Savings Goal with the One-Off box ticked
      records the row already marked, and the next Month opened does not inherit it
- [x] The box is unticked by default and a row added without it behaves exactly as before
- [x] The box is absent when the same form is opened to edit an existing row, in all three
      panels
- [x] The checkbox reads One-Off in every case, never Ends Here
- [x] `OneOffMark` renders on marked and unmarked rows alike, in all three panels
- [x] Clicking it on an unmarked row marks it; clicking it on a marked row unmarks it, and
      the next Month opened inherits the row again
- [x] Unmarking a row does not clear its Unreviewed mark, and does not set one
- [x] The button carries `aria-pressed` reflecting the row's state, and its `aria-label`
      and tooltip say which direction clicking will go
- [x] An unmarked row's label and tooltip still choose between the One-Off and Ends Here
      wording according to whether the row appeared in the Previous Month
- [x] The `One-Off` / `Ends Here` text tag beside the row name is unchanged and is not
      clickable
- [x] The Income row still fits on one line at the dashboard's 1240px collapse and below,
      with the extra control now always present
- [x] Removing a row with a past still offers to end the run in the Previous Month

## Comments

Built as scoped: `OneOffMark.vue` lost its `v-if="!isOneOff(row)"` and gained a `marked:
boolean` prop, `aria-pressed`, and an `accent`-class pressed state (reusing the codebase's
existing "this needs attention" styling from `ConfirmMark`/`MonthNavigator`'s Today button,
rather than inventing a new one). Its `aria-label` and `data-tip` now branch on `marked`
first; the unmarked branch is untouched, still choosing One-Off vs Ends Here on `ending`.
All three panels (`IncomePanel.vue`, `ExpensesPanel.vue`, `GoalsPanel.vue`) pass `:marked`
and flip the click argument to `!isOneOff(row)`, so clicking always asks for the opposite of
the row's current state — this is what ticket 01's `setXOneOff(household, key, id, oneOff)`
was built for.

`IncomeForm.vue`, `ExpenseForm.vue` and `GoalForm.vue` each gained an `adding?: boolean`
prop (default `false`) and a `oneOff` ref, with a checkbox rendered only `v-if="adding"` and
included in the emitted draft. Each panel's add-form invocation now carries the `adding`
prop; the edit-form invocations are untouched, so the checkbox never appears there. The
text tag beside a row's name (`endingTag` via `.tag.one-off`) is untouched and remains an
inert `<span>`.

Checked in the browser against the running demo seed (`prometheus-demo` dev server): toggled
an existing row both directions and confirmed the `aria-label`/`data-tip`/`aria-pressed`/
`accent` class all flip correctly; added an income source with the box ticked and confirmed
it landed already marked (button read "Unmark ... " immediately); confirmed the edit form for
an existing row shows no One-Off checkbox; confirmed the Expense and Goal add forms both show
the checkbox; measured the Income row's `scrollWidth` vs `clientWidth` at 1240px and 600px
viewports to confirm no wrapping/overflow with the control now always present.

Checked with `npm run typecheck` (clean) and `npx vitest run` (606 tests passing, unchanged
from ticket 01 — this ticket is UI-only and added no new domain tests).
