import { DomainError } from './errors.js'
import type { Currency, Minor } from './types.js'

const AMOUNT = /^(-)?(\d+)(?:[.,](\d+))?$/

/**
 * Reads an amount as typed into integer minor units of the currency. Anything finer
 * than the currency's precision is refused rather than rounded, so no amount in the
 * Household ever comes from a floating-point value.
 */
export function toMinor(entered: string, currency: Currency): Minor {
  const match = AMOUNT.exec(entered.trim())
  if (!match) throw new DomainError(`"${entered}" is not an amount`)

  const [, sign, whole, fraction = ''] = match
  if (fraction.length > currency.decimals) {
    throw new DomainError(
      `${currency.code} is held to ${currency.decimals} decimals, so "${entered}" cannot be stored exactly`,
    )
  }

  const padded = fraction.padEnd(currency.decimals, '0')
  const magnitude = Number(`${whole}${padded}`)
  if (!Number.isSafeInteger(magnitude)) {
    throw new DomainError(`"${entered}" is larger than an amount the Household can hold`)
  }
  return sign === '-' && magnitude !== 0 ? -magnitude : magnitude
}

/** Renders minor units at the currency's own precision. */
export function formatAmount(amount: Minor, currency: Currency): string {
  const sign = amount < 0 ? '-' : ''
  const digits = String(Math.abs(amount)).padStart(currency.decimals + 1, '0')
  const whole = digits.slice(0, digits.length - currency.decimals)
  const fraction = digits.slice(digits.length - currency.decimals)
  return `${sign}${currency.symbol}${whole}${fraction ? `.${fraction}` : ''}`
}
