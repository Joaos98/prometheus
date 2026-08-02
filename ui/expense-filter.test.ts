import { describe, expect, it } from 'vitest'
import type { MemberId } from '../domain/index.js'
import { filterNote, participantChoices, participantsIn } from './expense-filter.js'

const rent = { name: 'Rent', participants: ['ada', 'bruno', 'mira'] as MemberId[] }
const gym = { name: 'Gym', participants: ['ada'] as MemberId[] }
const commute = { name: 'Commute', participants: ['bruno'] as MemberId[] }
const all = [rent, gym, commute]

const members = [
  { id: 'ada', name: 'Ada' },
  { id: 'bruno', name: 'Bruno' },
]

const nameOf = (id: MemberId): string =>
  ({ ada: 'Ada', bruno: 'Bruno', mira: 'Mira' })[id] ?? 'Unknown member'

describe('narrowing the list to one Participant', () => {
  it('shows everything when nobody is picked', () => {
    expect(participantsIn(all, undefined)).toEqual(all)
  })

  it('keeps the Expenses that member is a Participant of', () => {
    expect(participantsIn(all, 'ada').map((one) => one.name)).toEqual(['Rent', 'Gym'])
  })

  it('leaves out the ones they are not in', () => {
    expect(participantsIn(all, 'bruno').map((one) => one.name)).toEqual(['Rent', 'Commute'])
  })

  it('shows nothing rather than everything for somebody in none of them', () => {
    expect(participantsIn(all, 'zoe')).toEqual([])
  })

  /** The lens never repositions itself: a row saved out of it leaves, and the count says so. */
  it('drops an Expense whose Participants no longer include the filtered member', () => {
    const rewritten = [{ name: 'Gym', participants: ['bruno'] as MemberId[] }]

    expect(participantsIn(rewritten, 'ada')).toEqual([])
  })
})

describe('what the panel header says while filtered', () => {
  it('says nothing at all when nobody is picked', () => {
    expect(filterNote(undefined, 3, 3)).toBeUndefined()
  })

  it('states how many of how many are shown', () => {
    expect(filterNote('ada', 2, 3)).toBe('Showing 2 of 3')
  })

  /** A member absent from this Month is explained by the count, not by moving the filter. */
  it('accounts for a filter that hides everything', () => {
    expect(filterNote('mira', 0, 3)).toBe('Showing 0 of 3')
  })
})

describe('who the picker offers', () => {
  it('offers the Month’s members', () => {
    expect(participantChoices(members, undefined, nameOf)).toEqual(members)
  })

  it('leaves the Month’s members alone when the filtered one is among them', () => {
    expect(participantChoices(members, 'ada', nameOf)).toEqual(members)
  })

  it('adds the filtered member where this Month has not got them, so the picker is never blank', () => {
    expect(participantChoices(members, 'mira', nameOf)).toEqual([
      ...members,
      { id: 'mira', name: 'Mira' },
    ])
  })

  it('names somebody the Roster no longer holds rather than showing an identity', () => {
    expect(participantChoices(members, 'zoe', nameOf)).toEqual([
      ...members,
      { id: 'zoe', name: 'Unknown member' },
    ])
  })
})
