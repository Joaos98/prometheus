import { DomainError } from './errors.js'
import { monthAt, previousMonthKey } from './month.js'
import { monthName } from './month-key.js'
import type {
  Household,
  MemberId,
  Minor,
  Month,
  MonthKey,
  MonthRow,
  RowId,
  RowKind,
} from './types.js'

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

/** A row marked so that the next Month opened will not inherit it. */
export function isOneOff(row: { oneOff: boolean }): boolean {
  return row.oneOff
}

/**
 * Whether a row has a past: the Previous Month holds this same identity.
 *
 * This is what tells a **One-Off** from a row that **Ends Here**. The two carry the same
 * mark and have exactly the same effect — the next Month opened inherits neither — but
 * they are not the same thing to say. A cost that ran for a year and then stopped was
 * never a one-time cost, and a Month browsed a year later should not claim it was.
 *
 * Measured against the Previous Month rather than the whole record, which is how
 * everything else here reasons: inheritance, propagation and Drift all weigh a Month
 * against the one a row would have come from. Repurposing mints a new identity, so a
 * repurposed row correctly reads as one starting here rather than one ending.
 */
export function appearedBefore(
  household: Household,
  key: MonthKey,
  kind: RowKind,
  id: RowId,
): boolean {
  const previous = previousMonthKey(household, key)
  if (!previous) return false
  const rows: MonthRow[] = monthAt(household, previous)?.[kind] ?? []
  return rows.some((row) => row.id === id)
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

/**
 * A member's name as the Roster records it. The Roster never deletes anybody, so it can
 * name whoever a Month names, including somebody who has since left it.
 */
export function memberName(household: Household, member: MemberId): string {
  return household.roster.find((candidate) => candidate.id === member)?.name ?? 'Unknown member'
}

/**
 * A refusal a member can read: their own name and the Month as it is spoken, rather than
 * the identities the two are held by. This one reaches a member through the propagation
 * report, where a later Month can hold a row an edit cannot legally stand in.
 */
export function requireMember(household: Household, month: Month, member: MemberId): MemberId {
  if (!month.members.includes(member)) {
    throw new DomainError(
      `${memberName(household, member)} is not a member of ${monthName(month.key)}`,
    )
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
