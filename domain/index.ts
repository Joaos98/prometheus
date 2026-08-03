/**
 * The domain engine: every rule Prometheus computes, as pure functions over a
 * Household value. It imports no framework and does no I/O, so it is testable with no
 * browser, no adapter and no Vue.
 */
export {
  driftAhead,
  driftCount,
  driftOf,
  hasDrift,
  refreshFromPreviousMonth,
  type Drift,
  type DriftField,
  type MembershipDrift,
  type RowDrift,
  type RowDriftState,
} from './drift.js'
export { apportion } from './apportion.js'
export { DomainError } from './errors.js'
export {
  addExpenseSnapshot,
  confirmExpenseSnapshot,
  editExpenseSnapshot,
  setExpenseOneOff,
  removeExpenseSnapshot,
  type ExpenseDraft,
  type ExpenseEdits,
} from './expenses.js'
export {
  addSavingsGoal,
  confirmSavingsGoal,
  contributionTo,
  contributionsOf,
  editSavingsGoal,
  setGoalOneOff,
  recordContribution,
  removeSavingsGoal,
  totalContributedTo,
  type GoalDraft,
  type GoalEdits,
} from './goals.js'
export { accumulatedProgress, type AccumulatedProgress } from './progress.js'
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
  confirmIncomeSnapshot,
  editIncomeSnapshot,
  householdSpendableIncome,
  setIncomeOneOff,
  removeIncomeSnapshot,
  spendableIncome,
  spendableIncomeShares,
  totalIncome,
  type IncomeDraft,
  type IncomeEdits,
} from './income.js'
export { leftoverBalanceOf, leftoverBalancesOf, type LeftoverBalance } from './leftover.js'
export {
  propagateExpenseEdit,
  propagateGoalEdit,
  propagateIncomeEdit,
  type Propagation,
  type PropagationSkip,
  type SkipReason,
} from './propagation.js'
export { renamingAsks, repurposeExpenseSnapshot } from './repurposing.js'
export { isReviewed, unreviewedCount } from './review.js'
export { appearedBefore, isOneOff, isPending, memberName, type RowChange } from './rows.js'
export { sharesOf, splitOf, type Share, type Split } from './shares.js'
export { requireConsistentRule } from './split-rules.js'
export {
  assertMonthKey,
  monthAfter,
  monthBefore,
  monthKey,
  monthName,
  monthOfYear,
  yearOf,
} from './month-key.js'
export {
  discardMonth,
  entryCount,
  isOpened,
  monthAt,
  monthIfOpened,
  openedMonthKeys,
  openMonth,
  previousMonthKey,
} from './month.js'
export { formatAmount, plainAmount, toMinor } from './money.js'
export {
  exportHousehold,
  importHousehold,
  whatImportReplaces,
  HOUSEHOLD_FILE_FORMAT,
  type Replacement,
} from './transfer.js'
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
  RowKind,
  SavingsGoal,
  SplitRule,
} from './types.js'
