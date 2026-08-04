import { describe, expect, it } from 'vitest'
import { addExpenseSnapshot, openMonth, setUpHousehold, type Household } from '../domain/index.js'
import { localStorageStore } from './local-storage-store.js'
import { describePort } from './port-contract.js'
import { StorageError } from './port.js'

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

describePort('the browser’s own storage', () => {
  const storage = fakeStorage()
  return { client: () => localStorageStore(storage), close: () => storage.clear() }
})

describe('the localStorage adapter', () => {
  it('keeps the Household across a fresh adapter over the same storage', async () => {
    const storage = fakeStorage()
    const created = household()
    await localStorageStore(storage).createHousehold(created)

    expect(await localStorageStore(storage).loadHousehold()).toEqual(created)
  })

  it('reports rather than guesses when what is stored cannot be read', async () => {
    const storage = fakeStorage()
    storage.setItem('prometheus.household', '{ not json')

    await expect(localStorageStore(storage).loadHousehold()).rejects.toBeInstanceOf(StorageError)
  })

  it('reads browser data written before Line Items existed, every Expense simple', async () => {
    const storage = fakeStorage()
    const of = household()
    const created = addExpenseSnapshot(of, '2026-07', {
      name: 'Rent',
      category: 'Home',
      amount: 120000,
      participants: [of.roster[0]!.id],
    }).household
    /** v1.2 wrote no `lines` key at all, which is what the engine must not trip over. */
    const legacy = JSON.parse(JSON.stringify(created))
    for (const month of Object.values<any>(legacy.months)) {
      for (const row of month.expenses) delete row.lines
    }
    storage.setItem('prometheus.household', JSON.stringify({ shape: 1, household: legacy }))

    const loaded = await localStorageStore(storage).loadHousehold()

    expect(loaded!.months['2026-07']!.expenses[0]!.lines).toEqual([])
    /** And the Household is usable, not merely readable: opening the next Month inherits. */
    expect(() => openMonth(loaded!, '2026-08')).not.toThrow()
  })

  it('reads browser data written before the stored shape carried a version', async () => {
    const storage = fakeStorage()
    const created = household()
    storage.setItem('prometheus.household', JSON.stringify(created))

    expect(await localStorageStore(storage).loadHousehold()).toEqual(created)
  })

  it('leaves data written before the version readable after it has been written to again', async () => {
    const storage = fakeStorage()
    const created = household()
    storage.setItem('prometheus.household', JSON.stringify(created))
    const store = localStorageStore(storage)

    await store.writeRow('2026-07', 'income', {
      id: 'salary',
      name: 'Salary',
      member: 'ana',
      amount: 320000,
      restrictedUse: false,
      reviewed: true,
      oneOff: false,
    })

    expect((await localStorageStore(storage).loadHousehold())!.months['2026-07']!.income).toHaveLength(1)
  })
})
