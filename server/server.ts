import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { StorageError, type HouseholdStore, type RowKind } from '../storage/port.js'

/**
 * The self-hosted server: the built app, and the Household's rows.
 *
 * It stores what it is given and returns what it stored. It computes no Split Rule, holds
 * no opinion on what a Household may contain, and imports no domain code — the engine runs
 * in the browser in both builds, and a second copy of the rules here would be a second
 * answer waiting to disagree with the first.
 *
 * There is no login, no password, no session and no permission check. A household on its
 * own hardware is not administering itself.
 */
export interface Deployment {
  /** Where the Household's rows are kept. */
  store: HouseholdStore
  /** The built app to serve, if this deployment serves one. */
  root?: string
}

const KINDS: RowKind[] = ['income', 'expenses', 'goals']

export function createServer(deployment: Deployment): Server {
  return createHttpServer((request, response) => {
    answer(deployment, request, response).catch((cause: unknown) => {
      send(response, 500, { error: String(cause) })
    })
  })
}

async function answer(
  deployment: Deployment,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://prometheus').pathname
  if (!path.startsWith('/api/')) return serveApp(deployment.root, path, response)
  try {
    await route(deployment.store, request, response, path.slice('/api'.length))
  } catch (cause) {
    if (cause instanceof StorageError) return send(response, 409, { error: cause.message })
    throw cause
  }
}

/**
 * The port's operations, one path each. The paths exist because HTTP needs them, not
 * because the port is shaped like a web API — every one of them is a member's action.
 */
async function route(
  store: HouseholdStore,
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
): Promise<void> {
  const at = path.split('/').slice(1).map(decodeURIComponent)
  const method = request.method ?? 'GET'

  if (at[0] === 'household' && at.length === 1) {
    if (method === 'GET') {
      return send(response, 200, { household: (await store.loadHousehold()) ?? null })
    }
    if (method === 'POST') {
      await store.createHousehold(await asked(request, 'household'))
      return send(response, 204)
    }
    if (method === 'PUT') {
      await store.replaceHousehold(await asked(request, 'household'))
      return send(response, 204)
    }
  }

  if (at[0] === 'months') {
    if (at.length === 1 && method === 'POST') {
      await store.openMonth(await asked(request, 'month'))
      return send(response, 204)
    }
    const month = at[1]
    if (month && at.length === 2 && method === 'DELETE') {
      await store.discardMonth(month)
      return send(response, 204)
    }
    const kind = at[3]
    const row = at[4]
    if (month && at[2] === 'rows' && row && at.length === 5 && isKind(kind)) {
      if (method === 'PUT') {
        await store.writeRow(month, kind, await asked(request, 'row'))
        return send(response, 204)
      }
      if (method === 'DELETE') {
        await store.deleteRow(month, kind, row)
        return send(response, 204)
      }
    }
  }

  send(response, 404, { error: `Prometheus has nothing at ${path}` })
}

function isKind(kind: string | undefined): kind is RowKind {
  return KINDS.includes(kind as RowKind)
}

/** What the client sent, under the one name this operation expects. */
async function asked<T>(request: IncomingMessage, name: string): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
  } catch (cause) {
    throw new StorageError(`Prometheus could not read what was sent: ${String(cause)}`)
  }
  if (!body || !(name in body)) throw new StorageError(`What was sent carried no ${name}`)
  return body[name] as T
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/**
 * The built app. Anything the build did not produce is answered with the app itself, so
 * that a Month's address typed straight into the bar opens Prometheus rather than a 404.
 */
async function serveApp(root: string | undefined, path: string, response: ServerResponse): Promise<void> {
  if (!root) return send(response, 404, { error: 'This deployment serves no app' })
  const built = resolve(root)
  const file = withinRoot(built, path)
  if (file) {
    const body = await read(file)
    if (body) return sendFile(response, file, body)
  }
  const app = await read(join(built, 'index.html'))
  if (!app) return send(response, 404, { error: 'The app has not been built' })
  sendFile(response, 'index.html', app)
}

/** Keeps a request for `../../etc/passwd` inside the directory the build produced. */
function withinRoot(root: string, path: string): string | undefined {
  const file = normalize(join(root, decodeURIComponent(path)))
  return file === root || file.startsWith(root + sep) ? file : undefined
}

async function read(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file)
  } catch {
    return undefined
  }
}

function sendFile(response: ServerResponse, file: string, body: Buffer): void {
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  response.end(body)
}

function send(response: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    response.writeHead(status)
    return response.end()
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}
