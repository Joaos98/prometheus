import {
  openedMonthKeys,
  type ExpenseEdits,
  type GoalEdits,
  type Household,
  type IncomeEdits,
  type MonthKey,
  type RowId,
} from '../domain/index.js'

/**
 * An edit that has just been saved in one Month, held while the member decides whether to
 * carry it into the later Months that were already open. The kind is what says which of
 * the engine's propagations to run, since each row kind has its own shape of edit.
 */
export type Carrying =
  | { kind: 'income'; id: RowId; name: string; edits: IncomeEdits }
  | { kind: 'expenses'; id: RowId; name: string; edits: ExpenseEdits }
  | { kind: 'goals'; id: RowId; name: string; edits: GoalEdits }

/**
 * The opened Months after this one — the Months a correction has somewhere to go. Months
 * that are not open are not among them and need nothing: they inherit when they are
 * opened, from whatever the record says by then.
 */
export function laterOpenedMonths(household: Household, key: MonthKey): MonthKey[] {
  return openedMonthKeys(household).filter((opened) => opened > key)
}
