import { describe, expect, it } from 'vitest'
import {
  addMember,
  deactivateMember,
  reactivateMember,
  relabelCurrency,
  setUpHousehold,
} from './household.js'
import { openMonth } from './month.js'
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

describe('managing the Roster after setup', () => {
  function setUp(): ReturnType<typeof setUpHousehold> {
    return setUpHousehold({
      currency: euro,
      memberNames: ['Ana', 'Bruno'],
      startingMonth: '2026-07',
    })
  }

  it('adds a member to the Roster, active, and absent from already-opened Months', () => {
    const household = setUp()
    const after = addMember(household, 'Carla')

    const added = after.roster.find((member) => member.name === 'Carla')
    expect(added?.active).toBe(true)
    expect(after.months['2026-07']!.members).toEqual(household.months['2026-07']!.members)
  })

  it('includes a newly added member in a Month opened afterwards', () => {
    const household = addMember(setUp(), 'Carla')
    const carla = household.roster.find((member) => member.name === 'Carla')!

    const after = openMonth(household, '2026-08')

    expect(after.months['2026-08']!.members).toContain(carla.id)
  })

  it('will not add a member with no name', () => {
    expect(() => addMember(setUp(), '  ')).toThrow(DomainError)
  })

  it('deactivates a member, absent from Months opened afterwards', () => {
    const household = setUp()
    const [ana, bruno] = household.roster

    const after = deactivateMember(household, bruno!.id)
    const opened = openMonth(after, '2026-08')

    expect(opened.months['2026-08']!.members).toEqual([ana!.id])
    expect(opened.roster.find((member) => member.id === bruno!.id)?.active).toBe(false)
  })

  it('changes nothing about a Month already opened when a member is deactivated', () => {
    const household = setUp()
    const bruno = household.roster[1]!
    const before = household.months['2026-07']

    const after = deactivateMember(household, bruno.id)

    expect(after.months['2026-07']).toEqual(before)
  })

  it('never deletes a deactivated member — a past Month still names them', () => {
    const household = setUp()
    const bruno = household.roster[1]!

    const after = deactivateMember(household, bruno.id)

    expect(after.roster.some((member) => member.id === bruno.id)).toBe(true)
    expect(after.months['2026-07']!.members).toContain(bruno.id)
  })

  it('reactivates a member, appearing afterwards with no record of the absence', () => {
    const household = setUp()
    const bruno = household.roster[1]!

    const deactivated = deactivateMember(household, bruno.id)
    const reactivated = reactivateMember(deactivated, bruno.id)

    expect(reactivated.roster.find((member) => member.id === bruno.id)?.active).toBe(true)

    const opened = openMonth(reactivated, '2026-08')
    expect(opened.months['2026-08']!.members).toContain(bruno.id)
  })

  it('will not deactivate or reactivate somebody who is not on the Roster', () => {
    const household = setUp()

    expect(() => deactivateMember(household, 'not-a-member')).toThrow(DomainError)
    expect(() => reactivateMember(household, 'not-a-member')).toThrow(DomainError)
  })

  it('opening a Month with no Previous Month takes the active Roster, not a copied member list', () => {
    const household = addMember(setUp(), 'Carla')
    const carla = household.roster.find((member) => member.name === 'Carla')!

    expect(household.months['2026-07']!.members).not.toContain(carla.id)
  })
})
