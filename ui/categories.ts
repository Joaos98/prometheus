/**
 * The Household's category vocabulary as the screen reads it: naming the one a row points
 * at, offering the list in an order a member can scan, and saying what giving one up would
 * cost. Nothing here writes — the engine owns the vocabulary, and `useHousehold` carries
 * the writes to the store.
 */
import {
  monthName,
  type Category,
  type CategoryId,
  type CategoryUsage,
  type Household,
} from '../domain/index.js'

/**
 * The name behind a row's category, or nothing at all.
 *
 * Nothing is the answer for an id the vocabulary no longer holds, as well as for a row
 * that never had one. The clear that has to precede a delete is what keeps the first case
 * from arising; where it does — this screen not yet caught up with another member's
 * delete — no chip is a truer rendering than a chip naming an id.
 */
export function categoryName(household: Household, id: CategoryId | null): string | undefined {
  if (id === null) return undefined
  return household.categories.find((category) => category.id === id)?.name
}

/**
 * The vocabulary to offer, by name rather than by when each was added: a picker and a
 * management list are both read by scanning for a name. Case is disregarded, because two
 * names differing only in case are what the vocabulary exists to prevent rather than a
 * distinction to sort on.
 */
export function categoryChoices(household: Household): Category[] {
  return [...household.categories].sort((one, other) =>
    one.name.localeCompare(other.name, undefined, { sensitivity: 'base' }),
  )
}

/**
 * What deleting a category would cost, said as a member reads it — "used by 34 rows across
 * 11 Months, June 2025 – August 2026" — or nothing at all where no row holds it, which is
 * the delete that goes ahead on a single confirmation.
 *
 * The engine words the same cost inside its refusal, from the same two figures. This is the
 * wording for the question asked before the refusal would arise, which is where a member
 * actually decides.
 */
export function costOfDeleting(usage: CategoryUsage): string | undefined {
  if (usage.rowCount === 0) return undefined
  const rows = usage.rowCount === 1 ? '1 row' : `${usage.rowCount} rows`
  const first = monthName(usage.months[0]!)
  if (usage.months.length === 1) return `used by ${rows} in ${first}`
  const last = monthName(usage.months.at(-1)!)
  return `used by ${rows} across ${usage.months.length} Months, ${first} – ${last}`
}
