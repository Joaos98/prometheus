import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot, confirmExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot, confirmIncomeSnapshot, editIncomeSnapshot } from './income.js'
import { monthAt, openMonth } from './month.js'
import { isReviewed, unreviewedCount } from './review.js'
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

describe('a row recorded fresh in this Month', () => {
  it('is reviewed from the start — there is nothing copied for a member to have missed', () => {
    const { row: income } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })
    const { row: expense } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

    expect(isReviewed(income)).toBe(true)
    expect(isReviewed(expense)).toBe(true)
  })
})

describe('opening a Month', () => {
  it('marks every copied row Unreviewed', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    }).household

    const august = openMonth(july, '2026-08')

    expect(isReviewed(monthAt(august, '2026-08')!.expenses[0]!)).toBe(false)
  })
})

describe('editing a row', () => {
  it('clears the Unreviewed mark inheritance set', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.income[0]!
    expect(isReviewed(row)).toBe(false)

    const edited = editIncomeSnapshot(august, '2026-08', row.id, { amount: 330000 })

    expect(isReviewed(edited.row)).toBe(true)
  })

  it('leaves an already reviewed row reviewed', () => {
    const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

    const edited = editExpenseSnapshot(after, '2026-07', row.id, { amount: 125000 })

    expect(isReviewed(edited.row)).toBe(true)
  })
})

describe('confirming a row', () => {
  it('clears the Unreviewed mark of an income row without changing any other field', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
      restrictedUse: true,
    }).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.income[0]!

    const confirmed = confirmIncomeSnapshot(august, '2026-08', row.id)

    expect(confirmed.row).toEqual({ ...row, reviewed: true })
  })

  it('clears the Unreviewed mark of an Expense without changing any other field', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    }).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.expenses[0]!

    const confirmed = confirmExpenseSnapshot(august, '2026-08', row.id)

    expect(confirmed.row).toEqual({ ...row, reviewed: true })
  })
})

describe('the count of Unreviewed rows', () => {
  it('is nothing for a Month with no rows', () => {
    expect(unreviewedCount(monthAt(household, '2026-07')!)).toBe(0)
  })

  it('is nothing for a Month whose rows were all recorded fresh', () => {
    const after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household

    expect(unreviewedCount(monthAt(after, '2026-07')!)).toBe(0)
  })

  it('counts every inherited row across income, Expenses and Goals', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    const withExpense = addExpenseSnapshot(july, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    }).household

    const august = openMonth(withExpense, '2026-08')

    expect(unreviewedCount(monthAt(august, '2026-08')!)).toBe(2)
  })

  it('reaches zero once every row has been edited or confirmed', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    const withExpense = addExpenseSnapshot(july, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    }).household
    const august = openMonth(withExpense, '2026-08')
    const month = monthAt(august, '2026-08')!

    const incomeConfirmed = confirmIncomeSnapshot(august, '2026-08', month.income[0]!.id)
    const allDone = editExpenseSnapshot(
      incomeConfirmed.household,
      '2026-08',
      month.expenses[0]!.id,
      { amount: 125000 },
    )

    expect(unreviewedCount(monthAt(allDone.household, '2026-08')!)).toBe(0)
  })
})
