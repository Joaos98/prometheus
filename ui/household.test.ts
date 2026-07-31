import { describe, expect, it } from 'vitest'
import { seedHousehold } from '../demo/seed.js'
import { openedMonthKeys, type ExpenseDraft, type Household, type Setup } from '../domain/index.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'
import { householdOver, type Seed } from './household.js'
import { thisMonth } from './months.js'

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

/**
 * A store that takes time to answer, as one over a network does. The browser's own storage
 * answers in the same microtask, which is what has been hiding the question this asks.
 */
function slowly(store: HouseholdStore, delay = 5): HouseholdStore {
  const wait = (): Promise<void> => new Promise((done) => setTimeout(done, delay))
  const slow =
    <A extends unknown[], R>(operation: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      await wait()
      return operation(...args)
    }
  return {
    loadHousehold: slow(store.loadHousehold.bind(store)),
    createHousehold: slow(store.createHousehold.bind(store)),
    openMonth: slow(store.openMonth.bind(store)),
    discardMonth: slow(store.discardMonth.bind(store)),
    writeRow: slow(store.writeRow.bind(store)),
    deleteRow: slow(store.deleteRow.bind(store)),
    replaceHousehold: slow(store.replaceHousehold.bind(store)),
  }
}

const setup: Setup = {
  currency: { code: 'EUR', symbol: '€', decimals: 2 },
  memberNames: ['Ana', 'Bruno'],
  startingMonth: '2026-07',
}

const expense = (name: string, amount: number, household: Household): ExpenseDraft => ({
  name,
  category: 'Home',
  amount,
  participants: household.roster.map((member) => member.id),
})

describe('the Household the app is showing', () => {
  it('keeps both changes on screen when the store takes its time', async () => {
    const storage = fakeStorage()
    const app = householdOver(slowly(localStorageStore(storage)))
    await app.setUp(setup)
    const roster = app.household.value!

    await Promise.all([
      app.addExpense('2026-07', expense('Rent', 120000, roster)),
      app.addExpense('2026-07', expense('Groceries', 30000, roster)),
    ])

    const showing = app.household.value!.months['2026-07']!.expenses
    expect(showing.map((row) => row.name)).toEqual(['Rent', 'Groceries'])
  })

  it('shows what it stored, and stores what it shows', async () => {
    const storage = fakeStorage()
    const app = householdOver(slowly(localStorageStore(storage)))
    await app.setUp(setup)
    const roster = app.household.value!

    await Promise.all([
      app.addExpense('2026-07', expense('Rent', 120000, roster)),
      app.addIncome('2026-07', { name: 'Salary', member: roster.roster[0]!.id, amount: 320000 }),
      app.addExpense('2026-07', expense('Groceries', 30000, roster)),
    ])

    const stored = await localStorageStore(storage).loadHousehold()
    expect(stored!.months['2026-07']).toEqual(app.household.value!.months['2026-07'])
  })

  it('takes up what the other member wrote when it asks again', async () => {
    const storage = fakeStorage()
    const store = localStorageStore(storage)
    const app = householdOver(store)
    await app.setUp(setup)
    const roster = app.household.value!
    await app.addExpense('2026-07', expense('Rent', 120000, roster))

    const bruno = householdOver(store)
    await bruno.load()
    await bruno.addExpense('2026-07', expense('Groceries', 30000, bruno.household.value!))
    await app.refresh()

    expect(app.household.value!.months['2026-07']!.expenses.map((row) => row.name)).toEqual([
      'Rent',
      'Groceries',
    ])
  })

  it('leaves a change in flight alone when it asks what has changed', async () => {
    const storage = fakeStorage()
    const app = householdOver(slowly(localStorageStore(storage)))
    await app.setUp(setup)
    const roster = app.household.value!

    const writing = app.addExpense('2026-07', expense('Rent', 120000, roster))
    const asking = app.refresh()
    await Promise.all([writing, asking])

    expect(app.household.value!.months['2026-07']!.expenses.map((row) => row.name)).toEqual(['Rent'])
  })
})

describe('a build that has a Household to start from', () => {
  const sample: Seed = () => seedHousehold(thisMonth())

  it('shows the sample Household to a browser with nothing stored', async () => {
    const storage = fakeStorage()
    const app = householdOver(localStorageStore(storage), sample)
    await app.load()

    expect(app.household.value!.roster.map((member) => member.name)).toEqual([
      'Ada',
      'Bruno',
      'Mira',
    ])
    expect(await localStorageStore(storage).loadHousehold()).toBeDefined()
  })

  it('lands a visitor in the Month the calendar is on rather than the Month opened ahead', async () => {
    const app = householdOver(localStorageStore(fakeStorage()), sample)
    await app.load()

    expect(app.viewing.value).toBe(thisMonth())
    expect(openedMonthKeys(app.household.value!).at(-1)).not.toBe(thisMonth())
  })

  it('lands a returning visitor in that same Month too', async () => {
    const store = localStorageStore(fakeStorage())
    await householdOver(store, sample).load()

    const returning = householdOver(store, sample)
    await returning.load()

    expect(returning.viewing.value).toBe(thisMonth())
  })

  it('keeps what a visitor changed, rather than sowing the sample again', async () => {
    const storage = fakeStorage()
    const store = localStorageStore(storage)
    const app = householdOver(store, sample)
    await app.load()
    await app.addExpense(thisMonth(), expense('Piano lessons', 6000, app.household.value!))

    const returning = householdOver(store, sample)
    await returning.load()

    expect(
      returning.household.value!.months[thisMonth()]!.expenses.map((row) => row.name),
    ).toContain('Piano lessons')
  })

  it('leaves a Household a visitor has emptied emptied', async () => {
    const storage = fakeStorage()
    const store = localStorageStore(storage)
    const app = householdOver(store, sample)
    await app.load()
    for (const key of openedMonthKeys(app.household.value!)) await app.discard(key)

    const returning = householdOver(store, sample)
    await returning.load()

    expect(openedMonthKeys(returning.household.value!)).toEqual([])
  })

  it('puts the sample Household back when it is reset', async () => {
    const app = householdOver(localStorageStore(fakeStorage()), sample)
    await app.load()
    await app.addExpense(thisMonth(), expense('Piano lessons', 6000, app.household.value!))
    await app.reset()

    expect(
      app.household.value!.months[thisMonth()]!.expenses.map((row) => row.name),
    ).not.toContain('Piano lessons')
    expect(app.viewing.value).toBe(thisMonth())
  })

  it('offers no reset, and sows nothing, where there is no Household to start from', async () => {
    const app = householdOver(localStorageStore(fakeStorage()))
    await app.load()

    expect(app.seeded).toBe(false)
    expect(app.household.value).toBeUndefined()
  })
})
