/**
 * The Household's category vocabulary (ADR-0012): adding one, renaming one, and asking
 * where one is used. A category is a label on a row, not a party to it — nothing here
 * computes with an amount, a Participant or a Split Rule.
 *
 * Deleting a category and the clear it requires when one is in use are ticket 06's, not
 * this module's.
 */
import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import { openedMonthKeys } from './month.js'
import { requireName } from './rows.js'
import type { Category, CategoryId, Household, MonthKey } from './types.js'

/** What using a category costs to give up: the rows that hold it and the Months they are in. */
export interface CategoryUsage {
  rowCount: number
  /** The Months that hold at least one row of this category, in calendar order. */
  months: MonthKey[]
}

/** Adds a category to the Household's vocabulary, its id minted fresh. */
export function addCategory(household: Household, name: string): Household {
  const named = requireName(name, 'A category')
  requireUniqueName(household, named)
  const category: Category = { id: mintId(), name: named }
  return { ...household, categories: [...household.categories, category] }
}

/**
 * Renames a category. From here on every Month renders the new name, past Months
 * included — no row is touched, because a row holds only the id (ADR-0012).
 */
export function renameCategory(household: Household, id: CategoryId, name: string): Household {
  requireCategory(household, id)
  const named = requireName(name, 'A category')
  requireUniqueName(household, named, id)
  return {
    ...household,
    categories: household.categories.map((category) =>
      category.id === id ? { ...category, name: named } : category,
    ),
  }
}

/**
 * Every Expense across the whole record that holds this category, and the Months that
 * hold one. This is what ticket 06's delete confirmation names — a row count and a Month
 * range — and what tells it whether a delete is immediate or refused.
 */
export function categoryUsage(household: Household, id: CategoryId): CategoryUsage {
  let rowCount = 0
  const months: MonthKey[] = []
  for (const key of openedMonthKeys(household)) {
    const count = household.months[key]!.expenses.filter(
      (expense) => expense.category === id,
    ).length
    if (count > 0) {
      rowCount += count
      months.push(key)
    }
  }
  return { rowCount, months }
}

function requireCategory(household: Household, id: CategoryId): Category {
  const category = household.categories.find((candidate) => candidate.id === id)
  if (!category) throw new DomainError(`${id} is not a category this Household has`)
  return category
}

/**
 * Two categories may not share a name, compared case-insensitively: "Groceries" and
 * "groceries" are exactly the confusion a vocabulary exists to end, not a second entry
 * worth keeping apart.
 */
function requireUniqueName(household: Household, name: string, excluding?: CategoryId): void {
  const clashes = household.categories.some(
    (category) =>
      category.id !== excluding && category.name.toLowerCase() === name.toLowerCase(),
  )
  if (clashes) throw new DomainError(`A category named "${name}" already exists`)
}
