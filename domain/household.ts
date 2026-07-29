import { DomainError } from './errors.js'
import { assertMonthKey } from './month-key.js'
import { openMonth } from './month.js'
import type { Currency, Household, Member, MonthKey } from './types.js'

export interface Setup {
  currency: Currency
  memberNames: string[]
  startingMonth: MonthKey
}

/**
 * Brings a Household into existence: the currency every amount will be in, the Roster,
 * and the Month to start from, which is opened holding the active Roster and no rows.
 * All three are required — a Household missing any of them cannot record anything.
 */
export function setUpHousehold(setup: Setup): Household {
  const currency = validCurrency(setup.currency)
  const names = setup.memberNames.map((name) => name.trim()).filter((name) => name !== '')
  if (names.length === 0) {
    throw new DomainError('A Household needs at least one member on its Roster')
  }
  const startingMonth = assertMonthKey(setup.startingMonth)

  const roster: Member[] = names.map((name) => ({ id: crypto.randomUUID(), name, active: true }))
  return openMonth({ currency, roster, months: {} }, startingMonth)
}

/**
 * Renames the currency without converting a single amount. Amounts are integer minor
 * units, so a currency of different decimal precision would silently change what every
 * stored amount means; that is refused rather than converted.
 */
export function relabelCurrency(household: Household, currency: Currency): Household {
  const relabelled = validCurrency(currency)
  if (relabelled.decimals !== household.currency.decimals) {
    throw new DomainError(
      `Amounts are held as ${household.currency.code} minor units to ${household.currency.decimals} decimals, and ${relabelled.code} has ${relabelled.decimals}. Nothing is converted, so this change is refused.`,
    )
  }
  return { ...household, currency: relabelled }
}

function validCurrency(currency: Currency): Currency {
  const code = currency.code.trim()
  if (code === '') throw new DomainError('A Household needs a currency')
  if (!Number.isInteger(currency.decimals) || currency.decimals < 0 || currency.decimals > 4) {
    throw new DomainError(`${code} cannot have ${currency.decimals} decimal places`)
  }
  return { code, symbol: currency.symbol.trim() || code, decimals: currency.decimals }
}
