import { DomainError } from './errors.js'
import { assertMonthKey, monthName } from './month-key.js'
import type { Household, Month, MonthKey } from './types.js'

/** The Month as the Household holds it, or nothing if it has not been opened. */
export function monthAt(household: Household, key: MonthKey): Month | undefined {
  return household.months[key]
}

export function isOpened(household: Household, key: MonthKey): boolean {
  return monthAt(household, key) !== undefined
}

/** Every opened Month, in calendar order. */
export function openedMonthKeys(household: Household): MonthKey[] {
  return Object.keys(household.months).sort()
}

/**
 * The nearest opened Month before this one — not necessarily the preceding calendar
 * month. Gaps in the record are legal and are skipped.
 */
export function previousMonthKey(household: Household, key: MonthKey): MonthKey | undefined {
  return openedMonthKeys(household)
    .filter((opened) => opened < key)
    .pop()
}

/**
 * Brings a Month's data into existence. A Month takes its members from the Previous
 * Month, so that changing the Roster cannot alter what any Month already says; the
 * Household's very first Month has no Previous Month and takes the active Roster
 * instead, opening with no rows — which is correct, since nothing precedes it.
 */
export function openMonth(household: Household, key: MonthKey): Household {
  const month = assertMonthKey(key)
  if (isOpened(household, month)) {
    throw new DomainError(`${monthName(month)} is already opened`)
  }

  const previous = previousMonthKey(household, month)
  const members = previous
    ? [...household.months[previous]!.members]
    : household.roster.filter((member) => member.active).map((member) => member.id)

  const opened: Month = { key: month, members, income: [], expenses: [], goals: [] }
  return { ...household, months: { ...household.months, [month]: opened } }
}
