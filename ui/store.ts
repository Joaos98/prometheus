import { httpStore } from '../storage/http-store.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'

/**
 * Which data layer this build was made with — the only thing the two builds differ in.
 * The self-hosted build talks to its own server; everything else, the demo included,
 * keeps the Household in the browser and needs nothing running behind it.
 */
export function chosenStore(): HouseholdStore {
  return import.meta.env['VITE_STORAGE'] === 'server'
    ? httpStore('/api')
    : localStorageStore(window.localStorage)
}
