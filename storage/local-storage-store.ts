import type { Household, Month, MonthKey, MonthRow, RowId } from '../domain/index.js'
import { StorageError, type HouseholdStore, type RowKind } from './port.js'

const KEY = 'prometheus.household'

/**
 * The shape the browser's storage is written in today. Every schema change is paid twice
 * — once in SQLite, once here — so the stored document says which shape it is rather than
 * leaving a later version to guess from what it finds.
 */
const SHAPE = 1

/** The stored document, as of the current shape. */
interface StoredDocument {
  shape: number
  household: Household
}

/**
 * Brings whatever is in the browser's storage up to the current shape. Shape 0 is the
 * document Prometheus wrote before it versioned anything: the Household, bare.
 */
function migrate(stored: unknown): Household {
  const document = stored as Partial<StoredDocument>
  const household =
    typeof document.shape === 'number' ? (document.household as Household) : (stored as Household)
  return { ...household, months: inCalendarOrder(household.months) }
}

/**
 * A record is read in the order it happened, so that is the order the Months come back in
 * — whichever order they were opened in, and whichever adapter is answering.
 */
function inCalendarOrder(months: Record<MonthKey, Month>): Record<MonthKey, Month> {
  return Object.fromEntries(Object.entries(months).sort(([one], [other]) => one.localeCompare(other)))
}

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
      return migrate(JSON.parse(stored))
    } catch (cause) {
      throw new StorageError(`The stored Household could not be read: ${String(cause)}`)
    }
  }

  const write = (household: Household): void => {
    try {
      storage.setItem(KEY, JSON.stringify({ shape: SHAPE, household } satisfies StoredDocument))
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
