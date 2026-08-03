# Spec 0003 — v1.2: One-Off marks and the household's income total

Status: ready-for-agent — four tickets, `01`–`04`

The v1.2 block of [the roadmap](../../roadmap.md), refined into a spec. Vocabulary is
[CONTEXT.md](../../../CONTEXT.md); the dashboard layout this works within is
[ADR-0010](../../adr/0010-month-dashboard-layout.md). Two items, not the three the roadmap
listed — the third was rejected during refinement and the roadmap records why.

Both surviving items change what the engine offers and compute; neither stores anything
new. No storage migration, no `localStorage` shape change, no new `localStorage` key, no
change to what an export contains. The MVP shipped as v1.0 and the dashboard refinements
as v1.1; this is v1.2.

## Problem Statement

### Marking a row One-Off is a second step, and cannot be undone

The mark that stops the next Month inheriting a row is set by its own control after the
row exists. Adding a one-time cost is therefore two actions — record it, then mark it —
when the member knew it was one-time before they started typing.

The worse half is that the mark is one-way. `markIncomeOneOff`, `markExpenseOneOff` and
`markGoalOneOff` set `oneOff` to `true` and there is nothing anywhere in the engine, the
store or the UI that sets it back. A row marked by mistake stays marked, and the only way
out is to remove the row and record it again — which mints a new identity and so silently
breaks the thread that inheritance, Forward Propagation and Drift all follow.

### The Income panel never says what the Household earns

Every figure in the panel is one member's. There is no line anywhere in Prometheus for
what the Household's Spendable Income comes to, and nothing that says how it is divided
between the people in it — which is the number that explains, at a glance, why a
proportional Split Rule falls the way it does.

## Solution

The One-Off mark becomes settable on the add form and clearable afterwards. In the engine,
the three one-way `markXOneOff` functions become two-way setters; on the dashboard, the
flag control becomes a toggle and the add forms grow a checkbox.

The Income panel gains a total Spendable Income line beneath the per-member sections, with
each member's share of it as a whole-percent figure in their section header. The
percentages are apportioned by largest remainder so that they total exactly 100 — which is
the discipline `domain/shares.ts` already holds every Share to, and is why this is not a
UI-only item. That machinery is extracted so there is one implementation of it rather than
two.

## User Stories

### The One-Off mark

1. As a member recording a one-time cost, I want to mark it One-Off on the form I am
   already filling in, so that recording it is one action rather than two.
2. As a member who marked a row by mistake, I want to unmark it, so that a slip costs me a
   click rather than the row's history.
3. As a member, I want unmarking a row not to count as having checked its figures, so that
   the Unreviewed mark keeps meaning what it means.
4. As a member, I want the same control to do this in every panel, so that Income,
   Expenses and Savings Goals do not each behave differently.
5. As a member looking at a row, I want to be able to tell at a glance whether it is
   marked, so that the control's state and the row's tag agree.

### The household's income

6. As a member, I want to see what the Household's Spendable Income comes to, so that the
   panel says something about the Household and not only about the people in it.
7. As a member, I want to see what proportion of it is mine, so that a proportional Split
   Rule's answer is explained rather than merely asserted.
8. As a member, I want those proportions to total exactly 100, so that the panel holds to
   the same exactness as every other total in the app.
9. As a member whose Household has income still Pending, I want the panel to say so, so
   that a total that understates is not read as final.
10. As a member in a Household where the percentages could not be true, I want them absent
    rather than wrong.
11. As the only member of my Household, I want not to be shown a total that restates my own
    figure, or told that I have 100% of it.

## Implementation Decisions

### At creation the mark is always One-Off, never Ends Here

The roadmap item is titled "One-Off and Ends Here: settable at creation", and that is loose.
`appearedBefore` (`domain/rows.ts`) decides which of the two readings a row gets by asking
whether the Previous Month holds the same identity. A row being added has a freshly minted
identity, so the answer is `false` by construction and can never be anything else.

The add form's checkbox therefore reads **One-Off** and only that. Ends Here remains
settable, but only on a row that already exists, through the row's own control — which is
where a row with a past is, and the only place the distinction can be true.

### One setter, not a second verb

`markXOneOff` becomes `setXOneOff(household, key, id, oneOff: boolean)` for all three row
kinds, rather than three new `clearXOneOff` functions beside the existing three. Both
directions are one operation on one field and want one doc comment; six functions would
write the body and the reasoning twice per row kind.

`oneOff` is deliberately **not** added to `IncomeEdits`, `ExpenseEdits` or the goal's edits
type, which would have been the smallest diff. Every `editXSnapshot` sets `reviewed: true`,
and `markXOneOff` documents at length why marking must not: saying "do not carry this into
the next Month" is not saying "I have checked this figure". Routing a mark change through
the edit path would make clearing a mark silently confirm the row. The setter leaves
`reviewed` exactly as it found it, in both directions.

### The checkbox is on the add case only

`IncomeForm.vue`, `ExpenseForm.vue` and `GoalForm.vue` each serve both adding and editing.
The checkbox is gated to adding.

Two reasons. There would otherwise be two controls for one field on an existing row — the
checkbox and the flag — with no rule a member could infer for which to use. And the form's
save goes through `editXSnapshot`, so a member changing only the checkbox and saving would
also confirm the row as reviewed, which is the seam the previous decision exists to close.
Splitting the save into an edit plus a separate `setXOneOff` call was considered and
rejected: two writes for one save, to keep two competing controls, is a worse answer than
having one control per situation.

### The flag becomes a toggle

`OneOffMark.vue` currently renders only on an unmarked row (`v-if="!isOneOff(source)"`).
The `v-if` goes; the button is always present and carries `aria-pressed`, with its label
and tooltip flipping to the unmark reading when the row is marked.

The text tag beside the row's name — `One-Off` or `Ends Here`, chosen by `endingTag` — is
unchanged. It is the statement of fact; the flag is the control. Making the tag itself
clickable was considered and rejected: every other tag on a row (`Restricted-Use`,
`Pending`) is inert, and one clickable tag among them is an affordance a member cannot
predict.

### Largest remainder is extracted, not copied

`divide` in `domain/shares.ts` is already largest remainder in exact integer arithmetic.
Its body — apportioning a total across weights, floors first and the leftover units to the
largest fractional parts, ties by position — has nothing to do with members or with money.

It moves to `domain/apportion.ts` as `apportion(total, weights): number[]`. `divide` becomes
the thin wrapper that pairs the result with Participants in the Month's member order; the
income percentages call the same function with a total of `100`. One implementation, one
set of exactness tests, two callers.

Writing largest remainder a second time in `income.ts` would be the smaller diff and is
exactly what the roadmap item argues against — two implementations of the codebase's stated
exactness discipline, free to drift apart. Exporting `divide` itself was also rejected: it
is typed around `MemberId` and `Minor`, so the percentages would arrive as Shares of 100
currency units and the types would lie about what the numbers are.

### Whole percent

The percentages are whole numbers totalling exactly 100. They sit beside the exact figure
they are derived from, so their job is proportion rather than precision, and a tenth of a
percent on a four-thousand-unit Household is below the noise of the thing being described.
The section header is also tight: a name, a figure and a right-aligned label.

The accepted cost: several members with similar incomes read as the same percentage. One
decimal was considered and would separate them, at the price of a wider figure and an
implied precision the income does not have.

Largest remainder does visible work here — three equal incomes give 33, 33, 34, and which
member takes the extra point falls out of the Month's member order. That is the same
determinism `sharesOf` already relies on for tie-breaking, and it is a feature: the panel
reads the same way every time it is rendered.

### When there are no percentages to show

`spendableIncome` can return a negative figure — an income row accepts any whole minor
amount, and `domain/shares.ts` defends against exactly this when weighting a proportional
rule. The percentages refuse rather than defend.

Where any member's Spendable Income is negative, or the total is not positive, **no
percentages are shown at all**. The total figure still shows: it is a sum, and the sum is
true. The alternatives were both unreadable. Clamping negatives to zero the way the Split
Rule does gives a member 100% beside a figure larger than the total printed below them.
Dividing by the shown total gives percentages that sum to exactly 100 by going over 100 and
below zero.

The zero-total case is the one the roadmap already named — with no Spendable Income at all
there are no percentages to show — and the negative case joins it under one rule rather
than getting an answer of its own.

### Pending understates, and says so

A Pending row counts as nothing, so both the total and the percentages describe the income
entered so far. Both are shown, with one note beneath the total mirroring the rail's own
wording for the identical condition: *"Pending rows are not yet counted — this balance is
not final."*

Suppressing the percentages while any income is Pending was considered and rejected. Unlike
the negative case, nothing here is structurally unreadable — a member holding the only
entered figure genuinely has 100% of the Spendable Income the Month currently records. It
is incomplete, not false, and the rail already treats that condition as a note rather than
a refusal. Inventing a stricter rule for one panel would make the two disagree about the
same Month.

### A Household of one shows neither

With one member in the Month, the total row restates the figure directly above it and the
percentage can only ever say 100%. Neither renders.

This is v1.1's own reasoning on the single-Participant Split Rule, applied again: do not
render a control or a figure that can only say one thing. Until a second member exists the
panel looks exactly as it does today.

The split of responsibility: the engine refuses the percentages when they could not be true
(negative or non-positive total), because that is a question about the figures. The
one-member suppression is the UI's, because it is a question about what is worth rendering
— the engine will happily answer that a Household of one holds 100% of its own income.

### Restricted-Use needs no decision

The figure is Spendable Income throughout and does not follow the rail's Restricted-Use
toggle. CONTEXT.md settles this under **Leftover Balance**: the toggle substitutes total
Income "in this figure alone". The panel's per-member figure is already an unconditional
`spendableIncome`, and the total and percentages join it.

### The demo seed

The seed runs in CI as a test and drives the domain as a member would. It gains the income
total by having three members with different incomes already — Ada, Bruno and Mira — so
the percentages render, and with three of them largest remainder is exercised rather than
merely called.

It does not exercise clearing a One-Off mark. Doing so would mean seeding a row, marking
it and unmarking it, which is a sequence no member performs and which tests the engine
through the wrong door. The domain tests cover both directions directly.

### Supersedes

Nothing. Every criterion of `0001-mvp` and `0002-v1-1-dashboard-refinements` stands. The
three `markXOneOff` functions are renamed rather than removed, and their one-way behaviour
was never itself an acceptance criterion.

## Out of Scope

- **Opening an empty Month instead of copying the Previous Month.** The roadmap's third
  v1.2 item, **rejected** during refinement rather than deferred; `docs/roadmap.md` carries
  the reasoning. In short: a future Month opened empty reports every row of the Previous
  Month as Drift `missing` and offers to refresh them in one at a time, which is the empty
  open being undone by the feature next to it. Suppressing that means storing that the
  Month was opened empty, which is the one thing the item exists not to do and which
  ADR-0008 prices twice. Both uses it named are already served: a Household's first Month
  opens empty already (`firstMonth`, `domain/month.ts`), and a clean slate is removing the
  rows, whose absence later Months inherit.
- **Any change to CONTEXT.md.** The rejected item was the one that would have needed the
  definition of **Opening a Month** amended. **One-Off** and **Ends Here** describe the mark
  and its effect and say nothing about its being permanent, so both stand as written.
- **One decimal place on the percentages.** Considered and declined; whole percent, with
  close earners reading alike as the accepted cost.
- **A total for anything but Spendable Income.** No Household-wide expense total, no
  Household Leftover Balance. Neither is on the roadmap and neither follows from this item.
- **Percentages anywhere but the Income panel's section headers.** The rail is unchanged.
- **Reordering rows.** v1.3, and blocked on a decision ADR-0008 has no answer for yet.
