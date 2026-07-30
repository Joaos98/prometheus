import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import { addSavingsGoal, editSavingsGoal, recordContribution } from './goals.js'
import { setUpHousehold } from './household.js'
import { openMonth } from './month.js'
import { accumulatedProgress } from './progress.js'
import type { Household, MemberId, RowId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId
let holiday: RowId

beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ana = household.roster[0]!.id
  bruno = household.roster[1]!.id

  const { household: after, row } = addSavingsGoal(household, '2026-07', {
    name: 'Holiday',
    target: 200000,
    startAmount: 50000,
    participants: [ana, bruno],
  })
  household = after
  holiday = row.id
})

describe('Accumulated Progress as of a Month', () => {
  it('is that Month’s start amount plus that Month’s Contributions', () => {
    let after = recordContribution(household, '2026-07', holiday, ana, 25000).household
    after = recordContribution(after, '2026-07', holiday, bruno, 15000).household

    expect(accumulatedProgress(after, '2026-07', holiday)).toEqual({
      goal: holiday,
      startAmount: 50000,
      contributed: 40000,
      accumulated: 90000,
      thisMonth: 40000,
      target: 200000,
      remaining: 110000,
      reached: false,
    })
  })

  it('counts every Contribution to that goal identity in an earlier Month too', () => {
    let after = recordContribution(household, '2026-07', holiday, ana, 25000).household
    after = openMonth(after, '2026-08')
    after = recordContribution(after, '2026-08', holiday, ana, 30000).household

    const progress = accumulatedProgress(after, '2026-08', holiday)

    expect(progress.contributed).toBe(55000)
    expect(progress.thisMonth).toBe(30000)
    expect(progress.accumulated).toBe(105000)
  })

  it('counts Contributions across a gap in the record, since a skipped Month holds nothing', () => {
    let after = recordContribution(household, '2026-07', holiday, ana, 25000).household
    after = openMonth(after, '2026-11')
    after = recordContribution(after, '2026-11', holiday, ana, 10000).household

    expect(accumulatedProgress(after, '2026-11', holiday).contributed).toBe(35000)
  })

  it('is unmoved by a Contribution made in a later Month', () => {
    let after = recordContribution(household, '2026-07', holiday, ana, 25000).household
    after = openMonth(after, '2026-08')
    after = recordContribution(after, '2026-08', holiday, ana, 30000).household

    expect(accumulatedProgress(after, '2026-07', holiday).accumulated).toBe(75000)
  })

  it('is measured against that Month’s target, so raising it later rewrites no earlier Month', () => {
    let after = openMonth(household, '2026-08')
    after = editSavingsGoal(after, '2026-08', holiday, { target: 400000 }).household

    expect(accumulatedProgress(after, '2026-07', holiday).target).toBe(200000)
    expect(accumulatedProgress(after, '2026-08', holiday).target).toBe(400000)
  })

  it('is measured against that Month’s start amount, on the same terms', () => {
    let after = openMonth(household, '2026-08')
    after = editSavingsGoal(after, '2026-08', holiday, { startAmount: 60000 }).household

    expect(accumulatedProgress(after, '2026-07', holiday).accumulated).toBe(50000)
    expect(accumulatedProgress(after, '2026-08', holiday).accumulated).toBe(60000)
  })

  it('reports the target reached once the accumulated figure meets it', () => {
    const after = recordContribution(household, '2026-07', holiday, ana, 150000).household

    expect(accumulatedProgress(after, '2026-07', holiday)).toMatchObject({
      remaining: 0,
      reached: true,
    })
  })

  it('never reports a negative remainder — an overshoot is nothing left to save', () => {
    const after = recordContribution(household, '2026-07', holiday, ana, 200000).household

    expect(accumulatedProgress(after, '2026-07', holiday).remaining).toBe(0)
  })

  it('has nothing to reach and nothing remaining when the goal names no target', () => {
    const { household: after, row } = addSavingsGoal(household, '2026-07', {
      name: 'Rainy day',
      participants: [ana],
    })

    expect(accumulatedProgress(after, '2026-07', row.id)).toMatchObject({
      target: null,
      remaining: null,
      reached: false,
    })
  })

  it('ignores an earlier Month that does not hold the goal at all', () => {
    let after = setUpHousehold({
      currency: euro,
      memberNames: ['Ana'],
      startingMonth: '2026-07',
    })
    const only = after.roster[0]!.id
    after = openMonth(after, '2026-08')
    const { household: withGoal, row } = addSavingsGoal(after, '2026-08', {
      name: 'Holiday',
      startAmount: 10000,
      participants: [only],
    })
    after = recordContribution(withGoal, '2026-08', row.id, only, 5000).household

    expect(accumulatedProgress(after, '2026-08', row.id).accumulated).toBe(15000)
  })

  it('is refused for a goal the Month does not hold', () => {
    expect(() => accumulatedProgress(household, '2026-07', 'nothing')).toThrow(DomainError)
  })

  it('is refused for a Month that has not been opened', () => {
    expect(() => accumulatedProgress(household, '2026-09', holiday)).toThrow(DomainError)
  })
})
