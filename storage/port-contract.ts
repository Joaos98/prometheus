import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPending,
  openMonth,
  setUpHousehold,
  totalOfLines,
  type ExpenseSnapshot,
  type Household,
  type IncomeSnapshot,
  type LineItem,
  type Minor,
  type SavingsGoal,
} from '../domain/index.js'
import { StorageError, type HouseholdStore } from './port.js'

/**
 * One deployment of an adapter: whatever holds the Household, and however many clients
 * are pointed at it. Two members are two clients over one deployment, which is the only
 * way the suite can ask whether their edits collide.
 */
export interface Deployment {
  client(): HouseholdStore
  close(): Promise<void> | void
}

const household = (): Household => ({
  ...setUpHousehold({
    currency: { code: 'EUR', symbol: '€', decimals: 2 },
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  }),
  categories: [{ id: 'home', name: 'Home' }],
})

const salary = (amount: Minor | null): IncomeSnapshot => ({
  id: 'salary',
  name: 'Salary',
  member: 'ana',
  amount,
  restrictedUse: false,
  reviewed: true,
  oneOff: false,
})

const expense = (id: string, amount: Minor | null): ExpenseSnapshot => ({
  id,
  name: id,
  category: 'home',
  amount,
  lines: [],
  participants: ['ana', 'bruno'],
  splitRule: { kind: 'percentage', byMember: { ana: 60, bruno: 40 } },
  reviewed: true,
  oneOff: false,
})

const line = (id: string, name: string, amount: Minor | null): LineItem => ({ id, name, amount })

const composite = (id: string, lines: LineItem[]): ExpenseSnapshot => ({
  id,
  name: id,
  category: 'home',
  amount: totalOfLines(lines),
  lines,
  participants: ['ana', 'bruno'],
  splitRule: { kind: 'even' },
  reviewed: true,
  oneOff: false,
})

const goal = (id: string): SavingsGoal => ({
  id,
  name: id,
  target: 200000,
  startAmount: 0,
  participants: ['ana'],
  contributions: { ana: 25000 },
  reviewed: true,
  oneOff: false,
})

/** A Household that cannot be serialised, and so cannot reach any store intact. */
function unstorable(): Household {
  const broken = household()
  const july = broken.months['2026-07']!
  const row = expense('rent', 120000) as ExpenseSnapshot & { self?: unknown }
  row.self = row
  july.expenses = [row]
  return broken
}

/**
 * What every adapter behind the storage port must do, asked once and answered by each of
 * them. An adapter that drifts from this is a different application wearing the same UI,
 * which is precisely what the demo build must never become.
 */
export function describePort(name: string, deploy: () => Promise<Deployment> | Deployment): void {
  describe(`the storage port, over ${name}`, () => {
    let deployment: Deployment
    let store: HouseholdStore

    beforeEach(async () => {
      deployment = await deploy()
      store = deployment.client()
    })

    afterEach(async () => {
      await deployment.close()
    })

    it('finds no Household before one has been set up', async () => {
      expect(await store.loadHousehold()).toBeUndefined()
    })

    it('loads back the Household that was created', async () => {
      const created = household()

      await store.createHousehold(created)

      expect(await store.loadHousehold()).toEqual(created)
    })

    it('shows the same Household to a member who arrives later', async () => {
      await store.createHousehold(household())
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))

      expect(await deployment.client().loadHousehold()).toEqual(await store.loadHousehold())
    })

    it('will not create a second Household over the one already stored', async () => {
      await store.createHousehold(household())

      await expect(store.createHousehold(household())).rejects.toBeInstanceOf(StorageError)
    })

    it('loads back everything that was written, down to the last field', async () => {
      const created = household()
      await store.createHousehold(created)
      await store.openMonth(openMonth(created, '2026-08').months['2026-08']!)
      await store.writeRow('2026-07', 'income', salary(320000))
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      await store.writeRow('2026-07', 'goals', goal('holiday'))
      await store.writeRow('2026-08', 'expenses', expense('water', null))

      const loaded = (await store.loadHousehold())!

      expect(loaded.currency).toEqual(created.currency)
      expect(loaded.roster).toEqual(created.roster)
      expect(loaded.months['2026-07']!.income).toEqual([salary(320000)])
      expect(loaded.months['2026-07']!.expenses).toEqual([expense('rent', 120000)])
      expect(loaded.months['2026-07']!.goals).toEqual([goal('holiday')])
      expect(loaded.months['2026-08']!.expenses).toEqual([expense('water', null)])
      expect(loaded.months['2026-08']!.members).toEqual(created.roster.map((member) => member.id))
    })

    it('brings the Months back in calendar order, whatever order they were opened in', async () => {
      const created = household()
      await store.createHousehold(created)
      for (const key of ['2026-09', '2026-08', '2026-10']) {
        await store.openMonth({ key, members: [], income: [], expenses: [], goals: [] })
      }

      const loaded = (await store.loadHousehold())!

      expect(Object.keys(loaded.months)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    })

    it('records an opened Month', async () => {
      const created = household()
      await store.createHousehold(created)
      const august = openMonth(created, '2026-08').months['2026-08']!

      await store.openMonth(august)

      expect((await store.loadHousehold())!.months['2026-08']).toEqual(august)
    })

    it('refuses to open a Month before a Household exists', async () => {
      const august = openMonth(household(), '2026-08').months['2026-08']!

      await expect(store.openMonth(august)).rejects.toBeInstanceOf(StorageError)
    })

    it('writes a row without disturbing the other rows of the Month', async () => {
      await store.createHousehold(household())

      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      await store.writeRow('2026-07', 'expenses', expense('groceries', 30000))
      await store.writeRow('2026-07', 'expenses', expense('rent', 125000))

      const expenses = (await store.loadHousehold())!.months['2026-07']!.expenses
      expect(expenses.map((row) => row.id)).toEqual(['rent', 'groceries'])
      expect(expenses.map((row) => row.amount)).toEqual([125000, 30000])
    })

    it('brings an Expense back with its Participants and Split Rule intact', async () => {
      await store.createHousehold(household())
      const rent = expense('rent', 120000)

      await store.writeRow('2026-07', 'expenses', rent)

      expect((await store.loadHousehold())!.months['2026-07']!.expenses[0]).toEqual(rent)
    })

    it('brings a composite Expense back with its Line Items intact', async () => {
      await store.createHousehold(household())
      const groceries = composite('groceries', [
        line('fruit', 'Fruit', 1200),
        line('bread', 'Bread', 350),
      ])

      await store.writeRow('2026-07', 'expenses', groceries)

      expect((await store.loadHousehold())!.months['2026-07']!.expenses[0]).toEqual(groceries)
    })

    it('keeps a Line Item’s amount null, not zero, not undefined and not absent', async () => {
      await store.createHousehold(household())
      const groceries = composite('groceries', [line('fruit', 'Fruit', null)])

      await store.writeRow('2026-07', 'expenses', groceries)

      const written = (await store.loadHousehold())!.months['2026-07']!.expenses[0]!
      expect(written.lines[0]!.amount).toBeNull()
      expect('amount' in written.lines[0]!).toBe(true)
    })

    it('writes a composite Expense without disturbing the other rows of the Month', async () => {
      await store.createHousehold(household())
      const groceries = composite('groceries', [line('fruit', 'Fruit', 1200)])

      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      await store.writeRow('2026-07', 'expenses', groceries)

      const expenses = (await store.loadHousehold())!.months['2026-07']!.expenses
      expect(expenses.map((row) => row.id)).toEqual(['rent', 'groceries'])
      expect(expenses.find((row) => row.id === 'groceries')).toEqual(groceries)
    })

    it('reads a row written before Line Items existed as simple, with lines defaulting to []', async () => {
      await store.createHousehold(household())
      const { lines: _lines, ...legacy } = expense('rent', 120000)

      await store.writeRow('2026-07', 'expenses', legacy as ExpenseSnapshot)

      const written = (await store.loadHousehold())!.months['2026-07']!.expenses[0]!
      expect(written.lines).toEqual([])
    })

    it('round-trips the category vocabulary unchanged', async () => {
      const created = household()

      await store.createHousehold(created)

      expect((await store.loadHousehold())!.categories).toEqual(created.categories)
    })

    it('keeps an Expense’s category null, not absent, when nothing has been chosen', async () => {
      await store.createHousehold(household())

      await store.writeRow('2026-07', 'expenses', { ...expense('rent', 120000), category: null })

      const written = (await store.loadHousehold())!.months['2026-07']!.expenses[0]!
      expect(written.category).toBeNull()
      expect('category' in written).toBe(true)
    })

    it('loads a Household stored before categories existed with an empty vocabulary, discarding every Expense’s old category string', async () => {
      const created = household()
      const july = created.months['2026-07']!
      const withRow = { ...created, months: { ...created.months, '2026-07': { ...july, expenses: [expense('rent', 120000)] } } }
      const { categories: _categories, ...legacy } = withRow

      await store.createHousehold(legacy as unknown as Household)

      const loaded = (await store.loadHousehold())!
      expect(loaded.categories).toEqual([])
      expect(loaded.months['2026-07']!.expenses[0]!.category).toBeNull()
    })

    it('keeps both edits when two members write different rows of the same Month', async () => {
      await store.createHousehold(household())
      const ana = deployment.client()
      const bruno = deployment.client()

      await Promise.all([
        ana.writeRow('2026-07', 'expenses', expense('rent', 120000)),
        bruno.writeRow('2026-07', 'expenses', expense('groceries', 30000)),
      ])

      const expenses = (await store.loadHousehold())!.months['2026-07']!.expenses
      expect(expenses.map((row) => row.id).sort()).toEqual(['groceries', 'rent'])
    })

    it('leaves the rest of the Household alone when two members write at once', async () => {
      await store.createHousehold(household())
      await store.writeRow('2026-07', 'income', salary(320000))
      const ana = deployment.client()
      const bruno = deployment.client()

      await Promise.all([
        ana.writeRow('2026-07', 'expenses', expense('rent', 120000)),
        bruno.writeRow('2026-07', 'goals', goal('holiday')),
      ])

      const july = (await store.loadHousehold())!.months['2026-07']!
      expect(july.income).toEqual([salary(320000)])
      expect(july.expenses).toEqual([expense('rent', 120000)])
      expect(july.goals).toEqual([goal('holiday')])
    })

    it('takes the last write when two members write the same row', async () => {
      await store.createHousehold(household())
      const ana = deployment.client()
      const bruno = deployment.client()

      await ana.writeRow('2026-07', 'income', salary(320000))
      await bruno.writeRow('2026-07', 'income', salary(335000))

      const income = (await store.loadHousehold())!.months['2026-07']!.income
      expect(income).toHaveLength(1)
      expect(income[0]!.amount).toBe(335000)
    })

    it('tells an amount of nothing, an amount of zero and no row at all apart', async () => {
      await store.createHousehold(household())

      await store.writeRow('2026-07', 'income', { ...salary(null), id: 'pending' })
      await store.writeRow('2026-07', 'income', { ...salary(0), id: 'zero' })

      const income = (await store.loadHousehold())!.months['2026-07']!.income
      expect(income.map((row) => row.amount)).toEqual([null, 0])
      expect(income.map((row) => 'amount' in row)).toEqual([true, true])
      expect(income.find((row) => row.id === 'never-recorded')).toBeUndefined()
    })

    it('brings a Pending row back as Pending and not as zero', async () => {
      await store.createHousehold(household())
      await store.writeRow('2026-07', 'income', { ...salary(null), id: 'bonus' })

      const row = (await store.loadHousehold())!.months['2026-07']!.income[0]!

      expect(isPending(row)).toBe(true)
      expect(row.amount).not.toBe(0)
    })

    it('brings a goal back with a target of nothing still nothing', async () => {
      await store.createHousehold(household())

      await store.writeRow('2026-07', 'goals', { ...goal('someday'), target: null })

      expect((await store.loadHousehold())!.months['2026-07']!.goals[0]!.target).toBeNull()
    })

    it('removes a row', async () => {
      await store.createHousehold(household())
      await store.writeRow('2026-07', 'goals', goal('holiday'))
      await store.writeRow('2026-07', 'goals', goal('boiler'))

      await store.deleteRow('2026-07', 'goals', 'holiday')

      const goals = (await store.loadHousehold())!.months['2026-07']!.goals
      expect(goals.map((row) => row.id)).toEqual(['boiler'])
    })

    it('refuses a row written to a Month that has not been opened', async () => {
      await store.createHousehold(household())

      await expect(
        store.writeRow('2026-08', 'expenses', expense('rent', 120000)),
      ).rejects.toBeInstanceOf(StorageError)
    })

    it('discards a Month, leaving no trace of it', async () => {
      const created = household()
      await store.createHousehold(created)
      await store.openMonth(openMonth(created, '2026-08').months['2026-08']!)
      await store.writeRow('2026-08', 'expenses', expense('rent', 120000))

      await store.discardMonth('2026-08')

      const loaded = (await store.loadHousehold())!
      expect(loaded.months['2026-08']).toBeUndefined()
      expect(Object.keys(loaded.months)).toEqual(['2026-07'])
    })

    it('leaves the other Months alone when one is discarded', async () => {
      const created = household()
      await store.createHousehold(created)
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      await store.openMonth(openMonth(created, '2026-08').months['2026-08']!)

      await store.discardMonth('2026-08')

      expect((await store.loadHousehold())!.months['2026-07']!.expenses).toHaveLength(1)
    })

    it('opens a discarded Month afresh, with none of what it held before', async () => {
      const created = household()
      await store.createHousehold(created)
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      await store.discardMonth('2026-07')

      await store.openMonth({ key: '2026-07', members: ['ana'], income: [], expenses: [], goals: [] })

      expect((await store.loadHousehold())!.months['2026-07']!.expenses).toEqual([])
    })

    it('refuses to discard a Month that has not been opened', async () => {
      await store.createHousehold(household())

      await expect(store.discardMonth('2026-08')).rejects.toBeInstanceOf(StorageError)
    })

    it('replaces the whole Household', async () => {
      await store.createHousehold(household())
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      const other = setUpHousehold({
        currency: { code: 'GBP', symbol: '£', decimals: 2 },
        memberNames: ['Cleo'],
        startingMonth: '2025-01',
      })

      await store.replaceHousehold(other)

      expect(await store.loadHousehold()).toEqual(other)
    })

    it('replaces the Household onto a deployment that held none', async () => {
      const arriving = household()

      await store.replaceHousehold(arriving)

      expect(await store.loadHousehold()).toEqual(arriving)
    })

    it('leaves the Household untouched when a replacement cannot be stored', async () => {
      const created = household()
      await store.createHousehold(created)
      await store.writeRow('2026-07', 'expenses', expense('rent', 120000))
      const before = await store.loadHousehold()

      await expect(store.replaceHousehold(unstorable())).rejects.toBeInstanceOf(StorageError)

      expect(await store.loadHousehold()).toEqual(before)
    })
  })
}
