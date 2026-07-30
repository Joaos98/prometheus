# 19 — Visual consistency pass and narrow-window collapse

**What to build:** By now the dashboard has been assembled by many hands across eighteen tickets: the rail has grown a review meter, a Drift report, a Viewer control and a restricted-use toggle; the centre and right columns hold four kinds of row. This is the sweep that makes it read as one surface rather than four panels that happen to sit together.

The design brief applies from ticket 01 onward — this is **not** deferred styling. It is the pass where inconsistencies that only become visible once everything exists get resolved, and where the narrow-window behaviour gets its own attention.

**Blocked by:** 12, 14, 17

**Status:** ready-for-agent

- [ ] The palette is applied consistently: page background, card surfaces, hairline borders, and the three text weights of the brief
- [ ] Elements are separated by 0.5px hairlines rather than shadows, with no gradients anywhere
- [ ] The fire accent is used for primary actions, key totals and active navigation, and the moon/ice accent only for goal progress and subtle highlights — never as a general-purpose colour
- [ ] Two font weights only: regular for body and labels, medium for headings and key numbers
- [ ] Section labels use letter-spaced uppercase or small caps consistently across all panels
- [ ] Corner radii are consistent: 12px on cards, 8–10px on smaller controls
- [ ] Icons are simple outline style and used sparingly
- [ ] A whole Month fits one ordinary desktop window without scrolling, with the three columns starting level
- [ ] Below roughly 1240px the three columns collapse to one and the rail stops being pinned, with nothing overlapping, clipped or unreachable
- [ ] Every user-facing string uses CONTEXT.md's vocabulary and none of its _Avoid_ terms
- [ ] Amounts group their thousands, so a four-figure salary is scannable at a glance

## Comments

**Thousands separators, deferred here from ticket 02.** `formatAmount` in `domain/money.ts` renders bare digits — `£3200.00`, not `£3,200.00` — because it was written locale-free and deterministic, which is what the engine tests want. It gets harder to scan as figures grow, and the household's largest numbers (Spendable Income, Leftover Balance, goal targets) are exactly the ones that suffer. Decide the separator here, once, for every figure on the dashboard. Note that the Household has one currency and no locale setting anywhere, so this is a display decision the app makes, not one it reads from the browser.
