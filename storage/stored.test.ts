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
    expect(rent).toEqual({ ...stored.months['2026-07']!.expenses[0], lines: [] })
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
