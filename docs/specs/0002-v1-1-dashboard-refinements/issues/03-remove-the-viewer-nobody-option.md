# 03 — Remove the "Viewer: nobody" option

**What to build:** The Viewer picker stops offering "nobody", because it never described the screen. With nobody picked, `MonthRail.vue` already falls through to the Month's first member and gives them the full Leftover Balance subtraction — the picker was naming an absence that was not there.

The default becomes that same member: the Month's first, not the Roster's. The Roster's first may not be among a past Month's members at all, and defaulting to them would land straight back in the mismatch this ticket removes.

That member is written to `prometheus.viewer` on the first load that has an opened Month to read it from, so the picker holds still as a member steps between Months. A first load on an unopened Month writes nothing and shows the Roster's first active member — the write waits, so the pinned Viewer only ever comes from the one rule. `viewer` therefore keeps its `MemberId | undefined` type; pinning buys a stable label, not a simpler type.

Where the stored Viewer is not among a Month's members, the picker displays that Month's fallback instead. Browsing there never writes. This is a display substitution of the same kind `MonthRail.vue` already documents for the Restricted-Use toggle: storage changes on an explicit pick and at no other time.

The accepted cost is that stepping between Months can change the name in the picker with nothing on screen explaining it. That is the deliberate trade — the picker is never wrong about who the rail is showing.

This supersedes one criterion of `0001-mvp/issues/17`: *"The Viewer defaults to nobody, and the dashboard is fully usable with no Viewer set."* Its other nine still stand.

**Blocked by:** None — can start immediately

**Status:** done

**Suggested model:** Sonnet, medium thinking — small surface, but the substitution rule has to be held exactly: displayed value and stored value are different things, and only one of them is ever written.

- [x] The Viewer picker offers no "nobody" option
- [x] With nothing stored, the picker names the Month's first member — the one the rail leads with
- [x] That member is written to `prometheus.viewer` on the first load where an opened Month is being viewed
- [x] A first load on an unopened Month writes nothing and shows the Roster's first active member
- [x] Where the stored Viewer is not among the viewed Month's members, the picker names that Month's fallback member
- [x] Browsing such a Month never writes to `prometheus.viewer`
- [x] Navigating back to a Month the stored Viewer is in restores their name in the picker
- [x] Storage is written only when a member picks explicitly
- [x] A stored Viewer since deactivated stays listed and selectable
- [x] The picker always names whoever the rail is currently leading with
- [x] The Viewer remains per-device, grants no permissions, hides no member, and appears in no export

## Comments

**Built.** `ui/viewer.ts` holds the three rules, tested in `ui/viewer.test.ts`: `displayedViewer` reads back whoever the rail leads with, `viewerToPin` says what a load may write, and `viewerOptions` keeps the named member listed even when they are deactivated or belong only to a past Month.

The pinning is a `watch` on the viewed Month with `immediate: true`, which fires at most once — the moment anything is stored there is nothing left to pin — and pins nothing while the Month on screen is unopened, so the write waits rather than falling back to the Roster's first.

`MonthRail.vue` needed no change: it already fell through to the Month's own order, which is exactly the substitution the picker now reads. Its comment was updated to say so and to point at the module that mirrors it.

Verified in the running demo: a first load with nothing stored pinned the Month's first member and named them in the picker; picking another wrote once; stepping between Months afterwards left storage untouched and kept picker and rail in agreement.
