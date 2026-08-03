import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt } from './month.js'
import { sharesOf, splitOf } from './shares.js'
import type { ExpenseSnapshot, Household, MemberId, Minor, Month } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let month: Month
let ana: MemberId
let bruno: MemberId
let cleo: MemberId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno', 'Cleo'],
    startingMonth: '2026-07',
  })
  ;[ana, bruno, cleo] = household.roster.map((member) => member.id) as [
    MemberId,
    MemberId,
    MemberId,
  ]
  month = monthAt(household, '2026-07')!
})

/** An Expense as it would be recorded, so the Shares are read off real rows. */
function expenseOf(amount: Minor | null, participants: MemberId[]): ExpenseSnapshot {
  return addExpenseSnapshot(household, '2026-07', {
    name: 'Groceries',
    category: 'Home',
    amount,
    participants,
  }).row
}

const amountsOf = (shares: { amount: Minor }[]): Minor[] => shares.map((share) => share.amount)

describe('the Shares of an Expense', () => {
  it('give a single Participant the whole amount — this is how an individual cost is recorded', () => {
    const shares = sharesOf(month, expenseOf(4599, [ana]))

    expect(shares).toEqual([{ member: ana, amount: 4599 }])
  })

  it('divide an amount that splits cleanly into equal Shares', () => {
    const shares = sharesOf(month, expenseOf(9000, [ana, bruno, cleo]))

    expect(amountsOf(shares)).toEqual([3000, 3000, 3000])
  })

  it('break the tie by the Month’s member order, whatever order the Participants were given in', () => {
    const shares = sharesOf(month, expenseOf(10000, [cleo, bruno, ana]))

    expect(shares).toEqual([
      { member: ana, amount: 3334 },
      { member: bruno, amount: 3333 },
      { member: cleo, amount: 3333 },
    ])
  })

  it('are each zero for an Expense of zero, which is an answer', () => {
    const shares = sharesOf(month, expenseOf(0, [ana, bruno]))

    expect(amountsOf(shares)).toEqual([0, 0])
  })

  it('are nothing at all for a Pending Expense, which is not the same as costing nothing', () => {
    expect(sharesOf(month, expenseOf(null, [ana, bruno]))).toEqual([])
  })

  /**
   * No write path in the engine can produce a fixed rule that does not total its Expense.
   * One reaching here some other way — storage edited by hand, a file an import has yet to
   * learn to reject — must still not answer with Shares that come to less than the Expense.
   */
  it('still total the Expense when a fixed rule reaches them not adding up', () => {
    const malformed: ExpenseSnapshot = {
      ...expenseOf(120000, [ana, bruno]),
      splitRule: { kind: 'fixed', byMember: { [ana]: 50000 } },
    }

    const shares = sharesOf(month, malformed)

    expect(shares.reduce((total, share) => total + share.amount, 0)).toBe(120000)
    expect(splitOf(month, malformed).dividedEvenlyInstead).toBe(true)
  })

  it('read a fixed rule exactly as agreed, negative figures included', () => {
    const owed: ExpenseSnapshot = {
      ...expenseOf(120000, [ana, bruno]),
      splitRule: { kind: 'fixed', byMember: { [ana]: 140000, [bruno]: -20000 } },
    }

    expect(amountsOf(sharesOf(month, owed))).toEqual([140000, -20000])
  })
})
