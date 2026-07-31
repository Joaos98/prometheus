import { beforeEach, describe, expect, it } from 'vitest'
import {
  addExpenseSnapshot,
  editExpenseSnapshot,
  markExpenseOneOff,
  removeExpenseSnapshot,
} from './expenses.js'
import { addSavingsGoal, markGoalOneOff, recordContribution } from './goals.js'
import { deactivateMember, setUpHousehold } from './household.js'
import { addIncomeSnapshot, markIncomeOneOff } from './income.js'
import { monthAt, openMonth } from './month.js'
import { unreviewedCount } from './review.js'
import { isOneOff, isPending } from './rows.js'
import { sharesOf } from './shares.js'
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
const goalsIn = (of: Household, month: MonthKey) => monthAt(of, month)!.goals

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

describe('a row naming somebody who has left the Roster', () => {
  const withoutBruno = (of: Household): Household => deactivateMember(of, bruno)

  it('leaves an income row of theirs behind — it belongs to nobody here', () => {
    const july = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: bruno,
      amount: 250000,
    }).household

    const august = openMonth(withoutBruno(july), '2026-08')

    expect(incomeIn(august, '2026-08')).toEqual([])
  })

  it('divides an Expense among the Participants who are members here', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
    }).household

    const august = openMonth(withoutBruno(july), '2026-08')

    expect(expensesIn(august, '2026-08')[0]!.participants).toEqual([ana])
  })

  it('keeps that Expense’s Shares totalling the Expense', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
      splitRule: { kind: 'fixed', byMember: { [ana]: 50000, [bruno]: 70000 } },
    }).household

    const august = monthAt(openMonth(withoutBruno(july), '2026-08'), '2026-08')!
    const shares = sharesOf(august, august.expenses[0]!)

    expect(shares.reduce((total, share) => total + share.amount, 0)).toBe(120000)
  })

  it('divides evenly when their figure was part of a rule that no longer adds up', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
      splitRule: { kind: 'percentage', byMember: { [ana]: 40, [bruno]: 60 } },
    }).household

    const august = openMonth(withoutBruno(july), '2026-08')

    expect(expensesIn(august, '2026-08')[0]!.splitRule).toEqual({ kind: 'even' })
  })

  it('keeps a rule that still adds up without them, and drops their figure from it', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana, bruno],
      splitRule: { kind: 'fixed', byMember: { [ana]: 120000, [bruno]: 0 } },
    }).household

    const august = openMonth(withoutBruno(july), '2026-08')

    expect(expensesIn(august, '2026-08')[0]!.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 120000 },
    })
  })

  it('leaves behind an Expense that was theirs alone, which stops recurring', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Gym',
      category: 'Health',
      amount: 4000,
      participants: [bruno],
    }).household

    const august = openMonth(withoutBruno(july), '2026-08')

    expect(expensesIn(august, '2026-08')).toEqual([])
  })

  it('leaves no row behind that the Month cannot show or anybody confirm', () => {
    const salary = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: bruno,
      amount: 250000,
    }).household
    const july = addExpenseSnapshot(salary, '2026-07', {
      name: 'Gym',
      category: 'Health',
      amount: 4000,
      participants: [bruno],
    }).household

    const august = monthAt(openMonth(withoutBruno(july), '2026-08'), '2026-08')!

    expect(august.income.every((row) => august.members.includes(row.member))).toBe(true)
    expect(
      august.expenses.every((row) =>
        row.participants.every((member) => august.members.includes(member)),
      ),
    ).toBe(true)
    expect(unreviewedCount(august)).toBe(0)
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

describe('a row marked One-Off', () => {
  it('is not inherited when the next Month opens', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    })
    const marked = markExpenseOneOff(july.household, '2026-07', july.row.id).household

    const august = openMonth(marked, '2026-08')

    expect(expensesIn(august, '2026-08')).toEqual([])
    expect(expensesIn(august, '2026-07')).toHaveLength(1)
  })

  it('leaves every other row of the Month inherited as usual', () => {
    const rent = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })
    const repair = addExpenseSnapshot(rent.household, '2026-07', {
      name: 'Repair',
      category: 'Home',
      amount: 40000,
      participants: [ana],
    })
    const marked = markExpenseOneOff(repair.household, '2026-07', repair.row.id).household

    const august = openMonth(marked, '2026-08')

    expect(expensesIn(august, '2026-08').map((row) => row.name)).toEqual(['Rent'])
  })

  it('is how a long-running income row stops recurring while keeping its final Month intact', () => {
    const salary = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member: ana,
      amount: 320000,
    })
    const marked = markIncomeOneOff(salary.household, '2026-07', salary.row.id).household

    const august = openMonth(marked, '2026-08')

    expect(incomeIn(marked, '2026-07')).toHaveLength(1)
    expect(incomeIn(august, '2026-08')).toEqual([])
  })

  it('applies the same way to a Savings Goal', () => {
    const goal = addSavingsGoal(household, '2026-07', {
      name: 'Holiday',
      target: 200000,
      participants: [ana],
    })
    const marked = markGoalOneOff(goal.household, '2026-07', goal.row.id).household

    const august = openMonth(marked, '2026-08')

    expect(goalsIn(august, '2026-08')).toEqual([])
  })

  it('does not carry the One-Off mark itself onto anything', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    }).household

    const inherited = expensesIn(openMonth(july, '2026-08'), '2026-08')[0]!

    expect(isOneOff(inherited)).toBe(false)
  })
})

describe('a row removed from a Month', () => {
  it('means later Months opened afterwards inherit its absence', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })
    const removed = removeExpenseSnapshot(july.household, '2026-07', july.row.id)

    const august = openMonth(removed, '2026-08')

    expect(expensesIn(august, '2026-08')).toEqual([])
  })

  it('leaves earlier Months untouched', () => {
    const july = addExpenseSnapshot(household, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [ana],
    })
    const august = openMonth(july.household, '2026-08')

    const removed = removeExpenseSnapshot(august, '2026-08', july.row.id)

    expect(expensesIn(removed, '2026-07')).toHaveLength(1)
  })
})
