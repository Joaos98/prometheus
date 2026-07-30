import type { Month, MonthRow } from './types.js'

/** A row a member has edited or confirmed since it last changed hands. */
export function isReviewed(row: { reviewed: boolean }): boolean {
  return row.reviewed
}

/**
 * How many of the Month's rows are still Unreviewed — the figure the pinned rail's
 * meter reports, and the checklist that reaches zero once every row has been edited or
 * confirmed.
 */
export function unreviewedCount(month: Month): number {
  return rowsOf(month).filter((row) => !row.reviewed).length
}

function rowsOf(month: Month): MonthRow[] {
  return [...month.income, ...month.expenses, ...month.goals]
}
