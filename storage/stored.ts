import type { Category, ExpenseSnapshot, Household, Month, PaymentMethod } from '../domain/index.js'

/** A Household as an adapter may hand it over: everything a current one has, or less. */
type StoredHousehold = Omit<Household, 'categories' | 'paymentMethods'> & {
  categories?: Category[]
  paymentMethods?: PaymentMethod[]
}

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
 * genuinely chosen an empty vocabulary: v1.2 never wrote the key at all. `paymentMethods`
 * carries the identical contract, absent from every Household stored before this ticket —
 * v1.2 included — and the two vocabularies are told apart independently: a Household that
 * has already chosen categories but predates payment methods loads its categories exactly
 * as stored and defaults only `paymentMethods`. Either absence is also what discards the
 * matching field on every Expense rather than trusting a stale value — the old free-text
 * `category` for the one, and a `paymentMethod` that cannot have meant anything for the
 * other — ADR-0012's call, carried out here rather than converted at any later point, so
 * nothing downstream ever sees either.
 */
export function fromStored(household: StoredHousehold): Household {
  const legacyCategories = household.categories === undefined
  const legacyPaymentMethods = household.paymentMethods === undefined
  return {
    ...household,
    categories: household.categories ?? [],
    paymentMethods: household.paymentMethods ?? [],
    months: Object.fromEntries(
      Object.entries(household.months).map(([key, month]) => [
        key,
        monthFromStored(month, legacyCategories, legacyPaymentMethods),
      ]),
    ),
  }
}

function monthFromStored(
  month: Month,
  legacyCategories: boolean,
  legacyPaymentMethods: boolean,
): Month {
  return {
    ...month,
    expenses: month.expenses.map((row) =>
      expenseFromStored(row, legacyCategories, legacyPaymentMethods),
    ),
  }
}

/**
 * v1.2 and everything before it had no Line Items, so an Expense stored then is a simple
 * one — which is exactly what an empty list says. Its amount is the figure that was typed,
 * and stays so until somebody itemises it. The same Household predates the category
 * vocabulary, so whatever free string its `category` field held is discarded rather than
 * carried forward as an id nothing defines. `paymentMethod` predates every Household
 * stored before this ticket, categorised or not, and is discarded on the same terms.
 */
function expenseFromStored(
  row: ExpenseSnapshot,
  legacyCategories: boolean,
  legacyPaymentMethods: boolean,
): ExpenseSnapshot {
  const withLines = row.lines ? row : { ...row, lines: [] }
  const withCategory = legacyCategories ? { ...withLines, category: null } : withLines
  return legacyPaymentMethods ? { ...withCategory, paymentMethod: null } : withCategory
}
