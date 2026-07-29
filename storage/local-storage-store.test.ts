import { beforeEach, describe, expect, it } from 'vitest'
import { openMonth, setUpHousehold, type Household } from '../domain/index.js'
import { localStorageStore } from './local-storage-store.js'
import { StorageError, type HouseholdStore } from './port.js'

/** Enough of the browser's Storage for the adapter to be exercised without a browser. */
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

const household = (): Household =>
  setUpHousehold({
    currency: { code: 'EUR', symbol: '€', decimals: 2 },
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })

describe('the localStorage adapter', () => {
  let storage: Storage
  let store: HouseholdStore

  beforeEach(() => {
    storage = fakeStorage()
    store = localStorageStore(storage)
  })

  it('finds no Household before one has been set up', async () => {
    expect(await store.loadHousehold()).toBeUndefined()
  })

  it('loads back the Household that was created', async () => {
    const created = household()

    await store.createHousehold(created)

    expect(await store.loadHousehold()).toEqual(created)
  })

  it('keeps the Household across a fresh adapter over the same storage', async () => {
    const created = household()
    await store.createHousehold(created)

    expect(await localStorageStore(storage).loadHousehold()).toEqual(created)
  })

  it('will not create a second Household over the one already stored', async () => {
    await store.createHousehold(household())

    await expect(store.createHousehold(household())).rejects.toBeInstanceOf(StorageError)
  })

  it('records an opened Month', async () => {
    const created = household()
    await store.createHousehold(created)
    const august = openMonth(created, '2026-08').months['2026-08']!

    await store.openMonth(august)

    const loaded = await store.loadHousehold()
    expect(loaded!.months['2026-08']).toEqual(august)
  })

  it('refuses to open a Month before a Household exists', async () => {
    const august = openMonth(household(), '2026-08').months['2026-08']!

    await expect(store.openMonth(august)).rejects.toBeInstanceOf(StorageError)
  })

  it('writes a row without disturbing the other rows of the Month', async () => {
    await store.createHousehold(household())

    await store.writeRow('2026-07', 'expenses', { id: 'rent' })
    await store.writeRow('2026-07', 'expenses', { id: 'groceries' })

    const loaded = await store.loadHousehold()
    expect(loaded!.months['2026-07']!.expenses.map((row) => row.id)).toEqual(['rent', 'groceries'])
  })

  it('takes the last write to a row', async () => {
    await store.createHousehold(household())
    await store.writeRow('2026-07', 'income', { id: 'salary' })

    await store.writeRow('2026-07', 'income', { id: 'salary' })

    expect((await store.loadHousehold())!.months['2026-07']!.income).toHaveLength(1)
  })

  it('removes a row', async () => {
    await store.createHousehold(household())
    await store.writeRow('2026-07', 'goals', { id: 'holiday' })

    await store.deleteRow('2026-07', 'goals', 'holiday')

    expect((await store.loadHousehold())!.months['2026-07']!.goals).toEqual([])
  })

  it('refuses a row written to a Month that has not been opened', async () => {
    await store.createHousehold(household())

    await expect(store.writeRow('2026-08', 'expenses', { id: 'rent' })).rejects.toBeInstanceOf(
      StorageError,
    )
  })

  it('replaces the whole Household', async () => {
    await store.createHousehold(household())
    const other = setUpHousehold({
      currency: { code: 'GBP', symbol: '£', decimals: 2 },
      memberNames: ['Cleo'],
      startingMonth: '2025-01',
    })

    await store.replaceHousehold(other)

    expect(await store.loadHousehold()).toEqual(other)
  })

  it('reports rather than guesses when what is stored cannot be read', async () => {
    storage.setItem('prometheus.household', '{ not json')

    await expect(store.loadHousehold()).rejects.toBeInstanceOf(StorageError)
  })
})
