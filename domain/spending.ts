/**
 * What the Household spent grouped by category: one Month's totals, and what moved
 * between one Month and the one before it.
 *
 * This is the arithmetic ADR-0012 was written to make possible — a stored vocabulary
 * rather than a derived one is what lets a rename leave one series where it found one —
 * and it lives here rather than in `domain/categories.ts`, which labels rows and computes
 * with no amount at all.
 *
 * A Line Item has no category of its own: the parent Expense owns it, and a composite's
 * derived total lands under the parent's category as the one row it is everywhere else.
 * Nothing here reads `lines`, because `amount` already is that total.
 */
import { monthAt, previousMonthKey } from './month.js'
import type { CategoryId, Household, Minor, Month, MonthKey } from './types.js'

/**
 * What one Month spent under one category. `null` is not a category — it is the model's
 * own answer for a row nobody categorised, carried through as itself so that a caller
 * renders it under a heading of its own rather than inventing a category to hold it.
 */
export interface CategorySpend {
  category: CategoryId | null
  amount: Minor
}

/**
 * A Month's Expenses totalled by category, in the order each category is first met among
 * the Month's rows.
 *
 * A Pending Expense contributes nothing, exactly as it does to `householdExpenseTotal`,
 * so a Month still being filled in understates rather than reading as a cheap one. Its
 * category is still named: the Household did spend under it, and what it came to is not
 * yet entered. A category with no rows at all in this Month is absent rather than zero —
 * nothing was spent under it here, which is a caller's to render as an absence.
 */
export function spendingByCategory(month: Month): CategorySpend[] {
  const totals = new Map<CategoryId | null, Minor>()
  for (const row of month.expenses) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + (row.amount ?? 0))
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }))
}

/** One category's spending in two Months, and the difference between them. */
export interface CategoryChange {
  category: CategoryId | null
  before: Minor
  after: Minor
  /** `after` less `before`: positive is a rise, negative a fall. */
  change: Minor
}

/** What moved between one Month and the one before it, and which two Months those are. */
export interface SpendingChange {
  /** The Previous Month — the most recent *opened* one, which after a gap in the record
   * is not the preceding calendar month. */
  from: MonthKey
  to: MonthKey
  changes: CategoryChange[]
}

/**
 * What each category came to in this Month against the Previous Month, for every category
 * either of them holds.
 *
 * A category one Month holds and the other does not is a change from or to nothing rather
 * than an omission: nothing was spent under it, which is a figure. A category that did not
 * move is reported too, at a change of zero — this says what the two Months hold, and
 * whether an unmoved category is worth drawing is a caller's question.
 *
 * Nothing comes back where there is no comparison to draw: a Month nobody opened, or the
 * Household's very first Month, which has nothing behind it. Neither is a comparison
 * against zero — the record simply does not reach back that far.
 */
export function spendingChangeByCategory(
  household: Household,
  key: MonthKey,
): SpendingChange | undefined {
  const month = monthAt(household, key)
  if (!month) return undefined

  const from = previousMonthKey(household, key)
  if (!from) return undefined

  const before = totalsOf(monthAt(household, from)!)
  const after = totalsOf(month)

  // This Month's categories first, in its own order, then whatever only the Previous
  // Month held. Determinate rather than meaningful: what order a diverging bar reads best
  // in is a question about reading, and the caller settles it.
  const categories = [...after.keys(), ...[...before.keys()].filter((one) => !after.has(one))]

  return {
    from,
    to: key,
    changes: categories.map((category) => {
      const was = before.get(category) ?? 0
      const now = after.get(category) ?? 0
      return { category, before: was, after: now, change: now - was }
    }),
  }
}

function totalsOf(month: Month): Map<CategoryId | null, Minor> {
  return new Map(spendingByCategory(month).map((spend) => [spend.category, spend.amount]))
}
