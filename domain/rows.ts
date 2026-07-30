import { DomainError } from './errors.js'
import { monthAt } from './month.js'
import type { Household, MemberId, Minor, Month, MonthKey, RowId } from './types.js'

/**
 * What an operation on a single row returns: the Household as it now stands, and the
 * row that changed — which is what the storage port writes, one row at a time.
 */
export interface RowChange<Row> {
  household: Household
  row: Row
}

/**
 * A row with no amount entered at all. Distinct from an amount of zero, which is a
 * member's answer, and from an absent row, which was never recorded.
 */
export function isPending(row: { amount: Minor | null }): boolean {
  return row.amount === null
}

/** The Month a row is being recorded on. Nothing can be recorded on an unopened Month. */
export function openedMonth(household: Household, key: MonthKey): Month {
  const month = monthAt(household, key)
  if (!month) throw new DomainError(`${key} has not been opened, so it holds no rows`)
  return month
}

export function requireName(name: string, subject: string): string {
  const named = name.trim()
  if (named === '') throw new DomainError(`${subject} needs a name`)
  return named
}

/** Amounts are whole minor units or nothing at all; nothing at all is Pending. */
export function requireAmount(amount: Minor | null): Minor | null {
  if (amount === null) return null
  if (!Number.isSafeInteger(amount)) {
    throw new DomainError(`${amount} is not a whole number of minor units`)
  }
  return amount
}

export function requireMember(month: Month, member: MemberId): MemberId {
  if (!month.members.includes(member)) {
    throw new DomainError(`${member} is not a member of ${month.key}`)
  }
  return member
}

/** The Household with one of its Months replaced. */
export function withMonth(household: Household, month: Month): Household {
  return { ...household, months: { ...household.months, [month.key]: month } }
}

/** A Month's rows with the one of the given identity replaced, and every other left as is. */
export function replaceRow<Row extends { id: RowId }>(rows: Row[], id: RowId, row: Row): Row[] {
  return rows.map((candidate) => (candidate.id === id ? row : candidate))
}
