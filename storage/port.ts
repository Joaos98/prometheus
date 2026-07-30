import type { Household, Month, MonthKey, MonthRow, RowId } from '../domain/index.js'

/** Raised when storage cannot honour an operation. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

/** Which of a Month's lists a row belongs to. */
export type RowKind = 'income' | 'expenses' | 'goals'

/**
 * How Prometheus stores a Household.
 *
 * The port speaks in the operations a member performs — load the Household, open a
 * Month, write a row — rather than in requests and responses, so that an adapter is
 * free to be a table, a file or a browser's storage rather than a fetch shim faking
 * HTTP. Writes are row-scoped so that two members editing different rows never
 * collide; the same row twice is last-write-wins.
 */
export interface HouseholdStore {
  /** The stored Household, or nothing if this deployment has not been set up. */
  loadHousehold(): Promise<Household | undefined>

  /** Stores a freshly set-up Household. Refused if one is already stored. */
  createHousehold(household: Household): Promise<void>

  /** Records a Month that has been opened, with the rows it opened holding. */
  openMonth(month: Month): Promise<void>

  /**
   * Removes a Month and every row of it, returning it to unopened. The one destructive
   * operation the port carries, and the only one that is not row-scoped — an unopened
   * Month is absent rather than empty, so it cannot be said one row at a time.
   */
  discardMonth(month: MonthKey): Promise<void>

  /** Writes one row of one Month, leaving every other row alone. */
  writeRow(month: MonthKey, kind: RowKind, row: MonthRow): Promise<void>

  /** Removes one row of one Month. */
  deleteRow(month: MonthKey, kind: RowKind, row: RowId): Promise<void>

  /** Replaces the whole Household at once, as an import does. */
  replaceHousehold(household: Household): Promise<void>
}
