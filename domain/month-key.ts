import { DomainError } from './errors.js'
import type { MonthKey } from './types.js'

const KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

const NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Builds the key for a year and a month, where January is 1. */
export function monthKey(year: number, month: number): MonthKey {
  return assertMonthKey(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`)
}

export function assertMonthKey(key: string): MonthKey {
  if (!KEY.test(key)) {
    throw new DomainError(`"${key}" is not a Month — a Month is a year and a month, as in 2026-07`)
  }
  return key
}

/** The Month as the Household says it: "July 2026". */
export function monthName(key: MonthKey): string {
  const match = KEY.exec(assertMonthKey(key))!
  return `${NAMES[Number(match[2]) - 1]} ${match[1]}`
}
