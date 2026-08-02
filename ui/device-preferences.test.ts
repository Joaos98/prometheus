import { describe, expect, it } from 'vitest'
import {
  devicePreferencesOver,
  readExpenseFilter,
  readLeftoverDisplay,
  readViewer,
  writeExpenseFilter,
  writeLeftoverDisplay,
  writeViewer,
} from './device-preferences.js'

/** Enough of the browser's Storage to stand in for it outside a browser. */
function fakeStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => void entries.delete(key),
    setItem: (key, value) => void entries.set(key, value),
  }
}

describe('the Viewer', () => {
  it('is nothing until this device picks one', () => {
    expect(readViewer(fakeStorage())).toBeUndefined()
  })

  it('is what was last written, read back', () => {
    const storage = fakeStorage()
    writeViewer(storage, 'ana')

    expect(readViewer(storage)).toBe('ana')
  })

  it('goes back to nothing when written as nothing', () => {
    const storage = fakeStorage()
    writeViewer(storage, 'ana')
    writeViewer(storage, undefined)

    expect(readViewer(storage)).toBeUndefined()
  })

  it('does not touch a second device’s storage', () => {
    const here = fakeStorage()
    const there = fakeStorage()
    writeViewer(here, 'ana')

    expect(readViewer(there)).toBeUndefined()
  })
})

describe('the Leftover Balance display', () => {
  it('defaults to Spendable Income', () => {
    expect(readLeftoverDisplay(fakeStorage())).toBe('spendable')
  })

  it('is what was last written, read back', () => {
    const storage = fakeStorage()
    writeLeftoverDisplay(storage, 'total')

    expect(readLeftoverDisplay(storage)).toBe('total')
  })

  it('ignores a stored value it does not recognise, and answers Spendable Income', () => {
    const storage = fakeStorage()
    storage.setItem('prometheus.leftover-display', 'garbage')

    expect(readLeftoverDisplay(storage)).toBe('spendable')
  })
})

describe('the Expenses filter', () => {
  it('is everyone until this device picks a Participant', () => {
    expect(readExpenseFilter(fakeStorage())).toBeUndefined()
  })

  it('is what was last written, read back', () => {
    const storage = fakeStorage()
    writeExpenseFilter(storage, 'ana')

    expect(readExpenseFilter(storage)).toBe('ana')
  })

  it('goes back to everyone when written as nothing', () => {
    const storage = fakeStorage()
    writeExpenseFilter(storage, 'ana')
    writeExpenseFilter(storage, undefined)

    expect(readExpenseFilter(storage)).toBeUndefined()
  })

  it('is nothing to do with the Viewer — writing one leaves the other alone', () => {
    const storage = fakeStorage()
    writeViewer(storage, 'ana')
    writeExpenseFilter(storage, 'bruno')

    expect(readViewer(storage)).toBe('ana')
    expect(readExpenseFilter(storage)).toBe('bruno')
  })

  it('does not touch a second device’s storage', () => {
    const here = fakeStorage()
    const there = fakeStorage()
    writeExpenseFilter(here, 'ana')

    expect(readExpenseFilter(there)).toBeUndefined()
  })
})

describe('device preferences, reactively', () => {
  it('starts from what the device already has stored', () => {
    const storage = fakeStorage()
    writeViewer(storage, 'ana')
    writeLeftoverDisplay(storage, 'total')

    const preferences = devicePreferencesOver(storage)

    expect(preferences.viewer.value).toBe('ana')
    expect(preferences.leftoverDisplay.value).toBe('total')
  })

  it('writes the Viewer back to storage as it changes', async () => {
    const storage = fakeStorage()
    const preferences = devicePreferencesOver(storage)

    preferences.viewer.value = 'bruno'
    await Promise.resolve()

    expect(readViewer(storage)).toBe('bruno')
  })

  it('writes the display choice back to storage as it changes', async () => {
    const storage = fakeStorage()
    const preferences = devicePreferencesOver(storage)

    preferences.leftoverDisplay.value = 'total'
    await Promise.resolve()

    expect(readLeftoverDisplay(storage)).toBe('total')
  })

  it('writes the Expenses filter back to storage as it changes', async () => {
    const storage = fakeStorage()
    const preferences = devicePreferencesOver(storage)

    preferences.expenseFilter.value = 'bruno'
    await Promise.resolve()

    expect(readExpenseFilter(storage)).toBe('bruno')
  })

  it('leaves the Viewer where it was when the filter changes', async () => {
    const storage = fakeStorage()
    writeViewer(storage, 'ana')
    const preferences = devicePreferencesOver(storage)

    preferences.expenseFilter.value = 'bruno'
    await Promise.resolve()

    expect(preferences.viewer.value).toBe('ana')
    expect(readViewer(storage)).toBe('ana')
  })
})
