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

/** Every third digit from the right, which is where a thousands separator goes. */
const THOUSANDS = /\B(?=(\d{3})+$)/g

function digitsOf(amount: Minor, currency: Currency) {
  const digits = String(Math.abs(amount)).padStart(currency.decimals + 1, '0')
  return {
    sign: amount < 0 ? '-' : '',
    whole: digits.slice(0, digits.length - currency.decimals),
    fraction: digits.slice(digits.length - currency.decimals),
  }
}

/**
 * Renders minor units at the currency's own precision, thousands grouped so that the
 * Household's largest figures — a salary, a Leftover Balance, a goal's target — are
 * scannable at a glance.
 *
 * The separators are the app's own, not the browser's: a Household has one currency and
 * no locale anywhere, and a figure that reads differently on the machine it is looked at
 * from is not the Household's figure. A comma groups and a full stop divides, the same
 * pairing this has always rendered.
 */
export function formatAmount(amount: Minor, currency: Currency): string {
  const { sign, whole, fraction } = digitsOf(amount, currency)
  const grouped = whole.replace(THOUSANDS, ',')
  return `${sign}${currency.symbol}${grouped}${fraction ? `.${fraction}` : ''}`
}

/**
 * The same amount as a member types it: no symbol and no grouping. What goes back into a
 * field has to be something `toMinor` will read again, and a grouped figure is not — it
 * reads a comma as the decimal separator, as half the world types it.
 */
export function plainAmount(amount: Minor, currency: Currency): string {
  const { sign, whole, fraction } = digitsOf(amount, currency)
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`
}
