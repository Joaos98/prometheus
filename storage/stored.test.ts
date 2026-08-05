import { describe, expect, it } from 'vitest'
import type { Household } from '../domain/index.js'
import { fromStored } from './stored.js'

/**
 * A Household as v1.2 wrote it: every field of the day, and no `lines` key anywhere,
 * because Line Items did not exist. This is what every adapter reads back today.
 */
const asStoredByV12 = (): Household =>
  ({
    currency: { code: 'EUR', symbol: '€', decimals: 2 },
    roster: [{ id: 'ana', name: 'Ana', active: true }],
    months: {
      '2026-07': {
        key: '2026-07',
        members: ['ana'],
        income: [
          {
            id: 'salary',
            name: 'Salary',
            member: 'ana',
            amount: 400000,
            restrictedUse: false,
            reviewed: true,
            oneOff: false,
          },
        ],
        expenses: [
          {
            id: 'rent',
            name: 'Rent',
            category: 'Home',
            amount: 120000,
            participants: ['ana'],
            splitRule: { kind: 'even' },
            reviewed: true,
            oneOff: false,
          },
          {
            id: 'water',
            name: 'Water',
            category: 'Home',
            amount: null,
            participants: ['ana'],
            splitRule: { kind: 'even' },
            reviewed: false,
            oneOff: false,
          },
        ],
        goals: [],
      },
    },
  }) as unknown as Household

describe('a Household read out of storage', () => {
  it('gives every Expense stored before Line Items existed an empty list', () => {
    const read = fromStored(asStoredByV12())

    expect(read.months['2026-07']!.expenses.map((row) => row.lines)).toEqual([[], []])
  })

  it('leaves a Pending Expense Pending — an absent list is not an absent amount', () => {
    const read = fromStored(asStoredByV12())

    const water = read.months['2026-07']!.expenses[1]!
    expect(water.amount).toBeNull()
    expect(water.lines).toEqual([])
  })

  it('changes nothing else about the row', () => {
    const stored = asStoredByV12()

    const read = fromStored(stored)

    const rent = read.months['2026-07']!.expenses[0]!
    expect(rent).toEqual({
      ...stored.months['2026-07']!.expenses[0],
      lines: [],
      category: null,
      paymentMethod: null,
    })
  })

  it('gives a Household with no `categories` key an empty vocabulary', () => {
    const read = fromStored(asStoredByV12())

    expect(read.categories).toEqual([])
  })

  it('discards every Expense’s old free-text category rather than minting one from it', () => {
    const read = fromStored(asStoredByV12())

    expect(read.months['2026-07']!.expenses.map((row) => row.category)).toEqual([null, null])
  })

  it('leaves a v2 Household’s categories exactly as they are, ids and all', () => {
    const stored = asStoredByV12()
    const v2 = { ...stored, categories: [{ id: 'home', name: 'Home' }] }
    v2.months['2026-07']!.expenses[0]!.category = 'home'

    const read = fromStored(v2)

    expect(read.categories).toEqual([{ id: 'home', name: 'Home' }])
    expect(read.months['2026-07']!.expenses[0]!.category).toBe('home')
  })

  it('gives a Household with no `paymentMethods` key an empty vocabulary', () => {
    const read = fromStored(asStoredByV12())

    expect(read.paymentMethods).toEqual([])
  })

  it('sets every Expense’s payment method to null when the Household predates it', () => {
    const read = fromStored(asStoredByV12())

    expect(read.months['2026-07']!.expenses.map((row) => row.paymentMethod)).toEqual([null, null])
  })

  it('leaves a Household’s payment methods exactly as they are, ids and all', () => {
    const stored = asStoredByV12()
    const withMethods = { ...stored, paymentMethods: [{ id: 'card', name: 'Card' }] }
    withMethods.months['2026-07']!.expenses[0]!.paymentMethod = 'card'

    const read = fromStored(withMethods)

    expect(read.paymentMethods).toEqual([{ id: 'card', name: 'Card' }])
    expect(read.months['2026-07']!.expenses[0]!.paymentMethod).toBe('card')
  })

  /**
   * A Household that already chose categories but predates payment methods, which is
   * every Household stored by tickets 05–08 of spec 0004 before this one: the two
   * vocabularies are told apart independently, and one being legacy does not touch the
   * other.
   */
  it('defaults only payment methods on a Household that already has categories', () => {
    const stored = asStoredByV12()
    const withCategories = { ...stored, categories: [{ id: 'home', name: 'Home' }] }
    withCategories.months['2026-07']!.expenses[0]!.category = 'home'

    const read = fromStored(withCategories)

    expect(read.categories).toEqual([{ id: 'home', name: 'Home' }])
    expect(read.months['2026-07']!.expenses[0]!.category).toBe('home')
    expect(read.paymentMethods).toEqual([])
    expect(read.months['2026-07']!.expenses[0]!.paymentMethod).toBeNull()
  })

  it('leaves the lines of a Household that already has them exactly as they are', () => {
    const stored = asStoredByV12()
    const lines = [{ id: 'fruit', name: 'Fruit', amount: 1200 }]
    stored.months['2026-07']!.expenses[0]!.lines = lines

    const read = fromStored(stored)

    expect(read.months['2026-07']!.expenses[0]!.lines).toBe(lines)
  })

  it('leaves income, goals, the Roster and the currency untouched', () => {
    const stored = asStoredByV12()

    const read = fromStored(stored)

    expect(read.currency).toEqual(stored.currency)
    expect(read.roster).toEqual(stored.roster)
    expect(read.months['2026-07']!.income).toEqual(stored.months['2026-07']!.income)
    expect(read.months['2026-07']!.goals).toEqual([])
  })

  it('carries every Month across', () => {
    const stored = asStoredByV12()
    stored.months['2026-08'] = { ...stored.months['2026-07']!, key: '2026-08' }

    expect(Object.keys(fromStored(stored).months)).toEqual(['2026-07', '2026-08'])
  })
})
