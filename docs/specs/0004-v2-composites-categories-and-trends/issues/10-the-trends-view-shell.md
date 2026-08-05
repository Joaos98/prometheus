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

**Status:** done

**Suggested model:** Opus, medium thinking — the axis rules are the whole ticket, and every
later chart inherits whatever they get wrong.

- [x] `d3-scale` and `d3-shape` are added; no other charting dependency appears in
      `package.json`
- [x] The trends view is reachable from the masthead and is its own view
- [x] The axis covers opened Months up to and including the current one, and excludes future
      Months
- [x] The current Month is passed in rather than derived inside the domain
- [x] The axis is continuous by calendar month: an unopened Month occupies its slot
- [x] A series breaks across an unopened Month rather than interpolating or plotting zero
- [x] A Month with any Pending row is marked incomplete, with the count available on hover
- [x] A Household with one opened Month renders without error
- [x] A Household with no opened Months renders an empty state
- [x] Per-member series order the Viewer first and emphasise it, and show every other member
- [x] Nothing in the view reads the Restricted-Use toggle
- [x] The view renders correctly in the dark theme with no library styling leaking in
- [x] `npm run typecheck` is clean, the full suite passes, and `npm run build:demo` succeeds

## Comments

The axis is `ui/trends.ts`, a pure module with no Vue in it: `trendAxis(household, now)`
returns one `TrendSlot` per calendar month from the first opened Month to the last one at
or before `now` — `{ key, opened, pending }` — and `segmentsOf(values)` cuts a series into
the runs that can be drawn as one line, breaking on `undefined` and keeping each value's
slot index so a gap costs no width. `pendingNote(count)` gives the incomplete mark its
wording, following the rail's. `trendMembers` reads the members off the charted Months
rather than off the Roster, so somebody deactivated since is still charted and somebody
added after the last charted Month is not; it puts the Viewer first and does nothing else
with them. Twenty-six tests in `ui/trends.test.ts`, written before the module.

`now` is handed in rather than derived anywhere below the view, exactly as `driftOf` takes
it. `ui/months.ts` gained `useCalendarMonth()` — the ref plus the focus/visibilitychange
catch-up that `MonthDashboard.vue` had inline — and both views now read it from there, which
is the same rule from the two ends: only a Month after the current one can drift, and only
Months up to it are charted.

Routing is `ui/screen.ts`: a module-level ref, `'month' | 'trends'`, switched in `App.vue`.
A router would be a third runtime dependency for two values in an app with no URL and no
deep link, and the spec's departure from ADR-0008 is confined to the two d3 packages.
`@types/d3-scale` and `@types/d3-shape` are devDependencies, which the typecheck needs and
which draw nothing.

`ui/components/TrendChart.vue` is the one chart component tickets 11 to 13 fill: it takes
the axis, a list of `TrendSeries` and a formatter, and hand-writes the SVG on a fixed
logical canvas the browser scales. d3 supplies the domain, the ticks and the path string
and nothing else — no chart component, no canvas, no default styling, and so nothing of a
library's to leak into the dark theme. Every colour is one of the app's own vars, with the
Viewer's series in `--fire-bright`. Two degenerate cases are handled outright: a
single-slot axis is placed mid-canvas (a scale of zero width otherwise), and a series that
never moves is given one unit of room rather than a zero-height domain. The incomplete mark
is a hatched band across the Month's own slot with the count in a `<title>`, so it is
reachable by hover and by anyone hearing the chart read out.

The shell ships with one placeholder chart — how many rows each member appears on, Month by
Month — chosen because it is none of the six and exercises every rule the axis has. Tickets
11 to 13 replace it.

The code review moved four things. The masthead was a near-line-for-line duplicate across
the two views, down to the 1240px breakpoint, so `ui/components/Masthead.vue` now holds the
brand row, the three-group grid and that breakpoint, with the middle and the right slotted:
the Month navigator and its settings buttons have nothing to do with the trends view's way
back. The palette walked its index by every series, which handed `--fire` to whoever came
second behind a Viewer in `--fire-bright` — the one pair the emphasis exists to separate;
it is walked by the plain series alone now, and `--fire` sits last in it. `role="img"` makes
everything inside the drawing presentational, so the `<title>` counts reached a pointer
only; the incomplete Months are named in the chart's own label as well, which is the shape
the rail already gives its Pending mark. And the month labels were recovering the month and
the year by splitting `monthName`'s output and matching `-01` on the key, where
`monthOfYear` and `yearOf` are the engine's own answer.

The demo turned up one thing no test had: a Viewer pick the charted Months hold nowhere —
a stale pick, or a member who joined after the last charted Month — left every series drawn
alike, while the dashboard's picker went on naming somebody, because `displayedViewer`
substitutes per Month and there is no one Month here. `trendMembers` now leads with the
first charted member in that case and reports `emphasis` itself, so the rule lives in the
tested module rather than in the view.

Checked: `npm run typecheck` clean, full suite 881 tests passing (26 new), `npm run
build:demo` succeeds. Verified by hand in the running demo: the axis reads June to August
2026 with the seed's opened September left out as a plan; August's Pending row draws a
hatched band whose tip says "1 Pending row is not counted in this Month"; discarding July
leaves its slot on the axis with the three series broken either side of it and no
interpolation; a Household down to one opened Month draws its dots mid-canvas; and both
empty states appear — the one for a Household with nothing opened, and the one for a
Household whose only Months are still ahead. No console errors throughout.
