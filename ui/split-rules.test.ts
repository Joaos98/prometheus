import { describe, expect, it } from 'vitest'
import {
  addExpenseSnapshot,
  driftOf,
  editExpenseSnapshot,
  monthAt,
  openMonth,
  sharesOf,
  setUpHousehold,
  type MemberId,
  type SplitRule,
} from '../domain/index.js'
import { expenseCaption, isIndividual, ruleFor } from './split-rules.js'

const percentage: SplitRule = { kind: 'percentage', byMember: { ada: 60, bruno: 40 } }
const fixed: SplitRule = { kind: 'fixed', byMember: { ada: 8000, bruno: 4840 } }

const both: MemberId[] = ['ada', 'bruno']
const alone: MemberId[] = ['ada']

describe('an Expense with one Participant', () => {
  it('is an individual expense', () => {
    expect(isIndividual(alone)).toBe(true)
  })

  it('is not one with two Participants, nor with none', () => {
    expect(isIndividual(both)).toBe(false)
    expect(isIndividual([])).toBe(false)
  })
})

describe('the rule an Expense is saved with', () => {
  it('is Even where there is one Participant, whatever was chosen', () => {
    expect(ruleFor(alone, percentage)).toEqual({ kind: 'even' })
    expect(ruleFor(alone, fixed)).toEqual({ kind: 'even' })
    expect(ruleFor(alone, { kind: 'proportional' })).toEqual({ kind: 'even' })
  })

  it('is the chosen rule, untouched, where there is more than one', () => {
    expect(ruleFor(both, percentage)).toBe(percentage)
    expect(ruleFor(both, fixed)).toBe(fixed)
  })

  /** Nobody ticked is a state the form allows; forcing there would say something false. */
  it('is the chosen rule where nobody is ticked', () => {
    expect(ruleFor([], fixed)).toBe(fixed)
  })
})

/**
 * The consequence of forcing the rule, pinned rather than hidden. `splitRule` is a field
 * Drift compares, so an individual expense that arrived carrying a `percentage` rule
 * becomes a difference against the Months opened after it the moment somebody saves it.
 * That is correct — something did change — and it happens on an explicit edit alone.
 */
describe('forcing the rule, against Drift', () => {
  /** July holds a gym membership that is Ada's alone, still on an inherited rule. */
  function july() {
    const started = setUpHousehold({
      currency: { code: 'EUR', symbol: '€', decimals: 2 },
      memberNames: ['Ada', 'Bruno'],
      startingMonth: '2026-07',
    })
    const [ada] = started.roster.map((member) => member.id) as [MemberId, MemberId]
    const added = addExpenseSnapshot(started, '2026-07', {
      name: 'Gym',
      category: 'Health',
      amount: 4500,
      participants: [ada],
      splitRule: { kind: 'percentage', byMember: { [ada]: 100 } },
    })
    return { household: openMonth(added.household, '2026-08'), ada, gym: added.row.id }
  }

  it('rewrites no rule when the row is only inherited', () => {
    const { household, ada } = july()

    expect(monthAt(household, '2026-08')!.expenses[0]!.splitRule).toEqual({
      kind: 'percentage',
      byMember: { [ada]: 100 },
    })
    expect(driftOf(household, '2026-08', '2026-07').rows).toEqual([])
  })

  it('rewrites the rule to Even on an edit, and Drift reports the difference', () => {
    const { household, ada, gym } = july()
    const edited = editExpenseSnapshot(household, '2026-07', gym, {
      splitRule: ruleFor([ada], { kind: 'percentage', byMember: { [ada]: 100 } }),
    }).household

    expect(monthAt(edited, '2026-07')!.expenses[0]!.splitRule).toEqual({ kind: 'even' })
    expect(driftOf(edited, '2026-08', '2026-07').rows[0]!.fields).toEqual(['splitRule'])
  })

  it('moves no money doing it — one Participant takes the whole of it either way', () => {
    const { household, ada, gym } = july()
    const before = monthAt(household, '2026-07')!
    const wasShared = sharesOf(before, before.expenses[0]!)

    const edited = editExpenseSnapshot(household, '2026-07', gym, {
      splitRule: ruleFor([ada], { kind: 'percentage', byMember: { [ada]: 100 } }),
    }).household
    const after = monthAt(edited, '2026-07')!

    expect(wasShared).toEqual([{ member: ada, amount: 4500 }])
    expect(sharesOf(after, after.expenses[0]!)).toEqual(wasShared)
  })
})

describe('what a row’s caption says', () => {
  it('names the rule and counts the Participants', () => {
    expect(expenseCaption({ participants: both, splitRule: percentage }, false)).toEqual({
      lead: 'Percentages',
      participants: '2 Participants',
    })
  })

  it('calls a one-Participant row an individual expense instead of naming a rule', () => {
    expect(expenseCaption({ participants: alone, splitRule: { kind: 'even' } }, false)).toEqual({
      lead: 'Individual expense',
      participants: '1 Participant',
    })
  })

  /** The seam a row inherited before this ticket and never edited: it stops advertising
      a rule the form will no longer show. */
  it('says the same of a one-Participant row still storing a fixed or percentage rule', () => {
    expect(expenseCaption({ participants: alone, splitRule: fixed }, false).lead).toBe(
      'Individual expense',
    )
    expect(expenseCaption({ participants: alone, splitRule: percentage }, false).lead).toBe(
      'Individual expense',
    )
  })

  it('says the fixed amounts did not total the Expense where they did not', () => {
    expect(expenseCaption({ participants: both, splitRule: fixed }, true).warning).toBe(
      'The fixed amounts do not total the Expense — divided evenly',
    )
  })

  it('says there was no Spendable Income where a proportional rule had none to weigh', () => {
    expect(
      expenseCaption({ participants: both, splitRule: { kind: 'proportional' } }, true).warning,
    ).toBe('No Spendable Income this Month — divided evenly')
  })

  it('carries no divided-evenly-instead warning where there is one Participant to divide among', () => {
    expect(expenseCaption({ participants: alone, splitRule: fixed }, true).warning).toBeUndefined()
    expect(
      expenseCaption({ participants: alone, splitRule: { kind: 'proportional' } }, true).warning,
    ).toBeUndefined()
  })
})
