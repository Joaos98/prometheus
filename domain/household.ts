import { DomainError } from './errors.js'
import { assertMonthKey } from './month-key.js'
import { openMonth } from './month.js'
import { requireName } from './rows.js'
import type { Currency, Household, Member, MemberId, MonthKey } from './types.js'

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
  const currency = requireCurrency(setup.currency)
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
  const relabelled = requireCurrency(currency)
  if (relabelled.decimals !== household.currency.decimals) {
    throw new DomainError(
      `Amounts are held as ${household.currency.code} minor units to ${household.currency.decimals} decimals, and ${relabelled.code} has ${relabelled.decimals}. Nothing is converted, so this change is refused.`,
    )
  }
  return { ...household, currency: relabelled }
}

/**
 * Adds someone to the Roster, active from now on. They join whichever Month is opened
 * next — no already-opened Month is touched, since a Month's member list is its own,
 * copied at the moment it was opened.
 */
export function addMember(household: Household, name: string): Household {
  const member: Member = {
    id: crypto.randomUUID(),
    name: requireName(name, 'A member'),
    active: true,
  }
  return { ...household, roster: [...household.roster, member] }
}

/**
 * Marks a Roster member inactive. They are dropped from Months opened afterwards, but
 * nothing about an already-opened Month changes — it keeps its own copy of who was a
 * member when it was opened. Nobody is ever deleted from the Roster.
 */
export function deactivateMember(household: Household, member: MemberId): Household {
  return { ...household, roster: setActive(household, member, false) }
}

/**
 * Brings a deactivated Roster member back, active from now on. They appear in Months
 * opened afterwards with no record of the absence; no already-opened Month is touched.
 */
export function reactivateMember(household: Household, member: MemberId): Household {
  return { ...household, roster: setActive(household, member, true) }
}

function setActive(household: Household, member: MemberId, active: boolean): Member[] {
  if (!household.roster.some((candidate) => candidate.id === member)) {
    throw new DomainError(`${member} is not on the Roster`)
  }
  return household.roster.map((candidate) =>
    candidate.id === member ? { ...candidate, active } : candidate,
  )
}

/**
 * The one currency every amount in the Household is in. Held to a whole number of decimal
 * places, because a currency's precision is what its stored minor units mean.
 */
export function requireCurrency(currency: Currency): Currency {
  const code = currency.code.trim()
  if (code === '') throw new DomainError('A Household needs a currency')
  if (!Number.isInteger(currency.decimals) || currency.decimals < 0 || currency.decimals > 4) {
    throw new DomainError(`${code} cannot have ${currency.decimals} decimal places`)
  }
  return { code, symbol: currency.symbol.trim() || code, decimals: currency.decimals }
}
