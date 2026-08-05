import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { monthKey, monthName, type MonthKey } from '../domain/index.js'

/** The twelve months by name, January first, as the engine says them. */
export const MONTH_NAMES: string[] = Array.from(
  { length: 12 },
  (_, index) => monthName(monthKey(2000, index + 1)).split(' ')[0]!,
)

/**
 * The calendar month the device is in. Where navigation starts from when the Household
 * holds no opened Month at all, and what "Today" jumps back to.
 */
export function thisMonth(): MonthKey {
  const now = new Date()
  return monthKey(now.getFullYear(), now.getMonth() + 1)
}

/**
 * The Month the calendar is on, kept level with it for as long as a view is on screen.
 * The engine will not guess it — only a Month after this one can drift, and only Months
 * up to it are charted — and which one it is is the device's to say, not the Household's.
 *
 * Read again whenever the window comes back, because Prometheus is the kind of thing left
 * open on a tab: a session that spans the turn of a month would otherwise go on treating
 * the Month that has just arrived as one still ahead.
 */
export function useCalendarMonth(): Ref<MonthKey> {
  const now = ref(thisMonth())

  function catchUpWithTheCalendar(): void {
    now.value = thisMonth()
  }

  onMounted(() => {
    window.addEventListener('focus', catchUpWithTheCalendar)
    document.addEventListener('visibilitychange', catchUpWithTheCalendar)
  })

  onUnmounted(() => {
    window.removeEventListener('focus', catchUpWithTheCalendar)
    document.removeEventListener('visibilitychange', catchUpWithTheCalendar)
  })

  return now
}
