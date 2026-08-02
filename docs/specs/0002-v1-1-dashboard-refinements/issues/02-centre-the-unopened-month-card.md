# 02 — Centre the unopened-Month card

**What to build:** The card shown for a Month nobody has opened centres in the space beneath the masthead, on both axes, instead of sitting capped at 560px in the top-left corner of an otherwise empty page.

It is the only thing on that page — no rail, no columns. Anchoring it to the corner is exactly what makes an unopened Month read as a layout that failed to load rather than a Month that is genuinely empty. Centring makes the emptiness deliberate.

The masthead stays where it is, settings buttons included. The Month navigator is how a member leaves this screen, and a self-hoster arriving with a backup at a deployment with nothing in it needs the Household file button precisely here — this is the emptiest screen in the app and the one where import matters most.

ADR-0010 covers the opened-Month dashboard and explicitly does not specify this screen, so nothing there is contradicted.

**Blocked by:** 01 — both change `MonthDashboard.vue`'s body, and 01 removes the inline card slot this card currently sits beside

**Status:** done

**Suggested model:** Haiku or Sonnet, low thinking — a layout change to one component, with the card's own content untouched.

- [x] The unopened-Month card is centred horizontally and vertically in the space beneath the masthead
- [x] The card's content, wording and max-width are unchanged
- [x] The masthead renders as it does on an opened Month, including every settings button
- [x] The Month navigator still moves between Months from this screen
- [x] The layout holds at the 1240px collapse and below without the page scrolling horizontally
- [x] An opened Month's dashboard is visually unchanged

## Comments

**Built.** The card sits in an `.empty-month` wrapper in `MonthDashboard.vue` that takes what is left beneath the masthead and centres its one child on both axes.

One thing had to be fixed underneath it: `.dashboard`'s `min-height: 100%` had never done anything, because `#app` has no height for a percentage to resolve against. So `#app` became a `min-height: 100%` flex column in `styles.css` and `.dashboard` took `flex: 1`. Nothing else on the page stretches, so an opened Month is unchanged.

Measured in the running demo at 1280, 1100 and 375 wide: the card holds 560px until the window is narrower than that, sits with equal space above and below and equal space either side, and the page never scrolls sideways.
