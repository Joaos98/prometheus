import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot, editExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot, editIncomeSnapshot } from './income.js'
import { monthAt } from './month.js'
import { sharesOf, splitOf } from './shares.js'
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

/** Records income so a proportional split has something to weight by. */
function earning(entries: [MemberId, Minor, boolean?][]): void {
  for (const [member, amount, restrictedUse] of entries) {
    household = addIncomeSnapshot(household, '2026-07', {
      name: 'Salary',
      member,
      amount,
      restrictedUse: restrictedUse ?? false,
    }).household
  }
}

function rent(amount: Minor | null, participants: MemberId[], splitRule: SplitRule) {
  const { household: after, row } = addExpenseSnapshot(household, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount,
    participants,
    splitRule,
  })
  household = after
  return row
}

const shares = (row: Parameters<typeof sharesOf>[1]) => sharesOf(monthAt(household, '2026-07')!, row)

const amountsOf = (of: { amount: Minor }[]): Minor[] => of.map((share) => share.amount)

const sum = (amounts: Minor[]): Minor => amounts.reduce((total, amount) => total + amount, 0)

describe('a proportional Split Rule', () => {
  it('weights each Share by the Participant’s Spendable Income', () => {
    earning([
      [ana, 300000],
      [bruno, 100000],
    ])

    const row = rent(120000, [ana, bruno], { kind: 'proportional' })

    expect(amountsOf(shares(row))).toEqual([90000, 30000])
  })

  it('leaves Restricted-Use Income out of the weighting entirely', () => {
    earning([
      [ana, 300000],
      [bruno, 100000],
      [bruno, 200000, true],
    ])

    const row = rent(120000, [ana, bruno], { kind: 'proportional' })

    expect(amountsOf(shares(row))).toEqual([90000, 30000])
  })

  it('stores no weights, so correcting income moves every proportional Share with no edit to the Expense', () => {
    earning([
      [ana, 300000],
      [bruno, 100000],
    ])
    const row = rent(120000, [ana, bruno], { kind: 'proportional' })
    expect(amountsOf(shares(row))).toEqual([90000, 30000])

    const brunosSalary = monthAt(household, '2026-07')!.income[1]!
    household = editIncomeSnapshot(household, '2026-07', brunosSalary.id, {
      amount: 300000,
    }).household

    expect(amountsOf(shares(row))).toEqual([60000, 60000])
  })

  it('sums to exactly the amount when the weighting does not divide cleanly', () => {
    earning([
      [ana, 100000],
      [bruno, 100000],
      [cleo, 100000],
    ])

    const row = rent(10000, [ana, bruno, cleo], { kind: 'proportional' })

    expect(sum(amountsOf(shares(row)))).toBe(10000)
    expect(amountsOf(shares(row))).toEqual([3334, 3333, 3333])
  })

  it('divides evenly and says so when no Participant has any Spendable Income', () => {
    earning([[ana, 200000, true]])

    const row = rent(9000, [ana, bruno, cleo], { kind: 'proportional' })
    const split = splitOf(monthAt(household, '2026-07')!, row)

    expect(amountsOf(split.shares)).toEqual([3000, 3000, 3000])
    expect(split.dividedEvenlyInstead).toBe(true)
  })

  it('keeps the rule it was given when it falls back', () => {
    rent(9000, [ana, bruno], { kind: 'proportional' })

    expect(monthAt(household, '2026-07')!.expenses[0]!.splitRule).toEqual({ kind: 'proportional' })
  })

  it('does not say it fell back when somebody does have income', () => {
    earning([[ana, 100000]])

    const row = rent(9000, [ana, bruno], { kind: 'proportional' })

    expect(splitOf(monthAt(household, '2026-07')!, row).dividedEvenlyInstead).toBe(false)
  })

  it('gives nothing to a Participant with no Spendable Income while another has some', () => {
    earning([[ana, 100000]])

    const row = rent(9000, [ana, bruno], { kind: 'proportional' })

    expect(amountsOf(shares(row))).toEqual([9000, 0])
  })

  it('treats income that went backwards as nothing rather than as a negative weight', () => {
    earning([
      [ana, 100000],
      [bruno, -50000],
    ])

    const row = rent(9000, [ana, bruno], { kind: 'proportional' })

    expect(amountsOf(shares(row))).toEqual([9000, 0])
  })
})

describe('a percentage Split Rule', () => {
  it('divides by the percentages given', () => {
    const row = rent(100000, [ana, bruno], {
      kind: 'percentage',
      byMember: { [ana]: 70, [bruno]: 30 },
    })

    expect(amountsOf(shares(row))).toEqual([70000, 30000])
  })

  it('takes percentages to two decimal places', () => {
    const row = rent(100000, [ana, bruno], {
      kind: 'percentage',
      byMember: { [ana]: 33.33, [bruno]: 66.67 },
    })

    expect(amountsOf(shares(row))).toEqual([33330, 66670])
  })

  it('sums to exactly the amount when the percentages do not divide cleanly', () => {
    const row = rent(10001, [ana, bruno, cleo], {
      kind: 'percentage',
      byMember: { [ana]: 33.33, [bruno]: 33.33, [cleo]: 33.34 },
    })

    expect(sum(amountsOf(shares(row)))).toBe(10001)
  })
})

describe('a fixed Split Rule', () => {
  it('gives each Participant the amount agreed for them', () => {
    const row = rent(100000, [ana, bruno], {
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 80000 },
    })

    expect(shares(row)).toEqual([
      { member: ana, amount: 20000 },
      { member: bruno, amount: 80000 },
    ])
  })

  it('sums to exactly the amount, because it is only allowed to exist that way', () => {
    const row = rent(100000, [ana, bruno], {
      kind: 'fixed',
      byMember: { [ana]: 20000, [bruno]: 80000 },
    })

    expect(sum(amountsOf(shares(row)))).toBe(100000)
  })

  it('lets one Participant cover the whole cost', () => {
    const row = rent(100000, [ana, bruno], {
      kind: 'fixed',
      byMember: { [ana]: 0, [bruno]: 100000 },
    })

    expect(amountsOf(shares(row))).toEqual([0, 100000])
  })
})

describe('switching an Expense between rules', () => {
  it('changes the Shares without touching anything else about the Expense', () => {
    earning([
      [ana, 300000],
      [bruno, 100000],
    ])
    const row = rent(120000, [ana, bruno], { kind: 'even' })
    expect(amountsOf(shares(row))).toEqual([60000, 60000])

    const edited = editExpenseSnapshot(household, '2026-07', row.id, {
      splitRule: { kind: 'proportional' },
    })
    household = edited.household

    expect(amountsOf(shares(edited.row))).toEqual([90000, 30000])
    expect(edited.row.name).toBe('Rent')
    expect(edited.row.id).toBe(row.id)
  })
})
