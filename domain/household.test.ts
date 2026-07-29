import { describe, expect, it } from 'vitest'
import { relabelCurrency, setUpHousehold } from './household.js'
import { DomainError } from './errors.js'

const euro = { code: 'EUR', symbol: '€', decimals: 2 }

describe('setting up a Household', () => {
  it('takes a currency, a Roster and the Month to start from', () => {
    const household = setUpHousehold({
      currency: euro,
      memberNames: ['Ana', 'Bruno'],
      startingMonth: '2026-07',
    })

    expect(household.currency).toEqual(euro)
    expect(household.roster.map((member) => member.name)).toEqual(['Ana', 'Bruno'])
    expect(Object.keys(household.months)).toEqual(['2026-07'])
  })

  it('puts every member of the Roster on it as active', () => {
    const household = setUpHousehold({
      currency: euro,
      memberNames: ['Ana', 'Bruno'],
      startingMonth: '2026-07',
    })

    expect(household.roster.every((member) => member.active)).toBe(true)
  })

  it('gives each member an identity of their own', () => {
    const household = setUpHousehold({
      currency: euro,
      memberNames: ['Ana', 'Ana'],
      startingMonth: '2026-07',
    })

    const [first, second] = household.roster
    expect(first!.id).not.toEqual(second!.id)
  })

  it('will not proceed without a currency', () => {
    expect(() =>
      setUpHousehold({
        currency: { code: '', symbol: '', decimals: 2 },
        memberNames: ['Ana'],
        startingMonth: '2026-07',
      }),
    ).toThrow(DomainError)
  })

  it('will not proceed without anybody on the Roster', () => {
    expect(() =>
      setUpHousehold({ currency: euro, memberNames: [], startingMonth: '2026-07' }),
    ).toThrow(DomainError)
  })

  it('will not proceed without a Month to start from', () => {
    expect(() =>
      setUpHousehold({ currency: euro, memberNames: ['Ana'], startingMonth: '' }),
    ).toThrow(DomainError)
  })

  it('records the currency’s decimal precision', () => {
    const yen = setUpHousehold({
      currency: { code: 'JPY', symbol: '¥', decimals: 0 },
      memberNames: ['Ana'],
      startingMonth: '2026-07',
    })

    expect(yen.currency.decimals).toBe(0)
  })
})

describe('relabelling the currency', () => {
  const household = setUpHousehold({
    currency: euro,
    memberNames: ['Ana'],
    startingMonth: '2026-07',
  })

  it('changes what amounts are called and nothing else', () => {
    const relabelled = relabelCurrency(household, { code: 'GBP', symbol: '£', decimals: 2 })

    expect(relabelled.currency).toEqual({ code: 'GBP', symbol: '£', decimals: 2 })
    expect(relabelled.months).toEqual(household.months)
    expect(relabelled.roster).toEqual(household.roster)
  })

  it('is refused for a currency of different decimal precision', () => {
    expect(() => relabelCurrency(household, { code: 'JPY', symbol: '¥', decimals: 0 })).toThrow(
      DomainError,
    )
  })

  it('leaves the Household untouched when it is refused', () => {
    try {
      relabelCurrency(household, { code: 'JPY', symbol: '¥', decimals: 0 })
    } catch {
      // the refusal is asserted above
    }

    expect(household.currency).toEqual(euro)
  })
})
