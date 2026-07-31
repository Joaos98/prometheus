import type { Database } from 'better-sqlite3'
import type { Household, Member, Month, MonthKey, MonthRow, RowId } from '../domain/index.js'
import { StorageError, type HouseholdStore, type RowKind } from './port.js'

/**
 * The schemas this database has been through, in order. The one at the end is the one
 * the adapter reads; the ones before it exist so that a database written by an earlier
 * Prometheus is still readable by this one. A database records how far it has come in
 * `user_version`, so a fresh one walks the whole list and an existing one walks the rest.
 */
const migrations: ((db: Database) => void)[] = [
  /**
   * 1 — the Household as one document, which is what the browser's storage holds and
   * what SQLite started as before writes had to be row-scoped.
   */
  (db) => {
    db.exec(`create table household (
      id integer primary key check (id = 1),
      document text not null
    )`)
  },

  /**
   * 2 — the Household taken apart: currency and Roster, the Months, and the Months' rows
   * each addressable on their own, so that writing one row touches one row.
   */
  (db) => {
    db.exec(`
      create table household_next (
        id integer primary key check (id = 1),
        currency text not null,
        roster text not null
      );
      create table months (
        key text primary key,
        members text not null
      );
      create table month_rows (
        month text not null references months(key) on delete cascade,
        kind text not null,
        id text not null,
        position integer not null,
        data text not null,
        primary key (month, kind, id)
      );
    `)
    const stored = db.prepare('select document from household where id = 1').get() as
      | { document: string }
      | undefined
    if (stored) writeDocument(db, JSON.parse(stored.document) as Household, 'household_next')
    db.exec('drop table household; alter table household_next rename to household')
  },
]

const KINDS: RowKind[] = ['income', 'expenses', 'goals']

/**
 * Keeps the Household in SQLite, which is the data layer of the self-hosted build. It
 * knows the shape of a Household and nothing else about it: no rule is computed here and
 * no invariant is enforced, because the engine that owns them runs in the browser.
 */
export function sqliteStore(db: Database): HouseholdStore {
  migrate(db)

  const readHousehold = (): Household | undefined => {
    const stored = db.prepare('select currency, roster from household where id = 1').get() as
      | { currency: string; roster: string }
      | undefined
    if (!stored) return undefined
    return {
      currency: JSON.parse(stored.currency) as Household['currency'],
      roster: JSON.parse(stored.roster) as Member[],
      months: readMonths(db),
    }
  }

  const requireHousehold = (): void => {
    const stored = db.prepare('select 1 from household where id = 1').get()
    if (!stored) throw new StorageError('No Household is stored yet')
  }

  const requireMonth = (key: MonthKey): void => {
    requireHousehold()
    const stored = db.prepare('select 1 from months where key = ?').get(key)
    if (!stored) throw new StorageError(`${key} has not been opened`)
  }

  const putMonth = db.transaction((month: Month) => {
    db.prepare('insert into months (key, members) values (?, ?) on conflict (key) do update set members = excluded.members')
      .run(month.key, serialise(month.members))
    db.prepare('delete from month_rows where month = ?').run(month.key)
    for (const kind of KINDS) {
      month[kind].forEach((row: MonthRow, position: number) => {
        db.prepare('insert into month_rows (month, kind, id, position, data) values (?, ?, ?, ?, ?)')
          .run(month.key, kind, row.id, position, serialise(row))
      })
    }
  })

  const putHousehold = db.transaction((household: Household) => {
    db.exec('delete from month_rows; delete from months; delete from household')
    writeDocument(db, household, 'household')
  })

  return {
    async loadHousehold(): Promise<Household | undefined> {
      return readHousehold()
    },

    async createHousehold(household: Household): Promise<void> {
      if (db.prepare('select 1 from household where id = 1').get()) {
        throw new StorageError('A Household is already stored here')
      }
      reporting(() => putHousehold(household))
    },

    async openMonth(month: Month): Promise<void> {
      requireHousehold()
      reporting(() => putMonth(month))
    },

    async discardMonth(key: MonthKey): Promise<void> {
      requireMonth(key)
      db.prepare('delete from months where key = ?').run(key)
    },

    async writeRow(key: MonthKey, kind: RowKind, row: MonthRow): Promise<void> {
      requireMonth(key)
      reporting(() => {
        const data = serialise(row)
        const written = db
          .prepare('update month_rows set data = ? where month = ? and kind = ? and id = ?')
          .run(data, key, kind, row.id)
        if (written.changes === 0) {
          db.prepare(
            `insert into month_rows (month, kind, id, position, data)
             values (?, ?, ?, (select coalesce(max(position), -1) + 1 from month_rows where month = ? and kind = ?), ?)`,
          ).run(key, kind, row.id, key, kind, data)
        }
      })
    },

    async deleteRow(key: MonthKey, kind: RowKind, row: RowId): Promise<void> {
      requireMonth(key)
      db.prepare('delete from month_rows where month = ? and kind = ? and id = ?').run(key, kind, row)
    },

    async replaceHousehold(household: Household): Promise<void> {
      reporting(() => putHousehold(household))
    },
  }
}

/** Brings a database up to the current schema, leaving whatever it already held readable. */
function migrate(db: Database): void {
  db.pragma('foreign_keys = ON')
  const at = db.pragma('user_version', { simple: true }) as number
  for (let shape = at; shape < migrations.length; shape += 1) {
    db.transaction(() => {
      migrations[shape]!(db)
      db.pragma(`user_version = ${shape + 1}`)
    })()
  }
}

function readMonths(db: Database): Record<MonthKey, Month> {
  const months: Record<MonthKey, Month> = {}
  const stored = db.prepare('select key, members from months order by key').all() as {
    key: string
    members: string
  }[]
  for (const row of stored) {
    months[row.key] = {
      key: row.key,
      members: JSON.parse(row.members) as string[],
      income: [],
      expenses: [],
      goals: [],
    }
  }
  const rows = db
    .prepare('select month, kind, data from month_rows order by month, kind, position')
    .all() as { month: string; kind: RowKind; data: string }[]
  for (const row of rows) {
    months[row.month]?.[row.kind].push(JSON.parse(row.data) as never)
  }
  return months
}

/** Writes a whole Household into an empty set of tables, `household` named by the caller. */
function writeDocument(db: Database, household: Household, table: string): void {
  db.prepare(`insert into ${table} (id, currency, roster) values (1, ?, ?)`).run(
    serialise(household.currency),
    serialise(household.roster),
  )
  for (const month of Object.values(household.months)) {
    db.prepare('insert into months (key, members) values (?, ?)').run(
      month.key,
      serialise(month.members),
    )
    for (const kind of KINDS) {
      month[kind].forEach((row: MonthRow, position: number) => {
        db.prepare('insert into month_rows (month, kind, id, position, data) values (?, ?, ?, ?, ?)')
          .run(month.key, kind, row.id, position, serialise(row))
      })
    }
  }
}

function serialise(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Says what went wrong in the port's own terms. A write that cannot be serialised throws
 * partway through its transaction, which SQLite rolls back — so the Household that was
 * there is still there, and the member is told rather than left to find out.
 */
function reporting(write: () => void): void {
  try {
    write()
  } catch (cause) {
    if (cause instanceof StorageError) throw cause
    throw new StorageError(`The Household could not be stored: ${String(cause)}`)
  }
}
