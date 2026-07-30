/**
 * The domain engine: every rule Prometheus computes, as pure functions over a
 * Household value. It imports no framework and does no I/O, so it is testable with no
 * browser, no adapter and no Vue.
 */
export { DomainError } from './errors.js'
export {
  addExpenseSnapshot,
  editExpenseSnapshot,
  removeExpenseSnapshot,
  type ExpenseDraft,
  type ExpenseEdits,
} from './expenses.js'
export {
  addMember,
  deactivateMember,
  reactivateMember,
  relabelCurrency,
  setUpHousehold,
  type Setup,
} from './household.js'
export {
  addIncomeSnapshot,
  editIncomeSnapshot,
  removeIncomeSnapshot,
  spendableIncome,
  type IncomeDraft,
  type IncomeEdits,
} from './income.js'
export { leftoverBalanceOf, leftoverBalancesOf, type LeftoverBalance } from './leftover.js'
export { renamingAsks, repurposeExpenseSnapshot } from './repurposing.js'
export { isPending, type RowChange } from './rows.js'
export { sharesOf, splitOf, type Share, type Split } from './shares.js'
export { requireConsistentRule } from './split-rules.js'
export { assertMonthKey, monthKey, monthName } from './month-key.js'
export { isOpened, monthAt, openedMonthKeys, openMonth, previousMonthKey } from './month.js'
export { formatAmount, toMinor } from './money.js'
export type {
  Currency,
  ExpenseSnapshot,
  Household,
  IncomeSnapshot,
  Member,
  MemberId,
  Minor,
  Month,
  MonthKey,
  MonthRow,
  RowId,
  SavingsGoal,
  SplitRule,
} from './types.js'
