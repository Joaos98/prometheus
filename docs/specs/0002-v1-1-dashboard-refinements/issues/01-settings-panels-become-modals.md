# 01 — Settings panels become modals

**What to build:** The four cards that open inline on the dashboard — Roster, Household file, Currency and Demo — become modals, one per masthead button, so that opening one no longer pushes the Month down the page.

There is no modal, dialog or overlay anywhere in `ui/` today, so this ticket introduces the primitive. The masthead itself does not change: each button keeps its label and its place, and only where its panel renders is different. The dashboard's inline card slot goes away entirely.

Demo moves with the other three. It is the same inline toggle with the same problem, and leaving one of four neighbouring buttons behaving differently from its siblings reads as a fault rather than a distinction.

Escape, a backdrop click and a close button all dismiss. Nothing in these panels holds a draft worth protecting. One modal at a time is not a rule to enforce — the masthead sits behind the backdrop, so reaching a second button already means dismissing the first.

An import that succeeds leaves its modal open, still saying "The Household in the file is the one on screen." A transient banner would be a second new primitive in this ticket, for a receipt `HouseholdFile.vue` already prints.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, medium thinking — contained, but it introduces a primitive with real accessibility obligations (focus, `aria`, restoring focus on close). Get the primitive right once; the four call sites are then trivial.

- [x] Roster, Household file, Currency and Demo each open as a modal from their existing masthead button
- [x] No settings panel renders in the dashboard's flow, and the Month does not move when one opens
- [x] Escape dismisses the open modal
- [x] A click on the backdrop dismisses the open modal
- [x] Each modal has a visible close button
- [x] Only one modal is open at any time
- [x] Focus moves into the modal on open, is trapped while it is open, and returns to the button that opened it on close
- [x] The modal is announced as a dialog and carries an accessible name matching its button
- [x] A successful import leaves the Household file modal open showing its existing confirmation
- [x] Dismissing after a successful import reveals the imported Household on the dashboard behind it
- [x] The masthead's buttons, labels and layout are unchanged, including the 1240px collapse
- [x] No new notification, toast or banner mechanism is introduced

## Comments

**Built.** `ui/components/Modal.vue` is the primitive: teleported to the body, `role="dialog"` with `aria-modal` and an `aria-labelledby` heading, focus onto the dialog on open and back to the opening button on close, Tab wrapping at both ends, and Escape, a `mousedown` on the backdrop and a close button all dismissing.

Two judgements worth recording.

**The currency modal is titled "Currency", not `EUR €`.** The criterion asks for an accessible name matching its button, and the other three read their button back word for word. The currency button carries the Household's code and symbol — it is a value, not a label — and a dialog announced as "EUR €" names the setting's current answer rather than the setting. `ui/settings.ts` holds all four titles in one place so the pairing is visible.

**One modal at a time is held in the state, not left to the backdrop.** The four booleans became one `SettingsPanel | undefined` in `ui/settings.ts`, tested in `ui/settings.test.ts`. The backdrop already makes it true on screen; this makes it true for every way in that is not a click.

Verified in the running demo: opening the Roster leaves the Expenses column at the same offset it had before, Escape returns focus to the Roster button and clears the scroll lock, a second button replaces rather than adds, and the backdrop dismisses.

**Two defects found reviewing this and fixed.**

*The focus trap did not hold on the Household file panel.* `stops()` took everything matching the selector, and `HouseholdFile.vue` hides its file input behind a label with `display: none` — so the last stop was a node the browser skips, the forward wrap compared against it and never fired, and two Tabs walked focus out into the masthead behind the backdrop. It now keeps only elements that lay out a box, which is what tells a hidden node from one the browser will actually focus.

*Closing after switching panels put focus on the wrong button.* Reading `document.activeElement` on mount could not work: the outgoing panel's unmount restores focus to its own opener before the incoming one mounts, so the new modal took the old panel's button for its own. The button is now handed in as an `opener` prop, recorded by `press()` from the click that opened it and read once on mount — once, because by the time the outgoing panel unmounts the prop already names the incoming one.
