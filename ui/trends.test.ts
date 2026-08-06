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
  categoryChanges,
  categoryLayers,
  goalProgress,
  memberShareLayers,
  pendingNote,
  segmentsOf,
  trendAxis,
  trendCategories,
  trendGoals,
  trendMembers,
} from './trends.js'

const income = (amount: number | null): IncomeSnapshot =>
  ({ id: `i${amount}`, amount }) as IncomeSnapshot

/** A cost, said as a bare amount where the category and Shares it holds do not matter. */
type Cost =
  | number
  | null
  | {
      amount: number | null
      category?: string | null
      /** Who divides this Expense, defaulting to a single-member row nobody's percentage
       * chart needs to split. */
      participants?: string[]
      splitRule?: ExpenseSnapshot['splitRule']
    }

/** `at` is the row's place in its Month, which is all the identity a fixture needs. */
const expense = (cost: Cost, at: number): ExpenseSnapshot => {
  const { amount, category, participants, splitRule } =
    typeof cost === 'object' && cost !== null
      ? cost
      : { amount: cost, category: null, participants: undefined, splitRule: undefined }
  return {
    id: `e${at}-${amount}`,
    amount,
    category: category ?? null,
    participants: participants ?? ['ada'],
    splitRule: splitRule ?? { kind: 'even' },
  } as ExpenseSnapshot
}

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
  expenses?: Cost[]
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

/** The Household's category vocabulary, in the order categories were added to it. */
const naming = (of: Household, ...categories: [string, string][]): Household =>
  ({ ...of, categories: categories.map(([id, name]) => ({ id, name })) }) as Household

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

describe('each member’s share of household spending', () => {
  it('apportions by largest remainder so every Month totals exactly 100', () => {
    const spread = household({
      key: '2026-01',
      members: ['ada', 'bruno'],
      expenses: [
        { amount: 6000, participants: ['ada'] },
        { amount: 3000, participants: ['bruno'] },
      ],
    })
    const axis = trendAxis(spread, '2026-01')
    const members = trendMembers(spread, axis, 'ada')

    const layers = memberShareLayers(spread, axis, members)

    expect(layers.map((layer) => layer.values)).toEqual([[67], [33]])
    expect(layers.reduce((total, layer) => total + (layer.values[0] ?? 0), 0)).toBe(100)
  })

  it('reads zero for a member the Month holds who carries no Shares', () => {
    const spread = household({
      key: '2026-01',
      members: ['ada', 'bruno'],
      expenses: [{ amount: 5000, participants: ['ada'] }],
    })
    const axis = trendAxis(spread, '2026-01')
    const members = trendMembers(spread, axis, 'ada')

    const layers = memberShareLayers(spread, axis, members)

    expect(layers.find((layer) => layer.id === 'bruno')?.values).toEqual([0])
  })

  it('draws nothing for a Month with an Expense total of zero', () => {
    const spread = household({
      key: '2026-01',
      members: ['ada'],
      expenses: [{ amount: 0, participants: ['ada'] }],
    })
    const axis = trendAxis(spread, '2026-01')
    const members = trendMembers(spread, axis, 'ada')

    expect(memberShareLayers(spread, axis, members).map((layer) => layer.values)).toEqual([
      [undefined],
    ])
  })

  it('draws nothing for a Month with no entered Expense amounts at all', () => {
    const spread = household({
      key: '2026-01',
      members: ['ada'],
      expenses: [{ amount: null, participants: ['ada'] }],
    })
    const axis = trendAxis(spread, '2026-01')
    const members = trendMembers(spread, axis, 'ada')

    expect(memberShareLayers(spread, axis, members).map((layer) => layer.values)).toEqual([
      [undefined],
    ])
  })

  it('has no band before a member is added, and keeps their band up to when they leave', () => {
    const spread = household(
      { key: '2026-01', members: ['ada'], expenses: [{ amount: 4000, participants: ['ada'] }] },
      {
        key: '2026-02',
        members: ['ada', 'bruno'],
        expenses: [
          { amount: 4000, participants: ['ada'] },
          { amount: 2000, participants: ['bruno'] },
        ],
      },
    )
    const axis = trendAxis(spread, '2026-02')
    const members = trendMembers(spread, axis, 'ada')

    const bruno = memberShareLayers(spread, axis, members).find((layer) => layer.id === 'bruno')

    expect(bruno?.values).toEqual([undefined, 33])
  })

  it('keeps a deactivated member’s band up to their last Month, and none after', () => {
    const spread = household(
      {
        key: '2026-01',
        members: ['ada', 'mira'],
        expenses: [
          { amount: 4000, participants: ['ada'] },
          { amount: 1000, participants: ['mira'] },
        ],
      },
      { key: '2026-02', members: ['ada'], expenses: [{ amount: 4000, participants: ['ada'] }] },
    )
    const axis = trendAxis(spread, '2026-02')
    const members = trendMembers(spread, axis, 'ada')

    const mira = memberShareLayers(spread, axis, members).find((layer) => layer.id === 'mira')

    expect(mira?.values).toEqual([20, undefined])
  })

  it('carries the Viewer’s emphasis onto their band', () => {
    const spread = household({
      key: '2026-01',
      members: ['ada', 'bruno'],
      expenses: [{ amount: 4000, participants: ['ada'] }],
    })
    const axis = trendAxis(spread, '2026-01')
    const members = trendMembers(spread, axis, 'bruno')

    const layers = memberShareLayers(spread, axis, members)

    expect(layers[0]).toMatchObject({ id: 'bruno', emphasis: true })
    expect(layers[1]).toMatchObject({ id: 'ada', emphasis: false })
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

describe('the categories a by-category chart draws', () => {
  const spread = naming(
    household(
      { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
      { key: '2026-02', expenses: [{ amount: 9000, category: 'home' }] },
    ),
    ['home', 'Home'],
    ['food', 'Food'],
  )

  it('names every category the charted Months spent under, in the vocabulary’s order', () => {
    expect(
      trendCategories(spread, trendAxis(spread, '2026-03')).map((one) => [one.id, one.name]),
    ).toEqual([
      ['home', 'Home'],
      ['food', 'Food'],
    ])
  })

  it('leaves out a category no charted Month spent under', () => {
    const only = naming(
      household({ key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] }),
      ['home', 'Home'],
      ['food', 'Food'],
    )

    expect(trendCategories(only, trendAxis(only, '2026-03')).map((one) => one.id)).toEqual(['food'])
  })

  /** Not a category: the model's `null`, rendered under a heading of its own, last. */
  it('groups the rows holding no category under Uncategorised, behind the categories', () => {
    const mixed = naming(
      household({ key: '2026-01', expenses: [4000, { amount: 9000, category: 'home' }] }),
      ['home', 'Home'],
    )

    expect(
      trendCategories(mixed, trendAxis(mixed, '2026-03')).map((one) => [one.id, one.name]),
    ).toEqual([
      ['home', 'Home'],
      [null, 'Uncategorised'],
    ])
  })

  it('offers Uncategorised alone for a Month with every row uncategorised', () => {
    const none = household({ key: '2026-01', expenses: [4000, 9000] })

    expect(trendCategories(none, trendAxis(none, '2026-03')).map((one) => one.id)).toEqual([null])
  })

  /**
   * The whole of what ADR-0012's retroactive rename buys: a row holds the id, so a
   * renamed category is one category still, drawn once and under its new name.
   */
  it('draws one series across a rename, under the name the vocabulary now gives', () => {
    const before = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-02', expenses: [{ amount: 5000, category: 'food' }] },
      ),
      ['food', 'Food'],
    )
    const renamed = naming(before, ['food', 'Groceries'])

    expect(trendCategories(renamed, trendAxis(renamed, '2026-03'))).toEqual([
      {
        id: 'food',
        key: 'food',
        name: 'Groceries',
        colour: trendCategories(before, trendAxis(before, '2026-03'))[0]!.colour,
      },
    ])
  })

  it('gives each category a colour of its own, Uncategorised included', () => {
    const mixed = naming(
      household({
        key: '2026-01',
        expenses: [4000, { amount: 9000, category: 'home' }, { amount: 1000, category: 'food' }],
      }),
      ['home', 'Home'],
      ['food', 'Food'],
    )

    const colours = trendCategories(mixed, trendAxis(mixed, '2026-03')).map((one) => one.colour)

    expect(new Set(colours).size).toBe(3)
  })

  it('draws nothing for a stretch with no Expenses at all', () => {
    const empty = household({ key: '2026-01' })

    expect(trendCategories(empty, trendAxis(empty, '2026-02'))).toEqual([])
  })
})

describe('a category’s spending across the axis', () => {
  const spread = naming(
    household(
      { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
      { key: '2026-03', expenses: [{ amount: 5000, category: 'food' }] },
    ),
    ['food', 'Food'],
  )

  it('reads each Month’s total under the category, breaking across a Month nobody opened', () => {
    const axis = trendAxis(spread, '2026-04')

    expect(categoryLayers(spread, axis, trendCategories(spread, axis))).toEqual([
      { id: 'food', name: 'Food', colour: expect.any(String), values: [4000, undefined, 5000] },
    ])
  })

  /**
   * A Month the Household opened and spent nothing under this category in is a zero, not
   * a gap: nothing was spent, which is a figure somebody's rows answer for. Only a Month
   * nobody opened is unknown.
   */
  it('reads zero for an opened Month that spent nothing under the category', () => {
    const patchy = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-02', expenses: [{ amount: 9000, category: 'home' }] },
      ),
      ['home', 'Home'],
      ['food', 'Food'],
    )
    const axis = trendAxis(patchy, '2026-03')

    expect(
      categoryLayers(patchy, axis, trendCategories(patchy, axis)).map((one) => one.values),
    ).toEqual([
      [0, 9000],
      [4000, 0],
    ])
  })

  it('carries the colour each category was given', () => {
    const axis = trendAxis(spread, '2026-04')
    const categories = trendCategories(spread, axis)

    expect(categoryLayers(spread, axis, categories)[0]!.colour).toBe(categories[0]!.colour)
  })
})

describe('what moved against the Previous Month', () => {
  const spread = naming(
    household(
      { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
      { key: '2026-02', expenses: [{ amount: 5000, category: 'food' }] },
    ),
    ['food', 'Food'],
  )

  it('names the two Months it is comparing', () => {
    expect(categoryChanges(spread, '2026-02')).toMatchObject({ from: '2026-01', to: '2026-02' })
  })

  it('reports each category that moved, its rise or fall named', () => {
    expect(categoryChanges(spread, '2026-02')?.bars).toEqual([
      {
        id: 'food',
        key: 'food',
        name: 'Food',
        colour: expect.any(String),
        before: 4000,
        after: 5000,
        change: 1000,
      },
    ])
  })

  /** The comparison is against the most recent *opened* Month, which after a gap is not
      the preceding calendar one. */
  it('compares across a gap in the record', () => {
    const gapped = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-04', expenses: [{ amount: 5000, category: 'food' }] },
      ),
      ['food', 'Food'],
    )

    expect(categoryChanges(gapped, '2026-04')?.from).toBe('2026-01')
  })

  it('reads a category only the Previous Month held as a fall to nothing', () => {
    const stopped = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-02', expenses: [] },
      ),
      ['food', 'Food'],
    )

    expect(categoryChanges(stopped, '2026-02')?.bars).toMatchObject([
      { id: 'food', before: 4000, after: 0, change: -4000 },
    ])
  })

  it('reads a category only this Month holds as a rise from nothing', () => {
    const started = naming(
      household(
        { key: '2026-01', expenses: [] },
        { key: '2026-02', expenses: [{ amount: 5000, category: 'food' }] },
      ),
      ['food', 'Food'],
    )

    expect(categoryChanges(started, '2026-02')?.bars).toMatchObject([
      { id: 'food', before: 0, after: 5000, change: 5000 },
    ])
  })

  /** A diverging bar is read by what moved; a category that held still would draw as a
      bar of no length. */
  it('leaves out a category that did not move', () => {
    const still = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-02', expenses: [{ amount: 4000, category: 'food' }] },
      ),
      ['food', 'Food'],
    )

    expect(categoryChanges(still, '2026-02')?.bars).toEqual([])
  })

  it('orders the rises first, largest first, and the falls behind them', () => {
    const mixed = naming(
      household(
        {
          key: '2026-01',
          expenses: [
            { amount: 4000, category: 'food' },
            { amount: 9000, category: 'home' },
          ],
        },
        {
          key: '2026-02',
          expenses: [
            { amount: 9000, category: 'food' },
            { amount: 1000, category: 'home' },
          ],
        },
      ),
      ['home', 'Home'],
      ['food', 'Food'],
    )

    expect(categoryChanges(mixed, '2026-02')?.bars.map((bar) => bar.change)).toEqual([5000, -8000])
  })

  it('names the uncategorised rows as their own group', () => {
    const loose = household(
      { key: '2026-01', expenses: [4000] },
      { key: '2026-02', expenses: [5000] },
    )

    expect(categoryChanges(loose, '2026-02')?.bars).toMatchObject([
      { id: null, key: 'uncategorised', name: 'Uncategorised', change: 1000 },
    ])
  })

  /** The Household's first Month has nothing behind it, and a Month the record does not
      reach is not opened at all — neither is a comparison against zero. */
  it('has nothing to say for a Month with no Previous Month', () => {
    expect(categoryChanges(spread, '2026-01')).toBeUndefined()
  })

  it('has nothing to say for a Month nobody opened', () => {
    expect(categoryChanges(spread, '2026-05')).toBeUndefined()
  })

  /**
   * Chart 6 is not a time series, so it is not held to the shared axis: it reads
   * whichever Month the dashboard is on, and a Month ahead of the calendar — which the
   * axis leaves out — is a Month a member can be standing in.
   */
  it('reads a Month the shared axis leaves out', () => {
    const ahead = naming(
      household(
        { key: '2026-01', expenses: [{ amount: 4000, category: 'food' }] },
        { key: '2026-09', expenses: [{ amount: 5000, category: 'food' }] },
      ),
      ['food', 'Food'],
    )

    expect(categoryChanges(ahead, '2026-09')?.bars).toMatchObject([{ change: 1000 }])
  })
})
