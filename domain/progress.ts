import { DomainError } from './errors.js'
import { goalIn, totalContributedTo } from './goals.js'
import { openedMonthKeys } from './month.js'
import { openedMonth } from './rows.js'
import type { Household, Minor, MonthKey, RowId } from './types.js'

/**
 * What a Savings Goal had reached as of one Month — never as of today. Browsing last
 * November reports what last November knew: its own start amount and target, and the
 * Contributions made by then.
 */
export interface AccumulatedProgress {
  goal: RowId
  /** The Month's own baseline: what was saved before Prometheus started counting. */
  startAmount: Minor
  /** Every Contribution to this goal identity in this Month or any earlier one. */
  contributed: Minor
  /** The start amount and those Contributions together — the figure the row reports. */
  accumulated: Minor
  /** What this Month alone put in, which is what the collapsed row shows beside it. */
  thisMonth: Minor
  /** The target as this Month holds it, or nothing if the goal names none. */
  target: Minor | null
  /** What is left to reach that target, never below nothing. Null without a target. */
  remaining: Minor | null
  reached: boolean
}

/**
 * A goal's Accumulated Progress as of a Month: that Month's start amount plus every
 * Contribution to that goal identity in that Month or any earlier Month, measured
 * against that Month's target.
 *
 * The whole traversal is in memory and reads only Months at or before the one asked
 * about, which is what keeps a later Month's Contribution — or a later change of target
 * — from rewriting what an earlier Month reports.
 */
export function accumulatedProgress(
  household: Household,
  key: MonthKey,
  id: RowId,
): AccumulatedProgress {
  const month = openedMonth(household, key)
  const goal = goalIn(month, id)
  if (!goal) throw new DomainError(`${key} holds no Savings Goal ${id}`)

  const contributed = openedMonthKeys(household)
    .filter((opened) => opened <= key)
    .reduce((total, opened) => {
      const earlier = goalIn(household.months[opened]!, id)
      return total + (earlier ? totalContributedTo(earlier) : 0)
    }, 0)

  const accumulated = goal.startAmount + contributed

  return {
    goal: id,
    startAmount: goal.startAmount,
    contributed,
    accumulated,
    thisMonth: totalContributedTo(goal),
    target: goal.target,
    remaining: goal.target === null ? null : Math.max(goal.target - accumulated, 0),
    reached: goal.target !== null && accumulated >= goal.target,
  }
}
