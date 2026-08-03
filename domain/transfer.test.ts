import { beforeEach, describe, expect, it } from 'vitest'
import { addExpenseSnapshot, setExpenseOneOff, removeExpenseSnapshot } from './expenses.js'
import { addSavingsGoal, recordContribution } from './goals.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot } from './income.js'
import { leftoverBalancesOf } from './leftover.js'
import { monthAt, openMonth } from './month.js'
import { propagateExpenseEdit } from './propagation.js'
import { unreviewedCount } from './review.js'
import { sharesOf } from './shares.js'
import { exportHousehold, importHousehold, whatImportReplaces } from './transfer.js'
import type { Household, MemberId } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

let household: Household
let ana: MemberId
let bruno: MemberId

/**
 * A Household with something of everything in it: two Months, every kind of row, a
 * custom rule, a Restricted-Use wage, a One-Off, a row removed, an amount left Pending
 * and an amount deliberately entered as zero.
 */
beforeEach(() => {
  household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })
  ana = household.roster[0]!.id
  bruno = household.roster[1]!.id

  household = addIncomeSnapshot(household, '2026-07', {
    name: 'Salary',
    member: ana,
    amount: 320000,
  }).household
  household = addIncomeSnapshot(household, '2026-07', {
    name: 'Meal vouchers',
    member: bruno,
    amount: 15000,
    restrictedUse: true,
  }).household
  household = addIncomeSnapshot(household, '2026-07', {
    name: 'Wage',
    member: bruno,
    amount: 210000,
  }).household

  household = addExpenseSnapshot(household, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount: 120000,
    participants: [ana, bruno],
    splitRule: { kind: 'proportional' },
  }).household
  household = addExpenseSnapshot(household, '2026-07', {
    name: 'Internet',
    category: 'Home',
    amount: 4500,
    participants: [ana, bruno],
    splitRule: { kind: 'percentage', byMember: { [ana]: 60, [bruno]: 40 } },
  }).household
  household = addExpenseSnapshot(household, '2026-07', {
    name: 'Gym',
    category: 'Health',
    amount: 3900,
    participants: [ana],
  }).household

  household = addSavingsGoal(household, '2026-07', {
    name: 'Deposit',
    target: 1000000,
    startAmount: 250000,
    participants: [ana, bruno],
  }).household
  household = recordContribution(
    household,
    '2026-07',
    monthAt(household, '2026-07')!.goals[0]!.id,
    ana,
    50000,
  ).household

  household = openMonth(household, '2026-08')
})

function exported(): Household {
  return importHousehold(exportHousehold(household))
}

describe('exporting the whole Household', () => {
  it('writes a single JSON file holding the currency, the Roster and every opened Month', () => {
    const file = JSON.parse(exportHousehold(household)) as Record<string, unknown>

    expect(file.currency).toEqual(euro)
    expect(file.roster).toEqual(household.roster)
    expect(Object.keys(file.months as object)).toEqual(['2026-07', '2026-08'])
  })

  it('carries nothing but the Household — the Viewer and its display toggles are not in it', () => {
    const file = JSON.parse(exportHousehold(household)) as Record<string, unknown>

    expect(Object.keys(file).filter((key) => !key.startsWith('prometheus')).sort()).toEqual([
      'currency',
      'format',
      'months',
      'roster',
    ])
  })
})

describe('importing a Household that was exported', () => {
  it('reproduces it exactly', () => {
    expect(exported()).toEqual(household)
  })

  it('recomputes every figure to the same values', () => {
    const before = monthAt(household, '2026-07')!
    const after = monthAt(exported(), '2026-07')!

    expect(leftoverBalancesOf(after)).toEqual(leftoverBalancesOf(before))
    expect(sharesOf(after, after.expenses[0]!)).toEqual(sharesOf(before, before.expenses[0]!))
    expect(sharesOf(after, after.expenses[1]!)).toEqual(sharesOf(before, before.expenses[1]!))
  })

  it('keeps a null amount null, an explicit zero zero, and an absent row absent', () => {
    const pending = addExpenseSnapshot(household, '2026-08', {
      name: 'Repairs',
      category: 'Home',
      amount: null,
      participants: [ana, bruno],
    }).household
    const zeroed = addExpenseSnapshot(pending, '2026-08', {
      name: 'Water',
      category: 'Home',
      amount: 0,
      participants: [ana, bruno],
    }).household
    const gym = monthAt(zeroed, '2026-08')!.expenses.find((row) => row.name === 'Gym')!
    household = removeExpenseSnapshot(zeroed, '2026-08', gym.id)

    const august = monthAt(exported(), '2026-08')!

    expect(august.expenses.find((row) => row.name === 'Repairs')!.amount).toBeNull()
    expect(august.expenses.find((row) => row.name === 'Water')!.amount).toBe(0)
    expect(august.expenses.some((row) => row.name === 'Gym')).toBe(false)
  })

  it('keeps an Unreviewed row Unreviewed', () => {
    const august = monthAt(household, '2026-08')!
    expect(unreviewedCount(august)).toBe(7)

    expect(unreviewedCount(monthAt(exported(), '2026-08')!)).toBe(7)
  })

  it('keeps the stable identities, so propagation still follows the same thread', () => {
    const rent = monthAt(household, '2026-07')!.expenses[0]!

    const carried = propagateExpenseEdit(exported(), '2026-07', rent.id, { amount: 125000 })

    expect(carried.changed).toEqual(['2026-08'])
    expect(monthAt(carried.household, '2026-08')!.expenses[0]!.amount).toBe(125000)
  })

  it('keeps One-Off and Restricted-Use flags, Participants and Split Rules', () => {
    const gym = monthAt(household, '2026-07')!.expenses[2]!
    household = setExpenseOneOff(household, '2026-07', gym.id, true).household

    const july = monthAt(exported(), '2026-07')!

    expect(july.income.find((row) => row.name === 'Meal vouchers')!.restrictedUse).toBe(true)
    expect(july.expenses.find((row) => row.name === 'Gym')!.oneOff).toBe(true)
    expect(july.expenses.find((row) => row.name === 'Gym')!.participants).toEqual([ana])
    expect(july.expenses.find((row) => row.name === 'Internet')!.splitRule).toEqual({
      kind: 'percentage',
      byMember: { [ana]: 60, [bruno]: 40 },
    })
    expect(july.goals[0]!.contributions).toEqual({ [ana]: 50000 })
  })

  it('reproduces a Household that has never had a Month opened past its first', () => {
    const fresh = setUpHousehold({ currency: euro, memberNames: ['Ana'], startingMonth: '2026-01' })

    expect(importHousehold(exportHousehold(fresh))).toEqual(fresh)
  })
})

describe('what an import will replace', () => {
  it('is the Household as it now stands — its Months, its entries and its Roster', () => {
    expect(whatImportReplaces(household)).toEqual({
      months: 2,
      entries: 14,
      members: 2,
      earliest: '2026-07',
      latest: '2026-08',
    })
  })

  it('names no Month when none has been opened', () => {
    expect(whatImportReplaces({ currency: euro, roster: [], months: {} })).toEqual({
      months: 0,
      entries: 0,
      members: 0,
      earliest: undefined,
      latest: undefined,
    })
  })
})

describe('a file that cannot be read', () => {
  const rejected = (mangle: (file: Record<string, any>) => void): void => {
    const file = JSON.parse(exportHousehold(household)) as Record<string, any>
    mangle(file)
    expect(() => importHousehold(JSON.stringify(file))).toThrow()
  }

  it('is rejected when it is not JSON at all', () => {
    expect(() => importHousehold('not a Household')).toThrow()
  })

  it('is rejected when it is JSON but not a Prometheus Household', () => {
    expect(() => importHousehold(JSON.stringify({ hello: 'there' }))).toThrow()
  })

  it('is rejected when it was written by a later version of Prometheus', () => {
    rejected((file) => {
      file.format = 99
    })
  })

  it('is rejected when the currency is missing or nonsense', () => {
    rejected((file) => delete file.currency)
    rejected((file) => {
      file.currency = { code: 'EUR', symbol: '€', decimals: 'two' }
    })
  })

  it('is rejected when a Month is not keyed by a year and a month', () => {
    rejected((file) => {
      file.months.july = file.months['2026-07']
    })
  })

  it('is rejected when a Month holds somebody who is not on the Roster', () => {
    rejected((file) => {
      file.months['2026-07'].members = ['a-stranger']
    })
  })

  it('is rejected when a row carries an amount that is not a whole number of minor units', () => {
    rejected((file) => {
      file.months['2026-07'].expenses[0].amount = 1200.5
    })
  })

  it('is rejected when a row has no amount field at all, which is not the same as null', () => {
    rejected((file) => delete file.months['2026-07'].expenses[0].amount)
  })

  it('is rejected when a Split Rule does not add up to its Expense', () => {
    rejected((file) => {
      file.months['2026-07'].expenses[1].splitRule = {
        kind: 'percentage',
        byMember: { [ana]: 60, [bruno]: 30 },
      }
    })
  })

  it('is rejected when an Expense divides among somebody who is not a member of its Month', () => {
    rejected((file) => {
      file.months['2026-07'].expenses[2].participants = [ana, 'a-stranger']
    })
  })

  it('is rejected when a Contribution comes from somebody not saving for the goal', () => {
    rejected((file) => {
      file.months['2026-07'].goals[0].participants = [ana]
      file.months['2026-07'].goals[0].contributions = { [ana]: 50000, [bruno]: 10000 }
    })
  })

  it('leaves the Household it was offered to completely unchanged', () => {
    const before = structuredClone(household)

    expect(() => importHousehold('{"prometheus":"household"}')).toThrow()

    expect(household).toEqual(before)
  })
})
