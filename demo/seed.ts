/**
 * The demo's sample Household — not fixture rows, but a program that drives the domain
 * the way a member would: set the Household up, open a Month, enter income, add Expenses
 * with mixed Split Rules, open the next Month and review what came across, correct a
 * couple of figures, contribute to a goal, open a Month ahead to plan, and carry one
 * correction forward while leaving another where it was.
 *
 * Written this way it cannot drift. Hand-written rows would mirror the schema and rot
 * quietly as the model moved, failing without crashing because nothing exercises sample
 * data; a seed that goes through the engine breaks loudly the moment a rule changes under
 * it. Which makes it the end-to-end integration test as well as the shop window, and it is
 * run as one.
 *
 * Every figure here is chosen to make a rule visible on the first screen: incomes differ
 * enough that a proportional Share and an even one are plainly not the same number, an
 * Expense divides into thirds that do not come out whole, an Expense changes its Split
 * Rule between two Months so that navigating back shows the snapshot model paying off,
 * and the Month a visitor arrives in is deliberately half-reviewed.
 */
import {
  addExpenseSnapshot,
  addIncomeSnapshot,
  addSavingsGoal,
  confirmExpenseSnapshot,
  confirmIncomeSnapshot,
  editExpenseSnapshot,
  editIncomeSnapshot,
  setExpenseOneOff,
  monthAfter,
  monthAt,
  monthBefore,
  openMonth,
  propagateExpenseEdit,
  recordContribution,
  setUpHousehold,
  type Currency,
  type Household,
  type MemberId,
  type Month,
  type MonthKey,
  type MonthRow,
  type RowId,
  type RowKind,
} from '../domain/index.js'

/** The sample Household's currency. Two decimals, so every amount below is in cents. */
const CURRENCY: Currency = { code: 'EUR', symbol: '€', decimals: 2 }

/** The three people sharing the sample Household, by the Roster identities they were given. */
interface Sharers {
  ada: MemberId
  bruno: MemberId
  mira: MemberId
}

/** The four Months the seed writes, named for what each of them is doing. */
interface Months {
  /** Where the record starts: everything entered fresh, so nothing is Unreviewed. */
  earliest: MonthKey
  /** A finished Month — inherited, reviewed through, corrected where it needed it. */
  settled: MonthKey
  /** The Month a visitor arrives in: half-reviewed, with a bill nobody has the figure for. */
  arrival: MonthKey
  /** Opened ahead to plan, and so the one Month that can report Drift. */
  planning: MonthKey
}

/**
 * The sample Household, as of whichever Month the calendar is on. `now` is passed in
 * rather than read here: the engine will not guess the date and neither will this, and a
 * test that had to be run in a particular month would be a poor integration test.
 */
export function seedHousehold(now: MonthKey): Household {
  const record: Months = {
    earliest: monthBefore(monthBefore(now)),
    settled: monthBefore(now),
    arrival: now,
    planning: monthAfter(now),
  }

  let household = setUpHousehold({
    currency: CURRENCY,
    memberNames: ['Ada', 'Bruno', 'Mira'],
    startingMonth: record.earliest,
  })

  const sharers: Sharers = {
    ada: memberNamed(household, 'Ada'),
    bruno: memberNamed(household, 'Bruno'),
    mira: memberNamed(household, 'Mira'),
  }

  household = enterTheFirstMonth(household, record, sharers)
  household = reviewTheSettledMonth(household, record, sharers)
  household = halfReviewTheArrivalMonth(household, record, sharers)
  return planAhead(household, record)
}

/**
 * The earliest Month, entered by hand as somebody starting out would enter it: three
 * incomes that are visibly not the same, one of them Restricted-Use so that Spendable
 * Income has something to exclude, and six Expenses between them using all four Split
 * Rules.
 */
function enterTheFirstMonth(household: Household, record: Months, sharers: Sharers): Household {
  const { earliest } = record
  const { ada, bruno, mira } = sharers
  const everyone = [ada, bruno, mira]

  household = addIncomeSnapshot(household, earliest, {
    name: 'Salary',
    member: ada,
    amount: 320_000,
  }).household
  household = addIncomeSnapshot(household, earliest, {
    name: 'Salary',
    member: bruno,
    amount: 210_000,
  }).household
  household = addIncomeSnapshot(household, earliest, {
    name: 'Salary',
    member: mira,
    amount: 138_000,
  }).household
  /** Restricted-Use: it is Mira's income, and none of it weighs a proportional Share. */
  household = addIncomeSnapshot(household, earliest, {
    name: 'Research grant',
    member: mira,
    amount: 45_000,
    restrictedUse: true,
  }).household

  household = addExpenseSnapshot(household, earliest, {
    name: 'Rent',
    category: 'Housing',
    amount: 185_000,
    participants: everyone,
    splitRule: { kind: 'proportional' },
  }).household
  /** 640.00 among three comes to 213.33 and a third — the cent goes to the largest remainder. */
  household = addExpenseSnapshot(household, earliest, {
    name: 'Groceries',
    category: 'Food',
    amount: 64_000,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, earliest, {
    name: 'Electricity',
    category: 'Utilities',
    amount: 9_655,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, earliest, {
    name: 'Internet',
    category: 'Utilities',
    amount: 4_500,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, earliest, {
    name: 'Car insurance',
    category: 'Transport',
    amount: 12_840,
    participants: [ada, bruno],
    splitRule: { kind: 'fixed', byMember: { [ada]: 8_000, [bruno]: 4_840 } },
  }).household
  household = addExpenseSnapshot(household, earliest, {
    name: 'Cleaner',
    category: 'Housing',
    amount: 9_000,
    participants: everyone,
    splitRule: { kind: 'percentage', byMember: { [ada]: 40, [bruno]: 35, [mira]: 25 } },
  }).household

  household = addSavingsGoal(household, earliest, {
    name: 'Trip to Lisbon',
    target: 240_000,
    startAmount: 30_000,
    participants: everyone,
  }).household

  const trip = rowIdOf(household, earliest, 'goals', 'Trip to Lisbon')
  household = recordContribution(household, earliest, trip, ada, 15_000).household
  household = recordContribution(household, earliest, trip, bruno, 10_000).household
  return recordContribution(household, earliest, trip, mira, 6_000).household
}

/**
 * The next Month, opened and then worked through to the end: every row arrives Unreviewed,
 * some are confirmed as they stand, some are corrected, one is added for this Month alone,
 * and the Cleaner stops being split by percentage and starts being split evenly — which is
 * the whole point of the snapshot model, and is visible by navigating back to the Month
 * before it.
 */
function reviewTheSettledMonth(household: Household, record: Months, sharers: Sharers): Household {
  const { settled } = record
  const { ada, bruno, mira } = sharers
  const everyone = [ada, bruno, mira]

  household = openMonth(household, settled)

  /** Ada's raise. Every proportional Share in the Month moves with it, untouched. */
  household = editIncomeSnapshot(household, settled, incomeOf(household, settled, ada, 'Salary'), {
    amount: 334_000,
  }).household
  household = confirmIncomeSnapshot(
    household,
    settled,
    incomeOf(household, settled, bruno, 'Salary'),
  ).household
  household = confirmIncomeSnapshot(
    household,
    settled,
    incomeOf(household, settled, mira, 'Salary'),
  ).household
  household = confirmIncomeSnapshot(
    household,
    settled,
    incomeOf(household, settled, mira, 'Research grant'),
  ).household

  household = confirmExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Rent'),
  ).household
  household = editExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Groceries'),
    { amount: 70_215 },
  ).household
  household = editExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Electricity'),
    { amount: 11_240 },
  ).household
  household = confirmExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Internet'),
  ).household
  household = confirmExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Car insurance'),
  ).household
  /** The agreement changed: the cleaner is now shared evenly rather than by percentage. */
  household = editExpenseSnapshot(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Cleaner'),
    { splitRule: { kind: 'even' } },
  ).household

  /** This Month alone: the deposit is paid once, so the next Month does not inherit it. */
  household = addExpenseSnapshot(household, settled, {
    name: 'Flight deposit',
    category: 'Travel',
    amount: 24_000,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = setExpenseOneOff(
    household,
    settled,
    rowIdOf(household, settled, 'expenses', 'Flight deposit'),
    true,
  ).household

  const trip = rowIdOf(household, settled, 'goals', 'Trip to Lisbon')
  household = recordContribution(household, settled, trip, ada, 18_000).household
  household = recordContribution(household, settled, trip, bruno, 12_000).household
  return recordContribution(household, settled, trip, mira, 8_000).household
}

/**
 * The Month a visitor arrives in, left deliberately halfway: a few rows looked at, several
 * still Unreviewed, and a bill announced with no figure yet — so the review meter has
 * something to count and the Leftover Balance has a term it is honestly missing.
 */
function halfReviewTheArrivalMonth(
  household: Household,
  record: Months,
  sharers: Sharers,
): Household {
  const { arrival } = record
  const { ada, bruno, mira } = sharers

  household = openMonth(household, arrival)

  household = confirmIncomeSnapshot(
    household,
    arrival,
    incomeOf(household, arrival, ada, 'Salary'),
  ).household
  household = editIncomeSnapshot(household, arrival, incomeOf(household, arrival, mira, 'Salary'), {
    amount: 142_500,
  }).household
  /** Bruno's salary and Mira's grant are left as they arrived: Unreviewed, on the meter. */

  household = editExpenseSnapshot(
    household,
    arrival,
    rowIdOf(household, arrival, 'expenses', 'Groceries'),
    { amount: 66_580 },
  ).household
  /** Electricity, the Car insurance and the Cleaner are left Unreviewed too. */

  /** Announced, not yet invoiced: Pending is nothing entered at all, which is not zero. */
  household = addExpenseSnapshot(household, arrival, {
    name: 'Boiler service',
    category: 'Housing',
    amount: null,
    participants: [ada, bruno, mira],
    splitRule: { kind: 'even' },
  }).household

  const trip = rowIdOf(household, arrival, 'goals', 'Trip to Lisbon')
  household = recordContribution(household, arrival, trip, ada, 18_000).household
  return recordContribution(household, arrival, trip, bruno, 12_000).household
}

/**
 * The Month after this one, opened early to plan — and then the two things that happen to
 * a Month opened early.
 *
 * The rent goes up, and the correction is carried forward, so the planning Month holds the
 * new figure without anybody going there to type it. The internet price changes too and is
 * not carried forward, so the planning Month keeps the old figure and says so: it reports
 * the difference as Drift, which is the visitor's first sight of a Month that has missed
 * something.
 */
function planAhead(household: Household, record: Months): Household {
  const { arrival, planning } = record

  household = openMonth(household, planning)

  const rent = rowIdOf(household, arrival, 'expenses', 'Rent')
  household = editExpenseSnapshot(household, arrival, rent, { amount: 191_000 }).household
  household = propagateExpenseEdit(household, arrival, rent, { amount: 191_000 }).household

  const internet = rowIdOf(household, arrival, 'expenses', 'Internet')
  return editExpenseSnapshot(household, arrival, internet, { amount: 4_900 }).household
}

function memberNamed(household: Household, name: string): MemberId {
  const member = household.roster.find((candidate) => candidate.name === name)
  if (!member) throw new Error(`The seed expected ${name} on the Roster`)
  return member.id
}

function monthOf(household: Household, key: MonthKey): Month {
  const month = monthAt(household, key)
  if (!month) throw new Error(`The seed expected ${key} to be opened`)
  return month
}

/**
 * The identity of a row the seed has just written, found by the name it wrote it under.
 * The engine mints identities, so this is how the seed asks for the row back — and a row
 * that is not there throws rather than being skipped, which is what makes the seed fail
 * loudly when the model stops producing what it asked for.
 */
function rowIdOf(household: Household, key: MonthKey, kind: RowKind, name: string): RowId {
  const rows: MonthRow[] = monthOf(household, key)[kind]
  const row = rows.find((candidate) => candidate.name === name)
  if (!row) throw new Error(`The seed expected ${key} to hold a ${kind} row called ${name}`)
  return row.id
}

/** An income row is one member's, so its name alone does not say which row is meant. */
function incomeOf(
  household: Household,
  key: MonthKey,
  member: MemberId,
  name: string,
): RowId {
  const row = monthOf(household, key).income.find(
    (candidate) => candidate.member === member && candidate.name === name,
  )
  if (!row) throw new Error(`The seed expected ${key} to hold ${name} for ${member}`)
  return row.id
}
