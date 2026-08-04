# 10 — The trends view shell, the axis and the gaps

**What to build:** The trends view with no charts in it yet — the route, the dependency, the
shared time axis, and the rules every chart will obey. Tickets 11 to 13 fill it.

**The view** is reached from the masthead and is its own view beside `MonthDashboard.vue`,
not a panel and not a modal. ADR-0010's three-column layout is about one Month and its spare
vertical room is spent by composites; a view whose subject is many Months does not belong
inside it.

**The dependency.** Add `d3-scale` and `d3-shape`, and nothing else. They supply nice
domains, tick selection and path generation. Every element drawn is hand-written SVG in a
Vue component — no chart component from a library, no canvas, no default styling to
override. This makes them the third and fourth runtime dependencies of an app that has two;
the spec records that as a knowing departure from ADR-0008, confined to this view.

**The shared axis** is the substance of this ticket, because every chart uses it:

- It covers **opened Months up to the current one**. Future Months hold plans and are
  excluded. The engine has no idea what today is — `driftOf` already takes `now` as an
  argument for exactly this reason — so the view is told, and does not guess.
- It runs **month by month on the calendar**, whether or not each Month was opened. A series
  stops and restarts across a gap; it is never interpolated and never zeroed. The slope
  between two points has to keep meaning change per month.
- A Month holding Pending rows is drawn from what is entered and **marked incomplete** — a
  marked point or a hatched bar, with the count named on hover. This is v1.2's answer for the
  Income panel total, and the wording should follow the rail's.

**Per-member series** show every member, with the Viewer's emphasised and ordered first,
exactly as the rail already treats them. Nothing is hidden from anybody: the Viewer confers
no permissions.

**The Restricted-Use toggle plays no part in this view** and must not be read here.

Ship the shell with one placeholder chart or an empty state — whichever proves the axis —
rather than blocking on ticket 11.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

**Suggested model:** Opus, medium thinking — the axis rules are the whole ticket, and every
later chart inherits whatever they get wrong.

- [ ] `d3-scale` and `d3-shape` are added; no other charting dependency appears in
      `package.json`
- [ ] The trends view is reachable from the masthead and is its own view
- [ ] The axis covers opened Months up to and including the current one, and excludes future
      Months
- [ ] The current Month is passed in rather than derived inside the domain
- [ ] The axis is continuous by calendar month: an unopened Month occupies its slot
- [ ] A series breaks across an unopened Month rather than interpolating or plotting zero
- [ ] A Month with any Pending row is marked incomplete, with the count available on hover
- [ ] A Household with one opened Month renders without error
- [ ] A Household with no opened Months renders an empty state
- [ ] Per-member series order the Viewer first and emphasise it, and show every other member
- [ ] Nothing in the view reads the Restricted-Use toggle
- [ ] The view renders correctly in the dark theme with no library styling leaking in
- [ ] `npm run typecheck` is clean, the full suite passes, and `npm run build:demo` succeeds
