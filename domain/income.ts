import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import {
  openedMonth,
  replaceRow,
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
    id: mintId(),
    name: requireName(draft.name, 'An income source'),
    member: requireMember(household, month, draft.member),
    amount: requireAmount(draft.amount),
    restrictedUse: draft.restrictedUse ?? false,
    reviewed: true,
    oneOff: false,
  }
  return { household: withIncome(household, month, [...month.income, row]), row }
}

/**
 * Changes the fields an edit names on one row of one Month, and nothing else. An edit
 * always clears the Unreviewed mark, whether or not the row carried it.
 */
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
    ...(edits.member !== undefined && { member: requireMember(household, month, edits.member) }),
    ...(edits.amount !== undefined && { amount: requireAmount(edits.amount) }),
    ...(edits.restrictedUse !== undefined && { restrictedUse: edits.restrictedUse }),
    reviewed: true,
  }

  return { household: withIncome(household, month, replaceRow(month.income, id, row)), row }
}

/**
 * Confirms a row that is correct as inherited, without editing it: the one way to clear
 * the Unreviewed mark that changes no other field.
 */
export function confirmIncomeSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<IncomeSnapshot> {
  const month = openedMonth(household, key)
  const row: IncomeSnapshot = { ...incomeRow(month, id), reviewed: true }
  return { household: withIncome(household, month, replaceRow(month.income, id, row)), row }
}

/**
 * Marks an income source as belonging to this Month alone: opening the next Month will
 * not inherit it. This is also how a long-running source stops recurring while keeping
 * this Month's record intact. Marking One-Off says nothing about whether the row's other
 * fields have been reviewed, so it leaves the Unreviewed mark exactly as it found it.
 */
export function markIncomeOneOff(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<IncomeSnapshot> {
  const month = openedMonth(household, key)
  const row: IncomeSnapshot = { ...incomeRow(month, id), oneOff: true }
  return { household: withIncome(household, month, replaceRow(month.income, id, row)), row }
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

/**
 * A member's income for the Month including Restricted-Use — every named source, not
 * only what can be freely spent. A Pending row counts as nothing.
 */
export function totalIncome(month: Month, member: MemberId): Minor {
  return month.income
    .filter((row) => row.member === member)
    .reduce((total, row) => total + (row.amount ?? 0), 0)
}

/** The Month's income row of that identity, or nothing if this Month is not on its thread. */
export function incomeIn(month: Month, id: RowId): IncomeSnapshot | undefined {
  return month.income.find((candidate) => candidate.id === id)
}

function incomeRow(month: Month, id: RowId): IncomeSnapshot {
  const row = incomeIn(month, id)
  if (!row) throw new DomainError(`${month.key} holds no income row ${id}`)
  return row
}

function withIncome(household: Household, month: Month, income: IncomeSnapshot[]): Household {
  return withMonth(household, { ...month, income })
}
