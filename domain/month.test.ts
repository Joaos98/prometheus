import { describe, expect, it } from 'vitest'
import { setUpHousehold } from './household.js'
import { isOpened, monthAt, openMonth, previousMonthKey } from './month.js'
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

  it('takes its members from the Previous Month rather than from the Roster', () => {
    const household = householdOf(['Ana', 'Bruno'])
    const withoutBruno: Household = {
      ...household,
      roster: household.roster.map((member) =>
        member.name === 'Bruno' ? { ...member, active: false } : member,
      ),
    }

    const august = monthAt(openMonth(withoutBruno, '2026-08'), '2026-08')!

    expect(august.members.map((id) => nameOf(household, id))).toEqual(['Ana', 'Bruno'])
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
