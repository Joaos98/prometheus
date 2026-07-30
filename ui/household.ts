import { ref, shallowRef } from 'vue'
import {
  addExpenseSnapshot,
  addIncomeSnapshot,
  addMember,
  addSavingsGoal,
  confirmExpenseSnapshot,
  confirmIncomeSnapshot,
  confirmSavingsGoal,
  deactivateMember,
  editExpenseSnapshot,
  editIncomeSnapshot,
  editSavingsGoal,
  markExpenseOneOff,
  markGoalOneOff,
  markIncomeOneOff,
  reactivateMember,
  recordContribution,
  removeExpenseSnapshot,
  removeSavingsGoal,
  openedMonthKeys,
  relabelCurrency,
  removeIncomeSnapshot,
  repurposeExpenseSnapshot,
  setUpHousehold,
  type Currency,
  type ExpenseDraft,
  type ExpenseEdits,
  type GoalDraft,
  type GoalEdits,
  type Household,
  type IncomeDraft,
  type IncomeEdits,
  type MemberId,
  type Minor,
  type MonthKey,
  type RowId,
  type Setup,
} from '../domain/index.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'
import { messageOf } from './changes.js'

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
    failure.value = messageOf(cause)
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
 * The Roster, which is not a Month's row and so is written back whole, on the same
 * terms as relabelling the currency.
 */
async function addRosterMember(name: string): Promise<void> {
  const current = household.value
  if (!current) return
  const after = addMember(current, name)
  await store.replaceHousehold(after)
  household.value = after
}

async function deactivateRosterMember(member: MemberId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = deactivateMember(current, member)
  await store.replaceHousehold(after)
  household.value = after
}

async function reactivateRosterMember(member: MemberId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = reactivateMember(current, member)
  await store.replaceHousehold(after)
  household.value = after
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

/** Confirms a row that is correct as inherited, without editing it. */
async function confirmIncome(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = confirmIncomeSnapshot(current, month, id)
  await store.writeRow(month, 'income', row)
  household.value = after
}

/** Marks a row One-Off, one row at a time. */
async function markIncomeAsOneOff(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = markIncomeOneOff(current, month, id)
  await store.writeRow(month, 'income', row)
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

/**
 * Repurposing, which is not a row edit: it retires one identity and mints another, and
 * re-threads the row in every later Month that inherited it. A row-scoped write cannot
 * say that, so the Household goes back whole, as the Roster does.
 */
async function repurposeExpense(month: MonthKey, id: RowId, edits: ExpenseEdits): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after } = repurposeExpenseSnapshot(current, month, id, edits)
  await store.replaceHousehold(after)
  household.value = after
}

async function removeExpense(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = removeExpenseSnapshot(current, month, id)
  await store.deleteRow(month, 'expenses', id)
  household.value = after
}

/** Confirms an Expense that is correct as inherited, without editing it. */
async function confirmExpense(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = confirmExpenseSnapshot(current, month, id)
  await store.writeRow(month, 'expenses', row)
  household.value = after
}

/** Marks an Expense One-Off, one row at a time. */
async function markExpenseAsOneOff(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = markExpenseOneOff(current, month, id)
  await store.writeRow(month, 'expenses', row)
  household.value = after
}

/** Savings Goals, one row at a time, on the same terms as income and Expenses. */
async function addGoal(month: MonthKey, draft: GoalDraft): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = addSavingsGoal(current, month, draft)
  await store.writeRow(month, 'goals', row)
  household.value = after
}

async function editGoal(month: MonthKey, id: RowId, edits: GoalEdits): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = editSavingsGoal(current, month, id, edits)
  await store.writeRow(month, 'goals', row)
  household.value = after
}

async function removeGoal(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const after = removeSavingsGoal(current, month, id)
  await store.deleteRow(month, 'goals', id)
  household.value = after
}

/** Confirms a goal that is correct as inherited, without editing it. */
async function confirmGoal(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = confirmSavingsGoal(current, month, id)
  await store.writeRow(month, 'goals', row)
  household.value = after
}

/** Marks a goal One-Off, one row at a time. */
async function markGoalAsOneOff(month: MonthKey, id: RowId): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = markGoalOneOff(current, month, id)
  await store.writeRow(month, 'goals', row)
  household.value = after
}

/** What one Participant puts toward one goal this Month, entered directly. */
async function contribute(
  month: MonthKey,
  id: RowId,
  member: MemberId,
  amount: Minor | null,
): Promise<void> {
  const current = household.value
  if (!current) return
  const { household: after, row } = recordContribution(current, month, id, member, amount)
  await store.writeRow(month, 'goals', row)
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
    addRosterMember,
    deactivateRosterMember,
    reactivateRosterMember,
    addIncome,
    editIncome,
    removeIncome,
    confirmIncome,
    markIncomeAsOneOff,
    addExpense,
    editExpense,
    repurposeExpense,
    removeExpense,
    confirmExpense,
    markExpenseAsOneOff,
    addGoal,
    editGoal,
    removeGoal,
    confirmGoal,
    markGoalAsOneOff,
    contribute,
  }
}
