import { DomainError } from './errors.js'
import {
  openedMonth,
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
  const row: ExpenseSnapshot = {
    id: crypto.randomUUID(),
    name: requireName(draft.name, 'An Expense'),
    category: draft.category.trim(),
    amount: requireAmount(draft.amount),
    participants: requireParticipants(month, draft.participants),
    splitRule: draft.splitRule ?? { kind: 'even' },
  }
  return { household: withExpenses(household, month, [...month.expenses, row]), row }
}

/**
 * Changes the fields an edit names on one Expense of one Month, and nothing else. The
 * Expense keeps its identity, so its thread across the Months is unbroken.
 */
export function editExpenseSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: ExpenseEdits,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  const existing = expenseRow(month, id)

  const row: ExpenseSnapshot = {
    ...existing,
    ...(edits.name !== undefined && { name: requireName(edits.name, 'An Expense') }),
    ...(edits.category !== undefined && { category: edits.category.trim() }),
    ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    ...(edits.participants !== undefined && {
      participants: requireParticipants(month, edits.participants),
    }),
    ...(edits.splitRule !== undefined && { splitRule: edits.splitRule }),
  }

  const expenses = month.expenses.map((candidate) => (candidate.id === id ? row : candidate))
  return { household: withExpenses(household, month, expenses), row }
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

function expenseRow(month: Month, id: RowId): ExpenseSnapshot {
  const row = month.expenses.find((candidate) => candidate.id === id)
  if (!row) throw new DomainError(`${month.key} holds no Expense ${id}`)
  return row
}

/**
 * The Participants of an Expense: a subset of the Month's members, each named once, in
 * the Month's own order so that Shares fall the same way every time.
 */
function requireParticipants(month: Month, participants: MemberId[]): MemberId[] {
  for (const participant of participants) requireMember(month, participant)
  const named = month.members.filter((member) => participants.includes(member))
  if (named.length === 0) throw new DomainError('An Expense needs somebody to divide among')
  return named
}

function withExpenses(household: Household, month: Month, expenses: ExpenseSnapshot[]): Household {
  return withMonth(household, { ...month, expenses })
}
