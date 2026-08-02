# Spec 0002 — v1.1: dashboard refinements

Status: done — shipped as v1.1, all five tickets `done`

The first five items of [the roadmap](../../roadmap.md), refined into a spec. Vocabulary is [CONTEXT.md](../../../CONTEXT.md); the dashboard layout this works within is [ADR-0010](../../adr/0010-month-dashboard-layout.md). Everything here is UI: no domain function changes, no storage shape changes, no new `localStorage` key. The MVP shipped as v1.0 and this is v1.1.

## Problem Statement

Five ways the v1.0 dashboard crowds itself or misdescribes what it is showing. They are unrelated as code and identical in kind — each one is the screen failing to be a plain readout of the Month.

- **Settings push the Month down the page.** Roster, Household file, Currency and Demo each open as a card in the dashboard's flow, above the columns. Opening one shoves the whole Month down; opening two shoves it further. The panels are not about the Month, and they displace it anyway.
- **The Split Rule is offered where there is nothing to divide.** An Expense with one Participant yields one Share equal to the full amount, whatever the rule says. The form asks anyway, the row prints the answer, and a `fixed` rule that does not total the Expense produces a warning the member can act on only by adding a second Participant.
- **The Expenses list cannot be narrowed.** It is the longest list on the dashboard and there is no way to ask what one member is actually in.
- **The unopened-Month card sits in the corner of an empty page.** It is capped at 560px and left-aligned in the normal flow, with no rail and no columns beside it, so a Month nobody has opened reads as a layout that failed to load.
- **"Viewer: nobody" describes nothing.** With no Viewer picked the rail still leads with the Month's first member and gives them the full Leftover Balance subtraction. The picker names an absence that is not on screen.

## Solution

The four settings panels become modals, one per masthead button, so the Month never moves to accommodate something that is not about it. The Split Rule disappears from an Expense with one Participant, and the stored rule becomes Even so that the hidden control can never strand a member in front of a complaint. The Expenses panel gains its own Participant picker, persisted per device. The unopened-Month card centres in the space it has. And the Viewer picker stops offering an option that never described the screen, defaulting instead to the member the rail was already leading with.

Nothing here changes what a Month stores, what the engine computes, or what an export contains.

## User Stories

### Settings

1. As a member opening the Roster, I want the Month to stay exactly where it is, so that changing who is on the Roster does not cost me my place on the page.
2. As a member, I want a settings panel to close on Escape or a click outside it, so that dismissing it needs no aim.
3. As a member, I want only one settings panel open at a time, so that the screen has one subject.
4. As a member who has just imported a Household file, I want to be told plainly that it landed, so that importing a backup of the Household I already had is distinguishable from nothing happening.

### Expenses with one Participant

5. As a member recording an individual cost, I want not to be asked how to split it, so that a form stops asking a question with one possible answer.
6. As a member, I want a one-Participant Expense to say what it is on the row, so that the caption line says something true rather than naming a rule that does not apply.
7. As a member, I want never to see a split warning I cannot act on, so that the app does not complain about a state it will not let me reach.

### Narrowing the Expenses list

8. As a member, I want to filter Expenses to one Participant, so that I can see what one person is actually in without reading the whole Month.
9. As a member, I want to ask that about somebody other than me, so that answering it does not require telling the app I am them.
10. As a member reviewing several Months, I want the filter to hold as I move between them, so that a year of my own costs is one choice rather than twelve.
11. As a member, I want the panel to say how much it is hiding, so that a short list always explains itself.
12. As a member, I want the filter never to change itself, so that the list is only ever what I asked for.

### An unopened Month

13. As a member browsing a Month nobody has opened, I want the page to look deliberately empty rather than broken, so that "not opened" reads as a state and not a failure.
14. As a self-hoster arriving with a backup at a deployment with nothing in it, I want the Household file button still in reach, so that the emptiest screen in the app is the one where import is available.

### The Viewer

15. As a member, I want the Viewer picker to name whoever the rail is leading with, so that the control and the screen agree.
16. As a member who has never picked, I want a Viewer chosen for me, so that the rail's existing behaviour has a name on it.
17. As a member browsing a Month I am not in, I want the picker to name whoever that Month leads with, so that it stays a readout of the screen.
18. As a member, I want browsing such a Month never to change my stored choice, so that visiting history cannot rewrite who this device thinks I am.

## Implementation Decisions

### The modal primitive

There is no modal, dialog or overlay anywhere in `ui/` today, so ticket 01 introduces one. One modal per masthead button, keeping the buttons exactly as they are — a single tabbed "Settings" modal was considered and rejected as a larger redesign of the masthead than the problem calls for.

All four cards move, Demo included. It is the same inline toggle with the same problem, and one of four neighbouring buttons behaving differently from the other three reads as a fault. The dashboard's inline card slot disappears entirely rather than being half-emptied.

Escape, a backdrop click and a close button all dismiss. Nothing in these four panels holds a draft worth protecting: Roster edits commit on save, Currency is a select and a button, and a chosen import file is one click to re-choose. One modal at a time follows from the backdrop rather than being enforced — the masthead sits behind it, so a second button cannot be reached without dismissing the first.

An import that succeeds leaves its modal open, carrying the sentence `HouseholdFile.vue` already says. The alternative is a transient banner, which means a notification primitive Prometheus has never had — a second new primitive in a ticket already introducing one, for a receipt that already exists.

### The Split Rule on a one-Participant Expense

Ticking exactly one Participant makes the submitted rule `{ kind: 'even' }`, whatever it was. Hiding the control while leaving a `fixed` rule in place is worse than showing it: `splitOf` divides evenly instead when fixed amounts do not total the Expense and says so on the row, and the form disables its own save button — so a member would face a complaint with no control to answer it.

`splitRule` is a field Drift compares (`drift.ts`), so saving such a row can rewrite an inherited `percentage` or `fixed` rule and be reported as a difference against later opened Months. This is correct and should not be suppressed: something did change. It happens only on an explicit edit, never on inheritance, and never to a row nobody touched.

The row's caption reads `Individual expense · 1 Participant`. The phrase is the glossary's own, used for exactly this case under both **Share** and **Participants** in CONTEXT.md. The rule name goes, and so does the divided-evenly-instead warning, which says nothing when there is one Participant to divide among.

Dropping the rule name also covers the seam this leaves: a one-Participant row still storing `fixed`, inherited and never edited, stops advertising a rule the form will no longer show.

### The Participant filter

Its own picker in the Expenses panel header, not the Viewer. Changing the Viewer reorders the entire rail, which is far too large a side effect for wanting a shorter list, and it cannot ask what another member is in without claiming to be them.

The choice persists across Months and across a reload, held beside the Viewer in `ui/device-preferences.ts` — no new storage key beyond its own. It is deliberately lifted out of the subtree `MonthDashboard.vue` keys on the Month: that key exists to stop half-typed edits landing in the wrong Month, which is a correctness risk a lens does not carry. Re-picking the filter every Month would defeat the cross-Month review the item exists for.

The panel header states how many of how many it is showing, because the rail's Leftover Balances, review meter and entry count stay Month-wide — a filtered panel showing three rows beside a rail saying eight entries has to account for itself.

**The filter never moves on its own.** An Expense saved with Participants outside it leaves the list, and the count is what explains where it went. Clearing the filter automatically at that moment was considered and rejected: a lens that repositions itself is less predictable than one that occasionally hides something, and the count already tells the truth.

### The unopened-Month card

Centred on both axes in the space beneath the masthead. It is the only thing on the page, so anchoring it top-left is precisely what makes it read as a layout that failed rather than a Month that is genuinely empty.

The masthead stays, settings buttons included. ADR-0010 does not cover this screen, so nothing there is contradicted.

### The Viewer

The default is the Month's first member — the one `MonthRail.vue` already falls through to. Not the Roster's first, which may not be among a past Month's members at all and would land straight back in the mismatch this removes.

That member is written to `prometheus.viewer` on the first load that has an opened Month to read it from, so the picker does not drift as a member steps around. A first load on an unopened Month writes nothing and shows the Roster's first active member, so the pinned Viewer only ever comes from the one rule. `viewer` therefore keeps its `MemberId | undefined` type: pinning buys a stable label, not a simpler type.

Where the stored Viewer is not among a Month's members, the picker displays that Month's fallback instead. Browsing there **never writes** — it is a display substitution, the same kind `MonthRail.vue` already documents for the Restricted-Use toggle. Storage changes only on an explicit pick.

The accepted cost: stepping between Months can change the name in the picker with nothing on screen explaining it. Prose in the rail was considered and rejected as too much for a fixed-width card. The trade is that the picker is never wrong about who the rail is showing, at the price of looking like a setting that moves on its own.

### Supersedes

Ticket `0001-mvp/issues/17` was built to the criterion *"The Viewer defaults to nobody, and the dashboard is fully usable with no Viewer set."* Ticket 03 here replaces it. Its other nine criteria stand unchanged — the Viewer is still per-device, still grants nothing, still hides nobody, and still never appears in an export.

## Out of Scope

- **A notification, toast or banner primitive.** Ruled out in favour of the receipt `HouseholdFile.vue` already carries. If a later item genuinely needs transient messaging, it should introduce it deliberately rather than arriving as a side effect of relocating a settings panel.
- **The household's total Spendable Income and per-member percentages.** Moved to v1.2: the percentages want largest-remainder apportionment totalling exactly 100, which is `domain/shares.ts`'s discipline and belongs in the engine, so the item is not UI-only.
- **Roster reordering.** Would make "the Month's first member" a deliberate choice rather than an accident of history, but persisting order is the v1.3 problem and ADR-0008 has no answer for it yet.
- **Prose in the rail when the stored Viewer is absent from a Month.** Considered and declined; the picker's substitution stands unexplained on screen.
- **A narrow-window design for the centred unopened-Month card** beyond what the existing 1240px collapse already does.
- **Filtering anything but Expenses.** Income and Savings Goals are per-member already.
