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
 * The Month that opening `key` would produce, worked out without opening anything. A
 * pure question about the record as it now stands: what the Previous Month would hand
 * over, and to whom.
 *
 * Asking it of a Month that is already opened is meaningful and answers what opening it
 * afresh would give — which is not necessarily what it holds, since it may have been
 * opened before the Previous Month was last corrected.
 */
export function monthIfOpened(household: Household, key: MonthKey): Month {
  const month = assertMonthKey(key)
  const previous = previousMonthKey(household, month)
  return previous
    ? inheritMonth(household.months[previous]!, month, household)
    : firstMonth(household, month)
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

  return { ...household, months: { ...household.months, [month]: monthIfOpened(household, month) } }
}

/** How many rows a Month holds, of every kind — what discarding it would remove. */
export function entryCount(month: Month): number {
  return month.income.length + month.expenses.length + month.goals.length
}

/**
 * Undoes an open: the Month's key goes away entirely, taking every row with it, and the
 * Month is unopened again — not opened and empty, which is a different thing the model
 * relies on telling apart. Opening it afresh afterwards copies the Previous Month as it
 * now stands.
 *
 * This is the Household's one destructive operation, which is why the count of what will
 * be lost is a separate query: whoever calls this is expected to have said the number
 * out loud first. Every other Month is left exactly as it was, including the Months
 * after this one — they keep what they inherited, and simply inherit across the gap the
 * next time one of them is opened.
 */
export function discardMonth(household: Household, key: MonthKey): Household {
  const month = assertMonthKey(key)
  if (!isOpened(household, month)) {
    throw new DomainError(`${monthName(month)} has not been opened, so there is nothing to discard`)
  }

  const { [month]: discarded, ...kept } = household.months
  return { ...household, months: kept }
}

/** The Household's earliest Month: the active Roster, and nothing to inherit. */
function firstMonth(household: Household, key: MonthKey): Month {
  const members = household.roster.filter((member) => member.active).map((member) => member.id)
  return { key, members, income: [], expenses: [], goals: [] }
}
