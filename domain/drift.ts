/**
 * Drift: what a Month opened ahead of time has missed.
 *
 * A member opens August in July to plan ahead, then corrects July's rent. August was
 * copied before the correction and still holds the old figure — and because proportional
 * Shares weight by Spendable Income, a stale income line quietly corrupts every
 * proportional Share in that Month too. Rather than forbid opening a Month early, the
 * failure is made visible: the Month reports how it differs from what opening it now
 * would produce.
 *
 * It reports only rows that are still Unreviewed there. A value nobody has refreshed and
 * one a member changed on purpose are identical in the data, but the row carrying them is
 * not: the Unreviewed mark is precisely the record of whether anybody in this Month has
 * read that row and answered for it (ADR-0011). An answer given here has missed nothing,
 * and Forward Propagation already refuses to overwrite one — Drift reporting the same row
 * as a difference was that rule applied in one direction only.
 *
 * What is left is still a diff and nothing more: neutral rather than a warning, with
 * nothing to dismiss. A difference stops being reported when the Months agree again, when
 * somebody answers for the row, or when the Month stops being in the future — never
 * because it was waved away.
 *
 * One case is deliberately not covered: a row *removed* from this Month leaves no row
 * behind to carry a mark, so the Previous Month still holding it reads as `missing` as it
 * always did. ADR-0011 records why that needs its own decision.
 */
import { DomainError } from './errors.js'
import { rowForMembers } from './inheritance.js'
import { monthName } from './month-key.js'
import { monthAt, monthIfOpened, openedMonthKeys, previousMonthKey } from './month.js'
import { isReviewed } from './review.js'
import { openedMonth, replaceRow, withMonth } from './rows.js'
import type {
  Currency,
  ExpenseSnapshot,
  Household,
  IncomeSnapshot,
  LineItem,
  MemberId,
  Month,
  MonthKey,
  MonthRow,
  RowId,
  RowKind,
  SavingsGoal,
  SplitRule,
} from './types.js'

/** A field of a row that a Month and a fresh open of it do not agree on. */
export type DriftField =
  | 'name'
  | 'category'
  | 'paymentMethod'
  | 'amount'
  | 'participants'
  | 'splitRule'
  | 'lines'
  | 'member'
  | 'restrictedUse'
  | 'target'
  | 'startAmount'

/**
 * How one row stands against the row a fresh open would give this Month.
 *
 * `changed` is the same row, said differently. `missing` is a row the Previous Month has
 * gained since — it would arrive, and is not here. `gone` is one the Previous Month has
 * since lost, so a fresh open would not bring it at all.
 */
export type RowDriftState = 'changed' | 'missing' | 'gone'

export interface RowDrift {
  kind: RowKind
  id: RowId
  /** What to call the row when saying which one this is about. */
  name: string
  state: RowDriftState
  /** The fields that differ, for a `changed` row. Empty for the other two. */
  fields: DriftField[]
  /** The row as this Month holds it, absent when the row is `missing` here. */
  held: MonthRow | undefined
  /** The row as a fresh open would give it, absent when it is `gone` from the source. */
  inherited: MonthRow | undefined
}

/** The Month's own member list against the one a fresh open would give it. */
export interface MembershipDrift {
  held: MemberId[]
  inherited: MemberId[]
}

/** How a Month differs from what opening it now would produce. */
export interface Drift {
  month: MonthKey
  /** The Month it is measured against, as the record now stands. */
  from: MonthKey | undefined
  /** Absent when the two agree on who this Month is for. */
  members: MembershipDrift | undefined
  rows: RowDrift[]
}

/** Whether a Drift has anything at all to report. */
export function hasDrift(drift: Drift): boolean {
  return drift.rows.length > 0 || drift.members !== undefined
}

/** How many differences a Drift reports, membership counting as one of them. */
export function driftCount(drift: Drift): number {
  return drift.rows.length + (drift.members ? 1 : 0)
}

/**
 * What a Month holds against what opening it now from its Previous Month would produce.
 * A query and nothing else: it changes no Household and opens no Month.
 *
 * `now` is the Month the calendar is on, which the engine has no way of knowing and will
 * not guess. Only a Month after it can drift — one that has arrived has stopped being a
 * plan, and a diff against an earlier Month's later corrections would be noise on a
 * record the member has already lived through.
 */
export function driftOf(household: Household, key: MonthKey, now: MonthKey): Drift {
  const nothing: Drift = { month: key, from: undefined, members: undefined, rows: [] }

  const month = monthAt(household, key)
  if (!month || key <= now) return nothing

  /**
   * With no Previous Month there is nothing to have drifted from. Opening it now would
   * give the active Roster and no rows, so every row it holds would read as one a fresh
   * open would drop — which says nothing true about a Month whose rows were entered into
   * it directly, and would invite refreshing the lot of them away.
   */
  const from = previousMonthKey(household, key)
  if (!from) return nothing

  const fresh = monthIfOpened(household, key)
  return {
    month: key,
    from,
    members: sameMembers(month.members, fresh.members)
      ? undefined
      : { held: [...month.members], inherited: [...fresh.members] },
    rows: [
      ...rowDrift('income', month.income, fresh.income, incomeFields),
      ...rowDrift('expenses', month.expenses, fresh.expenses, expenseFields),
      ...rowDrift('goals', month.goals, fresh.goals, goalFields),
    ],
  }
}

/**
 * Takes one reported difference and settles it the Previous Month's way: the row it now
 * holds, the row it has gained, or the absence of one it has lost.
 *
 * Only a difference the engine is currently reporting can be refreshed, so this cannot be
 * used to reach into a Month that is not in the future or to overwrite a row nothing is
 * said about. One difference at a time is the whole point — the others stand until the
 * member decides about them too.
 *
 * What arrives is Unreviewed, exactly as it would be had the Month been opened now. The
 * member has chosen to take the copy, not to vouch for the figure, and the row genuinely
 * holds a value nobody has checked against this Month.
 */
export function refreshFromPreviousMonth(
  household: Household,
  key: MonthKey,
  now: MonthKey,
  kind: RowKind,
  id: RowId,
): Household {
  const month = openedMonth(household, key)
  const difference = driftOf(household, key, now).rows.find(
    (row) => row.kind === kind && row.id === id,
  )
  if (!difference) {
    throw new DomainError(
      `${monthName(key)} reports no difference for that row, so there is nothing to refresh`,
    )
  }

  const rows: MonthRow[] = month[kind]
  if (difference.state === 'gone') {
    return withMonth(household, { ...month, [kind]: rows.filter((row) => row.id !== id) })
  }

  const taking = landed(month, difference, kind, household.currency)
  const refreshed =
    difference.state === 'missing' ? [...rows, taking] : replaceRow(rows, id, taking)

  return withMonth(household, { ...month, [kind]: refreshed })
}

/**
 * The inherited row as this Month can actually hold it.
 *
 * The row was worked out against the members a fresh open *would* give the Month, which is
 * not always the members it has — membership is one of the things that drifts, and it is
 * not refreshed a row at a time. Landing the row as computed would hand this Month an
 * Expense divided among somebody it has never had, so it is reconciled again on the way in.
 *
 * A goal keeps the Contributions the Month already holds. A fresh open starts them at
 * nothing, which is right for a Month being opened and quite wrong for one being corrected:
 * what anybody put in here they put in here, and refreshing a target is no reason to lose
 * it. They are pruned to whoever is still a Participant, as editing a goal prunes them.
 */
function landed(
  month: Month,
  difference: RowDrift,
  kind: RowKind,
  currency: Currency,
): MonthRow {
  const row = rowForMembers(kind, difference.inherited!, month.members, currency)
  if (!row) {
    throw new DomainError(
      `${monthName(month.key)} has nobody that row could be about, so it cannot be refreshed`,
    )
  }
  return kind === 'goals' ? keepingContributions(row as SavingsGoal, difference.held) : row
}

function keepingContributions(goal: SavingsGoal, held: MonthRow | undefined): SavingsGoal {
  const already = (held as SavingsGoal | undefined)?.contributions
  if (!already) return goal
  return {
    ...goal,
    contributions: Object.fromEntries(
      Object.entries(already).filter(([member]) => goal.participants.includes(member)),
    ),
  }
}

/**
 * Every later opened Month that has drifted, in calendar order — what the rail reports
 * from whichever Month is being looked at, so a correction made here shows immediately
 * where it has not reached.
 */
export function driftAhead(household: Household, after: MonthKey, now: MonthKey): Drift[] {
  return openedMonthKeys(household)
    .filter((opened) => opened > after)
    .map((opened) => driftOf(household, opened, now))
    .filter(hasDrift)
}

/**
 * Rows matched by their stable identity, which is the only thing that says two Months are
 * talking about the same cost. Held and inherited are walked in the inherited Month's
 * order so the report reads the way the Month would.
 *
 * A row this Month has answered for is passed over in both directions. `changed` is the
 * plain case: the member typed this figure, so it differs from the Previous Month because
 * they made it differ. `gone` is the one that was actively wrong — a row recorded fresh
 * here starts Reviewed and has no counterpart behind it, so it read as a row the Previous
 * Month had lost, and refreshing that difference deleted what had just been added.
 */
function rowDrift<Row extends MonthRow & { name: string }>(
  kind: RowKind,
  held: Row[],
  inherited: Row[],
  fieldsOf: (one: Row, other: Row) => DriftField[],
): RowDrift[] {
  const drifted: RowDrift[] = []

  for (const row of inherited) {
    const here = held.find((candidate) => candidate.id === row.id)
    if (!here) {
      drifted.push({ kind, id: row.id, name: row.name, state: 'missing', fields: [], held: undefined, inherited: row })
      continue
    }
    if (isReviewed(here)) continue
    const fields = fieldsOf(here, row)
    if (fields.length > 0) {
      drifted.push({ kind, id: row.id, name: here.name, state: 'changed', fields, held: here, inherited: row })
    }
  }

  for (const row of held) {
    if (isReviewed(row)) continue
    if (!inherited.some((candidate) => candidate.id === row.id)) {
      drifted.push({ kind, id: row.id, name: row.name, state: 'gone', fields: [], held: row, inherited: undefined })
    }
  }

  return drifted
}

function incomeFields(held: IncomeSnapshot, inherited: IncomeSnapshot): DriftField[] {
  return [
    ...differs('name', held.name !== inherited.name),
    ...differs('member', held.member !== inherited.member),
    ...differs('amount', held.amount !== inherited.amount),
    ...differs('restrictedUse', held.restrictedUse !== inherited.restrictedUse),
  ]
}

function expenseFields(held: ExpenseSnapshot, inherited: ExpenseSnapshot): DriftField[] {
  return [
    ...differs('name', held.name !== inherited.name),
    ...differs('category', held.category !== inherited.category),
    ...differs('paymentMethod', held.paymentMethod !== inherited.paymentMethod),
    ...differs('amount', held.amount !== inherited.amount),
    ...differs('participants', !sameMembers(held.participants, inherited.participants)),
    ...differs('splitRule', !sameRule(held.splitRule, inherited.splitRule)),
    ...differs('lines', !sameLines(held.lines, inherited.lines)),
  ]
}

/**
 * A goal's Contributions are never compared. What anybody put in during a Month was put
 * in during that Month, and a fresh open would start them at nothing — so every goal
 * anybody has contributed to would otherwise report a difference that refreshing would
 * only destroy.
 */
function goalFields(held: SavingsGoal, inherited: SavingsGoal): DriftField[] {
  return [
    ...differs('name', held.name !== inherited.name),
    ...differs('target', held.target !== inherited.target),
    ...differs('startAmount', held.startAmount !== inherited.startAmount),
    ...differs('participants', !sameMembers(held.participants, inherited.participants)),
  ]
}

function differs(field: DriftField, itDoes: boolean): DriftField[] {
  return itDoes ? [field] : []
}

/** Membership is a list in a Month's own order, so order is part of what it says. */
function sameMembers(one: MemberId[], other: MemberId[]): boolean {
  return one.length === other.length && one.every((member, at) => member === other[at])
}

/** Two rules agree when they are the same kind and say the same of every Participant. */
function sameRule(one: SplitRule, other: SplitRule): boolean {
  if (one.kind !== other.kind) return false

  const ours = figuresOf(one)
  const theirs = figuresOf(other)
  const named = new Set([...Object.keys(ours), ...Object.keys(theirs)])
  return [...named].every((member) => ours[member] === theirs[member])
}

/** The per-Participant figures a rule carries, of which `even` and `proportional` have none. */
function figuresOf(rule: SplitRule): Record<MemberId, number> {
  return rule.kind === 'percentage' || rule.kind === 'fixed' ? rule.byMember : {}
}

/**
 * Two line lists agree when they hold the same ids in the same order with the same names
 * and the same amounts. The id is what is checked, not only the name and amount, so a
 * renamed or re-priced line reads as the same line changed rather than as one deleted
 * and another added.
 */
function sameLines(one: LineItem[], other: LineItem[]): boolean {
  return (
    one.length === other.length &&
    one.every((line, at) => {
      const there = other[at]
      return there !== undefined && sameLine(line, there)
    })
  )
}

function sameLine(one: LineItem, other: LineItem): boolean {
  return one.id === other.id && one.name === other.name && one.amount === other.amount
}
