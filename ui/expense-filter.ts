import type { MemberId } from '../domain/index.js'

/**
 * The Expenses panel narrowed to one Participant. A lens over the panel and nothing
 * else: the rail's Leftover Balances, its review meter and its entry count stay
 * Month-wide, because they are facts about the Month rather than about the list.
 *
 * Its own control, not the Viewer. Changing the Viewer reorders the whole rail, which is
 * far too large a side effect for wanting a shorter list, and it cannot ask what somebody
 * else is in without claiming to be them.
 */
export function participantsIn<Expense extends { participants: readonly MemberId[] }>(
  expenses: readonly Expense[],
  filtering: MemberId | undefined,
): Expense[] {
  if (!filtering) return [...expenses]
  return expenses.filter((expense) => expense.participants.includes(filtering))
}

/**
 * How much the panel is hiding, said while it is hiding anything at all.
 *
 * A filtered panel showing three rows beside a rail saying eight entries has to account
 * for itself. It is also the whole of what explains a filter that hides everything — a
 * member absent from this Month, or off the Roster since — because the filter never moves
 * on its own. A lens that repositions itself is less predictable than one that
 * occasionally hides something, and the count already tells the truth.
 */
export function filterNote(
  filtering: MemberId | undefined,
  shown: number,
  total: number,
): string | undefined {
  return filtering ? `Showing ${shown} of ${total}` : undefined
}

/**
 * Who the picker offers: this Month's members, and whoever is being filtered on where
 * this Month has not got them — so that stepping to a Month somebody was never in leaves
 * the control naming them rather than showing a blank beside an empty list.
 */
export function participantChoices<Member extends { id: MemberId; name: string }>(
  members: readonly Member[],
  filtering: MemberId | undefined,
  nameOf: (member: MemberId) => string,
): (Member | { id: MemberId; name: string })[] {
  if (!filtering || members.some((member) => member.id === filtering)) return [...members]
  return [...members, { id: filtering, name: nameOf(filtering) }]
}
