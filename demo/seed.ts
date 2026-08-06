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
 * a Month in the middle of the record is never opened at all so the trends' broken axis
 * has something real to break on, and a composite Expense carries a Line whose price
 * moves — and once goes Pending — across the Months that follow.
 */
import {
  addCategory,
  addExpenseSnapshot,
  addIncomeSnapshot,
  addLineItem,
  addPaymentMethod,
  addSavingsGoal,
  confirmExpenseSnapshot,
  confirmIncomeSnapshot,
  editExpenseSnapshot,
  editIncomeSnapshot,
  editLineItem,
  itemiseExpense,
  setExpenseOneOff,
  monthAfter,
  monthAt,
  monthBefore,
  openMonth,
  propagateExpenseEdit,
  recordContribution,
  setUpHousehold,
  type CategoryId,
  type Currency,
  type Household,
  type MemberId,
  type Month,
  type MonthKey,
  type MonthRow,
  type PaymentMethodId,
  type RowId,
  type RowKind,
} from '../domain/index.js'

/** The sample Household's currency. Two decimals, so every amount below is in cents. */
const CURRENCY: Currency = { code: 'EUR', symbol: '€', decimals: 2 }

/**
 * The vocabulary the sample Household keeps, minted before any row can point at one. A
 * category is a stored entity now, so the seed sets the list up as a member would rather
 * than writing a name onto a row and hoping something recognises it.
 */
const CATEGORY_NAMES = ['Food', 'Housing', 'Transport', 'Travel', 'Utilities']

/** Payment methods reuse the same idea: named once, then pointed at from an Expense. */
const PAYMENT_METHOD_NAMES = ['Bank transfer', 'Debit card', 'Credit card']

/** The three people sharing the sample Household, by the Roster identities they were given. */
interface Sharers {
  ada: MemberId
  bruno: MemberId
  mira: MemberId
}

/**
 * The six calendar Months the seed's story touches, named for what each of them is
 * doing. `gap` is deliberately never opened — it is the one seeded fact whose only
 * purpose is a chart, exercising the trends' broken axis with a real hole rather than
 * only a unit test's.
 */
interface Months {
  /** Where the record starts: everything entered fresh, so nothing is Unreviewed. */
  origin: MonthKey
  /** A second Month of history, reviewed through without much drama. */
  early: MonthKey
  /** Never opened. The record has a real hole here, not a Month recorded as empty. */
  gap: MonthKey
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
  const settled = monthBefore(now)
  const gap = monthBefore(settled)
  const early = monthBefore(gap)
  const origin = monthBefore(early)
  const record: Months = {
    origin,
    early,
    gap,
    settled,
    arrival: now,
    planning: monthAfter(now),
  }

  let household = setUpHousehold({
    currency: CURRENCY,
    memberNames: ['Ada', 'Bruno', 'Mira'],
    startingMonth: record.origin,
  })

  for (const name of CATEGORY_NAMES) household = addCategory(household, name)
  for (const name of PAYMENT_METHOD_NAMES) household = addPaymentMethod(household, name)

  const sharers: Sharers = {
    ada: memberNamed(household, 'Ada'),
    bruno: memberNamed(household, 'Bruno'),
    mira: memberNamed(household, 'Mira'),
  }

  household = enterTheOrigin(household, record, sharers)
  household = liveThroughEarly(household, record, sharers)
  /** `record.gap` is never opened. Skipping straight to `settled` is the gap itself. */
  household = reviewTheSettledMonth(household, record, sharers)
  household = halfReviewTheArrivalMonth(household, record, sharers)
  return planAhead(household, record)
}

/**
 * The earliest Month, entered by hand as somebody starting out would enter it: three
 * incomes that are visibly not the same, one of them Restricted-Use so that Spendable
 * Income has something to exclude, six Expenses between them using all four Split
 * Rules, a composite Expense built line by line, and two Savings Goals — one with a
 * target and one without.
 */
function enterTheOrigin(household: Household, record: Months, sharers: Sharers): Household {
  const { origin } = record
  const { ada, bruno, mira } = sharers
  const everyone = [ada, bruno, mira]

  household = addIncomeSnapshot(household, origin, {
    name: 'Salary',
    member: ada,
    amount: 320_000,
  }).household
  household = addIncomeSnapshot(household, origin, {
    name: 'Salary',
    member: bruno,
    amount: 210_000,
  }).household
  household = addIncomeSnapshot(household, origin, {
    name: 'Salary',
    member: mira,
    amount: 138_000,
  }).household
  /** Restricted-Use: it is Mira's income, and none of it weighs a proportional Share. */
  household = addIncomeSnapshot(household, origin, {
    name: 'Research grant',
    member: mira,
    amount: 45_000,
    restrictedUse: true,
  }).household

  household = addExpenseSnapshot(household, origin, {
    name: 'Rent',
    category: categoryNamed(household, 'Housing'),
    paymentMethod: paymentMethodNamed(household, 'Bank transfer'),
    amount: 185_000,
    participants: everyone,
    splitRule: { kind: 'proportional' },
  }).household
  /** 640.00 among three comes to 213.33 and a third — the cent goes to the largest remainder. */
  household = addExpenseSnapshot(household, origin, {
    name: 'Groceries',
    category: categoryNamed(household, 'Food'),
    paymentMethod: paymentMethodNamed(household, 'Debit card'),
    amount: 64_000,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, origin, {
    name: 'Electricity',
    category: categoryNamed(household, 'Utilities'),
    amount: 9_655,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, origin, {
    name: 'Internet',
    category: categoryNamed(household, 'Utilities'),
    amount: 4_500,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  household = addExpenseSnapshot(household, origin, {
    name: 'Car insurance',
    category: categoryNamed(household, 'Transport'),
    amount: 12_840,
    participants: [ada, bruno],
    splitRule: { kind: 'fixed', byMember: { [ada]: 8_000, [bruno]: 4_840 } },
  }).household
  household = addExpenseSnapshot(household, origin, {
    name: 'Cleaner',
    category: categoryNamed(household, 'Housing'),
    amount: 9_000,
    participants: everyone,
    splitRule: { kind: 'percentage', byMember: { [ada]: 40, [bruno]: 35, [mira]: 25 } },
  }).household

  /**
   * A composite, and left uncategorised: nobody has sorted the little recurring charges
   * into a category, which is exactly what the Uncategorised heading is for. Built by
   * itemising a typed figure and then adding to it, never by constructing a Line by hand.
   */
  household = addExpenseSnapshot(household, origin, {
    name: 'Subscriptions',
    category: null,
    paymentMethod: paymentMethodNamed(household, 'Credit card'),
    amount: 1_200,
    participants: everyone,
    splitRule: { kind: 'even' },
  }).household
  const subscriptions = rowIdOf(household, origin, 'expenses', 'Subscriptions')
  household = itemiseExpense(household, origin, subscriptions).household
  household = editLineItem(
    household,
    origin,
    subscriptions,
    lineIdOf(household, origin, subscriptions, 'Subscriptions'),
    { name: 'Cloud storage' },
  ).household
  household = addLineItem(household, origin, subscriptions, {
    name: 'Streaming',
    amount: 1_500,
  }).household
  household = addLineItem(household, origin, subscriptions, {
    name: 'Music',
    amount: 999,
  }).household

  household = addSavingsGoal(household, origin, {
    name: 'Trip to Lisbon',
    target: 240_000,
    startAmount: 30_000,
    participants: everyone,
  }).household
  /** No target named: a goal with nothing fixed to reach, saved toward all the same. */
  household = addSavingsGoal(household, origin, {
    name: 'Emergency fund',
    startAmount: 50_000,
    participants: everyone,
  }).household

  const trip = rowIdOf(household, origin, 'goals', 'Trip to Lisbon')
  household = recordContribution(household, origin, trip, ada, 15_000).household
  household = recordContribution(household, origin, trip, bruno, 10_000).household
  household = recordContribution(household, origin, trip, mira, 6_000).household

  const emergencyFund = rowIdOf(household, origin, 'goals', 'Emergency fund')
  return recordContribution(household, origin, emergencyFund, ada, 5_000).household
}

/**
 * A second Month of history, opened and reviewed through without much drama — it exists
 * so the trend charts have more than a single point either side of the gap that follows
 * it, and so the composite's Streaming Line can show its price moving for the first time.
 */
function liveThroughEarly(household: Household, record: Months, sharers: Sharers): Household {
  const { early } = record
  const { ada, bruno, mira } = sharers

  household = openMonth(household, early)

  household = confirmIncomeSnapshot(
    household,
    early,
    incomeOf(household, early, ada, 'Salary'),
  ).household
  household = confirmIncomeSnapshot(
    household,
    early,
    incomeOf(household, early, bruno, 'Salary'),
  ).household
  household = confirmIncomeSnapshot(
    household,
    early,
    incomeOf(household, early, mira, 'Salary'),
  ).household
  household = confirmIncomeSnapshot(
    household,
    early,
    incomeOf(household, early, mira, 'Research grant'),
  ).household

  for (const name of ['Rent', 'Electricity', 'Internet', 'Car insurance', 'Cleaner']) {
    household = confirmExpenseSnapshot(
      household,
      early,
      rowIdOf(household, early, 'expenses', name),
    ).household
  }
  household = editExpenseSnapshot(
    household,
    early,
    rowIdOf(household, early, 'expenses', 'Groceries'),
    { amount: 61_400 },
  ).household

  /** The streaming service's price rose — the first move the trend charts have to show. */
  const subscriptions = rowIdOf(household, early, 'expenses', 'Subscriptions')
  household = editLineItem(
    household,
    early,
    subscriptions,
    lineIdOf(household, early, subscriptions, 'Streaming'),
    { amount: 1_600 },
  ).household
  household = confirmExpenseSnapshot(household, early, subscriptions).household

  const trip = rowIdOf(household, early, 'goals', 'Trip to Lisbon')
  household = recordContribution(household, early, trip, ada, 15_000).household
  household = recordContribution(household, early, trip, bruno, 10_000).household
  household = recordContribution(household, early, trip, mira, 6_000).household

  const emergencyFund = rowIdOf(household, early, 'goals', 'Emergency fund')
  return recordContribution(household, early, emergencyFund, bruno, 4_000).household
}

/**
 * The next Month opened, worked through to the end: every row arrives Unreviewed,
 * some are confirmed as they stand, some are corrected, one is added for this Month alone,
 * and the Cleaner stops being split by percentage and starts being split evenly — which is
 * the whole point of the snapshot model, and is visible by navigating back to the Month
 * before it. Opening it inherits straight from `early`, since `record.gap` in between was
 * never opened at all.
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

  /** The music subscription got cheaper — the trend the other direction. */
  const subscriptions = rowIdOf(household, settled, 'expenses', 'Subscriptions')
  household = editLineItem(
    household,
    settled,
    subscriptions,
    lineIdOf(household, settled, subscriptions, 'Music'),
    { amount: 899 },
  ).household
  household = confirmExpenseSnapshot(household, settled, subscriptions).household

  /** This Month alone: the deposit is paid once, so the next Month does not inherit it. */
  household = addExpenseSnapshot(household, settled, {
    name: 'Flight deposit',
    category: categoryNamed(household, 'Travel'),
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
  household = recordContribution(household, settled, trip, mira, 8_000).household

  const emergencyFund = rowIdOf(household, settled, 'goals', 'Emergency fund')
  return recordContribution(household, settled, emergencyFund, mira, 6_000).household
}

/**
 * The Month a visitor arrives in, left deliberately halfway: a few rows looked at, several
 * still Unreviewed, a bill announced with no figure yet, and now a subscription whose
 * renewal has not billed either — so the review meter has something to count, the
 * Leftover Balance has a term it is honestly missing, and the composite's own Pending
 * Line is exercised end to end rather than only in a unit test.
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
    category: categoryNamed(household, 'Housing'),
    amount: null,
    participants: [ada, bruno, mira],
    splitRule: { kind: 'even' },
  }).household

  /** The cloud storage renewal has not billed yet: the whole composite reads Pending. */
  const subscriptions = rowIdOf(household, arrival, 'expenses', 'Subscriptions')
  household = editLineItem(
    household,
    arrival,
    subscriptions,
    lineIdOf(household, arrival, subscriptions, 'Cloud storage'),
    { amount: null },
  ).household
  /** Left Unreviewed, alongside everything else this half-reviewed Month has not settled. */

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

/**
 * The identity of one of the categories the seed minted, asked for by name. A row holds
 * the id and never the name (ADR-0012), so this is how the seed writes a categorised
 * Expense — and a name the vocabulary has not got throws rather than landing as a
 * reference to nothing, which is the one thing a row's category must never be.
 */
function categoryNamed(household: Household, name: string): CategoryId {
  const category = household.categories.find((candidate) => candidate.name === name)
  if (!category) throw new Error(`The seed expected a category named ${name}`)
  return category.id
}

/** The identity of one of the payment methods the seed minted, asked for by name. */
function paymentMethodNamed(household: Household, name: string): PaymentMethodId {
  const method = household.paymentMethods.find((candidate) => candidate.name === name)
  if (!method) throw new Error(`The seed expected a payment method named ${name}`)
  return method.id
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

/** The identity of a composite Expense's Line, found by the name the seed gave it. */
function lineIdOf(
  household: Household,
  key: MonthKey,
  expenseId: RowId,
  name: string,
): RowId {
  const expense = monthOf(household, key).expenses.find((candidate) => candidate.id === expenseId)
  if (!expense) throw new Error(`The seed expected ${key} to hold Expense ${expenseId}`)
  const line = expense.lines.find((candidate) => candidate.name === name)
  if (!line) throw new Error(`The seed expected ${key}'s ${expense.name} to hold a Line called ${name}`)
  return line.id
}
