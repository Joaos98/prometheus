import { afterEach, describe, expect, it } from 'vitest'
import { mintId } from './identity.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Absent where `randomUUID` is inherited from `Crypto.prototype` rather than held outright. */
const own = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')

/**
 * A browser outside a secure context — served over plain http from anything but localhost
 * — has no `crypto.randomUUID` at all. That is where a self-hosted Prometheus runs and
 * where the demo may well be published, so it is worth being able to stand in.
 *
 * Shadowed rather than deleted: where the function is inherited, deleting it removes
 * nothing and the fallback would never be reached.
 */
function withoutRandomUUID(): void {
  Object.defineProperty(crypto, 'randomUUID', {
    value: undefined,
    configurable: true,
    writable: true,
  })
  /** Or the two tests below would go on testing the branch they mean to be standing in for. */
  expect(crypto.randomUUID).toBeUndefined()
}

afterEach(() => {
  if (own) Object.defineProperty(crypto, 'randomUUID', own)
  else Reflect.deleteProperty(crypto, 'randomUUID')
})

describe('minting an identity', () => {
  it('is a UUID', () => {
    expect(mintId()).toMatch(UUID)
  })

  it('is a UUID where the browser withholds randomUUID', () => {
    withoutRandomUUID()
    expect(mintId()).toMatch(UUID)
  })

  it('is never the same identity twice, with randomUUID or without it', () => {
    const withIt = Array.from({ length: 500 }, mintId)
    withoutRandomUUID()
    const without = Array.from({ length: 500 }, mintId)

    expect(new Set([...withIt, ...without]).size).toBe(1000)
  })
})
