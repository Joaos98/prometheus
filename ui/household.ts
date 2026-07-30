import { ref, shallowRef } from 'vue'
import {
  addExpenseSnapshot,
  addIncomeSnapshot,
  editExpenseSnapshot,
  editIncomeSnapshot,
  removeExpenseSnapshot,
  openedMonthKeys,
  relabelCurrency,
  removeIncomeSnapshot,
  setUpHousehold,
  type Currency,
  type ExpenseDraft,
  type ExpenseEdits,
  type Household,
  type IncomeDraft,
  type IncomeEdits,
  type MonthKey,
  type RowId,
  type Setup,
} from '../domain/index.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'

/**
 * The Household the app is showing, and the one Month it is looking at. The engine
 * computes; this only holds what it returned and hands writes to the storage port.
 */
const store: HouseholdStore = localStorageStore(window.localStorage)

const household = shallowRef<Household | undefined>(undefined)
const viewing = ref<MonthKey | undefined>(undefined)
const loading = ref(true)
const failure = ref<string | undefined>(undefined)

async function load(): Promise<void> {
  loading.value = true
  failure.value = undefined
  try {
    const loaded = await store.loadHousehold()
    household.value = loaded
    viewing.value = loaded ? openedMonthKeys(loaded).at(-1) : undefined
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function setUp(setup: Setup): Promise<void> {
  const created = setUpHousehold(setup)
  await store.createHousehold(created)
  household.value = created
  viewing.value = setup.startingMonth
}

/**
 * Renames the currency. No amount is converted, and the engine refuses a currency of
 * different decimal precision before any of this reaches storage.
 */
async function relabel(currency: Currency): Promise<void> {
  if (!household.value) return
  const relabelled = relabelCurrency(household.value, currency)
  await store.replaceHousehold(relabelled)
  household.value = relabelled
}

/**
 * Income, one row at a time. The engine decides what the Household becomes; the port
 * is handed only the row that changed, so two members editing different rows never
 * collide.
 */
async function addIncome(month: MonthKey, draft: IncomeDraft): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = addIncomeSnapshot(current, month, draft)
  await store.writeRow(month, 'income', row)
  household.value = after
}

async function editIncome(month: MonthKey, id: RowId, edits: IncomeEdits): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = editIncomeSnapshot(current, month, id, edits)
  await store.writeRow(month, 'income', row)
  household.value = after
}

async function removeIncome(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = removeIncomeSnapshot(current, month, id)
  await store.deleteRow(month, 'income', id)
  household.value = after
}

/** Expenses, one row at a time, on the same terms as income. */
async function addExpense(month: MonthKey, draft: ExpenseDraft): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = addExpenseSnapshot(current, month, draft)
  await store.writeRow(month, 'expenses', row)
  household.value = after
}

async function editExpense(month: MonthKey, id: RowId, edits: ExpenseEdits): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = editExpenseSnapshot(current, month, id, edits)
  await store.writeRow(month, 'expenses', row)
  household.value = after
}

async function removeExpense(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = removeExpenseSnapshot(current, month, id)
  await store.deleteRow(month, 'expenses', id)
  household.value = after
}

export function useHousehold() {
  return {
    household,
    viewing,
    loading,
    failure,
    load,
    setUp,
    relabel,
    addIncome,
    editIncome,
    removeIncome,
    addExpense,
    editExpense,
    removeExpense,
  }
}
