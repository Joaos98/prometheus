import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { addSavingsGoal, recordContribution } from './goals.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot } from './income.js'
import { monthAt, openMonth } from './month.js'
import { isPending } from './rows.js'
import type { Household, MemberId, MonthKey } from './types.js'

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
  ;[ana, bruno] = household.roster.map((member) => member.id) as [MemberId, MemberId]
})

const incomeIn = (of: Household, month: MonthKey) => monthAt(of, month)!.income
const expensesIn = (of: Household, month: MonthKey) => monthAt(of, month)!.expenses

describe('opening a Month inherits the Previous Month’s income', () => {
  it('copies every income row, field for field', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 250000,
      restrictedUse: false,
    }).household

    const august = openMonth(july, '2026-08')

    expect(incomeIn(august, '2026-08')).toEqual(
      incomeIn(july, '2026-07').map((row) => ({ ...row, reviewed: false })),
    )
  })

  it('carries the Restricted-Use flag across, so vouchers stay restricted', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Meal vouchers',
      member: ana,
      amount: 15000,
      restrictedUse: true,
    }).household

    const august = openMonth(july, '2026-08')

    expect(incomeIn(august, '2026-08')[0]!.restrictedUse).toBe(true)
  })
})

describe('opening a Month inherits the Previous Month’s Expenses', () => {
  it('copies every Expense Snapshot, field for field', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
      splitRule: { kind: 'proportional' },
    }).household

    const august = openMonth(july, '2026-08')

    expect(expensesIn(august, '2026-08')).toEqual(
      expensesIn(july, '2026-07').map((row) => ({ ...row, reviewed: false })),
    )
  })

  it('brings the Participants and the Split Rule with it', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Groceries',
      category: 'Home',
      amount: 40000,
      participants: [ana, bruno],
      splitRule: { kind: 'fixed', byMember: { [ana]: 25000, [bruno]: 15000 } },
    }).household

    const inherited = expensesIn(openMonth(july, '2026-08'), '2026-08')[0]!

    expect(inherited.participants).toEqual([ana, bruno])
    expect(inherited.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 25000, [bruno]: 15000 },
    })
  })
})

describe('an inherited row', () => {
  const rentIn = (of: Household) =>
    addExpenseSnapshot(of, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    })

  it('keeps the stable identity of the row it came from', () => {
    const july = rentIn(household)
    const salary = addIncomeSnapshot(july.household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 250000,
    })

    const august = openMonth(salary.household, '2026-08')

    expect(expensesIn(august, '2026-08')[0]!.id).toBe(july.row.id)
    expect(incomeIn(august, '2026-08')[0]!.id).toBe(salary.row.id)
  })

  it('is changed only in the Month it is in, though the two share an identity', () => {
    const july = rentIn(household)
    const august = openMonth(july.household, '2026-08')

    const edit = editExpenseSnapshot(august, '2026-08', july.row.id, { amount: 125000 })
    const raised = edit.household

    expect(expensesIn(raised, '2026-08')[0]!.amount).toBe(125000)
    expect(expensesIn(raised, '2026-07')[0]!.amount).toBe(120000)
  })

  it('carries a Savings Goal across, identity intact', () => {
    const withGoal = addSavingsGoal(household, '2026-07', {
      name: 'Holiday',
      target: 200000,
      startAmount: 50000,
      participants: [ana],
    }).household
    const july = monthAt(withGoal, '2026-07')!.goals[0]!

    const august = openMonth(withGoal, '2026-08')

    expect(monthAt(august, '2026-08')!.goals).toEqual([
      { ...july, contributions: {}, reviewed: false },
    ])
  })

  it('leaves a goal’s Contributions behind — what was put in was put in that Month', () => {
    let withGoal = addSavingsGoal(household, '2026-07', {
      name: 'Holiday',
      participants: [ana],
    }).household
    const id = monthAt(withGoal, '2026-07')!.goals[0]!.id
    withGoal = recordContribution(withGoal, '2026-07', id, ana, 25000).household

    const august = openMonth(withGoal, '2026-08')

    expect(monthAt(august, '2026-08')!.goals[0]!.contributions).toEqual({})
    expect(monthAt(august, '2026-07')!.goals[0]!.contributions).toEqual({ [ana]: 25000 })
  })
})

describe('the Month that is inherited from', () => {
  const salaryIn = (of: Household, month: string, amount: number) =>
    addIncomeSnapshot(of, month, { name: 'Salary', member: ana, amount }).household

  /** March and July opened, each with its own salary, and April to June left as a gap. */
  const marchAndJuly = (): Household => {
    const march = salaryIn(openMonth(household, '2026-03'), '2026-03', 250000)
    return salaryIn(march, '2026-07', 300000)
  }

  it('is the nearest opened Month, so a gap does not force a Month to start empty', () => {
    const june = openMonth(marchAndJuly(), '2026-06')

    expect(incomeIn(june, '2026-06').map((row) => row.amount)).toEqual([250000])
  })

  it('is the Month before a Month opened in the past, not the Month after it', () => {
    const may = openMonth(marchAndJuly(), '2026-05')

    expect(incomeIn(may, '2026-05').map((row) => row.amount)).toEqual([250000])
  })

  it('is the Previous Month for a Month opened far into the future', () => {
    const march = openMonth(marchAndJuly(), '2027-03')

    expect(incomeIn(march, '2027-03').map((row) => row.amount)).toEqual([300000])
  })

  it('is left exactly as it was, since opening changes nothing behind it', () => {
    const july = salaryIn(household, '2026-07', 250000)

    const august = openMonth(july, '2026-08')

    expect(incomeIn(august, '2026-07')).toEqual(incomeIn(july, '2026-07'))
  })
})

describe('a Month that is not the latest', () => {
  it('is still editable — there is no closing action and nothing becomes read-only', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })
    const later = openMonth(openMonth(july.household, '2026-08'), '2026-09')

    const edit = editExpenseSnapshot(later, '2026-07', july.row.id, { amount: 118000 })

    expect(expensesIn(edit.household, '2026-07')[0]!.amount).toBe(118000)
  })
})

describe('a Pending row', () => {
  it('is inherited Pending, so the next Month does not pretend the cost was nothing', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: null,
      participants: [ana],
    }).household

    const inherited = expensesIn(openMonth(july, '2026-08'), '2026-08')[0]!

    expect(inherited.amount).toBeNull()
    expect(isPending(inherited)).toBe(true)
  })

  it('is distinct from an explicit zero, which is inherited as the answer it is', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: 0,
      participants: [ana],
    }).household

    const inherited = expensesIn(openMonth(july, '2026-08'), '2026-08')[0]!

    expect(inherited.amount).toBe(0)
    expect(isPending(inherited)).toBe(false)
  })
})
