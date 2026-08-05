/**
 * The Household's category vocabulary (ADR-0012): adding one, renaming one, asking where
 * one is used, and taking one away. A category is a label on a row, not a party to it —
 * nothing here computes with an amount, a Participant or a Split Rule.
 *
 * Deleting is the one destructive act, and it comes in two halves that must be run in
 * order: `clearCategory` takes the category off every row that holds it, and only then may
 * `deleteCategory` take it out of the vocabulary. Which of those two writes lands first is
 * a question about a store, so the halves are separate and the app orders them.
 */
import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import { monthName } from './month-key.js'
import { openedMonthKeys } from './month.js'
import { requireName, withMonth } from './rows.js'
import type { Category, CategoryId, ExpenseSnapshot, Household, MonthKey } from './types.js'

/** What using a category costs to give up: the rows that hold it and the Months they are in. */
export interface CategoryUsage {
  rowCount: number
  /** The Months that hold at least one row of this category, in calendar order. */
  months: MonthKey[]
}

/** One Expense with a category taken off it, and the Month whose row it is. */
export interface ClearedRow {
  month: MonthKey
  row: ExpenseSnapshot
}

/**
 * A category taken off every row that held it: the Household as it now stands, and the
 * rows a store has to be given, one at a time.
 */
export interface CategoryClearance {
  household: Household
  rows: ClearedRow[]
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
 * hold one. This is what a delete confirmation names — a row count and a Month range —
 * and what tells it whether a delete is immediate or has to clear the record first.
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

/**
 * Takes a category off every row across the whole record that holds it, leaving the
 * category itself in the vocabulary for the `deleteCategory` that follows. That order is
 * the rule (ADR-0012): the clear lands first, and a run that fails partway leaves a
 * half-cleared category that still cannot be deleted, which is a retry rather than a
 * corrupt state. Running it again finishes the job, since it only ever looks for rows that
 * still hold the category.
 *
 * **This is not an edit, so it does not set `reviewed`.** Nobody reviewed anything: the
 * Unreviewed count is the number a monthly review is actually run against, and a deletion
 * answering for rows in eleven Months would corrupt it. This is the argument `setExpenseOneOff`
 * already carries, on a second write path that is not an edit.
 *
 * It cannot produce Drift either, which is worth saying because the opposite is the
 * intuitive guess: Drift weighs what a Month holds against what a fresh open would *now*
 * produce, both from the household as it stands, and a complete clear moves the held row
 * and the inherited one together.
 *
 * The cleared rows come back alongside the Household because writes are row-scoped
 * (ADR-0008): the caller hands its store each one in turn. Which of the two halves lands
 * first is a question about a store and not about the domain, so the app orders them.
 */
export function clearCategory(household: Household, id: CategoryId): CategoryClearance {
  requireCategory(household, id)
  const rows: ClearedRow[] = []
  let cleared = household
  for (const key of openedMonthKeys(household)) {
    const month = household.months[key]!
    if (!month.expenses.some((expense) => expense.category === id)) continue
    const expenses = month.expenses.map((expense) => {
      if (expense.category !== id) return expense
      const row = { ...expense, category: null }
      rows.push({ month: key, row })
      return row
    })
    cleared = withMonth(cleared, { ...month, expenses })
  }
  return { household: cleared, rows }
}

/**
 * Takes a category out of the vocabulary. Refused while any row still holds it: the
 * refusal names what giving it up would cost, in rows and in Months, because that is the
 * discipline this app already keeps around a destructive act (ADR-0012, and Discarding a
 * Month before it). Clearing it from those rows is `clearCategory`, and this is what runs
 * once every clear has landed.
 */
export function deleteCategory(household: Household, id: CategoryId): Household {
  const category = requireCategory(household, id)
  const usage = categoryUsage(household, id)
  if (usage.rowCount > 0) {
    const cost = costInWords(usage)
    throw new DomainError(`"${category.name}" is ${cost} — clear it before deleting it`)
  }
  return {
    ...household,
    categories: household.categories.filter((candidate) => candidate.id !== id),
  }
}

/**
 * What giving a category up would cost, said as a member reads it: "used by 34 rows across
 * 11 Months, June 2025 – August 2026". A panel asking a member to confirm builds its own
 * sentence from `categoryUsage`, which hands the same two figures over structured; this
 * wording is what the refusal itself carries.
 */
function costInWords(usage: CategoryUsage): string {
  const rows = usage.rowCount === 1 ? '1 row' : `${usage.rowCount} rows`
  const first = monthName(usage.months[0]!)
  if (usage.months.length === 1) return `used by ${rows} in ${first}`
  const last = monthName(usage.months.at(-1)!)
  return `used by ${rows} across ${usage.months.length} Months, ${first} – ${last}`
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
