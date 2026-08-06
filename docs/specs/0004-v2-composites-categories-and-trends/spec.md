# Spec 0004 — V2: composite expenses, categories, payment methods and trends

Status: done — fourteen tickets in `issues/`, numbered in dependency order, all done

V2, refined into a spec. Vocabulary is [CONTEXT.md](../../../CONTEXT.md); the dashboard
layout this works within is [ADR-0010](../../adr/0010-month-dashboard-layout.md); the two
decisions this spec makes that a future reader will need the reasoning for are
[ADR-0012](../../adr/0012-categories-as-stored-entities.md) and
[ADR-0013](../../adr/0013-composite-expense-line-items.md).

V2 is what `prometheus-system-plan.md` §4 and spec 0001's *Out of Scope* already name —
composite expenses, visual trends over time, and categories as first-class entities —
together with payment methods, which [the roadmap](../../roadmap.md) added. It is one spec
with four sections rather than a sequence of four specs, because the sections constrain
each other: categories are only worth storing because trends draw them, trends are only
legible because categories are typo-proof, and composite expenses decide what a category
attaches to.

This is the first work since v1.0 that stores something new. v1.1 was UI alone and v1.2
changed what the engine offered without changing what it kept; this adds two Household-level
lists, a `lines` field on every Expense, and two id fields, and it pays for them in both
storage adapters and in the export format.

## Problem Statement

### An Expense is a single number, and some costs are not

A supermarket run, a utilities bill, a card statement — these are one payment made of
parts, and the parts are what change month to month. Prometheus can record the total or it
can record each part as its own Expense; neither is right. The total hides why it moved.
Separate Expenses multiply the Participants and Split Rule that every one of them shares,
and turn one review decision into eight.

[ADR-0010](../../adr/0010-month-dashboard-layout.md) already anticipated this: the centre
column's spare vertical room is recorded there as headroom for composite expenses.

### Categories are a free string nobody can manage

`ExpenseSnapshot.category` is a string typed per row per Month. It has no vocabulary, so
"Groceries" and "groceries" are different categories; no rename, so correcting one means
editing every row in every Month that says it; and no way to see what categories exist
short of reading the data. Spec 0001 shipped the field and deferred the management of it,
and nothing consumes it — there is no view anywhere in the app that groups by category.

### There is no way to see the record as a record

Every figure in Prometheus is one Month's own truth, which is the model working. What is
missing is the other reading: whether spending is rising, which categories moved, whether a
goal is on course, whether anybody's Leftover Balance is trending toward zero. The data has
been there since v1.0 and nothing draws it.

### How a cost was paid is not recorded at all

"Credit Card", "Pix", "direct debit" — informational, and absent. Worth being deliberate
that recording it does not become the payment tracking spec 0001 rules out: it says how the
money left, not who paid or whether they did.

## Solution

**Composite expenses.** An `ExpenseSnapshot` may carry **Line Items**: a name and an
amount each, with a stable identity. A composite's amount is the sum of its lines rather
than a typed figure. The parent keeps Participants and the Split Rule, so an Expense still
yields one set of Shares and nothing in the Share, Split Rule or Leftover Balance machinery
changes. ADR-0013 records why a Line has no Participants of its own.

**Categories.** A Household-level list of named categories, beside the currency and the
Roster. `ExpenseSnapshot.category` becomes a nullable id into it. Renaming relabels every
Month at once; deleting is refused while the category is in use, with an offer to clear it
from every referencing row first. ADR-0012 records why this does not contradict ADR-0003.

**Payment methods.** A second Household-level list of exactly the same shape, and a second
nullable id on `ExpenseSnapshot`. Informational: nothing computes with it.

**Trends.** A new view, reached from the masthead, drawing six charts across the record.
Rendering is hand-written SVG in Vue components; `d3-scale` and `d3-shape` are added as the
app's third runtime dependency for domain rounding, tick selection and path generation.

## User Stories

### Composite expenses

1. As a member recording a bill made of parts, I want one Expense holding those parts, so
   that I set Participants and a Split Rule once rather than once per part.
2. As a member reviewing a composite, I want to see its parts without leaving the
   dashboard, so that a total that moved explains itself.
3. As a member, I want a composite's total to be the sum of its parts and not separately
   typeable, so that the two can never disagree.
4. As a member who knows a line is coming but not what it costs, I want to record it
   without a figure, so that the composite reads as incomplete rather than as cheap.
5. As a member itemising an Expense I already record as a total, I want that total to
   become its first line, so that switching costs me nothing.
6. As a member who has itemised too far, I want deleting the last line to hand the total
   back as a typed amount, so that switching back costs me nothing either.
7. As a member of a Month opened early, I want to be told when a composite's lines differ
   from the Month behind it, so that Drift covers a composite as it covers everything else.

### Categories

8. As a member, I want to choose a category from the ones the Household uses, so that a
   typo does not silently create a second category.
9. As a member who named a category badly, I want to rename it once, so that every Month
   reads the new name.
10. As a member, I want to delete a category I no longer want, and to be told plainly what
    that will cost before it happens.
11. As a member, I want an Expense to be allowed no category at all, so that categorising
    is something I do when it is useful rather than a toll on every row.
12. As a member, I want deleting a category not to count as having reviewed the rows it
    touched, so that the Unreviewed meter keeps meaning what it means.

### Payment methods

13. As a member, I want to record how a cost was paid, so that the row says something the
    bank statement will agree with.
14. As a member, I want that to be informational only, so that Prometheus stays a share
    calculator.

### Trends

15. As a member, I want to see income against expenses across the Months, so that the
    record says something the dashboard cannot.
16. As a member, I want to see which categories the Household spends in and how that has
    moved, so that a category is worth setting.
17. As a member, I want to see what share of the Household's spending each of us bears, so
    that the Split Rule's cumulative effect is visible rather than inferred.
18. As a member, I want to see what rose and what fell against last Month, so that a review
    has something to act on.
19. As a member, I want a Month I never opened to read as absent rather than as zero.
20. As a member, I want a Month with rows still Pending to be marked as incomplete, so that
    a half-entered Month is not read as a cheap one.
21. As the member reading it, I want my own series emphasised without anything being hidden
    from me, exactly as the rail already treats the Viewer.

## Implementation Decisions

### A Line Item is a name and an amount, and nothing else

The parent Expense owns Participants and the Split Rule; a Line owns neither. **Share stays
one set per Expense**, so `sharesOf`, `leftover`, the rail and CONTEXT.md's **Share**,
**Split Rule** and **Participants** entries are untouched by this section.

The alternative — a Line carrying its own Participants and rule, with the parent as a
grouping whose amount is the sum — was considered and rejected. ADR-0013 records the
reasoning and the case it costs.

### `lines` is a field on `ExpenseSnapshot`, not a second row kind

Composite is a mode, not a type. `ExpenseSnapshot` gains `lines: LineItem[]`; empty means
simple, non-empty means the amount is derived. A discriminated union would make it
impossible to hold both a typed amount and lines at once, at the price of every consumer of
`ExpenseSnapshot` in the domain, both storage adapters, the UI and the export path having to
narrow. A fourth `RowKind` beside `income`, `expenses` and `goals` would grow a fourth case
in Drift, propagation, review counting and the dashboard, and would stop a composite being
an Expense in the glossary's sense.

The invariant the union would have enforced is enforced by construction instead: the amount
of a composite is computed, never stored as a typed figure, so there is nothing to
contradict. `month_rows` stores each row as a JSON blob (`storage/sqlite-store.ts`) and
`localStorage` holds the whole Household as JSON, so the new field needs a read-side default
of `[]` and no schema migration.

### A Line carries a `RowId`

Lines inherit as themselves, so Drift can report *Fruit 12.00 → 15.00* rather than reading a
rename as a delete plus an add, and Forward Propagation can carry a corrected line without
replacing the list. The cost is one identity per line and nothing else; the minting
machinery is already in `domain/identity.ts`.

**Renaming a Line does not ask about Repurposing.** Repurposing exists because an Expense's
identity carries its history — inheritance, propagation, Drift, and a member's sense that
this is the same cost. Nothing accumulates per Line: there is no history view, no progress
figure, nothing that reads a Line across Months except the diff. Getting the answer "wrong"
costs one oddly-worded difference in a Drift report. Asking a question with no consequence
behind it would train members to dismiss the one that has.

### Unreviewed and the One-Off mark live on the parent

A composite is **one row** in the review model: one tick on the checklist, one mark, one
entry in the Unreviewed count. Reviewing a composite means opening it and reading its lines,
which is the same act as reviewing any row with more numbers behind it.

Per-line `reviewed` was considered. It is the truest reading of "entry is a checklist that
ends at zero", and it was rejected because a composite would stop being one row everywhere
else: the meter, the rail, the row's own mark and the dashboard would each need a notion of
partial review, and Drift — which consults `isReviewed` per row — would need a second level.

Per-line One-Off was considered and rejected on the model's own terms. A row stops recurring
by being removed from a Month, whose absence every later Month inherits. A line that should
not come back next Month is deleted next Month; that is the existing mechanism, not a gap.

### A Line's amount may be null, and a composite with any null line is Pending

`amount: Minor | null` on a Line, exactly as on an Expense. The composite's amount is null
when it has no lines at all, or when any line is Pending; otherwise it is the sum.

This is the null-vs-zero distinction spec 0001 calls the riskiest thing in the codebase,
held at a second level. It buys the case the feature is for: a member who knows the water
line is coming and not what it costs records the line and leaves the figure out, and the
composite reads Pending rather than quietly totalling too little.

Counting a null line as zero was rejected for exactly that reason — it produces a total that
is wrong with no warning attached. Requiring an amount per line was rejected because it
forces a placeholder zero, which is the thing Pending exists to be distinguishable from.

### Line edits are validated jointly with the Split Rule

`requireConsistentRule` (`domain/split-rules.ts`) already judges a rule against the amount
and Participants it would stand against, "never a half-applied edit" — which is what makes
it impossible to change an amount out from under a `fixed` rule. Editing, adding or removing
a line changes the amount, so it goes through the same door: the edit and the rule are
judged together or not at all.

The consequence is deliberate. Adding a line to a composite with a `fixed` rule forces the
member to say who absorbs it. That is a real decision about money, not an obstacle — the
same one they would face typing a new total on a simple Expense today.

Rescaling the fixed figures automatically was rejected: no edit path in this codebase
silently changes a number a member typed. Forbidding `fixed` on a composite outright was
rejected as removing a working combination to avoid a prompt, and would need its own rule
for a simple Expense with a `fixed` rule gaining its first line.

### Converting between simple and composite preserves the figure

Adding a first line to an Expense with a typed amount turns that amount into the first
line, named after the Expense itself, ready to be renamed and split up. Deleting the last
line of a composite hands the running total back as the typed amount.

Nothing is lost or zeroed in either direction, and a `fixed` Split Rule survives both
transitions — the total is the same on either side of them, so the rule that was valid stays
valid. Discarding the figure on conversion would invalidate a `fixed` rule twice for no
reason. Making the mode permanent at creation was rejected outright: discovering that
Groceries wants itemising would mean deleting it and minting a new identity, which is
Repurposing in reverse and destroys exactly the history the model works to keep.

### Drift gains one field, `lines`

A composite whose lines differ from its Previous Month reports as **one changed row** with
`lines` among its fields, and refreshing takes the whole line list — as refreshing already
takes a whole row.

Reporting each line as its own difference was rejected: `RowDrift.id` and `RowDrift.kind`
identify a row of a Month, and a per-line refresh would have no per-line `reviewed` mark to
respect, which is the rule Drift is built on (ADR-0011). Excluding lines from Drift was
rejected because a composite whose figures were all corrected in an earlier Month would
report nothing, which is precisely the failure Drift exists to make visible.

`DriftField` is an opt-in union and each row kind's comparison lists the fields it checks,
so this is one member added to the union and one line added to `expenseFields`.

### Categories are stored, and rows point at them by id

A Household-level list; `ExpenseSnapshot.category` becomes `CategoryId | null`. A rename
relabels every Month at once. ADR-0012 records why this does not contradict ADR-0003 and
ADR-0004, why the retroactive rename is right, and what it costs.

### Categories are for Expenses only

The V2 list says expenses, income sources *and* goals. Income and goals are **declined**.

A Household has thirty-odd Expenses in a Month and two or three income rows; income already
groups by member and by Restricted-Use, and a Savings Goal is few in number and already
named for the thing it is. A vocabulary earns its keep where there are enough rows to group
and a chart worth drawing, and only Expenses have either. A single shared vocabulary across
all three would offer "Salary" in the Expense picker and "Rent" in the income one, and a
chart grouping by it would mix money coming in with money going out; three scoped
vocabularies would mean three pickers and three migrations, two of them serving a handful of
rows. This is a scope decision, not a blocked one: extending the same machinery to another
row kind later is a field and a picker.

### Uncategorised is `null`, not an entity

`category: CategoryId | null`. Null is a permanent legal state: the row renders with no
chip, and trends group those rows under a heading that cannot be renamed or deleted because
it is not a category. This matches how `amount: null` and `target: null` already read.

A built-in Uncategorised category would avoid a nullable field, at the price of an entry in
the list that behaves unlike its neighbours and that a member can rename to anything.
Requiring a category on every edit would fill the vocabulary faster and would put a
mandatory choice in front of every edit that has nothing to do with categories.

### The existing category strings are dropped

The list starts empty and every existing row becomes uncategorised. The MVP's free strings
are not migrated into minted categories.

The alternative — minting one category per distinct string in use — preserves more, and
preserves the mess along with it: a Household that typed "Groceries" and "groceries" starts
with two categories and a cleanup job. Starting empty makes the vocabulary a deliberate act,
which is the whole point of storing one. The accepted cost is real and should be stated
plainly in the release note: **a v1.2 Household loses its category strings on upgrade.**
Exporting before upgrading is the only way to keep them.

### Delete only, with an explicit clear

A category is deleted, never retired. There is no active flag.

Deleting a category no row references is immediate. Deleting one in use is **refused**, and
the member is shown what it would cost — the row count and the Month range, *"used by 34
rows across 11 Months, June 2025 – August 2026"* — with the option to clear it from every
referencing row and then delete.

This is destructive, irreversible, and it writes into Months that are settled history. It is
the second thing in the app allowed to do that, after Discarding a Month, and it borrows
that action's discipline: name the cost in entries before proceeding. Export is the only
recovery, and the confirmation says so.

Retirement was considered and rejected. It invents a second state for an entity — active and
retired — with picker filtering, an import rule and a UI for both. Deleting costs nothing
extra because `null` is already a legal category, so a cleared row lands in a state the
model already handles.

Because ADR-0008 makes writes row-scoped and last-write-wins, the clear is N row writes and
not one atomic act. **The order is fixed: clear every referencing row first, delete the
category only once every clear has landed.** A run that fails partway leaves a
half-cleared category that still cannot be deleted, which is a retry rather than a corrupt
state.

### Clearing does not set `reviewed`, and cannot produce Drift

Clearing a category from rows across the record **leaves `reviewed` exactly as it found
it.** Nobody reviewed anything. The Unreviewed count is the number spec 0001 calls the real
risk of a monthly review, and a category deletion quietly answering for rows in eleven
Months would corrupt it. This is the same reasoning `setXOneOff` already carries in spec
0003, applied to a second write path that is not an edit.

Drift needs no handling at all, and the reason is worth recording because the opposite is
the intuitive guess. Drift compares what a Month **holds** against what a fresh open from
its Previous Month **would now produce**, both computed from the household as it currently
stands (`monthIfOpened`, `domain/drift.ts`). A complete clear moves the held row and the
inherited row together, so they still agree; a category the pair never referenced changes
neither. **A complete clear can never create category drift.** The only way to see any is a
partially-applied clear, which is the ordering rule above and is resolved by retrying.

### Payment methods reuse the category machinery exactly

A second Household-level list, a second nullable id on `ExpenseSnapshot`, the same picker,
the same delete-and-clear flow, the same `null`-means-unset reading, and the same treatment
of `reviewed`. The two lists are independent: a payment method is not a kind of spending,
and collapsing them into one field would let it answer only one of two different questions.

`paymentMethod` joins `category` as a compared `DriftField`. It is a field of the row like
any other, it can be corrected in an earlier Month like any other, and excluding it would be
a special case with nothing behind it.

Nothing computes with a payment method. It weights no split, appears in no total, and is
drawn by no chart in this spec. Spec 0001 rules out payment tracking of any kind, and this
field stays on the right side of that line by saying how the money left the account and
nothing about who paid or whether they did.

### Trends is its own view

Reached from the masthead, spanning the record. ADR-0010's three-column layout is settled
and is about one Month, and its spare vertical room is spent by composite lines in this same
spec. A view whose subject is many Months does not belong inside a layout whose every figure
is one Month's own truth, and looking back is a different act from reviewing.

The single-Month charts in the set read the Month currently selected on the dashboard, so
navigating Months moves them.

### Charts are hand-rendered over borrowed maths

`d3-scale` and `d3-shape` are added — around 10kb together — and nothing else. They supply
nice domains, tick selection and path generation, which are the parts of charting that
actually go wrong. Every element drawn is hand-written SVG in a Vue component, so the dark
theme and the markup stay the app's own.

A full charting library was rejected. The parts that make one worth its weight — zoom and
pan, streaming data, canvas rendering at scale, twenty chart types — serve none of this: the
dataset is one point per opened Month, a decade being 120 points, and the shapes are fixed.
What would arrive with it is a third-party default styling to fight into a dark theme and
tens of kilobytes on a static demo that exists to be opened by strangers. Writing the scales
and ticks by hand was also rejected: axis tick selection and path generation are where
hand-rolled charts go wrong, and they are the cheapest part of the library to take.

This makes `d3-scale` and `d3-shape` the third and fourth runtime dependencies of an app
that has two. ADR-0008 chose a spare stack deliberately; this is a departure from it, taken
knowingly and confined to one view.

### Household figures, Viewer highlighted

Charts read at Household level. Where a series is naturally per-member — Leftover Balance,
share of spending — every member appears, with the Viewer's series emphasised and ordered
first, exactly as the rail already treats them.

Opening on the Viewer's own figures was rejected because it would make the Viewer decide
what data is shown, and CONTEXT.md defines it as conferring no permissions and hiding
nothing from anyone. Household totals with no per-member series at all would be the most
legible charts on the page and would drop the comparison a shared-finances app is read for.

### Opened Months up to the current one

A trend covers opened Months that are not in the future. A future Month holds a plan: it may
be Unreviewed throughout and may be reporting Drift, and charting it beside settled history
invites reading intention as fact. Drawing them dashed was considered — it is genuinely
useful for a future Month already filled in — and costs a second visual state on every chart
plus a decision about whether a drifting Month is flagged there too. Declined for the first
cut, and cheap to add later.

### A continuous calendar axis, with broken series

The time axis runs month by month whether or not each Month was opened, and a series stops
and restarts across a gap.

The x-axis of a time series is a quantity, not a list of labels: the slope between two
points means change *per month*. Compressing July and September into adjacent slots draws a
two-month change identically to a one-month one, which is the chart misstating a rate rather
than merely omitting a Month. And in this model an unopened Month is not missing data — it
is a Month that was never brought into existence, and a break renders that fact where a
smooth line would render an inference.

The accepted cost: a Household that opens Months sporadically gets a sparse chart. Gaps are
the exception in an app whose entire flow is opening each Month in turn, so the continuous
axis costs nothing when the record is dense and tells the truth when it is not. Counting a
gap as zero was rejected outright — it asserts the Household earned and spent nothing in a
Month it merely never recorded.

### Pending counts as nothing, and the Month says so

A Pending row contributes nothing and the Month is marked incomplete — a marked point or
hatched bar, with the count named on hover. This is the answer v1.2 already gave for the
Income panel's total, and the wording follows the rail's.

Excluding such a Month entirely was rejected: it removes a Month from the record over one
unfilled row, and on a continuous axis it becomes indistinguishable from a Month nobody
opened. Counting it silently was rejected because a half-entered Month then draws as a
genuine dip.

### One stacked income chart, and no Restricted-Use toggle

Income is drawn as a single chart with Restricted-Use stacked above Spendable Income: full
height is total Income, the band is what is actually spendable, and the difference between
them — the entire point of the distinction — is visible rather than reconstructed across two
panels.

The rail's Restricted-Use toggle therefore plays **no part** in trends. The toggle exists
because the Leftover Balance is one number and a number can show one value; a chart has room
for both, so the preference is unnecessary here. Leftover Balance charts on Spendable Income,
which CONTEXT.md already calls its default basis, and CONTEXT.md's confinement of the toggle
to "this figure alone" stands unamended.

### The six charts

1. **Income vs expenses over time** — household totals per Month, income stacked
   Spendable / Restricted-Use.
2. **Spending by category over time** — stacked, uncategorised rows under their own heading.
3. **Goal progress** — Accumulated Progress against target per goal, as of each Month.
4. **Leftover Balance per member over time** — the app's headline number, Viewer emphasised.
5. **Share of household spending per member** — each member's total Shares as a percentage
   band. This draws the output of the Split Rule machinery, which is the thing that makes
   Prometheus not a generic budget tracker and which nothing in the app currently shows.
6. **Month-over-month change by category** — a diverging bar against the Previous Month, for
   the Month being viewed. The one chart here with a decision attached to it: it is read
   during a review rather than after one.

Considered and not included in this cut: savings rate, recurring vs one-off spend,
individual vs shared spending, payment method mix, top categories this Month, and a
composite's lines over time. Each is cheap once the view exists, and each is listed here so
the next person does not have to rediscover them.

### The demo seed

The seed runs in CI as a test and drives the domain as a member would. It gains a
categories list, a payment methods list, at least one composite Expense with several lines,
and enough Months of history for the six charts to have something to draw — including one
Month left unopened, so the broken-axis case is exercised by the seed rather than only by a
unit test.

### Supersedes

- Spec 0001's *Out of Scope* entries for **composite expenses**, **visual trends over time**
  and **categories as first-class entities**, all three of which this spec builds.
- ADR-0008's two-dependency stack, in one respect only: `d3-scale` and `d3-shape` are added.
  The decision to keep the server dumb and the domain client-side is untouched.

Every other criterion of `0001-mvp`, `0002-v1-1-dashboard-refinements` and
`0003-v1-2-one-off-marks-and-income-totals` stands.

## Out of Scope

- **Categories on income sources and Savings Goals.** Declined during refinement with the
  reasoning above, not deferred against a version.
- **Migrating the MVP's category strings.** Declined; the list starts empty and the release
  note says so.
- **Retiring a category**, and any active/inactive state on either Household-level list.
- **A Line Item with its own Participants or Split Rule** (ADR-0013), and with it any notion
  of a Share below the level of an Expense.
- **Per-Line `reviewed` or One-Off marks.** A composite is one row in the review model.
- **A category or payment method on a Line.** A Line is a name and an amount.
- **Undo, for anything.** The category clear is irreversible and export is the recovery, as
  it is for Discarding a Month.
- **Future Months in trends**, and the second visual state that drawing them would need.
- **The Restricted-Use toggle affecting anything outside the Leftover Balance.**
- **Interactive charts** beyond hover readouts — no zoom, no pan, no brushing, no date-range
  picker.
- **Exporting or downloading a chart.**
- **The six charts not chosen**, listed above so they are not rediscovered as new ideas.
- **Payment tracking of any kind.** A payment method says how money left an account. Who
  paid, whether they paid, transfers and settlement remain out of scope, permanently.
- **A narrow-screen design for the trends view.** It inherits spec 0001's desktop target.

## Further Notes

- The riskiest thing here is the **category clear across the record**: it is the only
  operation in the app that writes to many Months at once, it is irreversible, and it is
  non-atomic under ADR-0008. Its ordering rule and its `reviewed` exception both need tests
  that assert what it does *not* touch, not only what it does.
- The second riskiest is the **derived amount against a `fixed` Split Rule**. Spec 0001
  named `fixed`-against-a-changing-amount as its own second-riskiest item; composites give
  the amount a second way to move, and every path that mutates a line has to go through
  `requireConsistentRule`.
- Third is the **null line amount**, which is spec 0001's riskiest item at a new level. It
  has to survive the engine, both storage adapters, the export JSON and the UI's number
  inputs, exactly as `amount: null` does.
- **Build the engine first**, as spec 0001 did: Line Items, the derived amount, the joint
  validation, the `lines` Drift field, the two Household-level lists and the clear operation
  are all testable with no adapter and no browser. Storage and export come second, the
  dashboard third, the trends view fourth, the demo seed last.
- The four sections are independent enough to ship in any order **except** that trends
  depends on categories: chart 2 and chart 6 group by category, and chart 1's stacking does
  not. Categories therefore land before trends.
- The tickets reflect this. Three chains start immediately and run in parallel —
  composites (`01`→`02`,`03`→`04`), categories (`05`→`06`,`07`→`08`→`09`) and the trends
  shell (`10`→`11`,`13`) — meeting only at `12`, which needs both `08` and `10`, and at
  `14`, which needs everything.
- One thing ticket `06` was left to decide rather than told: `replaceHousehold` exists and
  would make the category clear a single atomic write, at the cost of clobbering concurrent
  row edits anywhere in the Household. The spec takes the row-scoped route and the ticket
  says why, and invites an argument against it in the comments rather than a quiet change.
