# 08 — The category picker and management

**What to build:** Choosing a category on an Expense, and managing the list.

**The picker**, in `ExpenseForm.vue`: choose from the Household's categories, or none. No
free typing that silently mints a category — the whole reason the vocabulary is stored is
that a typo must not become a second category. Adding a category from within the form is
fine if it is an explicit action with the name shown back; falling into one by typing is
not.

**The row**, in `ExpensesPanel.vue`: a category renders as a chip beside the row's name. An
uncategorised Expense renders **no chip at all** — not a chip reading "Uncategorised".
Absence is the reading; a placeholder chip would put visual weight on every row that has not
been categorised, which is the toll on entry this design declined.

**Management**, as a masthead modal, following v1.1's settings-as-modals pattern
(`Modal.vue`, and `RosterPanel.vue` as the closest existing shape): list the categories, add,
rename, delete.

**The delete confirmation is the part to get right.** An unused category deletes on
confirmation. One in use shows what it will cost in the terms ticket 06 supplies — *"used by
34 rows across 11 Months, June 2025 – August 2026"* — offers to clear it from those rows and
then delete, and says plainly that this cannot be undone and that exporting first is the only
way back. `DiscardMonth.vue` is the existing precedent for a destructive confirmation that
names its cost in entries; follow it rather than inventing a second voice for the same kind
of warning.

While the clear runs it is N row writes (ticket 06), so it is not instant on a long record.
Show that it is running and do not let a second delete start on top of it.

**Blocked by:** 05, 06, 07

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — mostly a form and a modal, with a destructive
confirmation that has to be honest without being melodramatic.

- [ ] An Expense's category is chosen from the Household's list, or left as none
- [ ] Typing a name that does not exist does not silently create a category
- [ ] Adding a category from within the form, if offered, is an explicit action
- [ ] A categorised Expense shows a chip; an uncategorised one shows nothing
- [ ] The management modal lists, adds, renames and deletes categories
- [ ] Renaming updates every Month's rendering immediately, past Months included
- [ ] Deleting an unused category asks once and removes it
- [ ] Deleting a category in use names the row count and the Month range before proceeding
- [ ] The confirmation says the clear cannot be undone and that export is the recovery
- [ ] Confirming clears every referencing row and then deletes the category
- [ ] The clear shows progress and cannot be started twice concurrently
- [ ] A clear that fails partway leaves the category present, and the modal says so rather
      than reporting success
- [ ] Cleared rows do not become Reviewed — check the Month's unreviewed count before and
      after
- [ ] `npm run typecheck` is clean and the full suite passes
