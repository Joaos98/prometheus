import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot } from './expenses.js'
import { addSavingsGoal, recordContribution } from './goals.js'
import { addIncomeSnapshot } from './income.js'
import { setUpHousehold } from './household.js'
import { leftoverBalanceOf, leftoverBalancesOf } from './leftover.js'
import { monthAt } from './month.js'
import type { Household, MemberId, Month } from './types.js'

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

const monthOf = (of: Household): Month => monthAt(of, '2026-07')!

describe('a Leftover Balance', () => {
  it('is Spendable Income minus Shares minus Contributions', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 100000,
    }).household
    after = addExpenseSnapshot(after, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 40000,
      participants: [ana, bruno],
    }).household

    const balance = leftoverBalanceOf(monthOf(after), ana)

    expect(balance).toEqual({
      member: ana,
      spendableIncome: 100000,
      totalIncome: 100000,
      shares: 20000,
      contributions: 0,
      balance: 80000,
      incomplete: false,
    })
  })

  it('may be negative — Shares can outrun Spendable Income', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 10000,
    }).household
    after = addExpenseSnapshot(after, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 40000,
      participants: [ana, bruno],
    }).household

    expect(leftoverBalanceOf(monthOf(after), ana).balance).toBe(-10000)
  })

  it('excludes Restricted-Use Income, which never counts as Spendable', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 100000,
    }).household
    after = addIncomeSnapshot(after, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 20000,
      restrictedUse: true,
    }).household

    expect(leftoverBalanceOf(monthOf(after), ana).spendableIncome).toBe(100000)
  })

  it('carries total Income, Restricted-Use included, alongside Spendable Income', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 100000,
    }).household
    after = addIncomeSnapshot(after, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 20000,
      restrictedUse: true,
    }).household

    const balance = leftoverBalanceOf(monthOf(after), ana)

    expect(balance.spendableIncome).toBe(100000)
    expect(balance.totalIncome).toBe(120000)
  })

  it('sums Shares across every Expense the member participates in', () => {
    let after = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 30000,
      participants: [ana, bruno],
    }).household
    after = addExpenseSnapshot(after, '2026-07', {
      name: 'Internet',
      category: 'Home',
      amount: 6000,
      participants: [ana, bruno],
    }).household

    expect(leftoverBalanceOf(monthOf(after), ana).shares).toBe(18000)
  })

  it('counts nothing for an Expense the member does not participate in', () => {
    const after = addExpenseSnapshot(household, '2026-07', {
      name: 'Bruno’s gym',
      category: 'Health',
      amount: 5000,
      participants: [bruno],
    }).household

    expect(leftoverBalanceOf(monthOf(after), ana).shares).toBe(0)
  })

  it('subtracts what the member contributed to the Month’s Savings Goals', () => {
    let after = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 100000,
    }).household
    const { household: withGoal, row } = addSavingsGoal(after, '2026-07', {
      name: 'Holiday',
      target: 200000,
      participants: [ana, bruno],
    })
    after = recordContribution(withGoal, '2026-07', row.id, ana, 15000).household

    const balance = leftoverBalanceOf(monthOf(after), ana)

    expect(balance.contributions).toBe(15000)
    expect(balance.balance).toBe(85000)
  })

  it('counts nothing for a goal the member has contributed nothing to', () => {
    const after = addSavingsGoal(household, '2026-07', {
      name: 'Holiday',
      participants: [ana, bruno],
    }).household

    expect(leftoverBalanceOf(monthOf(after), ana).contributions).toBe(0)
  })

  it('counts nothing for another member’s Contribution', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', {
      name: 'Holiday',
      participants: [ana, bruno],
    })
    const after = recordContribution(withGoal, '2026-07', row.id, bruno, 15000).household

    expect(leftoverBalanceOf(monthOf(after), ana).contributions).toBe(0)
  })

  it('never carries into a later Month — it is computed fresh from that Month’s own rows', () => {
    expect(monthAt(household, '2026-07')).toBeDefined()
    expect(monthAt(household, '2026-08')).toBeUndefined()
  })

  describe('a Pending row', () => {
    it('contributes nothing to the balance, and flags the balance as incomplete', () => {
      const after = addIncomeSnapshot(household, '2026-07', {
        name: 'Bonus',
        member: ana,
        amount: null,
      }).household

      const balance = leftoverBalanceOf(monthOf(after), ana)

      expect(balance.spendableIncome).toBe(0)
      expect(balance.incomplete).toBe(true)
    })

    it('flags incomplete when a Pending Expense includes the member', () => {
      const after = addExpenseSnapshot(household, '2026-07', {
        name: 'Rent',
        category: 'Home',
        amount: null,
        participants: [ana, bruno],
      }).household

      expect(leftoverBalanceOf(monthOf(after), ana).incomplete).toBe(true)
    })

    it('does not flag a member left untouched by another member’s Pending row', () => {
      const after = addIncomeSnapshot(household, '2026-07', {
        name: 'Bonus',
        member: bruno,
        amount: null,
      }).household

      expect(leftoverBalanceOf(monthOf(after), ana).incomplete).toBe(false)
    })

    it('does not flag incomplete for a Pending Restricted-Use row, since it never counts anyway', () => {
      const after = addIncomeSnapshot(household, '2026-07', {
        name: 'Meal vouchers',
        member: ana,
        amount: null,
        restrictedUse: true,
      }).household

      expect(leftoverBalanceOf(monthOf(after), ana).incomplete).toBe(false)
    })
  })
})

describe('the Leftover Balances of a Month', () => {
  it('gives one Balance per member, in the Month’s own member order', () => {
    const balances = leftoverBalancesOf(monthOf(household))

    expect(balances.map((balance) => balance.member)).toEqual([ana, bruno])
  })
})
