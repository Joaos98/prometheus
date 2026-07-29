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

export interface IncomeSnapshot {
  id: RowId
}

export interface ExpenseSnapshot {
  id: RowId
}

export interface SavingsGoal {
  id: RowId
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
