/**
 * The seed is the demo's shop window and the end-to-end integration test at once, so this
 * is where it is run as one. Every assertion here is something a visitor can see on the
 * first screen — the Shares on an Expense, a Leftover Balance, what the review meter
 * counts, what a Month opened early reports — rather than anything about how the seed is
 * written. A domain change that quietly stops the model producing them fails here.
 */
import { describe, expect, it } from 'vitest'
import {
  accumulatedProgress,
  driftOf,
  exportHousehold,
  hasDrift,
  householdSpendableIncome,
  importHousehold,
  leftoverBalancesOf,
  monthAfter,
  monthAt,
  monthBefore,
  openedMonthKeys,
  sharesOf,
  spendableIncome,
  spendableIncomeShares,
  totalIncome,
  unreviewedCount,
  type ExpenseSnapshot,
  type Household,
  type Month,
  type MonthKey,
} from '../domain/index.js'
import { seedHousehold } from './seed.js'

/** Any Month at all: the seed is told what the calendar says rather than reading it. */
const NOW: MonthKey = '2026-07'

const SETTLED = monthBefore(NOW)
const GAP = monthBefore(SETTLED)
const EARLY = monthBefore(GAP)
const ORIGIN = monthBefore(EARLY)
const PLANNING = monthAfter(NOW)

const household = seedHousehold(NOW)

function month(key: MonthKey): Month {
  const opened = monthAt(household, key)
  if (!opened) throw new Error(`${key} is not opened`)
  return opened
}

function expense(key: MonthKey, name: string): ExpenseSnapshot {
  const row = month(key).expenses.find((candidate) => candidate.name === name)
  if (!row) throw new Error(`${key} holds no Expense called ${name}`)
  return row
}

function memberNamed(household: Household, name: string): string {
  return household.roster.find((candidate) => candidate.name === name)!.id
}

describe('the demo seed', () => {
  it('opens the record from four Months before now up to the Month after it, with a gap', () => {
    expect(openedMonthKeys(household)).toEqual([ORIGIN, EARLY, SETTLED, NOW, PLANNING])
  })

  it('never opens the Month in the middle of the record', () => {
    expect(monthAt(household, GAP)).toBeUndefined()
  })

  it('has the Month after the gap inherit across it, from the Month before', () => {
    expect(month(SETTLED).expenses.map((row) => row.name)).toContain('Rent')
  })

  it('lands a visitor in a Month with rows still Unreviewed', () => {
    expect(unreviewedCount(month(NOW))).toBeGreaterThan(0)
  })

  it('lands a visitor in a Month holding a Pending row', () => {
    const pending = month(NOW).expenses.filter((row) => row.amount === null)
    expect(pending.map((row) => row.name)).toContain('Boiler service')
  })

  it('shows more than one Split Rule in use in the Month a visitor arrives in', () => {
    const rules = new Set(month(NOW).expenses.map((row) => row.splitRule.kind))
    expect(rules.size).toBeGreaterThanOrEqual(2)
  })

  it('gives every member of the arrival Month a Leftover Balance of their own', () => {
    const balances = leftoverBalancesOf(month(NOW))
    expect(balances).toHaveLength(3)
    for (const balance of balances) expect(balance.balance).not.toBe(0)
  })

  it('divides a proportional Expense differently from an even one', () => {
    const proportional = sharesOf(month(NOW), expense(NOW, 'Rent'))
    const even = sharesOf(month(NOW), expense(NOW, 'Groceries'))

    const ada = memberNamed(household, 'Ada')
    const mira = memberNamed(household, 'Mira')
    const shareOf = (shares: typeof proportional, member: string): number =>
      shares.find((share) => share.member === member)!.amount

    /** The even split says the same of both, to the cent it could not divide; the other does not. */
    expect(Math.abs(shareOf(even, ada) - shareOf(even, mira))).toBeLessThanOrEqual(1)
    expect(shareOf(proportional, ada)).toBeGreaterThan(shareOf(proportional, mira))
  })

  it('holds an Expense that does not divide cleanly among its Participants', () => {
    const groceries = expense(NOW, 'Groceries')
    const shares = sharesOf(month(NOW), groceries)

    expect(shares.reduce((total, share) => total + share.amount, 0)).toBe(groceries.amount)
    expect(new Set(shares.map((share) => share.amount)).size).toBeGreaterThan(1)
  })

  it('shows the Household’s total Spendable Income and three percentages summing to exactly 100', () => {
    const total = householdSpendableIncome(month(NOW))
    const shares = spendableIncomeShares(month(NOW))

    expect(total).toBeGreaterThan(0)
    expect(shares).toHaveLength(3)
    expect(shares!.reduce((sum, share) => sum + share.percent, 0)).toBe(100)
  })

  it('holds a Restricted-Use income source that Spendable Income leaves out', () => {
    const mira = memberNamed(household, 'Mira')
    const restricted = month(NOW).income.filter((row) => row.restrictedUse)

    expect(restricted).not.toHaveLength(0)
    expect(spendableIncome(month(NOW), mira)).toBeLessThan(totalIncome(month(NOW), mira))
  })

  it('changes an Expense’s Split Rule between two Months, so navigating back shows the old one', () => {
    expect(expense(ORIGIN, 'Cleaner').splitRule.kind).toBe('percentage')
    expect(expense(SETTLED, 'Cleaner').splitRule.kind).toBe('even')
    expect(expense(ORIGIN, 'Cleaner').id).toBe(expense(SETTLED, 'Cleaner').id)
  })

  it('carries a recurring Expense across every Month by inheritance', () => {
    const rent = expense(ORIGIN, 'Rent').id
    for (const key of openedMonthKeys(household)) {
      expect(month(key).expenses.map((row) => row.id)).toContain(rent)
    }
  })

  it('leaves a One-Off Expense in its own Month alone', () => {
    expect(expense(SETTLED, 'Flight deposit').oneOff).toBe(true)
    expect(month(NOW).expenses.map((row) => row.name)).not.toContain('Flight deposit')
  })

  it('carries a correction forward into the Month opened ahead', () => {
    expect(expense(PLANNING, 'Rent').amount).toBe(expense(NOW, 'Rent').amount)
    /** What propagation carried is still Unreviewed there: nobody typed it in that Month. */
    expect(expense(PLANNING, 'Rent').reviewed).toBe(false)
  })

  it('leaves the Month opened ahead reporting Drift on the correction not carried forward', () => {
    const drift = driftOf(household, PLANNING, NOW)

    expect(hasDrift(drift)).toBe(true)
    expect(drift.rows.map((row) => row.name)).toContain('Internet')
    expect(drift.rows.map((row) => row.name)).not.toContain('Rent')
  })

  it('reports no Drift on the Month a visitor arrives in, which has stopped being a plan', () => {
    expect(hasDrift(driftOf(household, NOW, NOW))).toBe(false)
  })

  it('has a Savings Goal partway to its target', () => {
    const trip = month(NOW).goals.find((goal) => goal.name === 'Trip to Lisbon')!
    const progress = accumulatedProgress(household, NOW, trip.id)

    expect(progress.target).not.toBeNull()
    expect(progress.accumulated).toBeGreaterThan(progress.startAmount)
    expect(progress.accumulated).toBeLessThan(progress.target!)
    expect(progress.reached).toBe(false)
  })

  it('has a Savings Goal with nothing fixed to reach', () => {
    const emergencyFund = month(NOW).goals.find((goal) => goal.name === 'Emergency fund')!
    const progress = accumulatedProgress(household, NOW, emergencyFund.id)

    expect(progress.target).toBeNull()
    expect(progress.remaining).toBeNull()
    expect(progress.reached).toBe(false)
  })

  it('leaves an Expense uncategorised', () => {
    expect(expense(NOW, 'Subscriptions').category).toBeNull()
  })

  it('points an Expense at a payment method', () => {
    expect(expense(NOW, 'Rent').paymentMethod).not.toBeNull()
  })

  it('holds a composite Expense whose Lines do not divide cleanly, and change over time', () => {
    const subscriptions = expense(NOW, 'Subscriptions')
    expect(subscriptions.lines.length).toBeGreaterThan(1)

    const streamingIn = (key: MonthKey): number =>
      expense(key, 'Subscriptions').lines.find((line) => line.name === 'Streaming')!.amount!

    expect(streamingIn(ORIGIN)).not.toBe(streamingIn(EARLY))
  })

  it('carries a composite’s Lines into the next Month opened, identities intact', () => {
    const before = expense(EARLY, 'Subscriptions')
    const after = expense(SETTLED, 'Subscriptions')

    expect(after.lines.map((line) => line.id)).toEqual(before.lines.map((line) => line.id))
  })

  it('makes a whole composite Pending when one of its Lines is Pending', () => {
    const subscriptions = expense(NOW, 'Subscriptions')

    expect(subscriptions.lines.find((line) => line.name === 'Cloud storage')!.amount).toBeNull()
    expect(subscriptions.amount).toBeNull()
  })

  it('exports and re-imports cleanly, holding every Month and every composite Line', () => {
    const imported = importHousehold(exportHousehold(household))

    expect(openedMonthKeys(imported)).toEqual(openedMonthKeys(household))
    expect(imported.categories).toEqual(household.categories)
    expect(imported.paymentMethods).toEqual(household.paymentMethods)

    const before = household.months[NOW]!.expenses.find((row) => row.name === 'Subscriptions')!
    const after = imported.months[NOW]!.expenses.find((row) => row.name === 'Subscriptions')!
    expect(after.lines).toEqual(before.lines)
    expect(after.amount).toBeNull()
  })

  it('is the same Household every time it is run, whatever the calendar says', () => {
    const again = seedHousehold('2031-02')
    expect(openedMonthKeys(again)).toEqual(['2030-10', '2030-11', '2031-01', '2031-02', '2031-03'])
    expect(again.roster.map((member) => member.name)).toEqual(['Ada', 'Bruno', 'Mira'])
  })
})
