import { ref, shallowRef } from 'vue'
import {
  openedMonthKeys,
  relabelCurrency,
  setUpHousehold,
  type Currency,
  type Household,
  type MonthKey,
  type Setup,
} from '../domain/index.js'
import { localStorageStore } from '../storage/local-storage-store.js'
import type { HouseholdStore } from '../storage/port.js'

/**
 * The Household the app is showing, and the one Month it is looking at. The engine
 * computes; this only holds what it returned and hands writes to the storage port.
 */
const store: HouseholdStore = localStorageStore(window.localStorage)

const household = shallowRef<Household | undefined>(undefined)
const viewing = ref<MonthKey | undefined>(undefined)
const loading = ref(true)
const failure = ref<string | undefined>(undefined)

async function load(): Promise<void> {
  loading.value = true
  failure.value = undefined
  try {
    const loaded = await store.loadHousehold()
    household.value = loaded
    viewing.value = loaded ? openedMonthKeys(loaded).at(-1) : undefined
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function setUp(setup: Setup): Promise<void> {
  const created = setUpHousehold(setup)
  await store.createHousehold(created)
  household.value = created
  viewing.value = setup.startingMonth
}

/**
 * Renames the currency. No amount is converted, and the engine refuses a currency of
 * different decimal precision before any of this reaches storage.
 */
async function relabel(currency: Currency): Promise<void> {
  if (!household.value) return
  const relabelled = relabelCurrency(household.value, currency)
  await store.replaceHousehold(relabelled)
  household.value = relabelled
}

export function useHousehold() {
  return { household, viewing, loading, failure, load, setUp, relabel }
}
