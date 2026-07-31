import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import {
  addExpenseSnapshot,
  confirmExpenseSnapshot,
  editExpenseSnapshot,
  removeExpenseSnapshot,
} from './expenses.js'
import { addSavingsGoal, recordContribution } from './goals.js'
import { deactivateMember, setUpHousehold } from './household.js'
import { addIncomeSnapshot, confirmIncomeSnapshot } from './income.js'
import { monthAt, openedMonthKeys, openMonth } from './month.js'
import { propagateExpenseEdit, propagateGoalEdit, propagateIncomeEdit } from './propagation.js'
import { repurposeExpenseSnapshot } from './repurposing.js'
import { isReviewed } from './review.js'
import type { Household, MemberId, MonthKey, RowId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId

/** Rent and a salary recorded in July, with August and September opened from it. */
let rent: RowId
let salary: RowId
let holiday: RowId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ;[ana, bruno] = household.roster.map((member) => member.id) as [MemberId, MemberId]

  const withRent = addExpenseSnapshot(household, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount: 120000,
    participants: [ana, bruno],
  })
  rent = withRent.row.id

  const withSalary = addIncomeSnapshot(withRent.household, '2026-07', {
    name: 'Salary',
    member: ana,
    amount: 250000,
  })
  salary = withSalary.row.id

  const withGoal = addSavingsGoal(withSalary.household, '2026-07', {
    name: 'Holiday',
    target: 300000,
    participants: [ana, bruno],
  })
  holiday = withGoal.row.id

  household = openMonth(openMonth(withGoal.household, '2026-08'), '2026-09')
})

const rentIn = (of: Household, month: MonthKey) =>
  monthAt(of, month)!.expenses.find((row) => row.id === rent)
const salaryIn = (of: Household, month: MonthKey) =>
  monthAt(of, month)!.income.find((row) => row.id === salary)
const holidayIn = (of: Household, month: MonthKey) =>
  monthAt(of, month)!.goals.find((row) => row.id === holiday)

describe('propagating a correction forward', () => {
  it('replaces the value in every later opened Month still holding the copy', () => {
    const { household: after } = propagateExpenseEdit(household, '2026-07', rent, {
      amount: 125000,
    })

    expect(rentIn(after, '2026-08')!.amount).toBe(125000)
    expect(rentIn(after, '2026-09')!.amount).toBe(125000)
  })

  it('leaves what it replaced Unreviewed — it is a copy nobody has looked at yet', () => {
    const { household: after } = propagateExpenseEdit(household, '2026-07', rent, {
      amount: 125000,
    })

    expect(isReviewed(rentIn(after, '2026-08')!)).toBe(false)
  })

  it('leaves alone a value a member has edited, and says so', () => {
    const decided = editExpenseSnapshot(household, '2026-08', rent, { amount: 90000 }).household

    const { household: after, skipped } = propagateExpenseEdit(decided, '2026-07', rent, {
      amount: 125000,
    })

    expect(rentIn(after, '2026-08')!.amount).toBe(90000)
    expect(skipped).toContainEqual(expect.objectContaining({ month: '2026-08', reason: 'reviewed' }))
  })

  it('leaves alone a value a member has confirmed without editing it', () => {
    const confirmed = confirmExpenseSnapshot(household, '2026-08', rent).household

    const { household: after } = propagateExpenseEdit(confirmed, '2026-07', rent, {
      amount: 125000,
    })

    expect(rentIn(after, '2026-08')!.amount).toBe(120000)
  })

  it('reports the Months it changed, in calendar order', () => {
    const { changed } = propagateExpenseEdit(household, '2026-07', rent, { amount: 125000 })

    expect(changed).toEqual(['2026-08', '2026-09'])
  })

  it('accounts for every later opened Month, as either changed or skipped', () => {
    const decided = editExpenseSnapshot(household, '2026-08', rent, { amount: 90000 }).household

    const { changed, skipped } = propagateExpenseEdit(decided, '2026-07', rent, { amount: 125000 })

    expect([...changed, ...skipped.map((one) => one.month)].sort()).toEqual([
      '2026-08',
      '2026-09',
    ])
  })

  it('names the Month it skipped in the reason it gives for skipping it', () => {
    const decided = editExpenseSnapshot(household, '2026-08', rent, { amount: 90000 }).household

    const { skipped } = propagateExpenseEdit(decided, '2026-07', rent, { amount: 125000 })

    expect(skipped[0]!.because).toContain('August 2026')
  })

  it('reaches the Months after one that kept its own answer', () => {
    const decided = editExpenseSnapshot(household, '2026-08', rent, { amount: 90000 }).household

    const { household: after, changed } = propagateExpenseEdit(decided, '2026-07', rent, {
      amount: 125000,
    })

    expect(changed).toEqual(['2026-09'])
    expect(rentIn(after, '2026-09')!.amount).toBe(125000)
  })

  it('changes nothing in the Month the correction was made in', () => {
    const { household: after } = propagateExpenseEdit(household, '2026-07', rent, {
      amount: 125000,
    })

    expect(rentIn(after, '2026-07')!.amount).toBe(120000)
  })

  it('opens no Month that was not open — a Month not yet opened inherits instead', () => {
    const { household: after } = propagateExpenseEdit(household, '2026-07', rent, {
      amount: 125000,
    })

    expect(openedMonthKeys(after)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('walks every opened Month after the source in order, across a gap in the calendar', () => {
    const december = openMonth(household, '2026-12')

    const { changed } = propagateExpenseEdit(december, '2026-07', rent, { amount: 125000 })

    expect(changed).toEqual(['2026-08', '2026-09', '2026-12'])
  })

  it('leaves the Household it was given untouched', () => {
    propagateExpenseEdit(household, '2026-07', rent, { amount: 125000 })

    expect(rentIn(household, '2026-08')!.amount).toBe(120000)
  })

  it('is refused when the Month it is carried from does not hold the row', () => {
    expect(() => propagateExpenseEdit(household, '2026-07', 'no-such-row', { amount: 1 })).toThrow(
      DomainError,
    )
  })

  it('is refused when the Month it is carried from has not been opened', () => {
    expect(() => propagateExpenseEdit(household, '2026-06', rent, { amount: 1 })).toThrow(
      DomainError,
    )
  })
})

describe('a later Month that does not hold the row at all', () => {
  it('is passed over, and the Months after it are still reached', () => {
    const removed = removeExpenseSnapshot(household, '2026-08', rent)

    const { household: after, changed, skipped } = propagateExpenseEdit(removed, '2026-07', rent, {
      amount: 125000,
    })

    expect(changed).toEqual(['2026-09'])
    expect(rentIn(after, '2026-09')!.amount).toBe(125000)
    expect(skipped).toContainEqual(expect.objectContaining({ month: '2026-08', reason: 'absent' }))
  })

  it('is not brought back by the correction', () => {
    const removed = removeExpenseSnapshot(household, '2026-08', rent)

    const { household: after } = propagateExpenseEdit(removed, '2026-07', rent, { amount: 125000 })

    expect(rentIn(after, '2026-08')).toBeUndefined()
  })
})

describe('a row matched across the Months', () => {
  it('is found by its stable identity, so a Month still calling it by its old name is reached', () => {
    const renamed = editExpenseSnapshot(household, '2026-07', rent, {
      name: 'Rent and service',
    }).household

    const { household: after, changed } = propagateExpenseEdit(renamed, '2026-07', rent, {
      amount: 125000,
    })

    expect(changed).toEqual(['2026-08', '2026-09'])
    expect(rentIn(after, '2026-08')!.name).toBe('Rent')
    expect(rentIn(after, '2026-08')!.amount).toBe(125000)
  })

  it('keeps the fields the correction does not name', () => {
    const { household: after } = propagateExpenseEdit(household, '2026-07', rent, {
      amount: 125000,
    })

    expect(rentIn(after, '2026-08')!.category).toBe('Home')
    expect(rentIn(after, '2026-08')!.participants).toEqual([ana, bruno])
  })
})

describe('a correction to an income row', () => {
  it('is carried into the later Months still holding the copy', () => {
    const { household: after, changed } = propagateIncomeEdit(household, '2026-07', salary, {
      amount: 265000,
    })

    expect(changed).toEqual(['2026-08', '2026-09'])
    expect(salaryIn(after, '2026-08')!.amount).toBe(265000)
  })

  it('leaves alone a Month a member has already answered for', () => {
    const decided = confirmIncomeSnapshot(household, '2026-08', salary).household

    const { household: after, skipped } = propagateIncomeEdit(decided, '2026-07', salary, {
      amount: 265000,
    })

    expect(salaryIn(after, '2026-08')!.amount).toBe(250000)
    expect(skipped).toContainEqual(expect.objectContaining({ month: '2026-08', reason: 'reviewed' }))
  })

  it('carries the Restricted-Use flag when that is what was corrected', () => {
    const { household: after } = propagateIncomeEdit(household, '2026-07', salary, {
      restrictedUse: true,
    })

    expect(salaryIn(after, '2026-08')!.restrictedUse).toBe(true)
  })
})

describe('a correction to a Savings Goal', () => {
  it('is carried into the later Months still holding the copy', () => {
    const { household: after, changed } = propagateGoalEdit(household, '2026-07', holiday, {
      target: 400000,
    })

    expect(changed).toEqual(['2026-08', '2026-09'])
    expect(holidayIn(after, '2026-08')!.target).toBe(400000)
  })

  it('leaves the later Months’ own Contributions alone', () => {
    const contributed = recordContribution(household, '2026-08', holiday, ana, 5000).household

    const { household: after, skipped } = propagateGoalEdit(contributed, '2026-07', holiday, {
      target: 400000,
    })

    expect(holidayIn(after, '2026-08')!.contributions).toEqual({ [ana]: 5000 })
    expect(skipped).toContainEqual(expect.objectContaining({ month: '2026-08', reason: 'reviewed' }))
  })
})

describe('a later Month the correction cannot stand in', () => {
  it('is passed over with the reason the engine gave, and the walk still goes on', () => {
    // Bruno leaves, so October opens without him — but its inherited rent still names him.
    const october = openMonth(deactivateMember(household, bruno), '2026-10')

    const { changed, skipped } = propagateExpenseEdit(october, '2026-07', rent, {
      participants: [ana, bruno],
    })

    expect(changed).toEqual(['2026-08', '2026-09'])
    expect(skipped).toContainEqual(expect.objectContaining({ month: '2026-10', reason: 'refused' }))
  })

  it('keeps every value it already had, rather than taking half the correction', () => {
    const october = openMonth(deactivateMember(household, bruno), '2026-10')

    const { household: after } = propagateExpenseEdit(october, '2026-07', rent, {
      participants: [ana, bruno],
      amount: 125000,
    })

    expect(rentIn(after, '2026-10')!.amount).toBe(120000)
    expect(rentIn(after, '2026-10')!.participants).toEqual([ana])
  })
})

describe('a row repurposed in a later Month', () => {
  it('is a different identity, so the correction does not reach it', () => {
    const repurposed = repurposeExpenseSnapshot(household, '2026-08', rent, {
      name: 'Storage unit',
    }).household

    const { household: after, changed } = propagateExpenseEdit(repurposed, '2026-07', rent, {
      amount: 125000,
    })

    expect(changed).toEqual([])
    expect(monthAt(after, '2026-08')!.expenses[0]!.amount).toBe(120000)
    expect(monthAt(after, '2026-09')!.expenses[0]!.amount).toBe(120000)
  })
})
