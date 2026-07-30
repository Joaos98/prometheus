import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import { addExpenseSnapshot, editExpenseSnapshot, removeExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { renamingAsks, repurposeExpenseSnapshot } from './repurposing.js'
import type { Household, MemberId, MonthKey, RowId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId

/** July holds Netflix; August is opened from it, so August's row is inherited. */
let netflix: RowId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ;[ana, bruno] = household.roster.map((member) => member.id) as [MemberId, MemberId]

  const added = addExpenseSnapshot(household, '2026-07', {
    name: 'Netflix',
    category: 'Leisure',
    amount: 1200,
    participants: [ana, bruno],
  })
  netflix = added.row.id
  household = openMonth(added.household, '2026-08')
})

const expensesIn = (of: Household, month: MonthKey) => monthAt(of, month)!.expenses
const idsIn = (of: Household, month: MonthKey) => expensesIn(of, month).map((row) => row.id)
const namesIn = (of: Household, month: MonthKey) => expensesIn(of, month).map((row) => row.name)

describe('whether renaming asks', () => {
  it('asks when an inherited Expense Snapshot is renamed', () => {
    expect(renamingAsks(household, '2026-08', netflix, 'Gym')).toBe(true)
  })

  it('does not ask for a row created in this Month, which has no thread behind it', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-08', {
      name: 'Dentist',
      category: 'Health',
      amount: 8000,
      participants: [ana],
    })

    expect(renamingAsks(after, '2026-08', row.id, 'Optician')).toBe(false)
  })

  it('does not ask when the name is not being changed, so a category edit passes quietly', () => {
    expect(renamingAsks(household, '2026-08', netflix, 'Netflix')).toBe(false)
  })

  it('does not ask when only the surrounding whitespace differs', () => {
    expect(renamingAsks(household, '2026-08', netflix, '  Netflix  ')).toBe(false)
  })

  it('does not ask in the Household’s first Month, which inherited nothing', () => {
    expect(renamingAsks(household, '2026-07', netflix, 'Gym')).toBe(false)
  })

  it('asks across a gap, since the Previous Month need not be the preceding one', () => {
    const october = openMonth(household, '2026-10')
    const inherited = expensesIn(october, '2026-10')[0]!

    expect(renamingAsks(october, '2026-10', inherited.id, 'Gym')).toBe(true)
  })

  it('still asks once the name already differs from the Previous Month’s', () => {
    const renamed = editExpenseSnapshot(household, '2026-08', netflix, { name: 'Netflix Premium' })

    expect(renamingAsks(renamed.household, '2026-08', netflix, 'Gym')).toBe(true)
  })

  it('does not ask about a row the Month does not hold', () => {
    expect(renamingAsks(household, '2026-08', 'no-such-row', 'Gym')).toBe(false)
  })

  it('does not ask about a Month that has not been opened', () => {
    expect(renamingAsks(household, '2026-09', netflix, 'Gym')).toBe(false)
  })

  it('does not ask about a row the Previous Month no longer shares an identity with', () => {
    const dropped = removeExpenseSnapshot(household, '2026-07', netflix)

    expect(renamingAsks(dropped, '2026-08', netflix, 'Gym')).toBe(false)
  })
})

describe('continuing the Expense', () => {
  it('keeps the identity, so the row stays part of the same thread across Months', () => {
    const { household: after } = editExpenseSnapshot(household, '2026-08', netflix, { name: 'Gym' })

    expect(idsIn(after, '2026-07')).toEqual([netflix])
    expect(idsIn(after, '2026-08')).toEqual([netflix])
    expect(namesIn(after, '2026-08')).toEqual(['Gym'])
  })
})

describe('repurposing the Expense', () => {
  it('mints a new identity for the row in this Month', () => {
    const { household: after, row } = repurposeExpenseSnapshot(household, '2026-08', netflix, {
      name: 'Gym',
      amount: 4000,
    })

    expect(row.id).not.toBe(netflix)
    expect(idsIn(after, '2026-08')).toEqual([row.id])
    expect(row).toMatchObject({ name: 'Gym', amount: 4000 })
  })

  it('ends the old thread at the Previous Month, which keeps the cost it recorded', () => {
    const { household: after } = repurposeExpenseSnapshot(household, '2026-08', netflix, {
      name: 'Gym',
      amount: 4000,
    })

    expect(expensesIn(after, '2026-07')).toEqual([
      expect.objectContaining({ id: netflix, name: 'Netflix', amount: 1200 }),
    ])
  })

  it('carries the new identity into the later Months that inherited the old one', () => {
    const september = openMonth(household, '2026-09')

    const { household: after, row } = repurposeExpenseSnapshot(september, '2026-08', netflix, {
      name: 'Gym',
      amount: 4000,
    })

    expect(idsIn(after, '2026-09')).toEqual([row.id])
  })

  it('leaves the later Months’ own fields alone, since only the thread has changed', () => {
    const september = openMonth(household, '2026-09')

    const { household: after } = repurposeExpenseSnapshot(september, '2026-08', netflix, {
      name: 'Gym',
      amount: 4000,
    })

    expect(expensesIn(after, '2026-09')[0]).toMatchObject({ name: 'Netflix', amount: 1200 })
  })

  it('stops where the thread had already ended, leaving a later unrelated row alone', () => {
    const september = openMonth(household, '2026-09')
    const withoutNetflix = removeExpenseSnapshot(september, '2026-09', netflix)
    const october = openMonth(withoutNetflix, '2026-10')

    const { household: after } = repurposeExpenseSnapshot(october, '2026-08', netflix, {
      name: 'Gym',
      amount: 4000,
    })

    expect(idsIn(after, '2026-09')).toEqual([])
    expect(idsIn(after, '2026-10')).toEqual([])
  })

  it('refuses a row created in this Month, which has no thread behind it to end', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-08', {
      name: 'Dentist',
      category: 'Health',
      amount: 8000,
      participants: [ana],
    })

    expect(() =>
      repurposeExpenseSnapshot(after, '2026-08', row.id, { name: 'Optician' }),
    ).toThrow(DomainError)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() =>
      repurposeExpenseSnapshot(household, '2026-08', 'no-such-row', { name: 'Gym' }),
    ).toThrow(DomainError)
  })

  it('refuses a Month that has not been opened', () => {
    expect(() =>
      repurposeExpenseSnapshot(household, '2026-09', netflix, { name: 'Gym' }),
    ).toThrow(DomainError)
  })

  it('judges the row whole, as any other write does', () => {
    expect(() => repurposeExpenseSnapshot(household, '2026-08', netflix, { name: '  ' })).toThrow(
      DomainError,
    )
    expect(() =>
      repurposeExpenseSnapshot(household, '2026-08', netflix, {
        name: 'Gym',
        splitRule: { kind: 'percentage', byMember: { [ana]: 40, [bruno]: 40 } },
      }),
    ).toThrow(DomainError)
  })

  it('leaves the Household it was given untouched', () => {
    repurposeExpenseSnapshot(household, '2026-08', netflix, { name: 'Gym', amount: 4000 })

    expect(idsIn(household, '2026-08')).toEqual([netflix])
    expect(namesIn(household, '2026-08')).toEqual(['Netflix'])
  })

  it('mints the identity rather than deriving it, so no two threads can meet again', () => {
    const first = repurposeExpenseSnapshot(household, '2026-08', netflix, { name: 'Gym' })
    const second = repurposeExpenseSnapshot(household, '2026-08', netflix, { name: 'Gym' })

    expect(first.row.id).not.toBe(second.row.id)
  })

  it('leaves the repurposed row this Month’s own, with nothing further to ask about', () => {
    const { household: after, row } = repurposeExpenseSnapshot(household, '2026-08', netflix, {
      name: 'Gym',
    })

    expect(renamingAsks(after, '2026-08', row.id, 'Pool')).toBe(false)
    expect(() => repurposeExpenseSnapshot(after, '2026-08', row.id, { name: 'Pool' })).toThrow(
      DomainError,
    )
  })
})
