import { describe, expect, it } from 'vitest'
import type { MemberId, Month } from '../domain/index.js'
import { displayedViewer, viewerOptions, viewerToPin } from './viewer.js'

const roster = (
  ...members: { id: MemberId; name: string; active: boolean }[]
): { id: MemberId; name: string; active: boolean }[] => members

const ADA = { id: 'ada', name: 'Ada', active: true }
const BRUNO = { id: 'bruno', name: 'Bruno', active: true }
const MIRA = { id: 'mira', name: 'Mira', active: true }
const ZOE = { id: 'zoe', name: 'Zoe', active: false }

/** Only the member list matters here; the rail leads with the Month's first. */
const monthOf = (...members: MemberId[]): Month => ({ members }) as Month

describe('who the picker names', () => {
  it('names the Month’s first member when this device has picked nobody', () => {
    expect(displayedViewer(undefined, monthOf('bruno', 'ada'), roster(ADA, BRUNO))).toBe('bruno')
  })

  it('names the picked member when the Month has them', () => {
    expect(displayedViewer('ada', monthOf('bruno', 'ada'), roster(ADA, BRUNO))).toBe('ada')
  })

  it('substitutes the Month’s first member where the picked one is not in it', () => {
    expect(displayedViewer('mira', monthOf('bruno', 'ada'), roster(ADA, BRUNO, MIRA))).toBe('bruno')
  })

  it('names the picked member again on a Month that does have them', () => {
    const stored: MemberId = 'mira'
    displayedViewer(stored, monthOf('bruno', 'ada'), roster(ADA, BRUNO, MIRA))

    expect(displayedViewer(stored, monthOf('ada', 'mira'), roster(ADA, BRUNO, MIRA))).toBe('mira')
  })

  it('names the Roster’s first active member on an unopened Month with nothing picked', () => {
    expect(displayedViewer(undefined, undefined, roster(ZOE, BRUNO, ADA))).toBe('bruno')
  })

  it('keeps naming the picked member on an unopened Month', () => {
    expect(displayedViewer('ada', undefined, roster(ZOE, BRUNO, ADA))).toBe('ada')
  })

  it('names nobody where there is neither a Month nor an active member to name', () => {
    expect(displayedViewer(undefined, undefined, roster(ZOE))).toBeUndefined()
  })

  /**
   * What a device holds after an import: a pick made against a Household that no longer
   * exists. It names nobody, so it falls through exactly as an unpicked device does —
   * rather than naming an identity nothing can look up.
   */
  it('falls through a pick the Roster has never heard of, on an unopened Month', () => {
    expect(displayedViewer('gone', undefined, roster(ZOE, BRUNO, ADA))).toBe('bruno')
  })

  it('falls through a pick the Roster has never heard of, on an opened one', () => {
    expect(displayedViewer('gone', monthOf('bruno', 'ada'), roster(ADA, BRUNO))).toBe('bruno')
  })
})

describe('what the first load pins', () => {
  it('pins the Month’s first member when nothing is stored', () => {
    expect(viewerToPin(undefined, monthOf('bruno', 'ada'))).toBe('bruno')
  })

  it('pins nothing on an unopened Month — the write waits', () => {
    expect(viewerToPin(undefined, undefined)).toBeUndefined()
  })

  it('pins nothing when this device has already picked', () => {
    expect(viewerToPin('mira', monthOf('bruno', 'ada'))).toBeUndefined()
  })

  it('pins nothing where the picked member is absent from the Month, so browsing never writes', () => {
    expect(viewerToPin('mira', monthOf('bruno', 'ada'))).toBeUndefined()
  })

  it('pins nothing on a Month with no members at all', () => {
    expect(viewerToPin(undefined, monthOf())).toBeUndefined()
  })
})

describe('what the picker offers', () => {
  it('offers every active member', () => {
    expect(viewerOptions(roster(ADA, BRUNO), 'ada').map((member) => member.id)).toEqual([
      'ada',
      'bruno',
    ])
  })

  it('keeps a member deactivated since being picked listed and selectable', () => {
    expect(viewerOptions(roster(ADA, ZOE), 'zoe').map((member) => member.id)).toEqual(['ada', 'zoe'])
  })

  it('lists the member being named even when they are the Month’s substituted fallback', () => {
    expect(viewerOptions(roster(ADA, ZOE), 'zoe')).toHaveLength(2)
  })

  it('leaves out a deactivated member nobody is naming', () => {
    expect(viewerOptions(roster(ADA, ZOE), 'ada').map((member) => member.id)).toEqual(['ada'])
  })

  it('offers no option standing for nobody', () => {
    expect(viewerOptions(roster(ADA, BRUNO), undefined).map((member) => member.id)).toEqual([
      'ada',
      'bruno',
    ])
  })
})
