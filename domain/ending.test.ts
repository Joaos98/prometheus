/**
 * One-Off and Ends Here: the same mark, told apart by whether the row has a past.
 *
 * Both stop a row being inherited, and the engine does nothing differently for either.
 * What differs is what the Household is entitled to say about the row afterwards, which
 * is why this is a question asked of the record rather than a second flag stored on it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot, setExpenseOneOff, removeExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot } from './income.js'
import { discardMonth, openMonth } from './month.js'
import { repurposeExpenseSnapshot } from './repurposing.js'
import { appearedBefore } from './rows.js'
import type { Household, MemberId, RowId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId
let rent: RowId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ;[ana, bruno] = household.roster.map((member) => member.id) as [MemberId, MemberId]

  const withRent = addExpenseSnapshot(household, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount: 120000,
    participants: [ana, bruno],
  })
  rent = withRent.row.id
  household = openMonth(withRent.household, '2026-08')
})

describe('a row that has been running', () => {
  it('has a past, so ending it here is not calling it a one-time cost', () => {
    expect(appearedBefore(household, '2026-08', 'expenses', rent)).toBe(true)
  })

  it('still has a past once the mark is on it — the mark says nothing about where it began', () => {
    const ending = setExpenseOneOff(household, '2026-08', rent, true).household

    expect(appearedBefore(ending, '2026-08', 'expenses', rent)).toBe(true)
  })

  /** Gaps in the record are legal, and the Previous Month is the nearest opened one. */
  it('has a past across a Month nobody opened', () => {
    const gapped = openMonth(discardMonth(household, '2026-08'), '2026-09')

    expect(appearedBefore(gapped, '2026-09', 'expenses', rent)).toBe(true)
  })
})

describe('a row recorded in this Month', () => {
  it('has no past, so it is a One-Off and nothing more', () => {
    const plumber = addExpenseSnapshot(household, '2026-08', {
      name: 'Emergency plumber',
      category: 'Home',
      amount: 30000,
      participants: [ana],
    })

    expect(appearedBefore(plumber.household, '2026-08', 'expenses', plumber.row.id)).toBe(false)
  })

  it('is a One-Off rather than Ends Here even when marked at creation', () => {
    const deposit = addExpenseSnapshot(household, '2026-08', {
      name: 'Flight deposit',
      category: 'Travel',
      amount: 24000,
      participants: [ana],
      oneOff: true,
    })

    expect(appearedBefore(deposit.household, '2026-08', 'expenses', deposit.row.id)).toBe(false)
  })

  it('has no past in the Household’s earliest Month, which has nothing before it', () => {
    expect(appearedBefore(household, '2026-07', 'expenses', rent)).toBe(false)
  })

  /** Repurposing mints a new identity, so the cost recorded under it genuinely starts here. */
  it('has no past when it was repurposed here, whatever the row it replaced had', () => {
    const repurposed = repurposeExpenseSnapshot(household, '2026-08', rent, { name: 'Storage unit' })

    expect(appearedBefore(repurposed.household, '2026-08', 'expenses', repurposed.row.id)).toBe(
      false,
    )
  })

  it('is asked of its own kind of row, never another’s', () => {
    const salary = addIncomeSnapshot(household, '2026-08', {
      name: 'Salary',
      member: ana,
      amount: 250000,
    })

    expect(appearedBefore(salary.household, '2026-08', 'income', salary.row.id)).toBe(false)
    expect(appearedBefore(salary.household, '2026-08', 'expenses', salary.row.id)).toBe(false)
  })
})

describe('a row the Previous Month has since lost', () => {
  it('stops having a past, since a fresh open would no longer bring it', () => {
    const removed = removeExpenseSnapshot(household, '2026-07', rent)

    expect(appearedBefore(removed, '2026-08', 'expenses', rent)).toBe(false)
  })
})
