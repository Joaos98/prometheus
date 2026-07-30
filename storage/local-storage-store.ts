import type { Household, Month, MonthKey, MonthRow, RowId } from '../domain/index.js'
import { StorageError, type HouseholdStore, type RowKind } from './port.js'

const KEY = 'prometheus.household'

/**
 * Keeps the Household in the browser's own storage. This is the whole data layer of
 * the demo build, and the reason returning to Prometheus shows the same Household.
 *
 * The Household is small enough to be held as one document, so a row-scoped write is
 * read, amend and write back — the port's contract, honoured without a query layer.
 */
export function localStorageStore(storage: Storage): HouseholdStore {
  const read = (): Household | undefined => {
    const stored = storage.getItem(KEY)
    if (stored === null) return undefined
    try {
      return JSON.parse(stored) as Household
    } catch (cause) {
      throw new StorageError(`The stored Household could not be read: ${String(cause)}`)
    }
  }

  const write = (household: Household): void => {
    try {
      storage.setItem(KEY, JSON.stringify(household))
    } catch (cause) {
      throw new StorageError(`The Household could not be stored: ${String(cause)}`)
    }
  }

  const readOrFail = (): Household => {
    const household = read()
    if (!household) throw new StorageError('No Household is stored yet')
    return household
  }

  const monthOrFail = (household: Household, key: MonthKey): Month => {
    const month = household.months[key]
    if (!month) throw new StorageError(`${key} has not been opened`)
    return month
  }

  return {
    async loadHousehold(): Promise<Household | undefined> {
      return read()
    },

    async createHousehold(household: Household): Promise<void> {
      if (read()) throw new StorageError('A Household is already stored here')
      write(household)
    },

    async openMonth(month: Month): Promise<void> {
      const household = readOrFail()
      write({ ...household, months: { ...household.months, [month.key]: month } })
    },

    async discardMonth(key: MonthKey): Promise<void> {
      const household = readOrFail()
      monthOrFail(household, key)
      const { [key]: discarded, ...kept } = household.months
      write({ ...household, months: kept })
    },

    async writeRow(key: MonthKey, kind: RowKind, row: MonthRow): Promise<void> {
      const household = readOrFail()
      const month = monthOrFail(household, key)
      const rows: MonthRow[] = month[kind]
      const at = rows.findIndex((existing) => existing.id === row.id)
      const written = at === -1 ? [...rows, row] : rows.map((existing, i) => (i === at ? row : existing))
      write(withMonth(household, { ...month, [kind]: written }))
    },

    async deleteRow(key: MonthKey, kind: RowKind, row: RowId): Promise<void> {
      const household = readOrFail()
      const month = monthOrFail(household, key)
      const rows: MonthRow[] = month[kind]
      write(withMonth(household, { ...month, [kind]: rows.filter((existing) => existing.id !== row) }))
    },

    async replaceHousehold(household: Household): Promise<void> {
      write(household)
    },
  }
}

function withMonth(household: Household, month: Month): Household {
  return { ...household, months: { ...household.months, [month.key]: month } }
}
