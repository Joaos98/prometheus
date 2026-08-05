import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCategory,
  categoryUsage,
  clearCategory,
  deleteCategory,
  renameCategory,
} from './categories.js'
import { driftOf } from './drift.js'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { DomainError } from './errors.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { withMonth } from './rows.js'
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

describe('deleting a category', () => {
  it('removes one no row references, leaving every other category alone', () => {
    const added = addCategory(addCategory(household, 'Groceries'), 'Utilities')
    const groceries = added.categories[0]!.id

    const after = deleteCategory(added, groceries)

    expect(after.categories.map((category) => category.name)).toEqual(['Utilities'])
  })

  it('changes no row', () => {
    const added = addCategory(addCategory(household, 'Groceries'), 'Utilities')
    const groceries = added.categories[0]!.id
    const utilities = added.categories[1]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Electricity',
      category: utilities,
      amount: 8000,
      participants: [ana, bruno],
    })

    const after = deleteCategory(withExpense, groceries)

    expect(after.months).toEqual(withExpense.months)
  })

  it('will not delete a category the Household does not have', () => {
    expect(() => deleteCategory(household, 'not-a-category')).toThrow(DomainError)
  })

  it('refuses one in use, naming the rows and the Months it would cost', () => {
    const added = addCategory(household, 'Groceries')
    const groceries = added.categories[0]!.id
    const { household: first } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: groceries,
      amount: 30000,
      participants: [ana, bruno],
    })
    /** July's two rows are inherited by August and September: six rows across three Months. */
    const { household: second } = addExpenseSnapshot(first, '2026-07', {
      name: 'Butcher',
      category: groceries,
      amount: 5000,
      participants: [ana, bruno],
    })
    const opened = openMonth(openMonth(second, '2026-08'), '2026-09')

    expect(() => deleteCategory(opened, groceries)).toThrow(
      '"Groceries" is used by 6 rows across 3 Months, July 2026 – September 2026 — ' +
        'clear it before deleting it',
    )
  })

  it('says a single Month plainly rather than as a range', () => {
    const added = addCategory(household, 'Groceries')
    const groceries = added.categories[0]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: groceries,
      amount: 30000,
      participants: [ana, bruno],
    })

    expect(() => deleteCategory(withExpense, groceries)).toThrow(
      '"Groceries" is used by 1 row in July 2026 — clear it before deleting it',
    )
  })
})

describe('clearing a category from the record', () => {
  /** Groceries on one row, Utilities on another, and a third categorised as nothing. */
  function threeRows(): { household: Household; groceries: string; utilities: string } {
    const added = addCategory(addCategory(household, 'Groceries'), 'Utilities')
    const groceries = added.categories[0]!.id
    const utilities = added.categories[1]!.id
    const { household: first } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: groceries,
      amount: 30000,
      participants: [ana, bruno],
    })
    const { household: second } = addExpenseSnapshot(first, '2026-07', {
      name: 'Electricity',
      category: utilities,
      amount: 8000,
      participants: [ana, bruno],
    })
    const { household: third } = addExpenseSnapshot(second, '2026-07', {
      name: 'Bus fare',
      category: null,
      amount: 1000,
      participants: [ana, bruno],
    })
    return { household: openMonth(third, '2026-08'), groceries, utilities }
  }

  /** July cleared and August not, as a store that stopped answering halfway would leave it. */
  function halfCleared(household: Household, id: string): Household {
    const july = monthAt(household, '2026-07')!
    return withMonth(household, {
      ...july,
      expenses: july.expenses.map((expense) =>
        expense.category === id ? { ...expense, category: null } : expense,
      ),
    })
  }

  it('takes it off every referencing row in every Month', () => {
    const { household: record, groceries } = threeRows()

    const { household: after } = clearCategory(record, groceries)

    for (const key of ['2026-07', '2026-08'] as const) {
      const supermarket = monthAt(after, key)!.expenses[0]!
      expect(supermarket.name).toBe('Supermarket')
      expect(supermarket.category).toBeNull()
    }
  })

  it('hands back each cleared row and the Month it belongs to, so each can be written', () => {
    const { household: record, groceries } = threeRows()

    const { rows } = clearCategory(record, groceries)

    expect(rows.map((cleared) => [cleared.month, cleared.row.name])).toEqual([
      ['2026-07', 'Supermarket'],
      ['2026-08', 'Supermarket'],
    ])
    expect(rows.every((cleared) => cleared.row.category === null)).toBe(true)
  })

  it('leaves a row holding a different category, and one holding none, exactly as they were', () => {
    const { household: record, groceries } = threeRows()
    const before = monthAt(record, '2026-07')!.expenses

    const { household: after } = clearCategory(record, groceries)

    const july = monthAt(after, '2026-07')!.expenses
    expect(july[1]).toEqual(before[1])
    expect(july[2]).toEqual(before[2])
  })

  it('changes no field of a cleared row but the category', () => {
    const { household: record, groceries } = threeRows()
    const before = monthAt(record, '2026-07')!.expenses[0]!

    const { household: after } = clearCategory(record, groceries)

    expect(monthAt(after, '2026-07')!.expenses[0]).toEqual({ ...before, category: null })
  })

  it('leaves the category itself in the vocabulary, for the delete that follows', () => {
    const { household: record, groceries } = threeRows()

    const { household: after } = clearCategory(record, groceries)

    expect(after.categories.map((category) => category.id)).toContain(groceries)
    expect(() => deleteCategory(after, groceries)).not.toThrow()
  })

  it('will not clear a category the Household does not have', () => {
    expect(() => clearCategory(household, 'not-a-category')).toThrow(DomainError)
  })

  /**
   * The clear is not an edit, so it answers for nothing. A deletion quietly marking rows in
   * eleven Months as reviewed would corrupt the one number a monthly review is run against.
   */
  it('leaves every cleared row’s reviewed mark exactly as it found it, in every Month', () => {
    const { household: record, groceries } = threeRows()
    const before = ['2026-07', '2026-08'].map(
      (key) => monthAt(record, key)!.expenses.map((expense) => expense.reviewed),
    )
    expect(before).toEqual([
      [true, true, true],
      [false, false, false],
    ])

    const { household: after } = clearCategory(record, groceries)

    expect(
      ['2026-07', '2026-08'].map((key) =>
        monthAt(after, key)!.expenses.map((expense) => expense.reviewed),
      ),
    ).toEqual(before)
  })

  /**
   * Drift weighs what a Month holds against what opening it now would produce, both read
   * off the household as it stands. A complete clear moves the two together, so a Month
   * opened ahead of time has still missed nothing.
   */
  it('produces no category Drift in a Month opened ahead of time', () => {
    const { household: record, groceries } = threeRows()
    const opened = openMonth(record, '2026-09')

    const { household: after } = clearCategory(opened, groceries)

    expect(driftOf(after, '2026-08', '2026-07').rows).toEqual([])
    expect(driftOf(after, '2026-09', '2026-07').rows).toEqual([])
  })

  /** What the previous test is worth: a Month opened ahead can report this difference. */
  it('shows category Drift while the clear is only half applied', () => {
    const { household: record, groceries } = threeRows()

    const partly = halfCleared(record, groceries)

    expect(driftOf(partly, '2026-08', '2026-07').rows[0]?.fields).toEqual(['category'])
  })

  it('finishes a clear that was only partly applied, and reports only what was left', () => {
    const { household: record, groceries } = threeRows()
    const partly = halfCleared(record, groceries)

    const { household: after, rows } = clearCategory(partly, groceries)

    expect(rows.map((cleared) => cleared.month)).toEqual(['2026-08'])
    expect(categoryUsage(after, groceries)).toEqual({ rowCount: 0, months: [] })
    expect(() => deleteCategory(after, groceries)).not.toThrow()
  })

  it('leaves a half-cleared category undeletable', () => {
    const { household: record, groceries } = threeRows()

    expect(() => deleteCategory(halfCleared(record, groceries), groceries)).toThrow(DomainError)
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
