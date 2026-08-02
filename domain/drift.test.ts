import { beforeEach, describe, expect, it } from 'vitest'
import { driftAhead, driftOf, refreshFromPreviousMonth, type DriftField } from './drift.js'
import { DomainError } from './errors.js'
import {
  addExpenseSnapshot,
  confirmExpenseSnapshot,
  editExpenseSnapshot,
  removeExpenseSnapshot,
} from './expenses.js'
import { addSavingsGoal, editSavingsGoal, recordContribution } from './goals.js'
import { addMember, deactivateMember, setUpHousehold } from './household.js'
import { addIncomeSnapshot, editIncomeSnapshot } from './income.js'
import { discardMonth, monthAt, openMonth } from './month.js'
import { isReviewed } from './review.js'
import { sharesOf } from './shares.js'
import type { Household, MemberId, MonthKey, RowId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId

/** July's rows, with August opened from them — a Month planned ahead. */
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
    startAmount: 50000,
    participants: [ana, bruno],
  })
  holiday = withGoal.row.id

  household = openMonth(withGoal.household, '2026-08')
})

const fieldsOf = (of: Household, id: RowId): DriftField[] =>
  driftOf(of, '2026-08', '2026-07').rows.find((row) => row.id === id)?.fields ?? []

describe('a Month opened ahead of time', () => {
  it('reports a value the Month it was copied from has since changed', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    const drift = driftOf(corrected, '2026-08', '2026-07')

    expect(drift.rows).toHaveLength(1)
    expect(drift.rows[0]!.fields).toEqual(['amount'])
  })

  it('reports nothing while it still says what it was copied from', () => {
    expect(driftOf(household, '2026-08', '2026-07').rows).toEqual([])
  })

  it('says nothing of an edit made in it — the member answered for that row', () => {
    const planned = editExpenseSnapshot(household, '2026-08', rent, { amount: 90000 }).household

    expect(driftOf(planned, '2026-08', '2026-07').rows).toEqual([])
  })

  it('says nothing of a row confirmed in it, though the Month it copied from moved on', () => {
    const answered = confirmExpenseSnapshot(household, '2026-08', rent).household
    const corrected = editExpenseSnapshot(answered, '2026-07', rent, { amount: 125000 }).household

    expect(driftOf(corrected, '2026-08', '2026-07').rows).toEqual([])
  })

  /**
   * A row recorded here has no counterpart behind it to have come from, so before the row
   * was read for its answer this reported it as one the Previous Month had lost — and
   * refreshing that difference took out what had just been added.
   */
  it('says nothing of a row recorded in it, which was never copied from anywhere', () => {
    const added = addIncomeSnapshot(household, '2026-08', {
      name: 'Freelance work',
      member: bruno,
      amount: 40000,
    })

    expect(driftOf(added.household, '2026-08', '2026-07').rows).toEqual([])
  })

  /**
   * Refreshing leaves what it took Unreviewed, so the row is back to one nobody has read
   * and drifts again the next time the Month it came from moves.
   */
  it('reports a refreshed row again, once the Month it came from moves again', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household
    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)
    const again = editExpenseSnapshot(refreshed, '2026-07', rent, { amount: 130000 }).household

    expect(fieldsOf(again, rent)).toEqual(['amount'])
  })

  it('reports a row the Month it was copied from has gained since', () => {
    const added = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: 4000,
      participants: [ana],
    })

    const drift = driftOf(added.household, '2026-08', '2026-07')

    expect(drift.rows).toEqual([
      expect.objectContaining({ id: added.row.id, kind: 'expenses', state: 'missing' }),
    ])
  })

  it('reports a row the Month it was copied from has since lost', () => {
    const removed = removeExpenseSnapshot(household, '2026-07', rent)

    const drift = driftOf(removed, '2026-08', '2026-07')

    expect(drift.rows).toEqual([
      expect.objectContaining({ id: rent, kind: 'expenses', state: 'gone' }),
    ])
  })
})

describe('the diff covers every field the copy covers', () => {
  it('covers an income row’s name, member, amount and Restricted-Use flag', () => {
    const changed = editIncomeSnapshot(household, '2026-07', salary, {
      name: 'Salary and bonus',
      member: bruno,
      amount: 265000,
      restrictedUse: true,
    }).household

    expect(fieldsOf(changed, salary)).toEqual(['name', 'member', 'amount', 'restrictedUse'])
  })

  it('covers an Expense’s name, category, amount, Participants and Split Rule', () => {
    const changed = editExpenseSnapshot(household, '2026-07', rent, {
      name: 'Rent and service',
      category: 'Housing',
      amount: 125000,
      participants: [ana],
      splitRule: { kind: 'proportional' },
    }).household

    expect(fieldsOf(changed, rent)).toEqual([
      'name',
      'category',
      'amount',
      'participants',
      'splitRule',
    ])
  })

  it('covers a goal’s name, target, start amount and Participants', () => {
    const changed = editSavingsGoal(household, '2026-07', holiday, {
      name: 'Big holiday',
      target: 400000,
      startAmount: 60000,
      participants: [ana],
    }).household

    expect(fieldsOf(changed, holiday)).toEqual(['name', 'target', 'startAmount', 'participants'])
  })

  /**
   * Both Months have to hold a `percentage` rule for the figures to be what differs, and
   * August's has to be one nobody has answered for — so it is inherited from a July that
   * already said 50/50, and July moves afterwards.
   */
  it('covers a Split Rule’s per-member figures, not only its kind', () => {
    const even = editExpenseSnapshot(household, '2026-07', rent, {
      splitRule: { kind: 'percentage', byMember: { [ana]: 50, [bruno]: 50 } },
    }).household
    const inherited = openMonth(discardMonth(even, '2026-08'), '2026-08')
    const changed = editExpenseSnapshot(inherited, '2026-07', rent, {
      splitRule: { kind: 'percentage', byMember: { [ana]: 40, [bruno]: 60 } },
    }).household

    expect(fieldsOf(changed, rent)).toEqual(['splitRule'])
  })

  it('covers who the Month is for', () => {
    const drift = driftOf(deactivateMember(household, bruno), '2026-08', '2026-07')

    expect(drift.members).toEqual({ held: [ana, bruno], inherited: [ana] })
  })

  it('leaves a goal’s Contributions out — what was put in was put in that Month', () => {
    const contributed = recordContribution(household, '2026-08', holiday, ana, 20000).household

    expect(fieldsOf(contributed, holiday)).toEqual([])
  })

  it('names the Month it is measured against', () => {
    expect(driftOf(household, '2026-08', '2026-07').from).toBe('2026-07')
  })
})

describe('the Drift standing against later opened Months', () => {
  /**
   * Each Month is measured against the one before it, so the two need their own causes:
   * July's correction is what August missed, and the row recorded in August is what
   * September would now be opened with and does not have.
   */
  it('reports every later opened Month that has drifted, in calendar order', () => {
    const september = openMonth(household, '2026-09')
    const corrected = editExpenseSnapshot(september, '2026-07', rent, { amount: 125000 }).household
    const water = addExpenseSnapshot(corrected, '2026-08', {
      name: 'Water',
      category: 'Home',
      amount: 4000,
      participants: [ana],
    }).household

    const ahead = driftAhead(water, '2026-07', '2026-07')

    expect(ahead.map((drift) => drift.month)).toEqual(['2026-08', '2026-09'])
  })

  /**
   * Drift is divergence from the Previous Month, so a correction shows up in the Month
   * that copied from it and no further: the Months beyond still agree with what they
   * themselves copied. Each one drifts in its turn, as the one before it is refreshed.
   */
  it('reaches the next Month only, since each is measured against the one before it', () => {
    const september = openMonth(household, '2026-09')
    const corrected = editExpenseSnapshot(september, '2026-07', rent, { amount: 125000 }).household

    expect(driftAhead(corrected, '2026-07', '2026-07').map((drift) => drift.month)).toEqual([
      '2026-08',
    ])
  })

  it('leaves out a later Month that still agrees with where it came from', () => {
    const september = openMonth(household, '2026-09')

    expect(driftAhead(september, '2026-07', '2026-07')).toEqual([])
  })

  it('leaves out Months that are not in the future', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    expect(driftAhead(corrected, '2026-07', '2026-09')).toEqual([])
  })
})

describe('refreshing one difference from the Previous Month', () => {
  const rentIn = (of: Household, month: MonthKey) =>
    monthAt(of, month)!.expenses.find((row) => row.id === rent)

  it('takes the value the Previous Month now holds', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)

    expect(rentIn(refreshed, '2026-08')!.amount).toBe(125000)
  })

  it('leaves what it took Unreviewed — it is a copied value like any other', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)

    expect(isReviewed(rentIn(refreshed, '2026-08')!)).toBe(false)
  })

  it('settles that difference, leaving nothing to report for the row', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)

    expect(fieldsOf(refreshed, rent)).toEqual([])
  })

  it('brings in a row the Previous Month has gained since', () => {
    const added = addExpenseSnapshot(household, '2026-07', {
      name: 'Water',
      category: 'Home',
      amount: 4000,
      participants: [ana],
    })

    const refreshed = refreshFromPreviousMonth(
      added.household,
      '2026-08',
      '2026-07',
      'expenses',
      added.row.id,
    )

    expect(monthAt(refreshed, '2026-08')!.expenses.map((row) => row.name)).toEqual([
      'Rent',
      'Water',
    ])
  })

  it('takes out a row the Previous Month has since lost', () => {
    const removed = removeExpenseSnapshot(household, '2026-07', rent)

    const refreshed = refreshFromPreviousMonth(removed, '2026-08', '2026-07', 'expenses', rent)

    expect(rentIn(refreshed, '2026-08')).toBeUndefined()
  })

  it('keeps the row where it was in the Month, rather than moving it to the end', () => {
    const water = addExpenseSnapshot(household, '2026-08', {
      name: 'Water',
      category: 'Home',
      amount: 4000,
      participants: [ana],
    }).household
    const corrected = editExpenseSnapshot(water, '2026-07', rent, { amount: 125000 }).household

    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)

    expect(monthAt(refreshed, '2026-08')!.expenses.map((row) => row.name)).toEqual([
      'Rent',
      'Water',
    ])
  })

  it('leaves the other differences standing — one at a time is the point', () => {
    const rentCorrected = editExpenseSnapshot(household, '2026-07', rent, {
      amount: 125000,
    }).household
    const both = editIncomeSnapshot(rentCorrected, '2026-07', salary, { amount: 265000 }).household

    const refreshed = refreshFromPreviousMonth(both, '2026-08', '2026-07', 'expenses', rent)

    expect(fieldsOf(refreshed, salary)).toEqual(['amount'])
  })

  it('leaves the Month it took from exactly as it was', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    const refreshed = refreshFromPreviousMonth(corrected, '2026-08', '2026-07', 'expenses', rent)

    expect(monthAt(refreshed, '2026-07')).toEqual(monthAt(corrected, '2026-07'))
  })

  it('keeps the Contributions this Month already holds', () => {
    const contributed = recordContribution(household, '2026-08', holiday, ana, 20000).household
    const raised = editSavingsGoal(contributed, '2026-07', holiday, { target: 400000 }).household

    const refreshed = refreshFromPreviousMonth(raised, '2026-08', '2026-07', 'goals', holiday)
    const goal = monthAt(refreshed, '2026-08')!.goals.find((row) => row.id === holiday)!

    expect(goal.target).toBe(400000)
    expect(goal.contributions).toEqual({ [ana]: 20000 })
  })

  it('drops a Contribution from somebody the refreshed goal no longer saves with', () => {
    const contributed = recordContribution(household, '2026-08', holiday, bruno, 20000).household
    const narrowed = editSavingsGoal(contributed, '2026-07', holiday, {
      participants: [ana],
    }).household

    const refreshed = refreshFromPreviousMonth(narrowed, '2026-08', '2026-07', 'goals', holiday)
    const goal = monthAt(refreshed, '2026-08')!.goals.find((row) => row.id === holiday)!

    expect(goal.participants).toEqual([ana])
    expect(goal.contributions).toEqual({})
  })

  it('is refused for a row that is not drifting, since there is nothing to take', () => {
    expect(() =>
      refreshFromPreviousMonth(household, '2026-08', '2026-07', 'expenses', rent),
    ).toThrow(DomainError)
  })

  it('is refused for a Month that is not in the future', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    expect(() =>
      refreshFromPreviousMonth(corrected, '2026-08', '2026-08', 'expenses', rent),
    ).toThrow(DomainError)
  })
})

/**
 * Membership drifts too, and is not refreshed a row at a time, so the row being taken was
 * worked out for a member list the Month receiving it may not have. June and August are
 * opened before Cleo joins; July is opened after her, and so has her.
 */
describe('refreshing into a Month whose membership has drifted too', () => {
  const record = (rule?: (ana: MemberId, bruno: MemberId, cleo: MemberId) => object) => {
    let of = setUpHousehold({
      currency: euro,
      memberNames: ['Ana', 'Bruno'],
      startingMonth: '2026-06',
    })
    const [one, two] = of.roster.map((member) => member.id) as [MemberId, MemberId]

    const withRent = addExpenseSnapshot(of, '2026-06', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [one, two],
    })
    of = openMonth(withRent.household, '2026-08')

    of = addMember(of, 'Cleo')
    const three = of.roster[2]!.id
    of = openMonth(of, '2026-07')
    of = editExpenseSnapshot(of, '2026-07', withRent.row.id, {
      participants: [one, two, three],
      ...(rule ? rule(one, two, three) : {}),
    }).household

    return { of, rent: withRent.row.id, one, two, three }
  }

  it('takes no Participant the Month receiving it does not have', () => {
    const { of, rent: id, one, two, three } = record()

    const refreshed = refreshFromPreviousMonth(of, '2026-08', '2026-06', 'expenses', id)
    const august = monthAt(refreshed, '2026-08')!

    expect(august.members).toEqual([one, two])
    expect(august.expenses[0]!.participants).toEqual([one, two])
    expect(august.expenses[0]!.participants).not.toContain(three)
  })

  it('stands down a Split Rule that cannot fit the Participants who are here', () => {
    const { of, rent: id } = record((one, two, three) => ({
      splitRule: { kind: 'fixed', byMember: { [one]: 40000, [two]: 40000, [three]: 40000 } },
    }))

    const refreshed = refreshFromPreviousMonth(of, '2026-08', '2026-06', 'expenses', id)
    const august = monthAt(refreshed, '2026-08')!
    const shares = sharesOf(august, august.expenses[0]!)

    expect(august.expenses[0]!.splitRule).toEqual({ kind: 'even' })
    expect(shares.reduce((total, share) => total + share.amount, 0)).toBe(120000)
  })
})

describe('a Month that is not in the future', () => {
  it('reports no Drift, whatever it holds', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    expect(driftOf(corrected, '2026-08', '2026-08').rows).toEqual([])
    expect(driftOf(corrected, '2026-08', '2026-09').rows).toEqual([])
  })

  it('reports no Drift for the Month the correction was made in', () => {
    const corrected = editExpenseSnapshot(household, '2026-07', rent, { amount: 125000 }).household

    expect(driftOf(corrected, '2026-07', '2026-07').rows).toEqual([])
  })

  it('reports no Drift for a Month that has not been opened', () => {
    expect(driftOf(household, '2026-12', '2026-07').rows).toEqual([])
  })
})
