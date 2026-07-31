import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { request, type Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { httpStore } from '../storage/http-store.js'
import { describePort } from '../storage/port-contract.js'
import { sqliteStore } from '../storage/sqlite-store.js'
import { createServer, type Deployment } from './server.js'

const here = dirname(fileURLToPath(import.meta.url))
const repository = join(here, '..')

/** A server on a port nobody chose, which is the only way several may run at once. */
async function running(deployment: Deployment): Promise<{ base: string; stop: () => Promise<void> }> {
  const server = createServer(deployment)
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const { port } = server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}`, stop: () => stopped(server) }
}

/** A build to serve, with something next to it that a member must never be handed. */
function builtApp(): { root: string; remove: () => void } {
  const directory = mkdtempSync(join(tmpdir(), 'prometheus-app-'))
  const root = join(directory, 'dist')
  mkdirSync(join(root, 'assets'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<!doctype html><div id="app"></div>')
  writeFileSync(join(root, 'assets', 'app.js'), 'export const app = 1')
  writeFileSync(join(directory, 'secret.txt'), 'not for the network')
  return { root, remove: () => rmSync(directory, { recursive: true, force: true }) }
}

/** A request sent exactly as written, which `fetch` will not do. */
function asked(port: number, path: string): Promise<string> {
  return new Promise((answered, failed) => {
    request({ host: '127.0.0.1', port, path }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => (body += chunk))
      response.on('end', () => answered(body))
    })
      .on('error', failed)
      .end()
  })
}

function stopped(server: Server): Promise<void> {
  return new Promise((done, failed) => {
    server.closeAllConnections()
    server.close((cause) => (cause ? failed(cause) : done()))
  })
}

describePort('the self-hosted server, over HTTP', async () => {
  const db = new Database(':memory:')
  const { base, stop } = await running({ store: sqliteStore(db) })
  return {
    client: () => httpStore(`${base}/api`),
    close: async () => {
      await stop()
      db.close()
    },
  }
})

describe('the self-hosted server', () => {
  it('knows nothing of the domain — it imports none of it', async () => {
    const sources = [
      ...(await readdir(join(repository, 'server'))).map((file) => join('server', file)),
      join('storage', 'sqlite-store.ts'),
      join('storage', 'port.ts'),
    ].filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))

    for (const file of sources) {
      const source = await readFile(join(repository, file), 'utf8')
      for (const line of source.split('\n')) {
        if (!line.includes("from '../domain") && !line.includes("from './domain")) continue
        expect(line.trimStart(), `${file} imports domain code at runtime`).toMatch(/^import type /)
      }
    }
  })

  it('turns away a member asking for a Household nobody has set up', async () => {
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db) })

    const answer = await fetch(`${base}/api/household`)

    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ household: null })
    await stop()
    db.close()
  })

  it('serves the app to anyone who asks, with no login in the way', async () => {
    const build = builtApp()
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db), root: build.root })

    const app = await fetch(`${base}/`)
    const script = await fetch(`${base}/assets/app.js`)

    expect(app.status).toBe(200)
    expect(app.headers.get('www-authenticate')).toBeNull()
    expect(app.headers.get('content-type')).toContain('text/html')
    expect(await app.text()).toContain('<div id="app">')
    expect(script.headers.get('content-type')).toContain('text/javascript')
    await stop()
    db.close()
    build.remove()
  })

  it('answers an address inside the app with the app itself', async () => {
    const build = builtApp()
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db), root: build.root })

    const answer = await fetch(`${base}/2026-07`)

    expect(answer.status).toBe(200)
    expect(await answer.text()).toContain('<div id="app">')
    await stop()
    db.close()
    build.remove()
  })

  it('will not serve a file from outside the build', async () => {
    const build = builtApp()
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db), root: build.root })
    const port = Number(new URL(base).port)

    // Asked raw, and with the separator encoded, so that neither `fetch` nor the URL
    // parser tidies the climb away before the server has had to refuse it itself.
    for (const path of ['/../secret.txt', '/%2e%2e%2fsecret.txt', '/assets/..%2f..%2fsecret.txt']) {
      expect(await asked(port, path), path).not.toContain('not for the network')
    }

    await stop()
    db.close()
    build.remove()
  })

  it('says it has nothing at a path the port does not name', async () => {
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db) })

    const answer = await fetch(`${base}/api/nonsense`)

    expect(answer.status).toBe(404)
    await stop()
    db.close()
  })

  it('refuses in the port’s own words, so a member reads the same sentence either way', async () => {
    const db = new Database(':memory:')
    const { base, stop } = await running({ store: sqliteStore(db) })
    const store = httpStore(`${base}/api`)

    await expect(store.discardMonth('2026-08')).rejects.toThrow('No Household is stored yet')

    await stop()
    db.close()
  })
})
