import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import { requireConsistentRule } from './split-rules.js'
import {
  isComposite,
  openedMonth,
  replaceRow,
  requireAmount,
  requireName,
  requireMember,
  withMonth,
  type RowChange,
} from './rows.js'
import type {
  CategoryId,
  ExpenseSnapshot,
  Household,
  LineItem,
  MemberId,
  Minor,
  Month,
  MonthKey,
  RowId,
  SplitRule,
} from './types.js'

export interface ExpenseDraft {
  name: string
  category: CategoryId | null
  amount: Minor | null
  participants: MemberId[]
  splitRule?: SplitRule
  oneOff?: boolean
}

/**
 * The fields an edit names. A field left out is left alone. An `amount` of `null` is
 * named: it takes the amount back to nothing at all, making the Expense Pending again.
 *
 * `lines` is not among them, and the reason is identity rather than arithmetic: a list
 * handed over wholesale would mint fresh Line Items for parts that had not changed,
 * which is exactly what Drift and Forward Propagation read a Line's identity to tell
 * apart. Lines are changed one at a time, through their own operations.
 */
export interface ExpenseEdits {
  name?: string
  category?: CategoryId | null
  amount?: Minor | null
  participants?: MemberId[]
  splitRule?: SplitRule
}

/** What a new Line Item is called and what it costs; `null` is Pending, as ever. */
export interface LineDraft {
  name: string
  amount: Minor | null
}

/**
 * What a correction to an Expense's lines carries into a later Month: the lines
 * themselves and the amount they derive. The amount travels alongside rather than being
 * recomputed on arrival, because a composite that lost its last line hands back a typed
 * total that is not itself a line — `consistent` recomputes it anyway whenever the lines
 * given are non-empty, so this only matters for that one direction.
 */
export interface LineCarry {
  lines: LineItem[]
  amount: Minor | null
}

/** The fields a line edit names. A field left out is left alone. */
export interface LineEdits {
  name?: string
  amount?: Minor | null
}

/** Records a cost the Household shares, dividing among the Participants named. */
export function addExpenseSnapshot(
  household: Household,
  key: MonthKey,
  draft: ExpenseDraft,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const row = consistent(household, {
    id: mintId(),
    name: requireName(draft.name, 'An Expense'),
    category: draft.category,
    amount: requireAmount(draft.amount),
    lines: [],
    participants: requireParticipants(household, month, draft.participants),
    splitRule: draft.splitRule ?? { kind: 'even' },
    reviewed: true,
    oneOff: draft.oneOff ?? false,
  })
  return { household: withExpenses(household, month, [...month.expenses, row]), row }
}

/**
 * Changes the fields an edit names on one Expense of one Month, and nothing else. The
 * Expense keeps its identity, so its thread across the Months is unbroken. An edit
 * always clears the Unreviewed mark, whether or not the row carried it.
 */
export function editExpenseSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: ExpenseEdits,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const existing = expenseRow(month, id)
  if (edits.amount !== undefined && isComposite(existing)) {
    throw new DomainError(
      `"${existing.name}" is made of Line Items, so what it costs is what they come to — change a line instead`,
    )
  }

  return writeExpense(household, month, {
    ...existing,
    ...(edits.name !== undefined && { name: requireName(edits.name, 'An Expense') }),
    ...(edits.category !== undefined && { category: edits.category }),
    ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    ...(edits.participants !== undefined && {
      participants: requireParticipants(household, month, edits.participants),
    }),
    ...(edits.splitRule !== undefined && { splitRule: edits.splitRule }),
    reviewed: true,
  })
}

/**
 * Confirms an Expense that is correct as inherited, without editing it: the one way to
 * clear the Unreviewed mark that changes no other field.
 */
export function confirmExpenseSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  return writeExpense(household, month, { ...expenseRow(month, id), reviewed: true })
}

/**
 * Sets whether an Expense belongs to this Month alone: while `true`, opening the next
 * Month will not inherit it. This is also how a long-running Expense stops recurring
 * while keeping this Month's record intact, and how that is undone. Setting it either
 * way says nothing about whether the Expense's other fields have been reviewed, so it
 * leaves the Unreviewed mark exactly as it found it.
 */
export function setExpenseOneOff(
  household: Household,
  key: MonthKey,
  id: RowId,
  oneOff: boolean,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  return writeExpense(household, month, { ...expenseRow(month, id), oneOff })
}

/**
 * Takes a cost out of a Month. This is also how an Expense stops recurring: later
 * Months inherit its absence.
 */
export function removeExpenseSnapshot(household: Household, key: MonthKey, id: RowId): Household {
  const month = openedMonth(household, key)
  expenseRow(month, id)
  return withExpenses(
    household,
    month,
    month.expenses.filter((candidate) => candidate.id !== id),
  )
}

/**
 * Turns a simple Expense into a composite one: the amount somebody typed becomes its
 * first Line Item, named after the Expense and ready to be renamed and split up. No
 * money moves, so a `fixed` rule that was valid before the change is still valid after
 * it, and there is no rule to supply.
 *
 * There has to be a figure for that first line to carry, and a simple Expense for it to
 * be the first of, so this is refused on a Pending Expense and on one already made of
 * lines. In both cases what is wanted is a line with a name of its own, which is
 * `addLineItem`.
 */
export function itemiseExpense(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<ExpenseSnapshot> {
  return changeLines(household, key, id, undefined, (existing) => {
    requireSomethingToItemise(existing)
    return asLines(existing)
  })
}

/**
 * Adds a Line Item, itemising the Expense first if it was still simple — so a figure
 * already recorded survives as a line of its own rather than being replaced by the one
 * being added.
 *
 * That does move the total, which is why `splitRule` is here: a `fixed` rule only totals
 * to one amount, so adding a line under one means saying who absorbs it. It is the same
 * decision a member faces typing a new total on a simple Expense, and the alternative —
 * rescaling figures they typed — is not one this codebase takes.
 */
export function addLineItem(
  household: Household,
  key: MonthKey,
  id: RowId,
  line: LineDraft,
  splitRule?: SplitRule,
): RowChange<ExpenseSnapshot> {
  return changeLines(household, key, id, splitRule, (existing) => [
    ...asLines(existing),
    lineOf(line),
  ])
}

/**
 * Changes the fields an edit names on one Line Item, and nothing else.
 *
 * A rename is only ever a rename: nothing accumulates against a Line the way a history
 * accumulates against an Expense, so there is no Repurposing question here and no fresh
 * identity minted (ADR-0013). An amount moves the Expense's total, so `splitRule` is
 * accepted alongside on the same terms as adding a line.
 */
export function editLineItem(
  household: Household,
  key: MonthKey,
  id: RowId,
  lineId: RowId,
  edits: LineEdits,
  splitRule?: SplitRule,
): RowChange<ExpenseSnapshot> {
  return changeLines(household, key, id, splitRule, (existing, month) => {
    const line = lineIn(month, existing, lineId)
    return replaceRow(existing.lines, lineId, {
      ...line,
      ...(edits.name !== undefined && { name: requireName(edits.name, 'A Line Item') }),
      ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    })
  })
}

/**
 * Takes a Line Item off an Expense. Removing the last one leaves a simple Expense again,
 * holding the running total as the amount somebody may now type over — nothing is lost
 * going back either, and a `fixed` rule survives that change because the total does not.
 * Removing any other line does move the total, so `splitRule` is accepted here too.
 */
export function removeLineItem(
  household: Household,
  key: MonthKey,
  id: RowId,
  lineId: RowId,
  splitRule?: SplitRule,
): RowChange<ExpenseSnapshot> {
  return changeLines(household, key, id, splitRule, (existing, month) => {
    lineIn(month, existing, lineId)
    return existing.lines.filter((candidate) => candidate.id !== lineId)
  })
}

/**
 * Lands a corrected line list in one Month, exactly as Forward Propagation carries any
 * other field. Used only there: the lines given already carry whatever identity they were
 * minted with, so none of `ExpenseEdits`' reasons for excluding a wholesale list apply — a
 * member never calls this directly, `addLineItem`, `editLineItem` and `removeLineItem` are
 * what they use, one line at a time.
 */
export function carryLines(
  household: Household,
  key: MonthKey,
  id: RowId,
  carry: LineCarry,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const existing = expenseRow(month, id)
  return writeExpense(household, month, {
    ...existing,
    lines: carry.lines,
    amount: carry.amount,
    reviewed: true,
  })
}

/**
 * What a set of Line Items comes to: nothing at all when there are none, and nothing at
 * all when any one of them is Pending. A line with no figure entered is not a line
 * costing nothing, so a composite missing one of its parts reads as incomplete rather
 * than as cheap — the same distinction `amount: null` draws on the Expense itself, held
 * one level further down. Lines that are all zero come to zero, which is a figure.
 */
export function totalOfLines(lines: LineItem[]): Minor | null {
  if (lines.length === 0) return null
  let total = 0
  for (const line of lines) {
    if (line.amount === null) return null
    total += line.amount
  }
  return total
}

/**
 * One line operation, which is the same act every time: find the Expense, work out what
 * its lines become, and write it back judged whole. Only `produce` differs between the
 * four, and every one of them moves the amount, so all four take the Split Rule that has
 * to stand against the new total and all four clear the Unreviewed mark — reading a
 * composite's parts and correcting one is reviewing it, which is what an edit means
 * anywhere else in this module.
 */
function changeLines(
  household: Household,
  key: MonthKey,
  id: RowId,
  splitRule: SplitRule | undefined,
  produce: (existing: ExpenseSnapshot, month: Month) => LineItem[],
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const existing = expenseRow(month, id)

  return writeExpense(household, month, {
    ...existing,
    lines: produce(existing, month),
    ...(splitRule !== undefined && { splitRule }),
    reviewed: true,
  })
}

/**
 * One Expense written into its Month, judged whole first. Every path that changes an
 * Expense in place comes through here, because an amount is only ever valid against the
 * Split Rule and the Participants it stands beside.
 */
function writeExpense(
  household: Household,
  month: Month,
  row: ExpenseSnapshot,
): RowChange<ExpenseSnapshot> {
  const settled = consistent(household, row)
  return {
    household: withExpenses(household, month, replaceRow(month.expenses, settled.id, settled)),
    row: settled,
  }
}

/**
 * The Expense as it would stand, judged whole. An amount, its Participants and its
 * Split Rule are only ever valid with respect to each other, so every write goes
 * through here and there is no path that stores a rule inconsistent with its Expense.
 *
 * It is also where a composite's amount is computed. The invariant a discriminated union
 * would have enforced — that a typed total cannot contradict the lines it is made of — is
 * enforced here instead, by there being no write that leaves the two able to disagree.
 * A simple Expense keeps the figure it was given, which is what hands the running total
 * back when the last line goes.
 *
 * A computed total is held to the same standard as a typed one. Each line is whole minor
 * units, but a sum of them need not still be a number that can be held exactly, and an
 * amount nobody can trust is worse than an edit refused.
 */
function consistent(household: Household, row: ExpenseSnapshot): ExpenseSnapshot {
  const settled = isComposite(row)
    ? { ...row, amount: requireAmount(totalOfLines(row.lines)) }
    : row
  requireConsistentRule(settled.splitRule, settled.amount, settled.participants, household.currency)
  return settled
}

/** A drafted line, given the identity that will carry it from Month to Month. */
function lineOf(draft: LineDraft): LineItem {
  return {
    id: mintId(),
    name: requireName(draft.name, 'A Line Item'),
    amount: requireAmount(draft.amount),
  }
}

/**
 * The lines an Expense already stands as. A composite is its own; a simple Expense is the
 * single line its typed amount becomes, named after the Expense itself. One with nothing
 * entered has no figure to preserve, so it becomes composite with only what is added.
 */
function asLines(row: ExpenseSnapshot): LineItem[] {
  if (isComposite(row)) return row.lines
  if (row.amount === null) return []
  return [{ id: mintId(), name: row.name, amount: row.amount }]
}

function requireSomethingToItemise(row: ExpenseSnapshot): void {
  if (isComposite(row)) {
    throw new DomainError(
      `"${row.name}" is already made of Line Items, so a further one needs a name`,
    )
  }
  if (row.amount === null) {
    throw new DomainError(`"${row.name}" has no amount to become its first Line Item`)
  }
}

function lineIn(month: Month, row: ExpenseSnapshot, lineId: RowId): LineItem {
  const line = row.lines.find((candidate) => candidate.id === lineId)
  if (!line) throw new DomainError(`${month.key}'s "${row.name}" holds no Line Item ${lineId}`)
  return line
}

/** The Month's Expense of that identity, or nothing if this Month is not on its thread. */
export function expenseIn(month: Month, id: RowId): ExpenseSnapshot | undefined {
  return month.expenses.find((candidate) => candidate.id === id)
}

function expenseRow(month: Month, id: RowId): ExpenseSnapshot {
  const row = expenseIn(month, id)
  if (!row) throw new DomainError(`${month.key} holds no Expense ${id}`)
  return row
}

/**
 * The Participants of an Expense: a subset of the Month's members, each named once, in
 * the Month's own order so that Shares fall the same way every time.
 */
function requireParticipants(
  household: Household,
  month: Month,
  participants: MemberId[],
): MemberId[] {
  for (const participant of participants) requireMember(household, month, participant)
  const named = month.members.filter((member) => participants.includes(member))
  if (named.length === 0) throw new DomainError('An Expense needs somebody to divide among')
  return named
}

function withExpenses(household: Household, month: Month, expenses: ExpenseSnapshot[]): Household {
  return withMonth(household, { ...month, expenses })
}
