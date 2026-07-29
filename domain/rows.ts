import type { Household, Minor } from './types.js'

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
