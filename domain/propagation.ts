/**
 * Forward Propagation: carrying an edit made in one Month into the later Months that are
 * already open and still hold the value it replaced. A member corrects July's rent, finds
 * August and September were opened before the correction, and fixes all three at once.
 *
 * Only values still Unreviewed there are replaced. A row a member has edited or confirmed
 * in a later Month is that Month's own answer, and correcting an earlier Month never
 * silently undoes a decision made in a later one — so those are reported back rather than
 * overwritten, and the member is told where to go and look.
 *
 * What is replaced stays Unreviewed. Propagation is a copied value arriving, exactly as
 * inheritance is; nobody has looked at the new figure in that Month any more than they
 * looked at the old one.
 *
 * The walk stops at nothing. A Month that kept its own answer, one that no longer holds
 * the row, and one the edit cannot stand in are each passed over and the walk goes on: a
 * row travels no way but inheritance, so a later Month holding this identity is on this
 * thread whatever the Months in between say, and stopping at a gap would silently drop
 * every Month beyond it while reading as a propagation that worked.
 *
 * Months that have not been opened need nothing at all. They inherit — from whichever
 * Month is their Previous one by the time somebody opens them.
 */
import { DomainError } from './errors.js'
import { carryLines, editExpenseSnapshot, expenseIn } from './expenses.js'
import { editSavingsGoal, goalIn } from './goals.js'
import { editIncomeSnapshot, incomeIn } from './income.js'
import { monthName } from './month-key.js'
import { monthAt, openedMonthKeys } from './month.js'
import { isReviewed } from './review.js'
import { openedMonth, replaceRow, withMonth, type RowChange } from './rows.js'
import type { Household, Month, MonthKey, MonthRow, RowId, RowKind } from './types.js'

/**
 * Why propagation passed a Month over rather than carrying the correction into it.
 *
 * `reviewed` is the one the member acted on: that Month holds an answer somebody gave
 * it, and a correction made earlier never overwrites a decision made later. `absent` is
 * a Month that is not on the thread at all — the row was taken out of it, ended before
 * it, or has since been repurposed into a different cost. `refused` is a Month the edit
 * cannot stand in, most often because it names somebody who is not a member there.
 */
export type SkipReason = 'reviewed' | 'absent' | 'refused'

/** One later Month the correction did not reach, and what to tell the member about it. */
export interface PropagationSkip {
  month: MonthKey
  reason: SkipReason
  because: string
}

/** What propagation carried forward, and what it left alone. */
export interface Propagation {
  household: Household
  /** The later Months the correction reached, in calendar order. */
  changed: MonthKey[]
  /** The later Months it passed over, in calendar order, each with its reason. */
  skipped: PropagationSkip[]
}

/** Carries a correction to an income row into the later Months still holding the copy. */
export const propagateIncomeEdit = propagator('income', incomeIn, editIncomeSnapshot)

/** Carries a correction to an Expense into the later Months still holding the copy. */
export const propagateExpenseEdit = propagator('expenses', expenseIn, editExpenseSnapshot)

/**
 * Carries a correction to an Expense's Line Items into the later Months still holding the
 * copy — the whole line list at once, as a fresh open already carries it, since a
 * per-line propagation would have no per-line Unreviewed mark to respect.
 */
export const propagateExpenseLines = propagator('expenses', expenseIn, carryLines)

/**
 * Carries a correction to a Savings Goal into the later Months still holding the copy.
 * Contributions are not among a goal's edits and so never travel: what somebody put in
 * during a Month was put in during that Month.
 */
export const propagateGoalEdit = propagator('goals', goalIn, editSavingsGoal)

/** A row of one kind as one Month holds it, or nothing if that Month is not on its thread. */
type Find<Row> = (month: Month, id: RowId) => Row | undefined

/** The operation that applies the member's edit to one Month, validating it there. */
type Edit<Row, Edits> = (
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: Edits,
) => RowChange<Row>

/**
 * The walk itself, which is the same for every kind of row: only what it takes to find a
 * row and to edit one differs, and both of those already exist per kind. Reusing the
 * edit operation is what makes a propagated value obey exactly the rules a typed one
 * does — an amount is still whole minor units, and a Split Rule still has to sum against
 * the amount it is carried in beside.
 */
function propagator<Row extends MonthRow & { reviewed: boolean }, Edits>(
  kind: RowKind,
  find: Find<Row>,
  edit: Edit<Row, Edits>,
) {
  return function propagate(
    household: Household,
    key: MonthKey,
    id: RowId,
    edits: Edits,
  ): Propagation {
    const source = openedMonth(household, key)
    if (!find(source, id)) {
      throw new DomainError(`${source.key} holds no such row, so there is nothing to carry forward`)
    }

    let carried = household
    const changed: MonthKey[] = []
    const skipped: PropagationSkip[] = []

    for (const later of openedMonthKeys(household).filter((opened) => opened > key)) {
      const row = find(monthAt(carried, later)!, id)

      if (!row) {
        skipped.push(skip(later, 'absent', `${monthName(later)} does not hold this row`))
        continue
      }

      if (isReviewed(row)) {
        skipped.push(
          skip(later, 'reviewed', `${monthName(later)} holds an answer of its own here`),
        )
        continue
      }

      try {
        const applied = edit(carried, later, id, edits)
        carried = stillUnreviewed(applied.household, later, kind, applied.row)
        changed.push(later)
      } catch (cause) {
        if (!(cause instanceof DomainError)) throw cause
        skipped.push(skip(later, 'refused', cause.message))
      }
    }

    return { household: carried, changed, skipped }
  }
}

function skip(month: MonthKey, reason: SkipReason, because: string): PropagationSkip {
  return { month, reason, because }
}

/**
 * Puts the propagated row back with its Unreviewed mark intact. The edit operations clear
 * that mark, and rightly so — a member typing a figure has reviewed it. Nobody typed this
 * one, so it is put back the way it arrived.
 */
function stillUnreviewed(
  household: Household,
  key: MonthKey,
  kind: RowKind,
  row: MonthRow,
): Household {
  const month = monthAt(household, key)!
  const rows: MonthRow[] = month[kind]
  return withMonth(household, {
    ...month,
    [kind]: replaceRow(rows, row.id, { ...row, reviewed: false }),
  })
}
