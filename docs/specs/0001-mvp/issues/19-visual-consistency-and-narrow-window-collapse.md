# 19 — Visual consistency pass and narrow-window collapse

**What to build:** By now the dashboard has been assembled by many hands across eighteen tickets: the rail has grown a review meter, a Drift report, a Viewer control and a restricted-use toggle; the centre and right columns hold four kinds of row. This is the sweep that makes it read as one surface rather than four panels that happen to sit together.

The design brief applies from ticket 01 onward — this is **not** deferred styling. It is the pass where inconsistencies that only become visible once everything exists get resolved, and where the narrow-window behaviour gets its own attention.

**Blocked by:** 12, 14, 17

**Status:** done

**Suggested model:** Opus, medium thinking — judgment across every panel at once. The cost here is browser round-trips rather than reasoning, so expect a long session whichever model runs it.

- [x] The palette is applied consistently: page background, card surfaces, hairline borders, and the three text weights of the brief
- [x] Elements are separated by 0.5px hairlines rather than shadows, with no gradients anywhere
- [x] The fire accent is used for primary actions, key totals and active navigation, and the moon/ice accent only for goal progress and subtle highlights — never as a general-purpose colour
- [x] Two font weights only: regular for body and labels, medium for headings and key numbers
- [x] Section labels use letter-spaced uppercase or small caps consistently across all panels
- [x] Corner radii are consistent: 12px on cards, 8–10px on smaller controls
- [x] Icons are simple outline style and used sparingly
- [x] A whole Month fits one ordinary desktop window without scrolling, with the three columns starting level
- [x] Below roughly 1240px the three columns collapse to one and the rail stops being pinned, with nothing overlapping, clipped or unreachable
- [x] Every user-facing string uses CONTEXT.md's vocabulary and none of its _Avoid_ terms
- [x] Amounts group their thousands, so a four-figure salary is scannable at a glance

## Comments

**Thousands separators, deferred here from ticket 02.** `formatAmount` in `domain/money.ts` renders bare digits — `£3200.00`, not `£3,200.00` — because it was written locale-free and deterministic, which is what the engine tests want. It gets harder to scan as figures grow, and the household's largest numbers (Spendable Income, Leftover Balance, goal targets) are exactly the ones that suffer. Decide the separator here, once, for every figure on the dashboard. Note that the Household has one currency and no locale setting anywhere, so this is a display decision the app makes, not one it reads from the browser.

**Decided: a comma groups, a full stop divides, and `formatAmount` does it.** The grouping went into the engine's own renderer rather than a display layer above it, because `formatAmount` is what the domain's refusals are worded with too — a `fixed` rule that misses its total names three figures, and those are figures on the dashboard like any other. It stays locale-free and deterministic: the separators are the app's, not the browser's, so a Household reads the same on every machine it is opened from. What a member types back is `plainAmount`, a second renderer with no symbol and no grouping, because `toMinor` reads a comma as a decimal separator and would refuse its own output otherwise.

**The One-Off control became an icon.** Spelled out, the label is wider than the Income column can give it: name, tags, amount and three text controls came to 365px against 292px of room, and the row either overflowed its card or broke `One-Off` across two lines. The design brief asks for outline icons used sparingly and names the flag among them, so `OneOffMark.vue` is that flag, used identically in all three panels, with the words kept in its `aria-label` and `title`.

**Where the shared vocabulary lives.** Eighteen tickets had each panel styling its own tags, row controls, notes, failures and in-place forms — the same rules eight times over with small divergences, which is exactly how four panels stop looking like one surface. Those are now single rules in `ui/styles.css` (`.tag`, `.row-action`, `.link-action`, `.destructive`, `.note`, `.failure`, `.row-body`, `.inset`, `.actions`), and the panels keep only what is genuinely their own. The pass removed about 330 lines net.

**Fitting one window.** At 1280×800 the seeded Month came to 910px and scrolled. It now fits in 789px, from a tighter spacing scale (`--gap` 16, `--pad` 18, `--row-gap` 8), captioned line-heights on the dense expense rows, and column widths rebalanced to 236 / flexible / 372 — the rail gives up what the Income column needed. Below 1240px the masthead comes apart along with the columns, and the rail and right column spread across the single column rather than each taking a full-width band.
