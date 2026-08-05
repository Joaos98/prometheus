import { describe, expect, it } from 'vitest'
import { SETTINGS_TITLES, toggleSettings } from './settings.js'

describe('which settings panel is open', () => {
  it('opens the one whose button was pressed', () => {
    expect(toggleSettings(undefined, 'roster')).toBe('roster')
  })

  it('closes the open one when its own button is pressed again', () => {
    expect(toggleSettings('roster', 'roster')).toBeUndefined()
  })

  it('replaces the open one when another button is pressed', () => {
    expect(toggleSettings('roster', 'currency')).toBe('currency')
  })

  it('never leaves two open, whatever the sequence', () => {
    const pressed = ['roster', 'currency', 'demo', 'household-file'] as const
    const open = pressed.reduce<ReturnType<typeof toggleSettings>>(
      (standing, button) => toggleSettings(standing, button),
      undefined,
    )

    expect(open).toBe('household-file')
  })
})

describe('what each settings modal is called', () => {
  it('names every panel', () => {
    expect(Object.keys(SETTINGS_TITLES).sort()).toEqual([
      'categories',
      'currency',
      'demo',
      'household-file',
      'payment-methods',
      'roster',
    ])
  })

  it('reads the masthead button back for the ones the button spells out', () => {
    expect(SETTINGS_TITLES.roster).toBe('Roster')
    expect(SETTINGS_TITLES.categories).toBe('Categories')
    expect(SETTINGS_TITLES['payment-methods']).toBe('Payment methods')
    expect(SETTINGS_TITLES['household-file']).toBe('Household file')
    expect(SETTINGS_TITLES.demo).toBe('Demo')
  })
})
