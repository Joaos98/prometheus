import type { Category, ExpenseSnapshot, Household, Month } from '../domain/index.js'

/** A Household as an adapter may hand it over: everything a current one has, or less. */
type StoredHousehold = Omit<Household, 'categories'> & { categories?: Category[] }

/**
 * What a Household read out of storage needs before the engine can be handed it.
 *
 * Every adapter keeps rows as JSON — SQLite a blob per row, `localStorage` one document,
 * the server whatever it was given — and none of them validates what comes back. So a
 * Household written by an older Prometheus returns missing whatever that version had no
 * field for, while the engine's types promise those fields are there.
 *
 * The defaulting belongs here rather than as a guard inside the domain. The engine is
 * entitled to believe its own types, and defending every read of every field at the point
 * of use is the shape of code that never stops growing. One boundary, crossed once.
 *
 * This is a read-side default, not a migration. Nothing is written back and no schema
 * changes, so a Household stored by an older version keeps loading until something in it
 * is edited — at which point the row is written in the current shape like any other.
 *
 * `categories` defaulting to `[]` here is temporary: a v1.2 Household has no category
 * vocabulary at all, and reading them for real — along with the export format and both
 * adapters — is ticket 07's.
 */
export function fromStored(household: StoredHousehold): Household {
  return {
    ...household,
    categories: household.categories ?? [],
    months: Object.fromEntries(
      Object.entries(household.months).map(([key, month]) => [key, monthFromStored(month)]),
    ),
  }
}

function monthFromStored(month: Month): Month {
  return { ...month, expenses: month.expenses.map(expenseFromStored) }
}

/**
 * v1.2 and everything before it had no Line Items, so an Expense stored then is a simple
 * one — which is exactly what an empty list says. Its amount is the figure that was typed,
 * and stays so until somebody itemises it.
 */
function expenseFromStored(row: ExpenseSnapshot): ExpenseSnapshot {
  return row.lines ? row : { ...row, lines: [] }
}
