import { beforeEach, describe, expect, it } from 'vitest'
import { addCategory, categoryUsage, renameCategory } from './categories.js'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { DomainError } from './errors.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import type { Household, MemberId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ana = household.roster[0]!.id
  bruno = household.roster[1]!.id
})

describe('a freshly set-up Household', () => {
  it('has no categories', () => {
    expect(household.categories).toEqual([])
  })
})

describe('adding a category', () => {
  it('mints an identity and adds it to the vocabulary', () => {
    const after = addCategory(household, 'Groceries')

    expect(after.categories).toHaveLength(1)
    expect(after.categories[0]!.name).toBe('Groceries')
    expect(after.categories[0]!.id).toBeTruthy()
  })

  it('gives two categories distinct identities', () => {
    const after = addCategory(addCategory(household, 'Groceries'), 'Utilities')

    expect(after.categories[0]!.id).not.toBe(after.categories[1]!.id)
  })

  it('will not add a category with no name', () => {
    expect(() => addCategory(household, '  ')).toThrow(DomainError)
  })

  it('refuses a second category of the same name', () => {
    const after = addCategory(household, 'Groceries')

    expect(() => addCategory(after, 'Groceries')).toThrow(DomainError)
  })

  it('treats two names as the same regardless of case', () => {
    const after = addCategory(household, 'Groceries')

    expect(() => addCategory(after, 'groceries')).toThrow(DomainError)
  })
})

describe('renaming a category', () => {
  it('changes the name and nothing about the identity', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id

    const renamed = renameCategory(added, id, 'Food')

    expect(renamed.categories[0]!.id).toBe(id)
    expect(renamed.categories[0]!.name).toBe('Food')
  })

  it('relabels what every Month renders, past Months included, without touching a row', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id
    const { household: withExpense, row } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: id,
      amount: 30000,
      participants: [ana, bruno],
    })
    const before = monthAt(withExpense, '2026-07')!.expenses[0]!

    const renamed = renameCategory(withExpense, id, 'Food')

    const after = monthAt(renamed, '2026-07')!.expenses[0]!
    expect(after).toEqual(before)
    expect(renamed.categories[0]!.name).toBe('Food')
    expect(row.category).toBe(id)
  })

  it('will not rename a category the Household does not have', () => {
    expect(() => renameCategory(household, 'not-a-category', 'Food')).toThrow(DomainError)
  })

  it('will not rename to an empty name', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id

    expect(() => renameCategory(added, id, '  ')).toThrow(DomainError)
  })

  it('refuses a rename that collides with another category', () => {
    const added = addCategory(addCategory(household, 'Groceries'), 'Utilities')
    const utilities = added.categories[1]!.id

    expect(() => renameCategory(added, utilities, 'Groceries')).toThrow(DomainError)
  })

  it('allows renaming a category to the name it already has', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id

    expect(() => renameCategory(added, id, 'Groceries')).not.toThrow()
  })
})

describe('where a category is used', () => {
  it('reports no rows and no Months for one nobody references', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id

    expect(categoryUsage(added, id)).toEqual({ rowCount: 0, months: [] })
  })

  it('counts the rows and names the Months across the whole record', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id

    const first = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: id,
      amount: 30000,
      participants: [ana, bruno],
    })
    const second = addExpenseSnapshot(first.household, '2026-07', {
      name: 'Butcher',
      category: id,
      amount: 5000,
      participants: [ana, bruno],
    })
    const opened = openMonth(second.household, '2026-08')

    expect(categoryUsage(opened, id)).toEqual({ rowCount: 4, months: ['2026-07', '2026-08'] })
  })

  it('does not count an Expense holding a different category, or none at all', () => {
    const added = addCategory(addCategory(household, 'Groceries'), 'Utilities')
    const groceries = added.categories[0]!.id
    const utilities = added.categories[1]!.id

    const { household: after } = addExpenseSnapshot(added, '2026-07', {
      name: 'Electricity',
      category: utilities,
      amount: 8000,
      participants: [ana, bruno],
    })
    const { household: withUncategorised } = addExpenseSnapshot(after, '2026-07', {
      name: 'Something',
      category: null,
      amount: 1000,
      participants: [ana, bruno],
    })

    expect(categoryUsage(withUncategorised, groceries)).toEqual({ rowCount: 0, months: [] })
  })
})

describe('setting a category on an Expense', () => {
  it('goes through the edit path and sets reviewed, as any edit does', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id
    const { household: withExpense, row } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      amount: 30000,
      participants: [ana, bruno],
    })
    const opened = openMonth(withExpense, '2026-08')
    const inherited = monthAt(opened, '2026-08')!.expenses[0]!
    expect(inherited.reviewed).toBe(false)

    const { row: edited } = editExpenseSnapshot(opened, '2026-08', row.id, { category: id })

    expect(edited.category).toBe(id)
    expect(edited.reviewed).toBe(true)
  })
})

describe('inheritance', () => {
  it('carries an Expense’s category id unchanged into a Month opened from it', () => {
    const added = addCategory(household, 'Groceries')
    const id = added.categories[0]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: id,
      amount: 30000,
      participants: [ana, bruno],
    })

    const opened = openMonth(withExpense, '2026-08')

    expect(monthAt(opened, '2026-08')!.expenses[0]!.category).toBe(id)
  })
})
