import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { sqliteStore } from '../storage/sqlite-store.js'
import { createServer } from './server.js'

/**
 * Prometheus, self-hosted: one process, one SQLite file, one Household. The file is the
 * whole of the deployment's state, so putting it on a volume is the whole of the backup
 * story — and exporting the Household is the other half, for people who would rather not
 * think about volumes at all.
 */
const database = process.env['PROMETHEUS_DATABASE'] ?? 'data/prometheus.db'
const port = Number(process.env['PORT'] ?? 8080)
const root = process.env['PROMETHEUS_APP'] ?? 'dist'

mkdirSync(dirname(database), { recursive: true })
const db = new Database(database)
db.pragma('journal_mode = WAL')

const server = createServer({ store: sqliteStore(db), root })
server.listen(port, () => {
  console.log(`Prometheus is at http://localhost:${port}, keeping the Household in ${database}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close()
      process.exit(0)
    })
  })
}
