import { formatAmount, toMinor, type Currency, type Minor } from '../domain/index.js'

/**
 * What a member typed into an amount field. Nothing typed is Pending — no amount at
 * all — which is not the same as a typed zero.
 */
export function readAmount(entered: string, currency: Currency): Minor | null {
  const typed = entered.trim()
  return typed === '' ? null : toMinor(typed, currency)
}

/** The amount as it goes back into the field: bare digits, no currency symbol. */
export function editableAmount(amount: Minor | null, currency: Currency): string {
  return amount === null ? '' : formatAmount(amount, { ...currency, symbol: '' })
}
