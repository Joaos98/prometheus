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

**Status:** done

**Suggested model:** Opus, medium thinking — mostly a form and a modal, with a destructive
confirmation that has to be honest without being melodramatic.

- [x] An Expense's category is chosen from the Household's list, or left as none
- [x] Typing a name that does not exist does not silently create a category
- [x] Adding a category from within the form, if offered, is an explicit action
- [x] A categorised Expense shows a chip; an uncategorised one shows nothing
- [x] The management modal lists, adds, renames and deletes categories
- [x] Renaming updates every Month's rendering immediately, past Months included
- [x] Deleting an unused category asks once and removes it
- [x] Deleting a category in use names the row count and the Month range before proceeding
- [x] The confirmation says the clear cannot be undone and that export is the recovery
- [x] Confirming clears every referencing row and then deletes the category
- [x] The clear shows progress and cannot be started twice concurrently
- [x] A clear that fails partway leaves the category present, and the modal says so rather
      than reporting success
- [x] Cleared rows do not become Reviewed — check the Month's unreviewed count before and
      after
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

**Composite layout work rode along in this ticket's commit, and belongs to `04`.** It was
already in the working tree when this was picked up: the line editor became one grid across
every row (`display: contents` per row, so the fields of one line cannot drift out of step
with the ones above it), the add-a-line button became a filled action sized to the column the
remove buttons share, Enter in either new-line field commits the line, and the composite's
disclosure control moved in beside its count inside the row body. Named here because the two
changes were interleaved in the same two files and could not be committed apart.

**The picker is modelled over a string, not over `CategoryId | null`.** `<option :value="null">`
bound through `v-model` leaves an uncategorised Expense's picker showing a blank rather than
"No category" — which reads as a control that failed to load, not as the answer it is. The
form keeps `category` as `CategoryId | null` and exposes a `chosenCategory` computed that maps
none to `''` in both directions; the option is a plain `value=""`. Caught in the browser
against the demo, not by a test — there is no component-test harness here, and this is the
kind of thing that only a real `<select>` shows you.

**The delete confirmation reads its cost afresh on every render**, from `categoryUsage`
against the Household as it stands, rather than capturing it when the question was raised.
The other member may categorise a row while the question sits open, and the figure a member
agrees to has to be the figure that is true when they agree to it — the same argument
`DiscardMonth.vue` makes for its own entry count.

**The clear's progress is real but effectively invisible over the browser's own storage.**
`clearing` holds the category being cleared, which disables every other delete, rename and add
in the modal and turns the button into "Clearing the rows…". Over `localStorage` the N row
writes settle inside a microtask, so nothing is on screen long enough to see; over the
self-hosted build's HTTP store it is N requests and it shows. The re-entrancy guard was checked
directly by clicking the destructive button twice in the same tick — the second click does
nothing, and exactly one category left the list.

**A clear that stops partway is reported as unfinished, not as a failure of nothing.** The
modal keeps a second sentence beside the store's own message saying that the category is still
here, that some rows may already have been cleared, that nothing was deleted, and that running
it again picks up where it stopped — which is what ticket 06's ordering actually guarantees.

**`ui/categories.ts` re-words the cost rather than reaching for the engine's sentence.**
`costInWords` is private to `domain/categories.ts` and worded for a refusal; this is the
question asked before a refusal could arise, which is where a member decides. `domain/categories.ts`
already says a confirming panel builds its own sentence from `categoryUsage`, and the two are
pinned to the same wording by tests on either side.

**The demo seed was still writing free strings, and now mints its vocabulary.** `demo/seed.ts`
passed `category: 'Housing'` and the like — MVP-era names that typecheck as `CategoryId` but
name nothing in `household.categories`, so every seeded row was a dangling reference: no chip,
and a picker with nothing selected. It now calls `addCategory` for the five names it already
used and looks each id up with `categoryNamed`. This is a correction to what tickets 05–07
left behind rather than a start on ticket 14, which still owns the fuller seed.

**A category the vocabulary no longer holds reads as none in the picker too, and saving
writes that none.** The chip already gave that reading; the picker had no option to show the
id against, so it went blank — the same failure the `''` mapping exists to prevent. The
computed now answers `''` for an id `props.categories` does not list, and `save` emits from
the picker rather than from the held id, so a member who opens such a row and saves it clears
the reference rather than putting it back. Checked by forging the state another member's
delete leaves behind: the Month on screen saved `null`, and the other Months were untouched,
an edit being per-Month.

**`useChanges` grew a `reporting` alongside `report`.** `report` answers a boolean, which is
what almost every caller wants and what `if (!(await report(…))) return` reads as; a mint
answers with the identity it minted, and the call sites had started hand-rolling the try/catch
that `ui/changes.ts` says is the one thing a panel does. `report` is now a thin `reporting`
that maps acceptance to `true`. `ExpenseForm` does not carry the mint out itself either: the
panel hands it a function that already reports, so a refused name is said where every other
refused change in that panel is said, and the form is left holding only what it does with the
identity that comes back.

**Both deletes are held shut, not just the clear.** The ticket asks only that a second clear
not start on top of one, but two clicks on the plain delete sent the second against a category
that had already gone, and what the member read was the engine saying it is not a category
this Household has — a refusal of a delete that had in fact succeeded. One `deleting` ref
holds which category and whether it is the long half; the button's label reads from it.

**The rename field takes focus, through a function ref.** The button that raises it is the
element the field replaces, so focus would otherwise be left on nothing. A named `ref` could
not do it: inside the `v-for` over the categories a named ref collects into an array, and only
one field ever exists.

**The unfinished-clear sentence is appended to the refusal, not held beside it.** Held on its
own it outlived the failure it belonged to: a rename or add that succeeded afterwards cleared
`failure` and left "The clear did not finish…" sitting underneath it. Appending it to
`failure` makes it live and die with the message it explains. It is also worded for both
outcomes now — the previous version claimed rows "may already have been cleared" even where
the refusal came before any write, which is the same kind of untruth as claiming the delete
succeeded. Checked by breaking `Storage.setItem` for one call: the sentence appears, the
category stays listed, a successful add afterwards takes it away, and the retried clear
finishes the job.

**The pill class is `chip`, not `tag`.** `CONTEXT.md`'s Category entry lists _tag_ under
_Avoid_, and the class sat directly on the category chip. Renamed in `styles.css` and at all
five uses, One-Off and Restricted-Use included — it is one pill shape, and leaving half of
them under the old name would be worse than either name alone.

**`ExpenseForm`'s two category props are required.** They were optional with a comment
defending the absent case, and both call sites always passed them, so the `v-if="addCategory"`
branch was dead.

**Uncategorised is rendered as absence in one place only.** `categoryName` answers `undefined`
both for a row with no category and for an id the vocabulary no longer holds, so a screen that
has not caught up with another member's delete draws no chip rather than a chip naming an id.
