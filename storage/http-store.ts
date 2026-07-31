import type { Household, Month, MonthKey, MonthRow, RowId } from '../domain/index.js'
import { StorageError, type HouseholdStore, type RowKind } from './port.js'

/**
 * Talks to the self-hosted server, which stores rows and knows nothing else. The port is
 * expressed in what a member does, not in HTTP, so this is the only place in Prometheus
 * where a request exists at all — the engine above it never learns there is a server.
 *
 * The server refuses in the port's own terms and this hands the refusal on unchanged, so
 * a member reads the same sentence whichever build they are on.
 */
export function httpStore(base: string, send: typeof fetch = fetch): HouseholdStore {
  const at = (path: string): string => `${base.replace(/\/$/, '')}${path}`

  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const request: RequestInit = { method }
    if (body !== undefined) {
      request.headers = { 'content-type': 'application/json' }
      request.body = serialise(body)
    }
    let response: Response
    try {
      response = await send(at(path), request)
    } catch (cause) {
      throw new StorageError(`Prometheus could not be reached: ${String(cause)}`)
    }
    const answer = response.status === 204 ? undefined : await readJson(response)
    if (!response.ok) throw new StorageError(refusalIn(answer, response))
    return answer
  }

  return {
    async loadHousehold(): Promise<Household | undefined> {
      const answer = (await call('GET', '/household')) as { household: Household | null }
      return answer.household ?? undefined
    },

    async createHousehold(household: Household): Promise<void> {
      await call('POST', '/household', { household })
    },

    async openMonth(month: Month): Promise<void> {
      await call('POST', '/months', { month })
    },

    async discardMonth(month: MonthKey): Promise<void> {
      await call('DELETE', `/months/${encodeURIComponent(month)}`)
    },

    async writeRow(month: MonthKey, kind: RowKind, row: MonthRow): Promise<void> {
      await call('PUT', rowPath(month, kind, row.id), { row })
    },

    async deleteRow(month: MonthKey, kind: RowKind, row: RowId): Promise<void> {
      await call('DELETE', rowPath(month, kind, row))
    },

    async replaceHousehold(household: Household): Promise<void> {
      await call('PUT', '/household', { household })
    },
  }
}

function rowPath(month: MonthKey, kind: RowKind, row: RowId): string {
  return `/months/${encodeURIComponent(month)}/rows/${kind}/${encodeURIComponent(row)}`
}

/**
 * A Household that cannot be written down never leaves the browser, so nothing on the
 * server has changed and the member is told the same way any other refusal is told.
 */
function serialise(body: unknown): string {
  try {
    return JSON.stringify(body)
  } catch (cause) {
    throw new StorageError(`The Household could not be stored: ${String(cause)}`)
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function refusalIn(answer: unknown, response: Response): string {
  const said = (answer as { error?: unknown } | undefined)?.error
  return typeof said === 'string' ? said : `Prometheus answered ${response.status}`
}
