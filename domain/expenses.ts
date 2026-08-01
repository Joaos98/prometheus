import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import { requireConsistentRule } from './split-rules.js'
import {
  openedMonth,
  replaceRow,
  requireAmount,
  requireName,
  requireMember,
  withMonth,
  type RowChange,
} from './rows.js'
import type {
  ExpenseSnapshot,
  Household,
  MemberId,
  Minor,
  Month,
  MonthKey,
  RowId,
  SplitRule,
} from './types.js'

export interface ExpenseDraft {
  name: string
  category: string
  amount: Minor | null
  participants: MemberId[]
  splitRule?: SplitRule
}

/**
 * The fields an edit names. A field left out is left alone. An `amount` of `null` is
 * named: it takes the amount back to nothing at all, making the Expense Pending again.
 */
export interface ExpenseEdits {
  name?: string
  category?: string
  amount?: Minor | null
  participants?: MemberId[]
  splitRule?: SplitRule
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
    category: draft.category.trim(),
    amount: requireAmount(draft.amount),
    participants: requireParticipants(household, month, draft.participants),
    splitRule: draft.splitRule ?? { kind: 'even' },
    reviewed: true,
    oneOff: false,
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

  const row = consistent(household, {
    ...existing,
    ...(edits.name !== undefined && { name: requireName(edits.name, 'An Expense') }),
    ...(edits.category !== undefined && { category: edits.category.trim() }),
    ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    ...(edits.participants !== undefined && {
      participants: requireParticipants(household, month, edits.participants),
    }),
    ...(edits.splitRule !== undefined && { splitRule: edits.splitRule }),
    reviewed: true,
  })

  return { household: withExpenses(household, month, replaceRow(month.expenses, id, row)), row }
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
  const row: ExpenseSnapshot = { ...expenseRow(month, id), reviewed: true }
  return { household: withExpenses(household, month, replaceRow(month.expenses, id, row)), row }
}

/**
 * Marks an Expense as belonging to this Month alone: opening the next Month will not
 * inherit it. This is also how a long-running Expense stops recurring while keeping
 * this Month's record intact. Marking One-Off says nothing about whether the Expense's
 * other fields have been reviewed, so it leaves the Unreviewed mark exactly as it found it.
 */
export function markExpenseOneOff(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const row: ExpenseSnapshot = { ...expenseRow(month, id), oneOff: true }
  return { household: withExpenses(household, month, replaceRow(month.expenses, id, row)), row }
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
 * The Expense as it would stand, judged whole. An amount, its Participants and its
 * Split Rule are only ever valid with respect to each other, so every write goes
 * through here and there is no path that stores a rule inconsistent with its Expense.
 */
function consistent(household: Household, row: ExpenseSnapshot): ExpenseSnapshot {
  requireConsistentRule(row.splitRule, row.amount, row.participants, household.currency)
  return row
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
