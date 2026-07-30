/** A member's identity, stable for as long as the Household exists. */
export type MemberId = string

/** A row's stable identity, carried across the Months a row is inherited into. */
export type RowId = string

/** A Month, identified by year and month: `2026-07`. */
export type MonthKey = string

/** An amount, always an integer number of minor units of the Household's currency. */
export type Minor = number

/**
 * The one currency every amount in the Household is in. `decimals` is its minor-unit
 * precision: amounts are integers of 10^-decimals. It may be relabelled but never
 * exchanged for a currency of different precision, which would change what stored
 * amounts mean.
 */
export interface Currency {
  code: string
  symbol: string
  decimals: number
}

/** A person in the Household. Members live on the Roster and are never deleted. */
export interface Member {
  id: MemberId
  name: string
  active: boolean
}

/**
 * One named income source for one member in one Month. There is no standing record of
 * what anyone earns — income exists only as these rows. `amount` of `null` is Pending:
 * no amount entered at all, which is not the same as an amount of zero.
 *
 * `reviewed` is Unreviewed's opposite: false the moment a row arrives by inheritance,
 * cleared to true by an edit or by an explicit confirmation. A row recorded fresh in
 * this Month starts true — there is nothing copied for a member to have missed.
 *
 * `oneOff` marks a row as belonging to this Month alone: opening the next Month does
 * not inherit it. The flag itself is never carried anywhere — a row that does arrive by
 * inheritance always arrives with it false.
 */
export interface IncomeSnapshot {
  id: RowId
  name: string
  member: MemberId
  amount: Minor | null
  restrictedUse: boolean
  reviewed: boolean
  oneOff: boolean
}

/**
 * How an Expense divides among its Participants, chosen per Month on the Snapshot.
 *
 * `proportional` deliberately stores no weights: it reads the Month's Spendable Income
 * when Shares are computed, so correcting an income figure updates every proportional
 * split without anyone touching an Expense. `percentage` values must total exactly 100
 * and `fixed` values exactly the Expense amount — neither is storable otherwise.
 */
export type SplitRule =
  | { kind: 'even' }
  | { kind: 'proportional' }
  | { kind: 'percentage'; byMember: Record<MemberId, number> }
  | { kind: 'fixed'; byMember: Record<MemberId, Minor> }

/**
 * One Expense in one Month: what it is called, what it cost, who it divides among and
 * how. The Expense itself has no existence outside these rows — `id` is the stable
 * identity that carries the same cost from one Month to the next, minted when the
 * Expense first appears. `amount` of `null` is Pending: nothing entered at all.
 */
export interface ExpenseSnapshot {
  id: RowId
  name: string
  category: string
  amount: Minor | null
  participants: MemberId[]
  splitRule: SplitRule
  reviewed: boolean
  oneOff: boolean
}

/**
 * One Savings Goal in one Month: what it is called, what it is saving toward, what it
 * had already reached before Prometheus, and who is saving for it. `id` is the stable
 * identity that carries the same goal from Month to Month, which is what lets
 * Accumulated Progress read Contributions across the record.
 *
 * `target` of `null` is a goal with nothing fixed to reach. `startAmount` is the Month's
 * own baseline, inherited unchanged, so it never absorbs what has since been contributed.
 * `contributions` holds only the Participants who have entered one — an absent member has
 * put in nothing this Month, and nothing here is ever divided by a rule.
 */
export interface SavingsGoal {
  id: RowId
  name: string
  target: Minor | null
  startAmount: Minor
  participants: MemberId[]
  contributions: Record<MemberId, Minor>
  reviewed: boolean
  oneOff: boolean
}

/** Any row a Month holds. */
export type MonthRow = IncomeSnapshot | ExpenseSnapshot | SavingsGoal

/**
 * A Month that has been opened. It owns its own list of members and its own rows, so
 * it keeps saying what it said whatever happens to the Roster or to any other Month.
 */
export interface Month {
  key: MonthKey
  members: MemberId[]
  income: IncomeSnapshot[]
  expenses: ExpenseSnapshot[]
  goals: SavingsGoal[]
}

/**
 * Everything the Household holds. A Month that has not been opened is absent from
 * `months` — which is a different thing from an opened Month holding no rows.
 */
export interface Household {
  currency: Currency
  roster: Member[]
  months: Record<MonthKey, Month>
}
