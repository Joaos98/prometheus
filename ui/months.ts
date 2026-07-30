import { monthKey, monthName, type MonthKey } from '../domain/index.js'

/** The twelve months by name, January first, as the engine says them. */
export const MONTH_NAMES: string[] = Array.from(
  { length: 12 },
  (_, index) => monthName(monthKey(2000, index + 1)).split(' ')[0]!,
)

/**
 * The calendar month the device is in. Where navigation starts from when the Household
 * holds no opened Month at all, and what "Today" jumps back to.
 */
export function thisMonth(): MonthKey {
  const now = new Date()
  return monthKey(now.getFullYear(), now.getMonth() + 1)
}
