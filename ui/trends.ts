import {
  accumulatedProgress,
  apportion,
  goalIn,
  householdExpenseTotal,
  isPending,
  leftoverBalanceOf,
  monthAfter,
  monthAt,
  monthName,
  openedMonthKeys,
  spendingByCategory,
  spendingChangeByCategory,
  type CategoryId,
  type Household,
  type MemberId,
  type Minor,
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
      pending: month ? pendingCount(month) : 0,
    })
  }
  return axis
}

/**
 * How many of a Month's rows have no amount entered at all. A Pending row counts as
 * nothing wherever it is counted, so this is what a chart marks the Month with — and
 * chart 6, which is not on the axis, needs the same figure for the two Months it compares.
 */
export function pendingCount(month: Month): number {
  return month.income.filter(isPending).length + month.expenses.filter(isPending).length
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
 * not in that Month, a goal that Month never held. Both break the line, which is the same
 * answer to the same question: this was not measured.
 *
 * A zero is not that. A category nothing was spent under in a Month the Household did
 * open is a figure its rows answer for, and `categoryLayers` draws it as one.
 */
export interface TrendSeries {
  id: string
  name: string
  values: (number | undefined)[]
  /** The Viewer's series, drawn brighter and heavier. Ordering is the caller's. */
  emphasis?: boolean
  /**
   * The colour to draw this series in, where what it stands for owns one — a category
   * keeps its own across every chart. Left out, the chart walks its own palette.
   */
  colour?: string
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
 * Each drawn member's share of the Household's Expense total for the Month, as a
 * percentage — this is the chart that draws the Split Rule machinery's cumulative effect,
 * which nothing else in the app shows across Months. The figures are apportioned by
 * largest remainder (`domain/apportion.ts`) so every Month totals exactly 100: every other
 * total in this codebase is exact, and a band summing to 101 beside a rail that never
 * misses by a unit is not a rounding choice.
 *
 * A Month with nothing to apportion — an Expense total of zero, or no Expense with an
 * amount entered at all — is `undefined` for every member, the same answer a gap gives
 * everywhere else: there is no proportion to draw, and splitting nothing evenly would draw
 * one nobody's rows answer for. A member the Month holds who carries no Shares reads as
 * zero, exactly as a category nothing was spent under does — a fact about the Month, not
 * an absence. A member the Month does not hold at all is `undefined`, breaking their band
 * before they joined or after they left, which is what `members` in the Month's own order
 * already gives every other per-member chart.
 *
 * A composite Expense contributes through its Shares like any other — `leftoverBalanceOf`
 * reads `sharesOf`, which already treats a composite's derived amount as any Expense's own.
 */
export function memberShareLayers(
  household: Household,
  axis: readonly TrendSlot[],
  members: readonly TrendMember[],
): TrendSeries[] {
  const perSlot = axis.map((slot) => {
    const month = monthAt(household, slot.key)
    if (!month) return undefined
    if (householdExpenseTotal(month) === 0) return undefined

    const weights = members.map((member) =>
      month.members.includes(member.id)
        ? BigInt(leftoverBalanceOf(month, member.id).shares)
        : 0n,
    )
    const percentages = apportion(100, weights)
    return members.map((member, at) => (month.members.includes(member.id) ? percentages[at]! : undefined))
  })

  return members.map((member, at) => ({
    id: member.id,
    name: member.name,
    emphasis: member.emphasis,
    values: perSlot.map((row) => row?.[at]),
  }))
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

/**
 * What the rows holding no category are drawn under. It is not a category: it is the
 * model's `null`, given a heading so that a member can see what it comes to. Nothing
 * renames it and nothing deletes it, because there is nothing there to rename — which is
 * why it is a constant here rather than an entry in the Household's vocabulary.
 */
const UNCATEGORISED = 'Uncategorised'

/** The key a series takes where the category it draws is `null`, since a series is keyed
 * by a string and `null` is not one. */
const UNCATEGORISED_KEY = 'uncategorised'

/** Grey rather than a hue, so that the group which is not a category does not read as
 * one, whichever colours the categories around it took. */
const UNCATEGORISED_COLOUR = 'var(--text-muted)'

/** The colours a category chart spends, walked in the vocabulary's own order by
 * `drawnAs`, which is where the reasoning for that lives. */
const CATEGORY_PALETTE = [
  'var(--category-1)',
  'var(--category-2)',
  'var(--category-3)',
  'var(--category-4)',
  'var(--category-5)',
  'var(--category-6)',
  'var(--category-7)',
  'var(--category-8)',
]

/** A category as a chart draws it, or the Uncategorised group standing in for `null`. */
export interface TrendCategory {
  id: CategoryId | null
  /**
   * The same group as a string, because a series and a bar are each keyed by one and
   * `null` is not one. It is minted here, once, so that no template invents a stand-in
   * for `null` of its own.
   */
  key: string
  name: string
  colour: string
}

/**
 * The categories the charted Months spent under, in the Household's own vocabulary order,
 * with the Uncategorised group last where any charted Month holds a row without one.
 *
 * Each is named as the vocabulary now has it rather than as any Month held it, because no
 * Month holds a name at all — a row holds the id (ADR-0012). That is the whole of what
 * makes a rename retroactive, and it is what leaves a chart spanning one drawing a single
 * series under the new name.
 *
 * A category the vocabulary no longer holds falls in with the uncategorised rows, exactly
 * as `categoryName` renders no chip for one: a delete clears every row first, so this is
 * only reachable on a screen not yet caught up with another member's delete, and a series
 * named after an id is worse than one honest heading.
 */
export function trendCategories(
  household: Household,
  axis: readonly TrendSlot[],
): TrendCategory[] {
  const spent = new Set<CategoryId | null>()
  for (const slot of axis) {
    const month = monthAt(household, slot.key)
    if (!month) continue
    for (const spend of spendingByCategory(month)) spent.add(inVocabulary(household, spend.category))
  }

  const drawn = household.categories
    .filter((category) => spent.has(category.id))
    .map((category) => drawnAs(household, category.id))

  if (spent.has(null)) drawn.push(drawnAs(household, null))
  return drawn
}

/**
 * One layer per category: what the Household spent under it in each Month of the axis.
 *
 * A Month nobody opened is `undefined`, as it is for every series. A Month that was opened
 * and spent nothing under this category is zero, and the distinction matters more here
 * than anywhere else in the view: these are stacked, so a gap in a lower layer would take
 * every layer above it with it — and it would be saying the wrong thing anyway. Nothing
 * spent under a category is a figure the Month's rows answer for, not an absence.
 */
export function categoryLayers(
  household: Household,
  axis: readonly TrendSlot[],
  categories: readonly TrendCategory[],
): TrendSeries[] {
  const perSlot = axis.map((slot) => {
    const month = monthAt(household, slot.key)
    return month ? resolvedTotalsOf(household, month) : undefined
  })

  return categories.map((category) => ({
    id: category.key,
    name: category.name,
    colour: category.colour,
    values: perSlot.map((totals) => (totals ? (totals.get(category.id) ?? 0) : undefined)),
  }))
}

/** One category's rise or fall against the Previous Month, as a diverging bar draws it. */
export interface ChangeBar extends TrendCategory {
  before: Minor
  after: Minor
  /** `after` less `before`: positive is a rise, negative a fall. Never zero — a category
   * that held still has no bar to draw. */
  change: Minor
}

/** What moved between the Month being read and the Previous Month, and which two Months
 * those are. The Months are named because after a gap the Previous Month is not the
 * obvious one. */
export interface CategoryChanges {
  from: MonthKey
  to: MonthKey
  bars: ChangeBar[]
}

/**
 * What rose and what fell by category against the Previous Month, largest rise first and
 * largest fall last, for whichever Month is handed in — the dashboard's, not the axis',
 * since this is a comparison of two Months rather than a series across them.
 *
 * A category that did not move is left out. The engine reports it, because two Months
 * holding the same figure is something it knows; a bar of no length is not a way to say it.
 *
 * Nothing comes back where the engine has no comparison to draw: a Month nobody opened, or
 * one with no Previous Month at all. A caller says so rather than drawing an empty frame.
 */
export function categoryChanges(household: Household, key: MonthKey): CategoryChanges | undefined {
  const moved = spendingChangeByCategory(household, key)
  if (!moved) return undefined

  // Summed by the category as this view resolves it, so that an id the vocabulary has
  // lost lands in the Uncategorised group rather than beside a second bar of that name.
  // Every figure is the engine's own, this one included: two groups folded together moved
  // by what both of them moved, so there is nothing to work out here.
  const totals = new Map<CategoryId | null, Omit<ChangeBar, keyof TrendCategory>>()
  for (const change of moved.changes) {
    const id = inVocabulary(household, change.category)
    const running = totals.get(id) ?? { before: 0, after: 0, change: 0 }
    totals.set(id, {
      before: running.before + change.before,
      after: running.after + change.after,
      change: running.change + change.change,
    })
  }

  const bars: ChangeBar[] = [...totals.entries()]
    .map(([id, figures]) => ({ ...drawnAs(household, id), ...figures }))
    .filter((bar) => bar.change !== 0)
    .sort((one, other) => other.change - one.change)

  return { from: moved.from, to: moved.to, bars }
}

/**
 * One category as every chart draws it — its key, its name and its colour — so that the
 * two charts cannot disagree about any of the three.
 *
 * The colour is the category's place in the Household's vocabulary, which a rename does
 * not move (ADR-0012): that is what makes a colour the category's own rather than a
 * chart's, and what leaves a chart spanning a rename drawing one series in one colour.
 * `null` — and an id the vocabulary has lost — takes the Uncategorised group's grey.
 *
 * A Household with more categories than there are colours has two of them share, and the
 * legend tells them apart — the same answer `TrendChart`'s own palette gives.
 */
function drawnAs(household: Household, id: CategoryId | null): TrendCategory {
  const at = id === null ? -1 : household.categories.findIndex((one) => one.id === id)
  return at === -1
    ? { id: null, key: UNCATEGORISED_KEY, name: UNCATEGORISED, colour: UNCATEGORISED_COLOUR }
    : {
        id,
        key: id!,
        name: household.categories[at]!.name,
        colour: CATEGORY_PALETTE[at % CATEGORY_PALETTE.length]!,
      }
}

/** The category as this view will draw it: an id the vocabulary no longer holds is not a
 * category any more, and falls in with the rows that never had one. */
function inVocabulary(household: Household, id: CategoryId | null): CategoryId | null {
  if (id === null) return null
  return household.categories.some((one) => one.id === id) ? id : null
}

/**
 * A Month's spending by category as this view groups it, which is not quite as the engine
 * reports it: an id the vocabulary has lost is folded in with the rows that never had one,
 * so that a stack still totals the Month's whole Expense figure rather than quietly
 * dropping a band.
 */
function resolvedTotalsOf(household: Household, month: Month): Map<CategoryId | null, Minor> {
  const totals = new Map<CategoryId | null, Minor>()
  for (const spend of spendingByCategory(month)) {
    const id = inVocabulary(household, spend.category)
    totals.set(id, (totals.get(id) ?? 0) + spend.amount)
  }
  return totals
}
