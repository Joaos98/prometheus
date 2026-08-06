import { describe, expect, it } from 'vitest'
import type {
  ExpenseSnapshot,
  Household,
  IncomeSnapshot,
  MemberId,
  Month,
  MonthKey,
  SavingsGoal,
} from '../domain/index.js'
import {
  axisSpan,
  axisValues,
  goalProgress,
  pendingNote,
  segmentsOf,
  trendAxis,
  trendGoals,
  trendMembers,
} from './trends.js'

const income = (amount: number | null): IncomeSnapshot =>
  ({ id: `i${amount}`, amount }) as IncomeSnapshot

const expense = (amount: number | null): ExpenseSnapshot =>
  ({ id: `e${amount}`, amount }) as ExpenseSnapshot

/** A Savings Goal identity, defaulting to one with no target and no Contributions. */
const goal = (id: string, overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id,
  name: 'Emergency fund',
  target: null,
  startAmount: 0,
  participants: ['ada'] as MemberId[],
  contributions: {},
  reviewed: true,
  oneOff: false,
  ...overrides,
})

interface Opened {
  key: string
  members?: string[]
  income?: (number | null)[]
  expenses?: (number | null)[]
  goals?: SavingsGoal[]
}

const household = (...opened: Opened[]): Household =>
  ({
    currency: { code: 'EUR', symbol: '€', decimals: 2 },
    categories: [],
    paymentMethods: [],
    roster: [
      { id: 'ada', name: 'Ada', active: true },
      { id: 'bruno', name: 'Bruno', active: true },
      { id: 'mira', name: 'Mira', active: false },
    ],
    months: Object.fromEntries(
      opened.map((month) => [
        month.key,
        {
          key: month.key as MonthKey,
          members: (month.members ?? ['ada']) as MemberId[],
          income: (month.income ?? []).map(income),
          expenses: (month.expenses ?? []).map(expense),
          goals: month.goals ?? [],
        } satisfies Month,
      ]),
    ),
  }) as Household

const keys = (axis: { key: MonthKey }[]): MonthKey[] => axis.map((slot) => slot.key)

describe('the time axis every chart shares', () => {
  it('spans the opened Months', () => {
    const axis = trendAxis(household({ key: '2026-01' }, { key: '2026-02' }), '2026-03')

    expect(keys(axis)).toEqual(['2026-01', '2026-02'])
    expect(axis.every((slot) => slot.opened)).toBe(true)
  })

  it('includes the current Month when it has been opened', () => {
    const axis = trendAxis(household({ key: '2026-02' }, { key: '2026-03' }), '2026-03')

    expect(keys(axis)).toEqual(['2026-02', '2026-03'])
  })

  /** A future Month holds a plan, and charting intention beside settled history reads
      as fact. It is excluded whether or not anybody has opened it. */
  it('excludes Months after the current one', () => {
    const axis = trendAxis(
      household({ key: '2026-02' }, { key: '2026-03' }, { key: '2026-04' }),
      '2026-03',
    )

    expect(keys(axis)).toEqual(['2026-02', '2026-03'])
  })

  it('ends at the last opened Month rather than running on to the current one', () => {
    const axis = trendAxis(household({ key: '2026-01' }, { key: '2026-02' }), '2026-06')

    expect(keys(axis)).toEqual(['2026-01', '2026-02'])
  })

  /** The x-axis is a quantity: the slope between two points has to keep meaning change
      per month, so a Month nobody opened still occupies its slot. */
  it('gives an unopened Month its own slot between two opened ones', () => {
    const axis = trendAxis(household({ key: '2026-01' }, { key: '2026-03' }), '2026-05')

    expect(keys(axis)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(axis.map((slot) => slot.opened)).toEqual([true, false, true])
  })

  it('runs across the turn of a year', () => {
    const axis = trendAxis(household({ key: '2025-11' }, { key: '2026-02' }), '2026-04')

    expect(keys(axis)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('holds a single opened Month as one slot', () => {
    const axis = trendAxis(household({ key: '2026-03' }), '2026-07')

    expect(keys(axis)).toEqual(['2026-03'])
  })

  it('is empty for a Household with nothing opened', () => {
    expect(trendAxis(household(), '2026-03')).toEqual([])
  })

  /** A Household whose only Months are plans has nothing settled to chart yet. */
  it('is empty when every opened Month is still ahead', () => {
    expect(trendAxis(household({ key: '2026-08' }, { key: '2026-09' }), '2026-07')).toEqual([])
  })

  it('counts the Pending rows of each Month', () => {
    const axis = trendAxis(
      household(
        { key: '2026-01', income: [1000, null], expenses: [null, null, 500] },
        { key: '2026-02', income: [1000], expenses: [500] },
      ),
      '2026-03',
    )

    expect(axis.map((slot) => slot.pending)).toEqual([3, 0])
  })

  it('counts nothing Pending in a Month nobody opened', () => {
    const axis = trendAxis(household({ key: '2026-01' }, { key: '2026-03' }), '2026-03')

    expect(axis[1]).toEqual({ key: '2026-02', opened: false, pending: 0 })
  })
})

describe('the stretch the charts are covering', () => {
  it('names the ends of the axis', () => {
    const spread = household({ key: '2026-01' }, { key: '2026-04' })

    expect(axisSpan(trendAxis(spread, '2026-06'))).toBe('January 2026 to April 2026')
  })

  it('names one Month where that is all there is', () => {
    const only = household({ key: '2026-03' })

    expect(axisSpan(trendAxis(only, '2026-06'))).toBe('March 2026')
  })

  it('names nothing where there is nothing to draw', () => {
    expect(axisSpan([])).toBeUndefined()
  })
})

describe('breaking a series across a gap', () => {
  it('keeps a full series as one run', () => {
    expect(segmentsOf([1, 2, 3])).toEqual([
      [
        { index: 0, value: 1 },
        { index: 1, value: 2 },
        { index: 2, value: 3 },
      ],
    ])
  })

  /** Never interpolated and never zeroed: the line stops and starts again. */
  it('stops and restarts across a gap rather than joining across it', () => {
    expect(segmentsOf([1, undefined, 3])).toEqual([
      [{ index: 0, value: 1 }],
      [{ index: 2, value: 3 }],
    ])
  })

  it('keeps the slot each value sits in, so a break costs no width', () => {
    expect(segmentsOf([undefined, undefined, 7, 8])).toEqual([
      [
        { index: 2, value: 7 },
        { index: 3, value: 8 },
      ],
    ])
  })

  it('keeps a zero, which is an amount rather than an absence', () => {
    expect(segmentsOf([0, undefined, 0])).toEqual([
      [{ index: 0, value: 0 }],
      [{ index: 2, value: 0 }],
    ])
  })

  it('has no runs at all where nothing is known', () => {
    expect(segmentsOf([undefined, undefined])).toEqual([])
  })
})

describe('what a Month with Pending rows says on hover', () => {
  it('says nothing where every row is entered', () => {
    expect(pendingNote(0)).toBeUndefined()
  })

  /** The wording follows the rail's: Pending rows are not counted, so the Month is
      drawn from what is entered and is not final. */
  it('names one Pending row in the singular', () => {
    expect(pendingNote(1)).toBe('1 Pending row is not counted in this Month')
  })

  it('names how many there are', () => {
    expect(pendingNote(4)).toBe('4 Pending rows are not counted in this Month')
  })
})

describe('the members a per-member chart draws', () => {
  const spread = household(
    { key: '2026-01', members: ['ada', 'bruno'] },
    { key: '2026-02', members: ['ada', 'bruno'] },
  )

  it('leads with the Viewer, emphasised', () => {
    expect(trendMembers(spread, trendAxis(spread, '2026-03'), 'bruno')).toEqual([
      { id: 'bruno', name: 'Bruno', emphasis: true },
      { id: 'ada', name: 'Ada', emphasis: false },
    ])
  })

  /** The Viewer confers no permissions and hides nothing from anybody. */
  it('shows every other member behind them', () => {
    expect(
      trendMembers(spread, trendAxis(spread, '2026-03'), 'bruno').map((one) => one.id),
    ).toContain('ada')
  })

  it('keeps the Roster’s own order, emphasising nobody, where no Viewer is picked', () => {
    expect(trendMembers(spread, trendAxis(spread, '2026-03'), undefined)).toEqual([
      { id: 'ada', name: 'Ada', emphasis: false },
      { id: 'bruno', name: 'Bruno', emphasis: false },
    ])
  })

  /**
   * A Month owns its member list, so somebody who left the Roster is still part of the
   * history being charted — and somebody who joined after the last charted Month is not
   * yet part of it.
   */
  it('draws whoever the charted Months hold, deactivated members included', () => {
    const past = household({ key: '2026-01', members: ['ada', 'mira'] })

    expect(trendMembers(past, trendAxis(past, '2026-03'), 'ada')).toEqual([
      { id: 'ada', name: 'Ada', emphasis: true },
      { id: 'mira', name: 'Mira', emphasis: false },
    ])
  })

  it('leaves out a member no charted Month holds', () => {
    const only = household({ key: '2026-01', members: ['ada'] })

    expect(trendMembers(only, trendAxis(only, '2026-03'), 'ada').map((one) => one.id)).toEqual([
      'ada',
    ])
  })

  /**
   * The Viewer is a display pick and may name somebody this stretch of the record has
   * never held — a member who joined after the last charted Month. The charts still draw
   * what the record holds, and nobody is emphasised: there is no picker here to say who
   * has been stood in, so a brightened series would be claiming to be the Viewer.
   */
  it('emphasises nobody where the Viewer is in none of the charted Months', () => {
    const only = household({ key: '2026-01', members: ['ada'] })

    expect(trendMembers(only, trendAxis(only, '2026-03'), 'bruno')).toEqual([
      { id: 'ada', name: 'Ada', emphasis: false },
    ])
  })

  it('draws nobody for a Household with nothing to chart', () => {
    expect(trendMembers(household(), [], 'ada')).toEqual([])
  })
})

describe('reading one figure per Month off the axis', () => {
  it('reads the caller’s figure for every opened Month', () => {
    const spread = household(
      { key: '2026-01', expenses: [500] },
      { key: '2026-02', expenses: [700, 100] },
    )
    const axis = trendAxis(spread, '2026-03')

    const values = axisValues(spread, axis, (month) =>
      month.expenses.reduce((total, row) => total + (row.amount ?? 0), 0),
    )

    expect(values).toEqual([500, 800])
  })

  it('is undefined for a Month nobody opened, without asking the caller for a figure', () => {
    const spread = household({ key: '2026-01' }, { key: '2026-03' })
    const axis = trendAxis(spread, '2026-03')

    const values = axisValues(spread, axis, () => 1)

    expect(values).toEqual([1, undefined, 1])
  })
})

describe('the goals a per-goal chart draws', () => {
  it('lists a goal every charted Month holds', () => {
    const spread = household({ key: '2026-01', goals: [goal('g1', { name: 'Roof' })] })

    expect(trendGoals(spread, trendAxis(spread, '2026-02'))).toEqual([{ id: 'g1', name: 'Roof' }])
  })

  it('names a goal as its most recently charted appearance had it', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { name: 'Roof' })] },
      { key: '2026-02', goals: [goal('g1', { name: 'New roof' })] },
    )

    expect(trendGoals(spread, trendAxis(spread, '2026-03'))).toEqual([
      { id: 'g1', name: 'New roof' },
    ])
  })

  /** A goal that stopped recurring is still part of the record it ran for. */
  it('keeps a goal that stopped recurring', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { name: 'Roof' })] },
      { key: '2026-02', goals: [] },
    )

    expect(trendGoals(spread, trendAxis(spread, '2026-03'))).toEqual([{ id: 'g1', name: 'Roof' }])
  })

  it('draws nothing for a stretch with no goals at all', () => {
    const spread = household({ key: '2026-01' })

    expect(trendGoals(spread, trendAxis(spread, '2026-02'))).toEqual([])
  })
})

describe('a goal’s Accumulated Progress across the axis', () => {
  it('draws progress and target for every Month the goal was held', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { target: 100000, contributions: { ada: 20000 } })] },
      { key: '2026-02', goals: [goal('g1', { target: 100000, contributions: { ada: 15000 } })] },
    )
    const axis = trendAxis(spread, '2026-03')

    const result = goalProgress(spread, axis, { id: 'g1', name: 'Roof' })

    expect(result.progress).toEqual({ id: 'g1', name: 'Roof', values: [20000, 35000] })
    expect(result.target).toEqual({ id: 'g1-target', name: 'Target', values: [100000, 100000] })
  })

  it('omits the target entirely where the goal never names one', () => {
    const spread = household({ key: '2026-01', goals: [goal('g1', { target: null })] })

    const result = goalProgress(spread, trendAxis(spread, '2026-02'), { id: 'g1', name: 'Roof' })

    expect(result.target).toBeUndefined()
  })

  /** A goal with no target has no line to measure against for that Month alone, even
      where an earlier or later Month named one. */
  it('draws progress with no target line for a Month with none, beside one that has one', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { target: null, contributions: { ada: 5000 } })] },
      { key: '2026-02', goals: [goal('g1', { target: 100000, contributions: { ada: 5000 } })] },
    )
    const axis = trendAxis(spread, '2026-03')

    const result = goalProgress(spread, axis, { id: 'g1', name: 'Roof' })

    expect(result.target?.values).toEqual([undefined, 100000])
  })

  it('breaks across a Month the goal did not hold, and keeps counting once it returns', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { contributions: { ada: 5000 } })] },
      { key: '2026-02', goals: [] },
      { key: '2026-03', goals: [goal('g1', { contributions: { ada: 2000 } })] },
    )
    const axis = trendAxis(spread, '2026-04')

    const result = goalProgress(spread, axis, { id: 'g1', name: 'Roof' })

    expect(result.progress.values).toEqual([5000, undefined, 7000])
  })

  it('reports a Month’s progress as of that Month, never as of today', () => {
    const spread = household(
      { key: '2026-01', goals: [goal('g1', { contributions: { ada: 5000 } })] },
      { key: '2026-02', goals: [goal('g1', { contributions: { ada: 3000 } })] },
    )
    const axis = trendAxis(spread, '2026-03')

    const result = goalProgress(spread, axis, { id: 'g1', name: 'Roof' })

    expect(result.progress.values).toEqual([5000, 8000])
  })
})
