import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setUpHousehold, type ExpenseSnapshot, type Household } from '../domain/index.js'
import { describePort } from './port-contract.js'
import { sqliteStore } from './sqlite-store.js'

const household = (): Household =>
  setUpHousehold({
    currency: { code: 'EUR', symbol: '€', decimals: 2 },
    memberNames: ['Ana', 'Bruno'],
    startingMonth: '2026-07',
  })

const rent = (): ExpenseSnapshot => ({
  id: 'rent',
  name: 'Rent',
  category: 'Home',
  amount: 120000,
  participants: ['ana', 'bruno'],
  splitRule: { kind: 'even' },
  reviewed: true,
  oneOff: false,
})

/** A file the test can close and reopen, which is the only way to ask whether it persisted. */
function temporaryFile(): { path: string; remove: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'prometheus-'))
  return {
    path: join(directory, 'household.db'),
    remove: () => rmSync(directory, { recursive: true, force: true }),
  }
}

describePort('SQLite', () => {
  const db = new Database(':memory:')
  return { client: () => sqliteStore(db), close: () => void db.close() }
})

describe('the SQLite adapter', () => {
  it('still holds the Household after the process that wrote it has gone', async () => {
    const file = temporaryFile()
    try {
      const first = new Database(file.path)
      const created = household()
      await sqliteStore(first).createHousehold(created)
      await sqliteStore(first).writeRow('2026-07', 'expenses', rent())
      first.close()

      const second = new Database(file.path)
      const loaded = await sqliteStore(second).loadHousehold()
      second.close()

      expect(loaded!.roster).toEqual(created.roster)
      expect(loaded!.months['2026-07']!.expenses).toEqual([rent()])
    } finally {
      file.remove()
    }
  })

  it('reads a database written before the Months had rows of their own', async () => {
    const db = new Database(':memory:')
    const created = household()
    created.months['2026-07']!.expenses = [rent()]
    db.exec('create table household (id integer primary key check (id = 1), document text not null)')
    db.prepare('insert into household (id, document) values (1, ?)').run(JSON.stringify(created))
    db.pragma('user_version = 1')

    const loaded = await sqliteStore(db).loadHousehold()

    expect(loaded).toEqual(created)
    db.close()
  })

  it('writes a row into a database it has just migrated', async () => {
    const db = new Database(':memory:')
    db.exec('create table household (id integer primary key check (id = 1), document text not null)')
    db.prepare('insert into household (id, document) values (1, ?)').run(JSON.stringify(household()))
    db.pragma('user_version = 1')
    const store = sqliteStore(db)

    await store.writeRow('2026-07', 'expenses', rent())

    expect((await store.loadHousehold())!.months['2026-07']!.expenses).toEqual([rent()])
    db.close()
  })

  it('migrates once, however many times it is opened', async () => {
    const db = new Database(':memory:')
    sqliteStore(db)
    const store = sqliteStore(db)

    await store.createHousehold(household())

    expect(db.pragma('user_version', { simple: true })).toBe(2)
    expect(await sqliteStore(db).loadHousehold()).toBeDefined()
    db.close()
  })
})
