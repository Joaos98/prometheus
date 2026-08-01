import { memberName, type Household, type MemberId, type Month } from '../domain/index.js'

/**
 * A member's name as the Roster records it. A Month keeps its own member list, so a
 * Month can name somebody the Roster no longer lists as active.
 *
 * The engine words its own refusals with names, so the lookup is the engine's and this
 * is the panels' way to it — one answer to "who is this", however it is asked.
 */
export const nameOf = memberName

/** The Month's members, named, in the Month's own order. */
export function membersOf(household: Household, month: Month): { id: MemberId; name: string }[] {
  return month.members.map((id) => ({ id, name: nameOf(household, id) }))
}
