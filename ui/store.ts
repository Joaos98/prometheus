import { seedHousehold } from '../demo/seed.js'
import { httpStore } from '../storage/http-store.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'
import type { Seed } from './household.js'
import { thisMonth } from './months.js'

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

/**
 * What the demo build puts in front of somebody with nothing stored, and what resetting
 * it puts back: the sample Household, built afresh by driving the domain. Every other
 * build has none, and arrives at the setup screen as it always did.
 *
 * This is the demo's whole difference from the self-hosted app, alongside the store it
 * is built with. Nothing above here is told which build it is running in.
 */
export function chosenSeed(): Seed | undefined {
  return import.meta.env['VITE_DEMO'] === 'true'
    ? () => seedHousehold(thisMonth())
    : undefined
}
