# The Month dashboard is three columns: a pinned rail, Expenses, then Income and goals

A Month holds four kinds of thing — a per-member summary, Income Snapshots, Expense Snapshots and Savings Goals — and the monthly review reads across all four. A single scrolling column, tried first, put them in sequence: reaching the goals meant losing sight of the Leftover Balances the goals feed into, and the review state lived in a footer that scrolled with the content it described. The dashboard is therefore laid out in three columns, and the whole of a Month fits one ordinary window without scrolling.

The **left rail is pinned**: the Viewer's Leftover Balance with its subtraction spelled out (Spendable Income, minus Shares, minus Contributions) and the restricted-use toggle beside it, then the other members' Leftover Balances, then the review meter, then the Month's own facts — which Month it was copied from, and the Drift standing against later opened Months. These are the figures every edit moves, so they stay on screen while the rows scroll. **Expenses take the centre column**, widest, each row carrying its name, Split Rule, Participants count, review state and the per-member Share preview. **Income and Savings Goals share the right column.**

Goals show **every member of the Month, not only Participants**, with non-Participants rendered greyed and named as such. Contributions are entered per member and a goal's Participants can differ from the Month's roster, so a list that silently omitted people would leave "who is not in this goal" unanswerable from the dashboard. Each goal row collapses: closed it shows accumulated progress against target and the Month's total contribution, open it shows every member's Contribution, the start amount, and Accumulated Progress as of this Month.

The Month's identity — "July 2026" — sits centred in the header rather than above the centre column, so the three columns start level and the title cannot shift as the header's other content changes width.

Two things this layout is deliberately not:

- **A matrix with a column per member.** It read as the spreadsheet Prometheus replaces and it scales by member rather than by row, so a fourth member squeezes the figures that matter. Shares belong under their Expense, not in a grid.
- **A queue showing only what needs attention.** Surfacing Pending and Unreviewed rows alone made monthly entry pleasant and the rest of the Month invisible; a member reviewing August wants to see what August actually says. Review state is carried by the meter in the rail and by marks on the rows themselves, in place.

## Consequences

- The centre column is the widest and currently the shortest — the expenses list ends well above the rail and the right column. This is headroom, not imbalance: composite expenses (system plan, V2) will expand an Expense into sub-items, and the vertical room is already there.
- The rail is fixed-width and does not grow with the Roster; past roughly four members the other-members list needs its own treatment. The panel columns are unaffected, since they scale by row.
- Below about 1240px the three columns collapse to one and the rail stops being pinned. The layout targets a desktop window; a narrow-screen design is not specified here.

The layout was settled by prototyping six variants against a seeded three-member Month rather than on paper; the winner is F.
