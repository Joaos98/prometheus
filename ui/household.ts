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
  discardMonth,
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
  openMonth,
  propagateExpenseEdit,
  propagateGoalEdit,
  propagateIncomeEdit,
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
  type Propagation,
  type RowId,
  type Setup,
} from '../domain/index.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'
import { messageOf } from './changes.js'
import { thisMonth } from './months.js'

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
    // The latest Month with anything in it, or — every Month having been discarded —
    // the one the calendar is on, which is a Month like any other and offers to open.
    viewing.value = loaded ? (openedMonthKeys(loaded).at(-1) ?? thisMonth()) : undefined
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
 * Moving around the record, which changes nothing: looking at a Month the Household has
 * not opened is a read, and leaves it unopened.
 */
function view(month: MonthKey): void {
  viewing.value = month
}

/** Opening a Month, which is the explicit act that brings its data into existence. */
async function open(month: MonthKey): Promise<void> {
  const current = household.value
  if (!current) return
  const after = openMonth(current, month)
  await store.openMonth(after.months[month]!)
  household.value = after
  viewing.value = month
}

/**
 * Discarding a Month: the whole Month goes, so the port is handed the Month rather than
 * a row. What is being looked at stays where it is — the Month is still the one the
 * member is on, now unopened and offering to be opened afresh.
 */
async function discard(month: MonthKey): Promise<void> {
  const current = household.value
  if (!current) return
  const after = discardMonth(current, month)
  await store.discardMonth(month)
  household.value = after
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

/**
 * Forward Propagation, which is not a row edit either: it writes one row in each of
 * however many later Months still hold the copy, so the Household goes back whole. What
 * it changed and what it passed over comes back to the caller, which is the only way the
 * member gets told where a later Month kept its own answer.
 */
async function propagateIncome(
  month: MonthKey,
  id: RowId,
  edits: IncomeEdits,
): Promise<Propagation> {
  return carryForward(propagateIncomeEdit(current(), month, id, edits))
}

async function propagateExpense(
  month: MonthKey,
  id: RowId,
  edits: ExpenseEdits,
): Promise<Propagation> {
  return carryForward(propagateExpenseEdit(current(), month, id, edits))
}

async function propagateGoal(month: MonthKey, id: RowId, edits: GoalEdits): Promise<Propagation> {
  return carryForward(propagateGoalEdit(current(), month, id, edits))
}

async function carryForward(propagation: Propagation): Promise<Propagation> {
  await store.replaceHousehold(propagation.household)
  household.value = propagation.household
  return propagation
}

/**
 * The Household as it stands. Propagation reports back rather than returning nothing, so
 * unlike every other change here it cannot quietly do nothing when there is no Household
 * — there would be no report to give.
 */
function current(): Household {
  const loaded = household.value
  if (!loaded) throw new Error('No Household is loaded')
  return loaded
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
    view,
    open,
    discard,
    relabel,
    addRosterMember,
    deactivateRosterMember,
    reactivateRosterMember,
    addIncome,
    editIncome,
    removeIncome,
    confirmIncome,
    markIncomeAsOneOff,
    propagateIncome,
    addExpense,
    editExpense,
    repurposeExpense,
    removeExpense,
    confirmExpense,
    markExpenseAsOneOff,
    propagateExpense,
    addGoal,
    editGoal,
    removeGoal,
    confirmGoal,
    markGoalAsOneOff,
    propagateGoal,
    contribute,
  }
}
