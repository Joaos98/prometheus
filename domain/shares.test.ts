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

const sum = (amounts: Minor[]): Minor => amounts.reduce((total, amount) => total + amount, 0)

describe('the Shares of an Expense', () => {
  it('give a single Participant the whole amount — this is how an individual cost is recorded', () => {
    const shares = sharesOf(month, expenseOf(4599, [ana]))

    expect(shares).toEqual([{ member: ana, amount: 4599 }])
  })

  it('divide an amount that splits cleanly into equal Shares', () => {
    const shares = sharesOf(month, expenseOf(9000, [ana, bruno, cleo]))

    expect(amountsOf(shares)).toEqual([3000, 3000, 3000])
  })

  it('sum to exactly the amount when it does not divide evenly', () => {
    const shares = sharesOf(month, expenseOf(10000, [ana, bruno, cleo]))

    expect(amountsOf(shares)).toEqual([3334, 3333, 3333])
    expect(sum(amountsOf(shares))).toBe(10000)
  })

  it('place the leftover cents one each, never all on the same Participant', () => {
    const shares = sharesOf(month, expenseOf(10001, [ana, bruno, cleo]))

    expect(amountsOf(shares)).toEqual([3334, 3334, 3333])
  })

  it('break the tie by the Month’s member order, whatever order the Participants were given in', () => {
    const shares = sharesOf(month, expenseOf(10000, [cleo, bruno, ana]))

    expect(shares).toEqual([
      { member: ana, amount: 3334 },
      { member: bruno, amount: 3333 },
      { member: cleo, amount: 3333 },
    ])
  })

  it('sum to exactly the amount for every amount and every number of Participants', () => {
    const everyone = [ana, bruno, cleo]

    for (let amount = 0; amount <= 500; amount++) {
      for (let count = 1; count <= everyone.length; count++) {
        const participants = everyone.slice(0, count)
        const total = sum(amountsOf(sharesOf(month, expenseOf(amount, participants))))
        expect(total, `${amount} among ${count}`).toBe(amount)
      }
    }
  })

  it('divide a negative amount exactly, as a correction against a cost', () => {
    const shares = sharesOf(month, expenseOf(-10000, [ana, bruno, cleo]))

    expect(amountsOf(shares)).toEqual([-3333, -3333, -3334])
    expect(sum(amountsOf(shares))).toBe(-10000)
  })

  it('never leave any Participant more than a cent from their exact share', () => {
    const shares = sharesOf(month, expenseOf(10000, [ana, bruno, cleo]))

    for (const share of shares) {
      expect(Math.abs(share.amount - 10000 / 3)).toBeLessThan(1)
    }
  })

  it('are the same twice over for the same Month data', () => {
    const expense = expenseOf(10000, [ana, bruno, cleo])

    expect(sharesOf(month, expense)).toEqual(sharesOf(month, expense))
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
