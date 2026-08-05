import { beforeEach, describe, expect, it } from 'vitest'
import { addCategory } from './categories.js'
import { driftOf } from './drift.js'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { DomainError } from './errors.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import {
  addPaymentMethod,
  clearPaymentMethod,
  deletePaymentMethod,
  paymentMethodUsage,
  renamePaymentMethod,
} from './payment-methods.js'
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
  it('has no payment methods', () => {
    expect(household.paymentMethods).toEqual([])
  })
})

describe('adding a payment method', () => {
  it('mints an identity and adds it to the vocabulary', () => {
    const after = addPaymentMethod(household, 'Card')

    expect(after.paymentMethods).toHaveLength(1)
    expect(after.paymentMethods[0]!.name).toBe('Card')
    expect(after.paymentMethods[0]!.id).toBeTruthy()
  })

  it('gives two payment methods distinct identities', () => {
    const after = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')

    expect(after.paymentMethods[0]!.id).not.toBe(after.paymentMethods[1]!.id)
  })

  it('will not add a payment method with no name', () => {
    expect(() => addPaymentMethod(household, '  ')).toThrow(DomainError)
  })

  it('refuses a second payment method of the same name', () => {
    const after = addPaymentMethod(household, 'Card')

    expect(() => addPaymentMethod(after, 'Card')).toThrow(DomainError)
  })

  it('treats two names as the same regardless of case', () => {
    const after = addPaymentMethod(household, 'Card')

    expect(() => addPaymentMethod(after, 'card')).toThrow(DomainError)
  })
})

describe('renaming a payment method', () => {
  it('changes the name and nothing about the identity', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id

    const renamed = renamePaymentMethod(added, id, 'Credit card')

    expect(renamed.paymentMethods[0]!.id).toBe(id)
    expect(renamed.paymentMethods[0]!.name).toBe('Credit card')
  })

  it('relabels what every Month renders, past Months included, without touching a row', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id
    const { household: withExpense, row } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: id,
      amount: 30000,
      participants: [ana, bruno],
    })
    const before = monthAt(withExpense, '2026-07')!.expenses[0]!

    const renamed = renamePaymentMethod(withExpense, id, 'Credit card')

    const after = monthAt(renamed, '2026-07')!.expenses[0]!
    expect(after).toEqual(before)
    expect(renamed.paymentMethods[0]!.name).toBe('Credit card')
    expect(row.paymentMethod).toBe(id)
  })

  it('will not rename a payment method the Household does not have', () => {
    expect(() => renamePaymentMethod(household, 'not-a-method', 'Credit card')).toThrow(
      DomainError,
    )
  })

  it('will not rename to an empty name', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id

    expect(() => renamePaymentMethod(added, id, '  ')).toThrow(DomainError)
  })

  it('refuses a rename that collides with another payment method', () => {
    const added = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')
    const cash = added.paymentMethods[1]!.id

    expect(() => renamePaymentMethod(added, cash, 'Card')).toThrow(DomainError)
  })

  it('allows renaming a payment method to the name it already has', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id

    expect(() => renamePaymentMethod(added, id, 'Card')).not.toThrow()
  })
})

describe('where a payment method is used', () => {
  it('reports no rows and no Months for one nobody references', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id

    expect(paymentMethodUsage(added, id)).toEqual({ rowCount: 0, months: [] })
  })

  it('counts the rows and names the Months across the whole record', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id

    const first = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: id,
      amount: 30000,
      participants: [ana, bruno],
    })
    const second = addExpenseSnapshot(first.household, '2026-07', {
      name: 'Butcher',
      category: null,
      paymentMethod: id,
      amount: 5000,
      participants: [ana, bruno],
    })
    const opened = openMonth(second.household, '2026-08')

    expect(paymentMethodUsage(opened, id)).toEqual({ rowCount: 4, months: ['2026-07', '2026-08'] })
  })

  it('does not count an Expense holding a different payment method, or none at all', () => {
    const added = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')
    const card = added.paymentMethods[0]!.id
    const cash = added.paymentMethods[1]!.id

    const { household: after } = addExpenseSnapshot(added, '2026-07', {
      name: 'Electricity',
      category: null,
      paymentMethod: cash,
      amount: 8000,
      participants: [ana, bruno],
    })
    const { household: withUnset } = addExpenseSnapshot(after, '2026-07', {
      name: 'Something',
      category: null,
      paymentMethod: null,
      amount: 1000,
      participants: [ana, bruno],
    })

    expect(paymentMethodUsage(withUnset, card)).toEqual({ rowCount: 0, months: [] })
  })
})

describe('deleting a payment method', () => {
  it('removes one no row references, leaving every other payment method alone', () => {
    const added = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')
    const card = added.paymentMethods[0]!.id

    const after = deletePaymentMethod(added, card)

    expect(after.paymentMethods.map((method) => method.name)).toEqual(['Cash'])
  })

  it('changes no row', () => {
    const added = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')
    const card = added.paymentMethods[0]!.id
    const cash = added.paymentMethods[1]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Electricity',
      category: null,
      paymentMethod: cash,
      amount: 8000,
      participants: [ana, bruno],
    })

    const after = deletePaymentMethod(withExpense, card)

    expect(after.months).toEqual(withExpense.months)
  })

  it('will not delete a payment method the Household does not have', () => {
    expect(() => deletePaymentMethod(household, 'not-a-method')).toThrow(DomainError)
  })

  it('refuses one in use, naming the rows and the Months it would cost', () => {
    const added = addPaymentMethod(household, 'Card')
    const card = added.paymentMethods[0]!.id
    const { household: first } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: card,
      amount: 30000,
      participants: [ana, bruno],
    })
    /** July's two rows are inherited by August and September: six rows across three Months. */
    const { household: second } = addExpenseSnapshot(first, '2026-07', {
      name: 'Butcher',
      category: null,
      paymentMethod: card,
      amount: 5000,
      participants: [ana, bruno],
    })
    const opened = openMonth(openMonth(second, '2026-08'), '2026-09')

    expect(() => deletePaymentMethod(opened, card)).toThrow(
      '"Card" is used by 6 rows across 3 Months, July 2026 – September 2026 — ' +
        'clear it before deleting it',
    )
  })

  it('says a single Month plainly rather than as a range', () => {
    const added = addPaymentMethod(household, 'Card')
    const card = added.paymentMethods[0]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: card,
      amount: 30000,
      participants: [ana, bruno],
    })

    expect(() => deletePaymentMethod(withExpense, card)).toThrow(
      '"Card" is used by 1 row in July 2026 — clear it before deleting it',
    )
  })
})

describe('clearing a payment method from the record', () => {
  /** Card on one row, Cash on another, and a third with nothing chosen. */
  function threeRows(): { household: Household; card: string; cash: string } {
    const added = addPaymentMethod(addPaymentMethod(household, 'Card'), 'Cash')
    const card = added.paymentMethods[0]!.id
    const cash = added.paymentMethods[1]!.id
    const { household: first } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: card,
      amount: 30000,
      participants: [ana, bruno],
    })
    const { household: second } = addExpenseSnapshot(first, '2026-07', {
      name: 'Electricity',
      category: null,
      paymentMethod: cash,
      amount: 8000,
      participants: [ana, bruno],
    })
    const { household: third } = addExpenseSnapshot(second, '2026-07', {
      name: 'Bus fare',
      category: null,
      paymentMethod: null,
      amount: 1000,
      participants: [ana, bruno],
    })
    return { household: openMonth(third, '2026-08'), card, cash }
  }

  /** July cleared and August not, as a store that stopped answering halfway would leave it. */
  function halfCleared(household: Household, id: string): Household {
    const july = monthAt(household, '2026-07')!
    return withMonth(household, {
      ...july,
      expenses: july.expenses.map((expense) =>
        expense.paymentMethod === id ? { ...expense, paymentMethod: null } : expense,
      ),
    })
  }

  it('takes it off every referencing row in every Month', () => {
    const { household: record, card } = threeRows()

    const { household: after } = clearPaymentMethod(record, card)

    for (const key of ['2026-07', '2026-08'] as const) {
      const supermarket = monthAt(after, key)!.expenses[0]!
      expect(supermarket.name).toBe('Supermarket')
      expect(supermarket.paymentMethod).toBeNull()
    }
  })

  it('hands back each cleared row and the Month it belongs to, so each can be written', () => {
    const { household: record, card } = threeRows()

    const { rows } = clearPaymentMethod(record, card)

    expect(rows.map((cleared) => [cleared.month, cleared.row.name])).toEqual([
      ['2026-07', 'Supermarket'],
      ['2026-08', 'Supermarket'],
    ])
    expect(rows.every((cleared) => cleared.row.paymentMethod === null)).toBe(true)
  })

  it('leaves a row holding a different payment method, and one holding none, exactly as they were', () => {
    const { household: record, card } = threeRows()
    const before = monthAt(record, '2026-07')!.expenses

    const { household: after } = clearPaymentMethod(record, card)

    const july = monthAt(after, '2026-07')!.expenses
    expect(july[1]).toEqual(before[1])
    expect(july[2]).toEqual(before[2])
  })

  it('changes no field of a cleared row but the payment method', () => {
    const { household: record, card } = threeRows()
    const before = monthAt(record, '2026-07')!.expenses[0]!

    const { household: after } = clearPaymentMethod(record, card)

    expect(monthAt(after, '2026-07')!.expenses[0]).toEqual({ ...before, paymentMethod: null })
  })

  it('leaves the payment method itself in the vocabulary, for the delete that follows', () => {
    const { household: record, card } = threeRows()

    const { household: after } = clearPaymentMethod(record, card)

    expect(after.paymentMethods.map((method) => method.id)).toContain(card)
    expect(() => deletePaymentMethod(after, card)).not.toThrow()
  })

  it('will not clear a payment method the Household does not have', () => {
    expect(() => clearPaymentMethod(household, 'not-a-method')).toThrow(DomainError)
  })

  /**
   * The clear is not an edit, so it answers for nothing. A deletion quietly marking rows in
   * eleven Months as reviewed would corrupt the one number a monthly review is run against.
   */
  it('leaves every cleared row’s reviewed mark exactly as it found it, in every Month', () => {
    const { household: record, card } = threeRows()
    const before = ['2026-07', '2026-08'].map(
      (key) => monthAt(record, key)!.expenses.map((expense) => expense.reviewed),
    )
    expect(before).toEqual([
      [true, true, true],
      [false, false, false],
    ])

    const { household: after } = clearPaymentMethod(record, card)

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
  it('produces no payment method Drift in a Month opened ahead of time', () => {
    const { household: record, card } = threeRows()
    const opened = openMonth(record, '2026-09')

    const { household: after } = clearPaymentMethod(opened, card)

    expect(driftOf(after, '2026-08', '2026-07').rows).toEqual([])
    expect(driftOf(after, '2026-09', '2026-07').rows).toEqual([])
  })

  /** What the previous test is worth: a Month opened ahead can report this difference. */
  it('shows payment method Drift while the clear is only half applied', () => {
    const { household: record, card } = threeRows()

    const partly = halfCleared(record, card)

    expect(driftOf(partly, '2026-08', '2026-07').rows[0]?.fields).toEqual(['paymentMethod'])
  })

  it('finishes a clear that was only partly applied, and reports only what was left', () => {
    const { household: record, card } = threeRows()
    const partly = halfCleared(record, card)

    const { household: after, rows } = clearPaymentMethod(partly, card)

    expect(rows.map((cleared) => cleared.month)).toEqual(['2026-08'])
    expect(paymentMethodUsage(after, card)).toEqual({ rowCount: 0, months: [] })
    expect(() => deletePaymentMethod(after, card)).not.toThrow()
  })

  it('leaves a half-cleared payment method undeletable', () => {
    const { household: record, card } = threeRows()

    expect(() => deletePaymentMethod(halfCleared(record, card), card)).toThrow(DomainError)
  })
})

describe('setting a payment method on an Expense', () => {
  it('goes through the edit path and sets reviewed, as any edit does', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id
    const { household: withExpense, row } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: null,
      amount: 30000,
      participants: [ana, bruno],
    })
    const opened = openMonth(withExpense, '2026-08')
    const inherited = monthAt(opened, '2026-08')!.expenses[0]!
    expect(inherited.reviewed).toBe(false)

    const { row: edited } = editExpenseSnapshot(opened, '2026-08', row.id, { paymentMethod: id })

    expect(edited.paymentMethod).toBe(id)
    expect(edited.reviewed).toBe(true)
  })
})

describe('inheritance', () => {
  it('carries an Expense’s payment method id unchanged into a Month opened from it', () => {
    const added = addPaymentMethod(household, 'Card')
    const id = added.paymentMethods[0]!.id
    const { household: withExpense } = addExpenseSnapshot(added, '2026-07', {
      name: 'Supermarket',
      category: null,
      paymentMethod: id,
      amount: 30000,
      participants: [ana, bruno],
    })

    const opened = openMonth(withExpense, '2026-08')

    expect(monthAt(opened, '2026-08')!.expenses[0]!.paymentMethod).toBe(id)
  })
})

describe('the two vocabularies stay independent', () => {
  it('lets an Expense hold a category, a payment method, both or neither', () => {
    const withBoth = addPaymentMethod(addCategory(household, 'Groceries'), 'Card')
    const category = withBoth.categories[0]!.id
    const method = withBoth.paymentMethods[0]!.id

    const { row } = addExpenseSnapshot(withBoth, '2026-07', {
      name: 'Supermarket',
      category,
      paymentMethod: method,
      amount: 30000,
      participants: [ana, bruno],
    })

    expect(row.category).toBe(category)
    expect(row.paymentMethod).toBe(method)
    // Minting one vocabulary's id never touches the other's list.
    expect(withBoth.paymentMethods.some((entry) => entry.id === category)).toBe(false)
    expect(withBoth.categories.some((entry) => entry.id === method)).toBe(false)
  })
})
