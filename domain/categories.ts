/**
 * The Household's category vocabulary (ADR-0012): adding one, renaming one, asking where
 * one is used, and taking one away. A category is a label on a row, not a party to it —
 * nothing here computes with an amount, a Participant or a Split Rule.
 *
 * The operations themselves live in `domain/vocabulary.ts`, generic over which
 * Household-level list they act on — this is the thin wrapper that names the list as
 * `categories` and the field as `category`, mirroring `domain/payment-methods.ts`.
 */
import {
  addItem,
  clearItem,
  deleteItem,
  itemUsage,
  renameItem,
  type Vocabulary,
  type VocabularyClearance,
  type VocabularyClearedRow,
  type VocabularyUsage,
} from './vocabulary.js'
import type { Category, CategoryId, Household } from './types.js'

export type CategoryUsage = VocabularyUsage
export type ClearedRow = VocabularyClearedRow
export type CategoryClearance = VocabularyClearance

const categories: Vocabulary = {
  noun: 'category',
  list: (household) => household.categories,
  withList: (household, list) => ({ ...household, categories: list as Category[] }),
  fieldOf: (expense) => expense.category,
  withField: (expense, id) => ({ ...expense, category: id as CategoryId | null }),
}

/** Adds a category to the Household's vocabulary, its id minted fresh. */
export function addCategory(household: Household, name: string): Household {
  return addItem(categories, household, name)
}

/**
 * Renames a category. From here on every Month renders the new name, past Months
 * included — no row is touched, because a row holds only the id (ADR-0012).
 */
export function renameCategory(household: Household, id: CategoryId, name: string): Household {
  return renameItem(categories, household, id, name)
}

/**
 * Every Expense across the whole record that holds this category, and the Months that
 * hold one. This is what a delete confirmation names — a row count and a Month range —
 * and what tells it whether a delete is immediate or has to clear the record first.
 */
export function categoryUsage(household: Household, id: CategoryId): CategoryUsage {
  return itemUsage(categories, household, id)
}

/**
 * Takes a category off every row across the whole record that holds it, leaving the
 * category itself in the vocabulary for the `deleteCategory` that follows. See
 * `domain/vocabulary.ts`'s `clearItem` for the ordering rule and why this is not an edit.
 */
export function clearCategory(household: Household, id: CategoryId): CategoryClearance {
  return clearItem(categories, household, id)
}

/**
 * Takes a category out of the vocabulary. Refused while any row still holds it: the
 * refusal names what giving it up would cost, in rows and in Months (ADR-0012).
 */
export function deleteCategory(household: Household, id: CategoryId): Household {
  return deleteItem(categories, household, id)
}
