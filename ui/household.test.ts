import { describe, expect, it } from 'vitest'
import { seedHousehold } from '../demo/seed.js'
import {
  addCategory,
  addPaymentMethod,
  openedMonthKeys,
  setUpHousehold,
  type ExpenseDraft,
  type Household,
  type Setup,
} from '../domain/index.js'
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

/** A store that says what it was asked to do, in the order it was asked to do it. */
function recording(store: HouseholdStore): HouseholdStore & { calls: string[] } {
  const calls: string[] = []
  const noted =
    <A extends unknown[], R>(name: string, operation: (...args: A) => Promise<R>) =>
    (...args: A): Promise<R> => {
      calls.push(name)
      return operation(...args)
    }
  return {
    calls,
    loadHousehold: store.loadHousehold.bind(store),
    createHousehold: store.createHousehold.bind(store),
    openMonth: noted('openMonth', store.openMonth.bind(store)),
    discardMonth: noted('discardMonth', store.discardMonth.bind(store)),
    writeRow: noted('writeRow', store.writeRow.bind(store)),
    deleteRow: noted('deleteRow', store.deleteRow.bind(store)),
    replaceHousehold: noted('replaceHousehold', store.replaceHousehold.bind(store)),
  }
}

/** A store whose nth row write fails, as a network that drops halfway through does. */
function failingOnWrite(store: HouseholdStore, nth: number): HouseholdStore {
  let writes = 0
  return {
    ...store,
    writeRow: (month, kind, row) => {
      writes += 1
      if (writes === nth) return Promise.reject(new Error('The store gave up'))
      return store.writeRow(month, kind, row)
    },
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

  it('answers a repurpose with the identity it minted, so the change has somewhere to go', async () => {
    const app = householdOver(localStorageStore(fakeStorage()))
    await app.setUp(setup)
    const roster = app.household.value!
    await app.addExpense('2026-07', expense('Netflix', 1200, roster))
    await app.open('2026-08')
    await app.open('2026-09')
    const was = app.household.value!.months['2026-08']!.expenses[0]!.id

    const minted = await app.repurposeExpense('2026-08', was, { name: 'Gym', amount: 4000 })

    expect(minted).toBeDefined()
    expect(minted).not.toBe(was)
    /** September inherited the old thread, so it is on the new one — under its own name. */
    const september = app.household.value!.months['2026-09']!.expenses[0]!
    expect(september.id).toBe(minted)
    expect(september.name).toBe('Netflix')
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

/**
 * A composite is one row wherever the app counts rows, so every line operation is one
 * `writeRow` against the parent — which is what these ask, alongside the figure surviving
 * each of the two transitions.
 */
describe('the Line Items of a composite Expense', () => {
  const withRent = async () => {
    const storage = fakeStorage()
    const app = householdOver(localStorageStore(storage))
    await app.setUp(setup)
    await app.addExpense('2026-07', expense('Rent', 120000, app.household.value!))
    const id = app.household.value!.months['2026-07']!.expenses[0]!.id
    return { app, storage, id }
  }

  const rentIn = (app: ReturnType<typeof householdOver>) =>
    app.household.value!.months['2026-07']!.expenses[0]!

  it('itemises a typed amount into one line named after the Expense', async () => {
    const { app, id } = await withRent()

    await app.itemise('2026-07', id)

    expect(rentIn(app).lines.map((line) => [line.name, line.amount])).toEqual([['Rent', 120000]])
    expect(rentIn(app).amount).toBe(120000)
  })

  it('adds a line and derives the total from the lines', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)

    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 })

    expect(rentIn(app).amount).toBe(125000)
  })

  it('renames and retypes a line without minting a fresh identity', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)
    const line = rentIn(app).lines[0]!.id

    await app.editExpenseLine('2026-07', id, line, { name: 'Base rent', amount: 118000 })

    expect(rentIn(app).lines[0]!.id).toBe(line)
    expect(rentIn(app).lines[0]!.name).toBe('Base rent')
    expect(rentIn(app).amount).toBe(118000)
  })

  it('hands the running total back as a typed amount when the last line goes', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)
    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 })
    const [first, second] = rentIn(app).lines.map((line) => line.id) as [string, string]

    await app.removeExpenseLine('2026-07', id, second)
    await app.removeExpenseLine('2026-07', id, first)

    expect(rentIn(app).lines).toEqual([])
    expect(rentIn(app).amount).toBe(120000)
  })

  it('makes the composite Pending while a line has no figure', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)

    await app.addExpenseLine('2026-07', id, { name: 'Water', amount: null })

    expect(rentIn(app).amount).toBeNull()
  })

  it('stores every line operation as one row write, so what is shown is what is stored', async () => {
    const { app, storage, id } = await withRent()
    await app.itemise('2026-07', id)

    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 })

    const stored = await localStorageStore(storage).loadHousehold()
    expect(stored!.months['2026-07']).toEqual(app.household.value!.months['2026-07'])
  })

  /**
   * A line correction reaches the later Months on the same terms an amount correction
   * does. Without this the offer would depend on whether the Expense happened to be
   * itemised, which is not a distinction a member makes.
   */
  it('carries a corrected line list into the later Months still holding the copy', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)
    await app.open('2026-08')
    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 })

    const { changed } = await app.propagateLines('2026-07', id)

    const august = app.household.value!.months['2026-08']!.expenses[0]!
    expect(changed).toEqual(['2026-08'])
    expect(august.lines.map((line) => line.name)).toEqual(['Rent', 'Service charge'])
    expect(august.amount).toBe(125000)
  })

  it('carries the list as the row now stands, not as it was when the offer was raised', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)
    await app.open('2026-08')
    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 })
    /** The member goes on editing before answering the offer the line above raised. */
    await app.addExpenseLine('2026-07', id, { name: 'Water', amount: 2000 })

    await app.propagateLines('2026-07', id)

    const august = app.household.value!.months['2026-08']!.expenses[0]!
    expect(august.lines.map((line) => line.name)).toEqual(['Rent', 'Service charge', 'Water'])
    expect(august.amount).toBe(127000)
  })

  it('hands a later Month back a typed amount when the last line has gone', async () => {
    const { app, id } = await withRent()
    await app.itemise('2026-07', id)
    await app.open('2026-08')
    const line = rentIn(app).lines[0]!.id
    await app.removeExpenseLine('2026-07', id, line)

    await app.propagateLines('2026-07', id)

    const august = app.household.value!.months['2026-08']!.expenses[0]!
    expect(august.lines).toEqual([])
    expect(august.amount).toBe(120000)
  })

  /**
   * The rule travels with the line that moves the total, which is how a member says who
   * absorbs the difference in the same breath as making it.
   */
  it('refuses a line that leaves a fixed rule no longer totalling, and takes one that is settled alongside', async () => {
    const { app, id } = await withRent()
    const [ana, bruno] = app.household.value!.roster.map((member) => member.id) as [string, string]
    await app.editExpense('2026-07', id, {
      splitRule: { kind: 'fixed', byMember: { [ana]: 60000, [bruno]: 60000 } },
    })
    await app.itemise('2026-07', id)

    await expect(
      app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 }),
    ).rejects.toThrow()
    expect(rentIn(app).lines).toHaveLength(1)
    expect(rentIn(app).amount).toBe(120000)

    await app.addExpenseLine('2026-07', id, { name: 'Service charge', amount: 5000 }, {
      kind: 'fixed',
      byMember: { [ana]: 65000, [bruno]: 60000 },
    })

    expect(rentIn(app).amount).toBe(125000)
  })
})

/**
 * The riskiest operation in the app: it writes into many Months at once, it is
 * irreversible, and ADR-0008 leaves it non-atomic. What these ask is the order, and what
 * a run that stops halfway leaves behind.
 */
describe('deleting a category', () => {
  /** Groceries on one row of July, inherited by August; Utilities on a row of its own. */
  async function withGroceries() {
    const storage = fakeStorage()
    const store = recording(localStorageStore(storage))
    const vocabulary = addCategory(setUpHousehold(setup), 'Groceries')
    const withCategories = addCategory(vocabulary, 'Utilities')
    await store.createHousehold(withCategories)
    const [groceries, utilities] = withCategories.categories.map((category) => category.id) as [
      string,
      string,
    ]

    const app = householdOver(store)
    await app.load()
    const roster = app.household.value!
    const categorised = (name: string, amount: number, category: string): ExpenseDraft => ({
      ...expense(name, amount, roster),
      category,
    })
    await app.addExpense('2026-07', categorised('Supermarket', 30000, groceries))
    await app.addExpense('2026-07', categorised('Electricity', 8000, utilities))
    await app.open('2026-08')
    store.calls.length = 0

    return { app, store, storage, groceries, utilities }
  }

  const stored = (storage: Storage): Promise<Household> =>
    localStorageStore(storage).loadHousehold() as Promise<Household>

  it('deletes one no row references without writing a row', async () => {
    const { app, store, storage, utilities, groceries } = await withGroceries()
    await app.removeExpense('2026-07', app.household.value!.months['2026-07']!.expenses[1]!.id)
    await app.removeExpense('2026-08', app.household.value!.months['2026-08']!.expenses[1]!.id)
    store.calls.length = 0

    await app.deleteCategory(utilities)

    expect(store.calls).toEqual(['replaceHousehold'])
    const left = (await stored(storage)).categories.map((category) => category.id)
    expect(left).toEqual([groceries])
  })

  it('refuses to delete one in use, and leaves the record exactly as it was', async () => {
    const { app, store, storage, groceries } = await withGroceries()
    const before = await stored(storage)

    await expect(app.deleteCategory(groceries)).rejects.toThrow('used by 2 rows')

    expect(store.calls).toEqual([])
    expect(await stored(storage)).toEqual(before)
  })

  it('clears every referencing row one write at a time, and only then puts the vocabulary back', async () => {
    const { app, store, storage, groceries } = await withGroceries()

    await app.clearAndDeleteCategory(groceries)

    expect(store.calls).toEqual(['writeRow', 'writeRow', 'replaceHousehold'])
    const after = await stored(storage)
    expect(after.categories.map((category) => category.name)).toEqual(['Utilities'])
    for (const key of ['2026-07', '2026-08'] as const) {
      const categories = after.months[key]!.expenses.map((row) => row.category)
      expect(categories).toEqual([null, expect.any(String)])
    }
  })

  it('changes nothing but the category of a cleared row, its Unreviewed mark included', async () => {
    const { app, storage, groceries } = await withGroceries()
    const before = await stored(storage)

    await app.clearAndDeleteCategory(groceries)

    const after = await stored(storage)
    for (const key of ['2026-07', '2026-08'] as const) {
      expect(after.months[key]!.expenses[0]).toEqual({
        ...before.months[key]!.expenses[0]!,
        category: null,
      })
      expect(after.months[key]!.expenses[1]).toEqual(before.months[key]!.expenses[1])
    }
  })

  /**
   * The order is what makes a failed run a retry rather than a corrupt state: the
   * vocabulary is only written once every clear has landed, so a category that is still
   * half in use is still in the list, and still refuses to be deleted.
   */
  it('leaves the category present and still undeletable when a row write fails partway', async () => {
    const storage = fakeStorage()
    const withCategories = addCategory(setUpHousehold(setup), 'Groceries')
    const store = localStorageStore(storage)
    await store.createHousehold(withCategories)
    const groceries = withCategories.categories[0]!.id
    const app = householdOver(store)
    await app.load()
    await app.addExpense('2026-07', {
      ...expense('Supermarket', 30000, app.household.value!),
      category: groceries,
    })
    await app.open('2026-08')

    const failing = householdOver(failingOnWrite(store, 2))
    await failing.load()
    await expect(failing.clearAndDeleteCategory(groceries)).rejects.toThrow('The store gave up')

    const halfway = await stored(storage)
    expect(halfway.categories.map((category) => category.name)).toEqual(['Groceries'])
    expect(halfway.months['2026-07']!.expenses[0]!.category).toBeNull()
    expect(halfway.months['2026-08']!.expenses[0]!.category).toBe(groceries)

    /**
     * The retry runs on the app that failed, which is the case that actually happens: a
     * refused change leaves the screen holding the record as it was before the clear, so
     * this asks again for rows the store has already cleared. Writing a cleared row over a
     * cleared row is last-write-wins over identical content (ADR-0008), and the run
     * finishes.
     */
    await failing.clearAndDeleteCategory(groceries)

    const finished = await stored(storage)
    expect(finished.categories).toEqual([])
    expect(finished.months['2026-07']!.expenses[0]!.category).toBeNull()
    expect(finished.months['2026-08']!.expenses[0]!.category).toBeNull()
    expect(failing.household.value!.categories).toEqual([])
  })
})

describe('deleting a payment method', () => {
  /** Card on one row of July, inherited by August; Cash on a row of its own. */
  async function withCard() {
    const storage = fakeStorage()
    const store = recording(localStorageStore(storage))
    const vocabulary = addPaymentMethod(setUpHousehold(setup), 'Card')
    const withMethods = addPaymentMethod(vocabulary, 'Cash')
    await store.createHousehold(withMethods)
    const [card, cash] = withMethods.paymentMethods.map((method) => method.id) as [
      string,
      string,
    ]

    const app = householdOver(store)
    await app.load()
    const roster = app.household.value!
    const paid = (name: string, amount: number, paymentMethod: string): ExpenseDraft => ({
      ...expense(name, amount, roster),
      paymentMethod,
    })
    await app.addExpense('2026-07', paid('Supermarket', 30000, card))
    await app.addExpense('2026-07', paid('Electricity', 8000, cash))
    await app.open('2026-08')
    store.calls.length = 0

    return { app, store, storage, card, cash }
  }

  const stored = (storage: Storage): Promise<Household> =>
    localStorageStore(storage).loadHousehold() as Promise<Household>

  it('deletes one no row references without writing a row', async () => {
    const { app, store, storage, cash, card } = await withCard()
    await app.removeExpense('2026-07', app.household.value!.months['2026-07']!.expenses[1]!.id)
    await app.removeExpense('2026-08', app.household.value!.months['2026-08']!.expenses[1]!.id)
    store.calls.length = 0

    await app.deletePaymentMethod(cash)

    expect(store.calls).toEqual(['replaceHousehold'])
    const left = (await stored(storage)).paymentMethods.map((method) => method.id)
    expect(left).toEqual([card])
  })

  it('refuses to delete one in use, and leaves the record exactly as it was', async () => {
    const { app, store, storage, card } = await withCard()
    const before = await stored(storage)

    await expect(app.deletePaymentMethod(card)).rejects.toThrow('used by 2 rows')

    expect(store.calls).toEqual([])
    expect(await stored(storage)).toEqual(before)
  })

  it('clears every referencing row one write at a time, and only then puts the vocabulary back', async () => {
    const { app, store, storage, card } = await withCard()

    await app.clearAndDeletePaymentMethod(card)

    expect(store.calls).toEqual(['writeRow', 'writeRow', 'replaceHousehold'])
    const after = await stored(storage)
    expect(after.paymentMethods.map((method) => method.name)).toEqual(['Cash'])
    for (const key of ['2026-07', '2026-08'] as const) {
      const methods = after.months[key]!.expenses.map((row) => row.paymentMethod)
      expect(methods).toEqual([null, expect.any(String)])
    }
  })

  it('changes nothing but the payment method of a cleared row, its Unreviewed mark included', async () => {
    const { app, storage, card } = await withCard()
    const before = await stored(storage)

    await app.clearAndDeletePaymentMethod(card)

    const after = await stored(storage)
    for (const key of ['2026-07', '2026-08'] as const) {
      expect(after.months[key]!.expenses[0]).toEqual({
        ...before.months[key]!.expenses[0]!,
        paymentMethod: null,
      })
      expect(after.months[key]!.expenses[1]).toEqual(before.months[key]!.expenses[1])
    }
  })

  /**
   * The order is what makes a failed run a retry rather than a corrupt state: the
   * vocabulary is only written once every clear has landed, so a payment method that is
   * still half in use is still in the list, and still refuses to be deleted.
   */
  it('leaves the payment method present and still undeletable when a row write fails partway', async () => {
    const storage = fakeStorage()
    const withMethods = addPaymentMethod(setUpHousehold(setup), 'Card')
    const store = localStorageStore(storage)
    await store.createHousehold(withMethods)
    const card = withMethods.paymentMethods[0]!.id
    const app = householdOver(store)
    await app.load()
    await app.addExpense('2026-07', {
      ...expense('Supermarket', 30000, app.household.value!),
      paymentMethod: card,
    })
    await app.open('2026-08')

    const failing = householdOver(failingOnWrite(store, 2))
    await failing.load()
    await expect(failing.clearAndDeletePaymentMethod(card)).rejects.toThrow('The store gave up')

    const halfway = await stored(storage)
    expect(halfway.paymentMethods.map((method) => method.name)).toEqual(['Card'])
    expect(halfway.months['2026-07']!.expenses[0]!.paymentMethod).toBeNull()
    expect(halfway.months['2026-08']!.expenses[0]!.paymentMethod).toBe(card)

    /**
     * The retry runs on the app that failed, which is the case that actually happens: a
     * refused change leaves the screen holding the record as it was before the clear, so
     * this asks again for rows the store has already cleared. Writing a cleared row over a
     * cleared row is last-write-wins over identical content (ADR-0008), and the run
     * finishes.
     */
    await failing.clearAndDeletePaymentMethod(card)

    const finished = await stored(storage)
    expect(finished.paymentMethods).toEqual([])
    expect(finished.months['2026-07']!.expenses[0]!.paymentMethod).toBeNull()
    expect(finished.months['2026-08']!.expenses[0]!.paymentMethod).toBeNull()
    expect(failing.household.value!.paymentMethods).toEqual([])
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
