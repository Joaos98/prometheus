import { DomainError } from './errors.js'
import { inheritMonth } from './inheritance.js'
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
 * Brings a Month's data into existence by copying the Previous Month wholesale. The
 * Household's very first Month has no Previous Month, so it takes the active Roster and
 * opens with no rows — which is correct, since nothing precedes it.
 */
export function openMonth(household: Household, key: MonthKey): Household {
  const month = assertMonthKey(key)
  if (isOpened(household, month)) {
    throw new DomainError(`${monthName(month)} is already opened`)
  }

  const previous = previousMonthKey(household, month)
  const opened: Month = previous
    ? inheritMonth(household.months[previous]!, month, household.roster)
    : firstMonth(household, month)

  return { ...household, months: { ...household.months, [month]: opened } }
}

/** The Household's earliest Month: the active Roster, and nothing to inherit. */
function firstMonth(household: Household, key: MonthKey): Month {
  const members = household.roster.filter((member) => member.active).map((member) => member.id)
  return { key, members, income: [], expenses: [], goals: [] }
}
