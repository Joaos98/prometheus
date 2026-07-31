# 17 — Viewer preference and the restricted-use toggle

**What to build:** Two comforts for a shared machine, neither of which is Household data and neither of which grants anything.

A member picks from a Roster dropdown in the header which member this device highlights and sorts first, so their own figures are where they look. It is stored on that device alone, defaults to nobody, hides nothing from anyone, and confers no permissions — every screen still shows all members side by side, because for a share calculator that comparison *is* the screen.

And a toggle beside the Leftover Balance for whether Restricted-Use Income counts toward it, so a member can see both "what I can spend on anything" and "what came in". It moves that one figure and nothing else — nobody's Share changes, because Shares always weight by Spendable Income whatever the dashboard is set to display.

**Blocked by:** 05

**Status:** done

**Suggested model:** Sonnet, medium thinking — small, with one rule to hold: the toggle is a display parameter at the call site and never reaches Share computation.

- [x] A Roster dropdown in the header sets which member this device treats as the Viewer
- [x] The Viewer's figures are highlighted and sorted first
- [x] The Viewer defaults to nobody, and the dashboard is fully usable with no Viewer set
- [x] The Viewer is stored on the device only, never leaves it, and is not Household data
- [x] Each device answers independently; changing the Viewer on one does not affect another
- [x] The Viewer grants no permissions and hides nothing — all members remain visible
- [x] A toggle beside the Leftover Balance substitutes total Income for Spendable Income in that figure alone
- [x] The toggle changes no member's Share, and no proportional Split Rule reweights
- [x] The toggle is a per-device display preference, not Household data
- [x] Neither the Viewer nor the toggle appears in an export
