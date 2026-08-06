import {
  accumulatedProgress,
  goalIn,
  isPending,
  monthAfter,
  monthAt,
  monthName,
  openedMonthKeys,
  type Household,
  type MemberId,
  type Month,
  type MonthKey,
  type RowId,
} from '../domain/index.js'
import { nameOf } from './members.js'

/**
 * One slot on the shared time axis: a calendar month, whether or not the Household ever
 * opened it, and how much of it is entered.
 *
 * `opened` false is not missing data. It is a Month that was never brought into
 * existence, and every chart renders that as a break rather than as a value.
 */
export interface TrendSlot {
  key: MonthKey
  opened: boolean
  /** How many of this Month's rows have no amount entered at all. */
  pending: number
}

/**
 * The axis every chart in the trends view shares: opened Months up to and including the
 * current one, month by month on the calendar.
 *
 * Two rules, and both of them are about telling the truth rather than about drawing:
 *
 * A future Month is excluded. It holds a plan — possibly Unreviewed throughout, possibly
 * reporting Drift — and charting intention beside settled history invites reading the one
 * as the other. Which Month that is cannot be worked out from the Household, so `now` is
 * handed in exactly as `driftOf` takes it: the engine has no idea what today is, and this
 * does not guess either.
 *
 * The axis is continuous. An unopened Month between two opened ones occupies its own slot,
 * because the x-axis of a time series is a quantity and the slope between two points has
 * to keep meaning change *per month*. Compressing July and September into adjacent slots
 * would draw a two-month change identically to a one-month one.
 */
export function trendAxis(household: Household, now: MonthKey): TrendSlot[] {
  const charted = openedMonthKeys(household).filter((key) => key <= now)
  const first = charted[0]
  const last = charted.at(-1)
  if (!first || !last) return []

  const axis: TrendSlot[] = []
  for (let key = first; key <= last; key = monthAfter(key)) {
    const month = monthAt(household, key)
    axis.push({
      key,
      opened: month !== undefined,
      pending: month
        ? month.income.filter(isPending).length + month.expenses.filter(isPending).length
        : 0,
    })
  }
  return axis
}

/**
 * The stretch of the record a chart is drawing, as the view says it above the charts:
 * one Month where that is all there is, and nothing at all where there is nothing to
 * draw. It reads the axis rather than the Household, so it can never name a span the
 * charts below it are not covering.
 */
export function axisSpan(axis: readonly TrendSlot[]): string | undefined {
  const first = axis[0]
  const last = axis.at(-1)
  if (!first || !last) return undefined
  if (first.key === last.key) return monthName(first.key)
  return `${monthName(first.key)} to ${monthName(last.key)}`
}

/** A value on the axis, carrying the slot it sits in so a break costs no width. */
export interface TrendPoint<Value> {
  index: number
  value: Value
}

/**
 * One series a chart draws: one value per slot on the axis, `undefined` where there is
 * nothing to draw. A slot the Household never opened is `undefined` for every series, and
 * a series may be `undefined` in an opened Month it has no figure for — a member who was
 * not in that Month, a category nothing was spent under. Both break the line, which is the
 * same answer to the same question: this was not measured.
 */
export interface TrendSeries {
  id: string
  name: string
  values: (number | undefined)[]
  /** The Viewer's series, drawn brighter and heavier. Ordering is the caller's. */
  emphasis?: boolean
}

/**
 * A series cut into the runs that can be drawn as one line. A slot with nothing known —
 * an unopened Month, or a Month this particular series has no figure for — ends the run
 * in hand and the next known value starts a fresh one.
 *
 * Never interpolated and never zeroed. Counting a gap as zero asserts the Household
 * earned and spent nothing in a Month it merely never recorded; joining across it draws
 * a rate that was never measured. A zero, by contrast, is somebody's answer and stays.
 */
export function segmentsOf<Value>(
  values: readonly (Value | undefined)[],
): TrendPoint<Value>[][] {
  const segments: TrendPoint<Value>[][] = []
  let run: TrendPoint<Value>[] = []

  values.forEach((value, index) => {
    if (value === undefined) {
      if (run.length) segments.push(run)
      run = []
      return
    }
    run.push({ index, value })
  })
  if (run.length) segments.push(run)

  return segments
}

/**
 * What the mark on an incomplete Month says when it is hovered or read out. A Pending row
 * contributes nothing, so the Month is drawn from what is entered and says as much —
 * following the wording the rail already gives the Leftover Balance, with the count that
 * the rail's per-member mark has no room for.
 */
export function pendingNote(count: number): string | undefined {
  if (count === 0) return undefined
  return count === 1
    ? '1 Pending row is not counted in this Month'
    : `${count} Pending rows are not counted in this Month`
}

/** A member a per-member chart draws a series for. The one leading is the emphasised one. */
export interface TrendMember {
  id: MemberId
  name: string
  emphasis: boolean
}

/**
 * Who a per-member chart draws: everybody the charted Months hold, in the Roster's own
 * order, with the Viewer first.
 *
 * Read off the Months rather than off the Roster, because a Month owns its member list:
 * somebody deactivated since is still part of the history being charted, and somebody
 * added after the last charted Month is not yet part of it.
 *
 * The Viewer leads and is emphasised, exactly as the rail already treats them, and that
 * is the whole of its effect here — every other member is drawn just the same. The Viewer
 * confers no permissions and hides nothing from anybody, so it may not decide what data
 * a chart shows.
 *
 * Where this stretch of the record holds the Viewer nowhere — somebody who joined after
 * the last charted Month — nobody is emphasised and every series is drawn alike. Leading
 * with a substitute was tried and taken back out: the rail may substitute because the
 * picker beside it reads the substitution back, and this view has no picker to say who
 * has been stood in. A chart that brightens somebody's line has to mean the Viewer.
 */
export function trendMembers(
  household: Household,
  axis: readonly TrendSlot[],
  viewer: MemberId | undefined,
): TrendMember[] {
  const charted = new Set<MemberId>()
  for (const slot of axis) {
    for (const member of monthAt(household, slot.key)?.members ?? []) charted.add(member)
  }

  const drawn = household.roster
    .filter((member) => charted.has(member.id))
    .map((member) => ({ id: member.id, name: member.name }))

  // A Month may hold somebody the Roster does not, which the engine's own lookup answers
  // for. Ordered after the Roster's own, since there is no order to read them in.
  for (const member of charted) {
    if (!drawn.some((one) => one.id === member)) {
      drawn.push({ id: member, name: nameOf(household, member) })
    }
  }

  const lead = drawn.find((member) => member.id === viewer)
  const ordered = lead ? [lead, ...drawn.filter((member) => member.id !== lead.id)] : drawn
  return ordered.map((member) => ({ ...member, emphasis: member.id === lead?.id }))
}

/**
 * One figure per slot on the axis, read off each opened Month by the caller's own
 * function — never computed here. `undefined` where the Month was never opened, exactly
 * as every other series breaks there. This is the one door a chart's figures come
 * through, so that no chart component ends up doing its own money arithmetic.
 */
export function axisValues(
  household: Household,
  axis: readonly TrendSlot[],
  figure: (month: Month) => number,
): (number | undefined)[] {
  return axis.map((slot) => {
    const month = monthAt(household, slot.key)
    return month ? figure(month) : undefined
  })
}

/** A Savings Goal a per-goal chart draws, named as the record most recently held it. */
export interface TrendGoal {
  id: RowId
  name: string
}

/**
 * The goals the charted Months hold, one per identity, in the order each was first
 * charted and named as its latest charted appearance has it — a rename is read fresh
 * exactly as everywhere else a goal's name is read, rather than frozen at first sight.
 *
 * A goal that stopped recurring is still named here if any charted Month held it: it
 * ended, and the Months it ran for are still part of the record.
 */
export function trendGoals(household: Household, axis: readonly TrendSlot[]): TrendGoal[] {
  const goals = new Map<RowId, string>()
  for (const slot of axis) {
    for (const goal of monthAt(household, slot.key)?.goals ?? []) {
      goals.set(goal.id, goal.name)
    }
  }
  return [...goals.entries()].map(([id, name]) => ({ id, name }))
}

/** One goal's Accumulated Progress across the axis, and its target where it names one. */
export interface GoalProgress {
  progress: TrendSeries
  /** Absent where the goal never named a target across the whole stretch charted —
   * there is nothing to measure it against, so no line is drawn for it. */
  target?: TrendSeries
}

/**
 * A goal's Accumulated Progress as of each Month on the axis, and its target line
 * alongside — both read from `domain/progress.ts`, never recomputed here.
 *
 * A slot where this Month never held the goal is `undefined` for both series: a goal
 * that ended still shows the Months it ran for, and breaks like any other series
 * afterward. A Month where the goal has no target is `undefined` for the target alone,
 * which is what leaves that one Month with progress drawn and nothing to measure it
 * against.
 */
export function goalProgress(
  household: Household,
  axis: readonly TrendSlot[],
  goal: TrendGoal,
): GoalProgress {
  const progress: (number | undefined)[] = []
  const target: (number | undefined)[] = []

  for (const slot of axis) {
    const month = monthAt(household, slot.key)
    if (!month || !goalIn(month, goal.id)) {
      progress.push(undefined)
      target.push(undefined)
      continue
    }
    const figure = accumulatedProgress(household, slot.key, goal.id)
    progress.push(figure.accumulated)
    target.push(figure.target ?? undefined)
  }

  const named = { id: goal.id, name: goal.name, values: progress }
  return target.some((value) => value !== undefined)
    ? { progress: named, target: { id: `${goal.id}-target`, name: 'Target', values: target } }
    : { progress: named }
}
