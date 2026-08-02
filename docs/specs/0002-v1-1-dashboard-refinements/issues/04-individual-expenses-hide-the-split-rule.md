# 04 — An Expense with one Participant hides the Split Rule

**What to build:** The Split Rule choice disappears from the Expense form when exactly one Participant is ticked, and the rule stored for such an Expense becomes Even.

An Expense with one Participant yields one Share equal to the full amount whatever the rule says, so the form is asking a question with one possible answer. CONTEXT.md already calls this an individual expense, under both **Share** and **Participants**.

The rule must be forced, not merely hidden. `splitOf` divides evenly instead when a `fixed` rule's amounts do not total the Expense and prints a warning on the row, and the form disables its own save button in the same state — so hiding the control over a stored `fixed` rule would strand the member in front of a complaint with nothing to answer it with.

`splitRule` is a field Drift compares, so saving a one-Participant row can rewrite an inherited `percentage` or `fixed` rule and be reported as a difference against later opened Months. That is correct and must not be suppressed: something did change. It happens only on an explicit edit — never on inheritance, and never to a row nobody has touched.

The row's caption reads `Individual expense · 1 Participant`, dropping the rule name and the divided-evenly-instead warning, which says nothing where there is one Participant to divide among. Dropping the rule name also covers the seam: a one-Participant row still storing `fixed`, inherited and never edited, stops advertising a rule the form no longer shows.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, medium thinking — the forcing rule and the caption are small, but the Drift consequence is real and wants a test that pins it rather than a fix that hides it.

- [x] The Split Rule fieldset is hidden while exactly one Participant is ticked
- [x] The per-Participant percentage and fixed-amount inputs are hidden with it
- [x] Saving with one Participant stores `{ kind: 'even' }`, whatever the rule was before
- [x] Ticking a second Participant restores the choice, showing the rule as it now stands
- [x] No one-Participant Expense can reach a state where its save button is disabled by an unsummable rule
- [x] A one-Participant row's caption reads `Individual expense · 1 Participant`
- [x] That caption shows no rule name and no divided-evenly-instead warning
- [x] A one-Participant row still storing `percentage` or `fixed`, never edited, renders with that same caption
- [x] Editing such a row rewrites its rule to Even and Drift reports the change against later opened Months
- [x] Inheriting a row into a newly opened Month rewrites no rule
- [x] Multi-Participant Expenses are unchanged in form, row and stored rule
- [x] Shares are unchanged in every case — this ticket moves no money

## Comments

**Built.** `ruleFor` and `expenseCaption` in `ui/split-rules.ts` carry it, so the form and the row cannot disagree about what an individual expense is. `ExpenseForm.vue` judges everything against `submittedRule` rather than the radio buttons, which is what makes the disabled-save state unreachable at one Participant: the rule it would validate is Even, and Even is never inconsistent.

The Drift consequence is pinned rather than hidden, in `ui/split-rules.test.ts`: a one-Participant row inherited into a later Month keeps its `percentage` rule and reports no difference, editing it in the earlier Month rewrites the rule to Even and Drift reports `splitRule`, and the Shares are identical before and after.

Verified in the running demo on Car insurance, a two-Participant row on a fixed rule: unticking the second Participant removed the Split Rule fieldset, the per-Participant amounts and the "Adds up" line together and left save enabled; ticking them back restored the fieldset still showing Fixed amounts; saving with one left the row reading `Individual expense · 1 Participant` with the whole amount as that member's Share.

**One defect found reviewing this and fixed.** The forced rule was first written as a computed, which took the form's render down: `chosenRule` refuses a percentage it cannot read, and a computed whose getter throws cannot be contained by whoever reads it — Vue refreshes a computed dependency during its own dirty-checking, outside any `try` here, so a percentage typed as `abc` left the form frozen at its last state rather than printing the refusal. It is a plain function again, called inside the two `try` blocks that want the refusal, which is the shape the form had before this ticket.
