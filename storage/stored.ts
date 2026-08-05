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
 * `categories` absent is how a v1.2 Household is told apart from a v2 one that has
 * genuinely chosen an empty vocabulary: v1.2 never wrote the key at all. That absence is
 * also what discards every Expense's old free-text `category` rather than minting a
 * category from it — ADR-0012's call, carried out here rather than converted at any
 * later point, so nothing downstream ever sees the old string.
 */
export function fromStored(household: StoredHousehold): Household {
  const legacy = household.categories === undefined
  return {
    ...household,
    categories: household.categories ?? [],
    months: Object.fromEntries(
      Object.entries(household.months).map(([key, month]) => [key, monthFromStored(month, legacy)]),
    ),
  }
}

function monthFromStored(month: Month, legacy: boolean): Month {
  return { ...month, expenses: month.expenses.map((row) => expenseFromStored(row, legacy)) }
}

/**
 * v1.2 and everything before it had no Line Items, so an Expense stored then is a simple
 * one — which is exactly what an empty list says. Its amount is the figure that was typed,
 * and stays so until somebody itemises it. The same Household predates the category
 * vocabulary, so whatever free string its `category` field held is discarded rather than
 * carried forward as an id nothing defines.
 */
function expenseFromStored(row: ExpenseSnapshot, legacy: boolean): ExpenseSnapshot {
  const withLines = row.lines ? row : { ...row, lines: [] }
  return legacy ? { ...withLines, category: null } : withLines
}
