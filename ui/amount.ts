import { DomainError, plainAmount, toMinor, type Currency, type Minor } from '../domain/index.js'

/**
 * What a member typed into an amount field. Nothing typed is Pending — no amount at
 * all — which is not the same as a typed zero.
 */
export function readAmount(entered: string, currency: Currency): Minor | null {
  const typed = entered.trim()
  return typed === '' ? null : toMinor(typed, currency)
}

/** The amount as it goes back into the field: bare digits, no symbol and no grouping. */
export function editableAmount(amount: Minor | null, currency: Currency): string {
  return amount === null ? '' : plainAmount(amount, currency)
}

const PERCENTAGE = /^-?\d+(?:[.,]\d+)?$/

/**
 * A percentage of a custom split, as typed. A comma divides as readily as a full stop,
 * because `toMinor` has always read one that way and the percentage field sits directly
 * beside an amount field in the same form — an app that takes `1000,00` in one box and
 * refuses `33,33` in the next is drawing a distinction its member never made.
 *
 * Nothing typed is nothing put in, which leaves the rule short of 100% and saying so.
 * A negative one is handed on rather than refused here: it is a percentage, just not an
 * allowed one, and the engine turns it away in its own words.
 */
export function readPercentage(entered: string): number {
  const typed = entered.trim()
  if (typed === '') return 0
  if (!PERCENTAGE.test(typed)) throw new DomainError(`"${entered}" is not a percentage`)
  return Number(typed.replace(',', '.'))
}
