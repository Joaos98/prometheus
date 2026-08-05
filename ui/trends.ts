import {
  isPending,
  monthAfter,
  monthAt,
  openedMonthKeys,
  type Household,
  type MemberId,
  type MonthKey,
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

/** A value on the axis, carrying the slot it sits in so a break costs no width. */
export interface TrendPoint<Value> {
  index: number
  value: Value
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
 * Where this stretch of the record holds the Viewer nowhere — a pick made against a
 * Household since replaced, or a member who joined after the last charted Month — the
 * first charted member leads instead. That is `displayedViewer`'s rule at the scale of
 * many Months: the rail always leads with somebody, and a chart with no series emphasised
 * would disagree with a picker that is naming one.
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

  const lead = drawn.find((member) => member.id === viewer) ?? drawn[0]
  if (!lead) return []
  return [lead, ...drawn.filter((member) => member.id !== lead.id)].map((member) => ({
    ...member,
    emphasis: member.id === lead.id,
  }))
}
