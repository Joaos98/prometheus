import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import { setUpHousehold } from './household.js'
import {
  addIncomeSnapshot,
  editIncomeSnapshot,
  markIncomeOneOff,
  removeIncomeSnapshot,
  spendableIncome,
  unmarkIncomeOneOff,
} from './income.js'
import { monthAt, openMonth } from './month.js'
import { isOneOff, isPending } from './rows.js'
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

const incomeIn = (of: Household, month = '2026-07') => monthAt(of, month)!.income

describe('recording income', () => {
  it('records one named source, the member it belongs to, its amount and its use', () => {
    const { household: after } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
      restrictedUse: false,
    })

    expect(incomeIn(after)).toEqual([
      {
        id: expect.any(String),
        name: 'Salary',
        member: ana,
        amount: 320000,
        restrictedUse: false,
        reviewed: true,
        oneOff: false,
      },
    ])
  })

  it('records a second source for the same member as its own row', () => {
    const first = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    const after = addIncomeSnapshot(first, '2026-07', {
      name: 'Saturday market',
      member: ana,
      amount: 18000,
    }).household

    expect(incomeIn(after).map((row) => row.name)).toEqual(['Salary', 'Saturday market'])
  })

  it('gives each row a stable identity of its own', () => {
    const first = addIncomeSnapshot(household, '2026-07', { name: 'Salary', member: ana, amount: 1 })
    const second = addIncomeSnapshot(first.household, '2026-07', {
      name: 'Salary',
      member: bruno,
      amount: 1,
    })

    expect(second.row.id).not.toBe(first.row.id)
  })

  it('needs a name — income is recorded one named source at a time', () => {
    expect(() =>
      addIncomeSnapshot(household, '2026-07', { name: '  ', member: ana, amount: 1000 }),
    ).toThrow(DomainError)
  })

  it('belongs to a member of that Month', () => {
    expect(() =>
      addIncomeSnapshot(household, '2026-07', {
        name: 'Salary',
        member: 'somebody-else',
        amount: 1000,
      }),
    ).toThrow(DomainError)
  })

  it('cannot be recorded on a Month that has not been opened', () => {
    expect(() =>
      addIncomeSnapshot(household, '2026-08', { name: 'Salary', member: ana, amount: 1000 }),
    ).toThrow(DomainError)
  })

  it('leaves the Household it was given untouched', () => {
    addIncomeSnapshot(household, '2026-07', { name: 'Salary', member: ana, amount: 1000 })

    expect(incomeIn(household)).toEqual([])
  })

  it('is Restricted-Use only when it is said to be', () => {
    const { row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 1000,
    })

    expect(row.restrictedUse).toBe(false)
  })

  it('refuses an amount that is not whole minor units', () => {
    expect(() =>
      addIncomeSnapshot(household, '2026-07', { name: 'Salary', member: ana, amount: 12.5 }),
    ).toThrow(DomainError)
  })
})

describe('an amount', () => {
  it('may be nothing at all, and that row is Pending', () => {
    const { row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Bonus',
      member: ana,
      amount: null,
    })

    expect(row.amount).toBeNull()
    expect(isPending(row)).toBe(true)
  })

  it('may be an explicit zero, which is an answer and not Pending', () => {
    const { row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Commission',
      member: ana,
      amount: 0,
    })

    expect(row.amount).toBe(0)
    expect(isPending(row)).toBe(false)
  })

  it('may be negative — a correction against a source', () => {
    const { row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Overpayment returned',
      member: ana,
      amount: -5000,
    })

    expect(row.amount).toBe(-5000)
  })
})

describe('Spendable Income', () => {
  it('is the sum of that member’s income for the Month', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    after = addIncomeSnapshot(after, '2026-07', {
      name: 'Saturday market',
      member: ana,
      amount: 18000,
    }).household

    expect(spendableIncome(monthAt(after, '2026-07')!, ana)).toBe(338000)
  })

  it('excludes Restricted-Use Income, which never counts toward what can be spent', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household
    after = addIncomeSnapshot(after, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 22000,
      restrictedUse: true,
    }).household

    expect(spendableIncome(monthAt(after, '2026-07')!, ana)).toBe(320000)
  })

  it('counts a Pending row as nothing, since no amount was entered', () => {
    const after = addIncomeSnapshot(household, '2026-07', {
      name: 'Bonus',
      member: ana,
      amount: null,
    }).household

    expect(spendableIncome(monthAt(after, '2026-07')!, ana)).toBe(0)
  })

  it('counts only the member’s own rows', () => {
    const after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    }).household

    expect(spendableIncome(monthAt(after, '2026-07')!, bruno)).toBe(0)
  })

  it('is nothing for a member with no income at all', () => {
    expect(spendableIncome(monthAt(household, '2026-07')!, ana)).toBe(0)
  })
})

describe('editing income', () => {
  it('changes the amount of the row it names', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })

    const edited = editIncomeSnapshot(after, '2026-07', row.id, { amount: 335000 })

    expect(incomeIn(edited.household)[0]!.amount).toBe(335000)
  })

  it('leaves the fields it does not name alone', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 22000,
      restrictedUse: true,
    })

    const edited = editIncomeSnapshot(after, '2026-07', row.id, { amount: 24000 })

    expect(edited.row).toEqual({ ...row, amount: 24000 })
  })

  it('sets an amount back to nothing, making the row Pending again', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Bonus',
      member: ana,
      amount: 50000,
    })

    const edited = editIncomeSnapshot(after, '2026-07', row.id, { amount: null })

    expect(isPending(edited.row)).toBe(true)
  })

  it('flags a source Restricted-Use, taking it out of Spendable Income from then on', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 22000,
    })

    const edited = editIncomeSnapshot(after, '2026-07', row.id, { restrictedUse: true })

    expect(spendableIncome(monthAt(edited.household, '2026-07')!, ana)).toBe(0)
  })

  it('changes the Month it names and no other', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })
    const augustOpened = openMonth(july.household, '2026-08')
    const august = addIncomeSnapshot(augustOpened, '2026-08', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })

    const edited = editIncomeSnapshot(august.household, '2026-07', july.row.id, { amount: 100 })

    expect(incomeIn(edited.household, '2026-07')[0]!.amount).toBe(100)
    expect(incomeIn(edited.household, '2026-08')[0]!.amount).toBe(320000)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => editIncomeSnapshot(household, '2026-07', 'no-such-row', { amount: 1 })).toThrow(
      DomainError,
    )
  })

  it('refuses a name of nothing', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 1,
    })

    expect(() => editIncomeSnapshot(after, '2026-07', row.id, { name: '' })).toThrow(DomainError)
  })
})

describe('marking income One-Off', () => {
  it('is not One-Off when recorded fresh', () => {
    const { row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })

    expect(isOneOff(row)).toBe(false)
  })

  it('marks a row One-Off without changing any other field', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Bonus',
      member: ana,
      amount: 50000,
    })

    const marked = markIncomeOneOff(after, '2026-07', row.id)

    expect(marked.row).toEqual({ ...row, oneOff: true })
  })

  it('clears the One-Off mark, so the row recurs again', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Bonus',
      member: ana,
      amount: 50000,
    })
    const marked = markIncomeOneOff(after, '2026-07', row.id)

    const unmarked = unmarkIncomeOneOff(marked.household, '2026-07', row.id)

    expect(isOneOff(unmarked.row)).toBe(false)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => markIncomeOneOff(household, '2026-07', 'no-such-row')).toThrow(DomainError)
  })
})

describe('removing income', () => {
  it('takes the row out of the Month', () => {
    const { household: after, row } = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })

    const removed = removeIncomeSnapshot(after, '2026-07', row.id)

    expect(incomeIn(removed)).toEqual([])
  })

  it('leaves the other sources where they are', () => {
    const salary = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })
    const vouchers = addIncomeSnapshot(salary.household, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 22000,
      restrictedUse: true,
    })

    const removed = removeIncomeSnapshot(vouchers.household, '2026-07', salary.row.id)

    expect(incomeIn(removed).map((row) => row.name)).toEqual(['Meal vouchers'])
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => removeIncomeSnapshot(household, '2026-07', 'no-such-row')).toThrow(DomainError)
  })
})
