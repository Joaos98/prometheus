import type { Household, MemberId, Month } from '../domain/index.js'

/**
 * A member's name as the Roster records it. A Month keeps its own member list, so a
 * Month can name somebody the Roster no longer lists as active.
 */
export function nameOf(household: Household, member: MemberId): string {
  return household.roster.find((candidate) => candidate.id === member)?.name ?? 'Unknown member'
}

/** The Month's members, named, in the Month's own order. */
export function membersOf(household: Household, month: Month): { id: MemberId; name: string }[] {
  return month.members.map((id) => ({ id, name: nameOf(household, id) }))
}
