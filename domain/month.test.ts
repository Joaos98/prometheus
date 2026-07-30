import { describe, expect, it } from 'vitest'
import { addExpenseSnapshot } from './expenses.js'
import { setUpHousehold } from './household.js'
import { addIncomeSnapshot } from './income.js'
import { addSavingsGoal } from './goals.js'
import {
  discardMonth,
  entryCount,
  isOpened,
  monthAt,
  openMonth,
  openedMonthKeys,
  previousMonthKey,
} from './month.js'
import { DomainError } from './errors.js'
import type { Household } from './types.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

const householdOf = (memberNames: string[], startingMonth = '2026-07'): Household =>
  setUpHousehold({ currency: euro, memberNames, startingMonth })

const nameOf = (household: Household, memberId: string): string =>
  household.roster.find((member) => member.id === memberId)!.name

describe('the first Month of a Household', () => {
  const household = householdOf(['Ana', 'Bruno'])
  const july = monthAt(household, '2026-07')!

  it('holds the active Roster', () => {
    expect(july.members.map((id) => nameOf(household, id))).toEqual(['Ana', 'Bruno'])
  })

  it('holds no rows, which is not an error — nothing precedes it', () => {
    expect(july.income).toEqual([])
    expect(july.expenses).toEqual([])
    expect(july.goals).toEqual([])
  })

  it('is opened', () => {
    expect(isOpened(household, '2026-07')).toBe(true)
  })
})

describe('a Month that has not been opened', () => {
  const household = householdOf(['Ana'])

  it('is absent from the Household', () => {
    expect(monthAt(household, '2026-08')).toBeUndefined()
    expect(isOpened(household, '2026-08')).toBe(false)
  })

  it('is not opened by browsing it', () => {
    monthAt(household, '2026-08')

    expect(Object.keys(household.months)).toEqual(['2026-07'])
  })

  it('is distinct from an opened Month holding no rows', () => {
    const august = monthAt(openMonth(household, '2026-08'), '2026-08')

    expect(august).toBeDefined()
    expect(august!.expenses).toEqual([])
    expect(monthAt(household, '2026-09')).toBeUndefined()
  })
})

describe('opening a Month', () => {
  it('identifies it by year and month', () => {
    const opened = openMonth(householdOf(['Ana']), '2026-11')

    expect(monthAt(opened, '2026-11')!.key).toBe('2026-11')
  })

  it('leaves the Household it was given untouched', () => {
    const household = householdOf(['Ana'])

    openMonth(household, '2026-08')

    expect(Object.keys(household.months)).toEqual(['2026-07'])
  })

  it('is refused for a Month that is already opened', () => {
    expect(() => openMonth(householdOf(['Ana']), '2026-07')).toThrow(DomainError)
  })

  it('is refused for anything that is not a year and a month', () => {
    expect(() => openMonth(householdOf(['Ana']), '2026-13')).toThrow(DomainError)
    expect(() => openMonth(householdOf(['Ana']), 'August')).toThrow(DomainError)
  })

  it('starts from the Previous Month’s members, dropping anyone now inactive', () => {
    const household = householdOf(['Ana', 'Bruno'])
    const withoutBruno: Household = {
      ...household,
      roster: household.roster.map((member) =>
        member.name === 'Bruno' ? { ...member, active: false } : member,
      ),
    }

    const august = monthAt(openMonth(withoutBruno, '2026-08'), '2026-08')!

    expect(august.members.map((id) => nameOf(household, id))).toEqual(['Ana'])
  })

  it('leaves an already-opened Month naming a since-deactivated member untouched', () => {
    const household = householdOf(['Ana', 'Bruno'])

    expect(monthAt(household, '2026-07')!.members.map((id) => nameOf(household, id))).toEqual([
      'Ana',
      'Bruno',
    ])
  })
})

/** A Month carrying one of each kind of row, so a count has something to count. */
function populated(): Household {
  const household = householdOf(['Ana', 'Bruno'])
  const ana = household.roster[0]!.id
  const withIncome = addIncomeSnapshot(household, '2026-07', {
    name: 'Salary',
    member: ana,
    amount: 320000,
  }).household
  const withExpense = addExpenseSnapshot(withIncome, '2026-07', {
    name: 'Rent',
    category: 'Home',
    amount: 120000,
    participants: household.roster.map((member) => member.id),
  }).household
  return addSavingsGoal(withExpense, '2026-07', {
    name: 'Holiday',
    target: 200000,
    participants: [ana],
  }).household
}

describe('what a Month would lose', () => {
  it('counts every row it holds, of every kind', () => {
    expect(entryCount(monthAt(populated(), '2026-07')!)).toBe(3)
  })

  it('is nothing for a Month opened holding no rows', () => {
    expect(entryCount(monthAt(householdOf(['Ana']), '2026-07')!)).toBe(0)
  })
})

describe('discarding a Month', () => {
  it('returns it to unopened rather than emptying it', () => {
    const after = discardMonth(populated(), '2026-07')

    expect(isOpened(after, '2026-07')).toBe(false)
    expect(monthAt(after, '2026-07')).toBeUndefined()
  })

  it('removes every row it held', () => {
    const after = discardMonth(populated(), '2026-07')

    expect(openedMonthKeys(after)).toEqual([])
  })

  it('leaves every other Month untouched', () => {
    const household = openMonth(openMonth(populated(), '2026-08'), '2026-09')

    const after = discardMonth(household, '2026-08')

    expect(openedMonthKeys(after)).toEqual(['2026-07', '2026-09'])
    expect(monthAt(after, '2026-07')).toEqual(monthAt(household, '2026-07'))
    expect(monthAt(after, '2026-09')).toEqual(monthAt(household, '2026-09'))
  })

  it('leaves the Household it was given untouched', () => {
    const household = populated()

    discardMonth(household, '2026-07')

    expect(isOpened(household, '2026-07')).toBe(true)
  })

  it('is refused for a Month that was never opened', () => {
    expect(() => discardMonth(householdOf(['Ana']), '2026-08')).toThrow(DomainError)
  })

  it('is refused for anything that is not a year and a month', () => {
    expect(() => discardMonth(householdOf(['Ana']), 'August')).toThrow(DomainError)
  })

  it('frees the Month to be opened afresh from the Previous Month', () => {
    const august = openMonth(populated(), '2026-08')
    const edited = addExpenseSnapshot(august, '2026-08', {
      name: 'Bicycle',
      category: 'One-time',
      amount: 45000,
      participants: monthAt(august, '2026-08')!.members,
    }).household

    const reopened = openMonth(discardMonth(edited, '2026-08'), '2026-08')

    expect(monthAt(reopened, '2026-08')).toEqual(monthAt(august, '2026-08'))
  })

  it('leaves the Month after it inheriting across the gap it opens', () => {
    const household = openMonth(openMonth(populated(), '2026-08'), '2026-09')

    const after = discardMonth(household, '2026-08')

    expect(previousMonthKey(after, '2026-09')).toBe('2026-07')
  })
})

describe('the Previous Month', () => {
  const household = openMonth(householdOf(['Ana'], '2026-03'), '2026-07')

  it('is the nearest opened Month before this one', () => {
    expect(previousMonthKey(household, '2026-08')).toBe('2026-07')
  })

  it('skips the Months in a gap', () => {
    expect(previousMonthKey(household, '2026-06')).toBe('2026-03')
  })

  it('does not exist before the earliest opened Month', () => {
    expect(previousMonthKey(household, '2026-01')).toBeUndefined()
  })

  it('is not the Month itself', () => {
    expect(previousMonthKey(household, '2026-07')).toBe('2026-03')
  })
})
