import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import {
  addSavingsGoal,
  confirmSavingsGoal,
  contributionTo,
  contributionsOf,
  editSavingsGoal,
  markGoalOneOff,
  recordContribution,
  removeSavingsGoal,
  totalContributedTo,
} from './goals.js'
import { setUpHousehold } from './household.js'
import { monthAt, openMonth } from './month.js'
import { isOneOff } from './rows.js'
import { isReviewed } from './review.js'
import type { Household, MemberId, Month, RowId, SavingsGoal } from './types.js'

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

const monthOf = (of: Household, key = '2026-07'): Month => monthAt(of, key)!
const goalIn = (of: Household, id: RowId, key = '2026-07'): SavingsGoal =>
  monthOf(of, key).goals.find((goal) => goal.id === id)!

const holiday = (participants: MemberId[] = []) => ({
  name: 'Holiday',
  target: 200000,
  startAmount: 50000,
  participants,
})

describe('recording a Savings Goal', () => {
  it('records a name, a target, a start amount and Participants', () => {
    const { household: after, row } = addSavingsGoal(household, '2026-07', holiday([ana, bruno]))

    expect(row).toMatchObject({
      name: 'Holiday',
      target: 200000,
      startAmount: 50000,
      participants: [ana, bruno],
      contributions: {},
      reviewed: true,
    })
    expect(monthOf(after).goals).toEqual([row])
  })

  it('mints a stable identity, which is what carries the goal between Months', () => {
    const { row } = addSavingsGoal(household, '2026-07', holiday([ana]))

    expect(row.id).toMatch(/\S/)
  })

  it('takes no target — saving without a fixed number is a goal too', () => {
    const { row } = addSavingsGoal(household, '2026-07', {
      name: 'Rainy day',
      target: null,
      participants: [ana],
    })

    expect(row.target).toBeNull()
  })

  it('starts at nothing when no start amount is named', () => {
    const { row } = addSavingsGoal(household, '2026-07', {
      name: 'Rainy day',
      target: null,
      participants: [ana],
    })

    expect(row.startAmount).toBe(0)
  })

  it('needs a name', () => {
    expect(() => addSavingsGoal(household, '2026-07', { name: '  ', participants: [ana] })).toThrow(
      DomainError,
    )
  })

  it('needs somebody saving for it', () => {
    expect(() => addSavingsGoal(household, '2026-07', holiday([]))).toThrow(DomainError)
  })

  it('names Participants in the Month’s own order, whatever order they arrive in', () => {
    const { row } = addSavingsGoal(household, '2026-07', holiday([bruno, ana]))

    expect(row.participants).toEqual([ana, bruno])
  })

  it('refuses somebody who is not a member of the Month', () => {
    expect(() => addSavingsGoal(household, '2026-07', holiday(['nobody']))).toThrow(DomainError)
  })

  it('refuses a negative start amount — a goal cannot begin owing', () => {
    expect(() =>
      addSavingsGoal(household, '2026-07', { name: 'Holiday', startAmount: -1, participants: [ana] }),
    ).toThrow(DomainError)
  })

  it('refuses a negative target', () => {
    expect(() =>
      addSavingsGoal(household, '2026-07', { name: 'Holiday', target: -1, participants: [ana] }),
    ).toThrow(DomainError)
  })

  it('is refused on a Month that has not been opened', () => {
    expect(() => addSavingsGoal(household, '2026-09', holiday([ana]))).toThrow(DomainError)
  })
})

describe('editing a Savings Goal', () => {
  it('changes the fields the edit names and leaves every other alone', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', holiday([ana, bruno]))

    const { row: edited } = editSavingsGoal(withGoal, '2026-07', row.id, { target: 300000 })

    expect(edited).toMatchObject({
      id: row.id,
      name: 'Holiday',
      target: 300000,
      startAmount: 50000,
      participants: [ana, bruno],
    })
  })

  it('takes a target away, leaving a goal with nothing to reach', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', holiday([ana]))

    const { row: edited } = editSavingsGoal(withGoal, '2026-07', row.id, { target: null })

    expect(edited.target).toBeNull()
  })

  it('clears the Unreviewed mark', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', holiday([ana]))
    const opened = openMonth(withGoal, '2026-08')
    expect(goalIn(opened, row.id, '2026-08').reviewed).toBe(false)

    const { row: edited } = editSavingsGoal(opened, '2026-08', row.id, { target: 300000 })

    expect(edited.reviewed).toBe(true)
  })

  it('drops the Contributions of anybody the edit takes out of the goal', () => {
    let after = addSavingsGoal(household, '2026-07', holiday([ana, bruno])).household
    const id = monthOf(after).goals[0]!.id
    after = recordContribution(after, '2026-07', id, bruno, 10000).household

    const { row: edited } = editSavingsGoal(after, '2026-07', id, { participants: [ana] })

    expect(edited.contributions).toEqual({})
  })

  it('is refused on a goal this Month does not hold', () => {
    expect(() => editSavingsGoal(household, '2026-07', 'nothing', { target: 1 })).toThrow(DomainError)
  })
})

describe('confirming a Savings Goal', () => {
  it('clears the Unreviewed mark and changes no other field', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', holiday([ana]))
    const opened = openMonth(withGoal, '2026-08')

    const { row: confirmed } = confirmSavingsGoal(opened, '2026-08', row.id)

    expect(confirmed).toEqual({ ...goalIn(opened, row.id, '2026-08'), reviewed: true })
  })
})

describe('marking a Savings Goal One-Off', () => {
  it('is not One-Off when recorded fresh', () => {
    const { row } = addSavingsGoal(household, '2026-07', holiday([ana]))

    expect(isOneOff(row)).toBe(false)
  })

  it('marks a goal One-Off without changing any other field', () => {
    const { household: after, row } = addSavingsGoal(household, '2026-07', holiday([ana]))

    const marked = markGoalOneOff(after, '2026-07', row.id)

    expect(marked.row).toEqual({ ...row, oneOff: true })
  })

  it('leaves the Unreviewed mark exactly as it found it', () => {
    const july = addSavingsGoal(household, '2026-07', holiday([ana])).household
    const august = openMonth(july, '2026-08')
    const row = monthAt(august, '2026-08')!.goals[0]!
    expect(isReviewed(row)).toBe(false)

    const marked = markGoalOneOff(august, '2026-08', row.id)

    expect(isReviewed(marked.row)).toBe(false)
  })

  it('refuses a row that is not in that Month', () => {
    expect(() => markGoalOneOff(household, '2026-07', 'no-such-row')).toThrow(DomainError)
  })
})

describe('removing a Savings Goal', () => {
  it('takes it out of the Month', () => {
    const { household: withGoal, row } = addSavingsGoal(household, '2026-07', holiday([ana]))

    const after = removeSavingsGoal(withGoal, '2026-07', row.id)

    expect(monthOf(after).goals).toEqual([])
  })

  it('is refused on a goal this Month does not hold', () => {
    expect(() => removeSavingsGoal(household, '2026-07', 'nothing')).toThrow(DomainError)
  })
})

describe('a Contribution', () => {
  let id: RowId

  beforeEach(() => {
    const { household: after, row } = addSavingsGoal(household, '2026-07', holiday([ana, bruno]))
    household = after
    id = row.id
  })

  it('is entered directly by one Participant, and divided by nothing', () => {
    const { row } = recordContribution(household, '2026-07', id, ana, 25000)

    expect(row.contributions).toEqual({ [ana]: 25000 })
  })

  it('replaces whatever that Participant last put toward the goal', () => {
    let after = recordContribution(household, '2026-07', id, ana, 25000).household
    after = recordContribution(after, '2026-07', id, ana, 30000).household

    expect(goalIn(after, id).contributions).toEqual({ [ana]: 30000 })
  })

  it('reads as nothing until it is entered', () => {
    expect(contributionTo(goalIn(household, id), ana)).toBe(0)
  })

  it('is taken back to nothing entered at all', () => {
    const after = recordContribution(household, '2026-07', id, ana, 25000).household

    const { row } = recordContribution(after, '2026-07', id, ana, null)

    expect(row.contributions).toEqual({})
  })

  it('clears the Unreviewed mark — entering one is looking at the row', () => {
    const opened = openMonth(household, '2026-08')

    const { row } = recordContribution(opened, '2026-08', id, ana, 5000)

    expect(row.reviewed).toBe(true)
  })

  it('is refused from somebody who is not a Participant of the goal', () => {
    const { household: after, row } = addSavingsGoal(household, '2026-07', {
      name: 'Bruno’s bike',
      participants: [bruno],
    })

    expect(() => recordContribution(after, '2026-07', row.id, ana, 5000)).toThrow(DomainError)
  })

  it('is refused from somebody who is not a member of the Month', () => {
    expect(() => recordContribution(household, '2026-07', id, 'nobody', 5000)).toThrow(DomainError)
  })

  it('is refused as a negative amount — a goal is not withdrawn from here', () => {
    expect(() => recordContribution(household, '2026-07', id, ana, -100)).toThrow(DomainError)
  })

  it('sums across the Participants who have entered one', () => {
    let after = recordContribution(household, '2026-07', id, ana, 25000).household
    after = recordContribution(after, '2026-07', id, bruno, 15000).household

    expect(totalContributedTo(goalIn(after, id))).toBe(40000)
  })
})

describe('a member’s Contributions for a Month', () => {
  it('sum across every goal of the Month', () => {
    let after = addSavingsGoal(household, '2026-07', holiday([ana, bruno])).household
    after = recordContribution(after, '2026-07', monthOf(after).goals[0]!.id, ana, 25000).household
    after = addSavingsGoal(after, '2026-07', { name: 'Rainy day', participants: [ana] }).household
    after = recordContribution(after, '2026-07', monthOf(after).goals[1]!.id, ana, 5000).household

    expect(contributionsOf(monthOf(after), ana)).toBe(30000)
  })

  it('read as nothing for a member who has contributed to none of them', () => {
    const after = addSavingsGoal(household, '2026-07', holiday([ana, bruno])).household

    expect(contributionsOf(monthOf(after), bruno)).toBe(0)
  })
})
