import { ref, watch } from 'vue'
import type { MemberId } from '../domain/index.js'

const VIEWER_KEY = 'prometheus.viewer'
const LEFTOVER_DISPLAY_KEY = 'prometheus.leftover-display'

/** Which figure the Leftover Balance card leads with. */
export type LeftoverDisplay = 'spendable' | 'total'

/**
 * The Viewer this device has picked, or nothing if it has not picked one. Read straight
 * off the device's own storage — never the Household's, and never sent to a store.
 */
export function readViewer(storage: Storage): MemberId | undefined {
  return storage.getItem(VIEWER_KEY) ?? undefined
}

export function writeViewer(storage: Storage, member: MemberId | undefined): void {
  if (member) storage.setItem(VIEWER_KEY, member)
  else storage.removeItem(VIEWER_KEY)
}

/** Defaults to Spendable Income, the Leftover Balance's own default basis. */
export function readLeftoverDisplay(storage: Storage): LeftoverDisplay {
  return storage.getItem(LEFTOVER_DISPLAY_KEY) === 'total' ? 'total' : 'spendable'
}

export function writeLeftoverDisplay(storage: Storage, display: LeftoverDisplay): void {
  storage.setItem(LEFTOVER_DISPLAY_KEY, display)
}

/**
 * The Viewer and the Leftover Balance display choice: two comforts for a shared machine,
 * held on this device alone. Read once at start-up and written straight back on every
 * change — there is no queue and no store, because neither is Household data.
 */
export function devicePreferencesOver(storage: Storage) {
  const viewer = ref<MemberId | undefined>(readViewer(storage))
  const leftoverDisplay = ref<LeftoverDisplay>(readLeftoverDisplay(storage))

  watch(viewer, (member) => writeViewer(storage, member))
  watch(leftoverDisplay, (display) => writeLeftoverDisplay(storage, display))

  return { viewer, leftoverDisplay }
}

let preferences: ReturnType<typeof devicePreferencesOver> | undefined

export function useDevicePreferences(): ReturnType<typeof devicePreferencesOver> {
  return (preferences ??= devicePreferencesOver(window.localStorage))
}
