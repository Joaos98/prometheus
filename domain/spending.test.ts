import { beforeEach, describe, expect, it } from 'vitest'
import {
  addExpenseSnapshot,
  addLineItem,
  editExpenseSnapshot,
  itemiseExpense,
  removeExpenseSnapshot,
} from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { spendingByCategory, spendingChangeByCategory } from './spending.js'
import type { CategoryId, ExpenseSnapshot, Household, MemberId, Month } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

const home = 'home' as CategoryId
const food = 'food' as CategoryId

let household: Household
let ana: MemberId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana'],
    startingMonth: '2026-07',
  })
  ana = household.roster[0]!.id
})

interface Cost {
  name?: string
  category?: CategoryId | null
  amount?: number | null
}

/** One Expense in one Month, defaulting to a categorised cost somebody has entered. */
function spend(of: Household, key: string, cost: Cost): Household {
  return addExpenseSnapshot(of, key as Month['key'], {
    name: cost.name ?? 'Rent',
    category: cost.category === undefined ? home : cost.category,
    amount: cost.amount === undefined ? 40000 : cost.amount,
    participants: [ana],
  }).household
}

const monthOf = (of: Household, key: string): Month => monthAt(of, key as Month['key'])!

const rowNamed = (of: Household, key: string, name: string): ExpenseSnapshot =>
  monthOf(of, key).expenses.find((row) => row.name === name)!

/** One Expense corrected in one Month, found by the name it was entered under. */
function correct(of: Household, key: string, name: string, amount: number): Household {
  return editExpenseSnapshot(of, key as Month['key'], rowNamed(of, key, name).id, { amount })
    .household
}

describe('what a Month spent, by category', () => {
  it('sums the Expenses under each category', () => {
    let after = spend(household, '2026-07', { name: 'Rent', amount: 40000 })
    after = spend(after, '2026-07', { name: 'Water', amount: 3000 })
    after = spend(after, '2026-07', { name: 'Market', category: food, amount: 12000 })

    expect(spendingByCategory(monthOf(after, '2026-07'))).toEqual([
      { category: home, amount: 43000 },
      { category: food, amount: 12000 },
    ])
  })

  /** `null` is the model's own answer for a row nobody categorised, and it is carried
      here as itself rather than as a category named after it. */
  it('groups the rows holding no category under null', () => {
    let after = spend(household, '2026-07', { amount: 40000 })
    after = spend(after, '2026-07', { name: 'Odds and ends', category: null, amount: 500 })

    expect(spendingByCategory(monthOf(after, '2026-07'))).toEqual([
      { category: home, amount: 40000 },
      { category: null, amount: 500 },
    ])
  })

  it('reports a Month whose every row is uncategorised as one uncategorised total', () => {
    let after = spend(household, '2026-07', { category: null, amount: 40000 })
    after = spend(after, '2026-07', { name: 'Market', category: null, amount: 12000 })

    expect(spendingByCategory(monthOf(after, '2026-07'))).toEqual([
      { category: null, amount: 52000 },
    ])
  })

  /** A composite's amount is derived from its lines, and a Line has no category of its
      own: the whole of it lands under the parent's category, as one row. */
  it('counts a composite under its parent’s category, at its derived total', () => {
    let after = spend(household, '2026-07', { name: 'Market', category: food, amount: 10000 })
    const row = monthOf(after, '2026-07').expenses[0]!
    after = itemiseExpense(after, '2026-07', row.id).household
    after = addLineItem(after, '2026-07', row.id, { name: 'Bread', amount: 2500 }).household

    expect(spendingByCategory(monthOf(after, '2026-07'))).toEqual([
      { category: food, amount: 12500 },
    ])
  })

  /**
   * A Pending row contributes nothing, exactly as it does to `householdExpenseTotal`, so
   * the figure understates rather than treating the cost as free. The category itself is
   * still named — the Household did spend under it, and how much is not yet entered.
   */
  it('counts a Pending Expense as nothing, keeping the category it names', () => {
    let after = spend(household, '2026-07', { amount: 40000 })
    after = spend(after, '2026-07', { name: 'Market', category: food, amount: null })

    expect(spendingByCategory(monthOf(after, '2026-07'))).toEqual([
      { category: home, amount: 40000 },
      { category: food, amount: 0 },
    ])
  })

  it('has nothing to say about a Month with no Expenses', () => {
    expect(spendingByCategory(monthOf(household, '2026-07'))).toEqual([])
  })
})

describe('what moved against the Previous Month, by category', () => {
  /** Every Month here is opened explicitly, so that the gap cases are the record's own
      rather than an artefact of inheritance. */
  const opened = (of: Household, key: string): Household => openMonth(of, key as Month['key'])

  it('reports the rise and the fall in each category', () => {
    let after = spend(household, '2026-07', { amount: 40000 })
    after = spend(after, '2026-07', { name: 'Market', category: food, amount: 20000 })
    after = opened(after, '2026-08')
    // Inherited from July, then corrected: Home up, Food down.
    after = correct(after, '2026-08', 'Rent', 45000)
    after = correct(after, '2026-08', 'Market', 5000)

    expect(spendingChangeByCategory(after, '2026-08')).toEqual({
      from: '2026-07',
      to: '2026-08',
      changes: [
        { category: home, before: 40000, after: 45000, change: 5000 },
        { category: food, before: 20000, after: 5000, change: -15000 },
      ],
    })
  })

  /** The Previous Month is the most recent *opened* one, which after a gap is not the
      preceding calendar month. */
  it('compares against the most recent opened Month, across a gap', () => {
    let after = spend(household, '2026-07', { amount: 40000 })
    after = opened(after, '2026-10')

    expect(spendingChangeByCategory(after, '2026-10')?.from).toBe('2026-07')
  })

  it('reads a category the Previous Month had and this one has not as a fall to nothing', () => {
    let after = spend(household, '2026-07', { name: 'Market', category: food, amount: 20000 })
    after = opened(after, '2026-08')
    after = removeExpenseSnapshot(after, '2026-08', rowNamed(after, '2026-08', 'Market').id)

    expect(spendingChangeByCategory(after, '2026-08')?.changes).toEqual([
      { category: food, before: 20000, after: 0, change: -20000 },
    ])
  })

  it('reads a category only this Month has as a rise from nothing', () => {
    let after = opened(household, '2026-08')
    after = spend(after, '2026-08', { name: 'Market', category: food, amount: 20000 })

    expect(spendingChangeByCategory(after, '2026-08')?.changes).toEqual([
      { category: food, before: 0, after: 20000, change: 20000 },
    ])
  })

  it('reports a category that did not move, so that a caller can say it did not', () => {
    let after = spend(household, '2026-07', { amount: 40000 })
    after = opened(after, '2026-08')

    expect(spendingChangeByCategory(after, '2026-08')?.changes).toEqual([
      { category: home, before: 40000, after: 40000, change: 0 },
    ])
  })

  it('reports the uncategorised rows as a group of their own', () => {
    let after = spend(household, '2026-07', { category: null, amount: 40000 })
    after = opened(after, '2026-08')
    after = correct(after, '2026-08', 'Rent', 41000)

    expect(spendingChangeByCategory(after, '2026-08')?.changes).toEqual([
      { category: null, before: 40000, after: 41000, change: 1000 },
    ])
  })

  /** The Household's first Month has nothing behind it, so there is no comparison to
      draw rather than a comparison against zero. */
  it('has nothing to say for a Month with no Previous Month', () => {
    expect(spendingChangeByCategory(household, '2026-07')).toBeUndefined()
  })

  it('has nothing to say for a Month nobody opened', () => {
    const after = spend(household, '2026-07', { amount: 40000 })

    expect(spendingChangeByCategory(after, '2026-09')).toBeUndefined()
  })
})
