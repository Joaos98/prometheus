/**
 * The Household's payment method vocabulary (ADR-0012): adding one, renaming one, asking
 * where one is used, and taking one away. A payment method says how the money left the
 * account and nothing about who paid or whether they did — it must not grow toward that.
 *
 * The operations themselves live in `domain/vocabulary.ts`, generic over which
 * Household-level list they act on — this is the thin wrapper that names the list as
 * `paymentMethods` and the field as `paymentMethod`, mirroring `domain/categories.ts`.
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
import type { Household, PaymentMethod, PaymentMethodId } from './types.js'

export type PaymentMethodUsage = VocabularyUsage
export type ClearedPaymentMethodRow = VocabularyClearedRow
export type PaymentMethodClearance = VocabularyClearance

const paymentMethods: Vocabulary = {
  noun: 'payment method',
  list: (household) => household.paymentMethods,
  withList: (household, list) => ({ ...household, paymentMethods: list as PaymentMethod[] }),
  fieldOf: (expense) => expense.paymentMethod,
  withField: (expense, id) => ({ ...expense, paymentMethod: id as PaymentMethodId | null }),
}

/** Adds a payment method to the Household's vocabulary, its id minted fresh. */
export function addPaymentMethod(household: Household, name: string): Household {
  return addItem(paymentMethods, household, name)
}

/**
 * Renames a payment method. From here on every Month renders the new name, past Months
 * included — no row is touched, because a row holds only the id (ADR-0012).
 */
export function renamePaymentMethod(
  household: Household,
  id: PaymentMethodId,
  name: string,
): Household {
  return renameItem(paymentMethods, household, id, name)
}

/**
 * Every Expense across the whole record that holds this payment method, and the Months
 * that hold one. This is what a delete confirmation names — a row count and a Month
 * range — and what tells it whether a delete is immediate or has to clear the record
 * first.
 */
export function paymentMethodUsage(household: Household, id: PaymentMethodId): PaymentMethodUsage {
  return itemUsage(paymentMethods, household, id)
}

/**
 * Takes a payment method off every row across the whole record that holds it, leaving
 * the payment method itself in the vocabulary for the `deletePaymentMethod` that
 * follows. See `domain/vocabulary.ts`'s `clearItem` for the ordering rule and why this
 * is not an edit.
 */
export function clearPaymentMethod(
  household: Household,
  id: PaymentMethodId,
): PaymentMethodClearance {
  return clearItem(paymentMethods, household, id)
}

/**
 * Takes a payment method out of the vocabulary. Refused while any row still holds it:
 * the refusal names what giving it up would cost, in rows and in Months (ADR-0012).
 */
export function deletePaymentMethod(household: Household, id: PaymentMethodId): Household {
  return deleteItem(paymentMethods, household, id)
}
