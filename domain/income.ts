import { DomainError } from './errors.js'
import {
  openedMonth,
  requireAmount,
  requireMember,
  requireName,
  withMonth,
  type RowChange,
} from './rows.js'
import type { Household, IncomeSnapshot, MemberId, Minor, Month, MonthKey, RowId } from './types.js'

export interface IncomeDraft {
  name: string
  member: MemberId
  amount: Minor | null
  restrictedUse?: boolean
}

/**
 * The fields an edit names. A field left out is left alone. An `amount` of `null` is
 * named: it takes the amount back to nothing at all, making the row Pending again.
 */
export interface IncomeEdits {
  name?: string
  member?: MemberId
  amount?: Minor | null
  restrictedUse?: boolean
}

/** Records one named income source on a Month. */
export function addIncomeSnapshot(
  household: Household,
  key: MonthKey,
  draft: IncomeDraft,
): RowChange<IncomeSnapshot> {
  const month = openedMonth(household, key)
  const row: IncomeSnapshot = {
    id: crypto.randomUUID(),
    name: requireName(draft.name, 'An income source'),
    member: requireMember(month, draft.member),
    amount: requireAmount(draft.amount),
    restrictedUse: draft.restrictedUse ?? false,
  }
  return { household: withIncome(household, month, [...month.income, row]), row }
}

/** Changes the fields an edit names on one row of one Month, and nothing else. */
export function editIncomeSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: IncomeEdits,
): RowChange<IncomeSnapshot> {
  const month = openedMonth(household, key)
  const existing = incomeRow(month, id)

  const row: IncomeSnapshot = {
    ...existing,
    ...(edits.name !== undefined && { name: requireName(edits.name, 'An income source') }),
    ...(edits.member !== undefined && { member: requireMember(month, edits.member) }),
    ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    ...(edits.restrictedUse !== undefined && { restrictedUse: edits.restrictedUse }),
  }

  const income = month.income.map((candidate) => (candidate.id === id ? row : candidate))
  return { household: withIncome(household, month, income), row }
}

/** Takes an income source out of a Month. */
export function removeIncomeSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
): Household {
  const month = openedMonth(household, key)
  incomeRow(month, id)
  return withIncome(
    household,
    month,
    month.income.filter((candidate) => candidate.id !== id),
  )
}

/**
 * A member's income for the Month excluding Restricted-Use, which can only be spent on
 * certain things and so never counts toward what they can spend or weights a Split
 * Rule. A Pending row counts as nothing — no amount was entered.
 */
export function spendableIncome(month: Month, member: MemberId): Minor {
  return month.income
    .filter((row) => row.member === member && !row.restrictedUse)
    .reduce((total, row) => total + (row.amount ?? 0), 0)
}

function incomeRow(month: Month, id: RowId): IncomeSnapshot {
  const row = month.income.find((candidate) => candidate.id === id)
  if (!row) throw new DomainError(`${month.key} holds no income row ${id}`)
  return row
}

function withIncome(household: Household, month: Month, income: IncomeSnapshot[]): Household {
  return withMonth(household, { ...month, income })
}
