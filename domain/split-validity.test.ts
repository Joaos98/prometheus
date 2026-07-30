import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.js'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { monthAt } from './month.js'
import type { Household, MemberId, Minor, SplitRule } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
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
})

const record = (amount: Minor | null, participants: MemberId[], splitRule: SplitRule) =>
  addExpenseSnapshot(household, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount,
    participants,
    splitRule,
  })

/** What the member is told when a split does not add up. */
const refusal = (call: () => unknown): string => {
  try {
    call()
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
  throw new Error('expected the split to be refused')
}

describe('a percentage rule that does not total 100', () => {
  it('cannot be saved', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'percentage', byMember: { [ana]: 70, [bruno]: 20 } }),
    ).toThrow(DomainError)
  })

  it('names the shortfall', () => {
    const told = refusal(() =>
      record(100000, [ana, bruno], { kind: 'percentage', byMember: { [ana]: 70, [bruno]: 20 } }),
    )

    expect(told).toContain('90%')
    expect(told).toContain('10%')
  })

  it('names the excess', () => {
    const told = refusal(() =>
      record(100000, [ana, bruno], { kind: 'percentage', byMember: { [ana]: 70, [bruno]: 40 } }),
    )

    expect(told).toContain('110%')
    expect(told).toContain('10%')
  })

  it('is refused for a fraction of a percent that does not close the gap', () => {
    expect(() =>
      record(100000, [ana, bruno], {
        kind: 'percentage',
        byMember: { [ana]: 33.33, [bruno]: 66.66 },
      }),
    ).toThrow(DomainError)
  })

  it('is refused when it is held to more than two decimal places', () => {
    expect(() =>
      record(100000, [ana, bruno], {
        kind: 'percentage',
        byMember: { [ana]: 33.333, [bruno]: 66.667 },
      }),
    ).toThrow(DomainError)
  })

  it('is refused when a Participant has no percentage of their own', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'percentage', byMember: { [ana]: 100 } }),
    ).toThrow(DomainError)
  })

  it('is refused when it names somebody who is not a Participant', () => {
    expect(() =>
      record(100000, [ana, bruno], {
        kind: 'percentage',
        byMember: { [ana]: 50, [bruno]: 50, [cleo]: 0 },
      }),
    ).toThrow(DomainError)
  })

  it('is refused for a negative percentage', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'percentage', byMember: { [ana]: 110, [bruno]: -10 } }),
    ).toThrow(DomainError)
  })
})

describe('a fixed rule that does not total the amount', () => {
  it('cannot be saved', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 20000, [bruno]: 70000 } }),
    ).toThrow(DomainError)
  })

  it('names the difference in the Household’s own currency', () => {
    const told = refusal(() =>
      record(100000, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 20000, [bruno]: 70000 } }),
    )

    expect(told).toContain('€900.00')
    expect(told).toContain('€100.00')
    expect(told).toContain('€1000.00')
  })

  it('cannot be attached to a Pending Expense, which has no total to reach', () => {
    expect(() =>
      record(null, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 0, [bruno]: 0 } }),
    ).toThrow(DomainError)
  })

  it('is refused when a Participant has no amount of their own', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 100000 } }),
    ).toThrow(DomainError)
  })

  it('is refused for anything that is not whole minor units', () => {
    expect(() =>
      record(100000, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 20000.5, [bruno]: 79999.5 } }),
    ).toThrow(DomainError)
  })
})

describe('an Expense amount under a fixed rule', () => {
  const agreed = () =>
    record(100000, [ana, bruno], { kind: 'fixed', byMember: { [ana]: 20000, [bruno]: 80000 } })

  it('cannot be changed on its own, since the rule would no longer total it', () => {
    const { household: after, row } = agreed()

    expect(() => editExpenseSnapshot(after, '2026-07', row.id, { amount: 120000 })).toThrow(
      DomainError,
    )
  })

  it('changes when the amount and the rule are given together in one operation', () => {
    const { household: after, row } = agreed()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, {
      amount: 120000,
      splitRule: { kind: 'fixed', byMember: { [ana]: 20000, [bruno]: 100000 } },
    })

    expect(edited.row.amount).toBe(120000)
    expect(edited.row.splitRule).toEqual({
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 100000 },
    })
  })

  it('leaves the Expense exactly as it was when the change is refused', () => {
    const { household: after, row } = agreed()

    try {
      editExpenseSnapshot(after, '2026-07', row.id, { amount: 120000 })
    } catch {
      // the refusal is asserted above
    }

    expect(monthAt(after, '2026-07')!.expenses[0]).toEqual(row)
  })

  it('can be changed freely once the rule no longer depends on it', () => {
    const { household: after, row } = agreed()

    const edited = editExpenseSnapshot(after, '2026-07', row.id, {
      amount: 120000,
      splitRule: { kind: 'even' },
    })

    expect(edited.row.amount).toBe(120000)
  })
})

describe('changing who a cost divides among', () => {
  it('is refused when the rule no longer covers the Participants', () => {
    const { household: after, row } = record(100000, [ana, bruno], {
      kind: 'percentage',
      byMember: { [ana]: 50, [bruno]: 50 },
    })

    expect(() =>
      editExpenseSnapshot(after, '2026-07', row.id, { participants: [ana, bruno, cleo] }),
    ).toThrow(DomainError)
  })

  it('goes through when the rule is given for the new Participants at the same time', () => {
    const { household: after, row } = record(100000, [ana, bruno], {
      kind: 'percentage',
      byMember: { [ana]: 50, [bruno]: 50 },
    })

    const edited = editExpenseSnapshot(after, '2026-07', row.id, {
      participants: [ana, bruno, cleo],
      splitRule: {
        kind: 'percentage',
        byMember: { [ana]: 40, [bruno]: 40, [cleo]: 20 },
      },
    })

    expect(edited.row.participants).toEqual([ana, bruno, cleo])
  })
})

describe('the rules that need no agreement', () => {
  it('divide evenly whatever the amount', () => {
    expect(() => record(null, [ana, bruno], { kind: 'even' })).not.toThrow()
  })

  it('divide proportionally whatever the amount', () => {
    expect(() => record(null, [ana, bruno], { kind: 'proportional' })).not.toThrow()
  })
})
