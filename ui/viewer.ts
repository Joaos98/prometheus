import type { MemberId, Month, Member } from '../domain/index.js'

/**
 * Who the Viewer picker names, which is always whoever the rail is leading with.
 *
 * The rail leads with this device's picked Viewer where the Month has them, and falls
 * through to the Month's own first member where it does not. The picker reads that back
 * rather than reading storage, so the control and the screen never disagree — the price
 * being that stepping to a Month somebody is not in changes the name in the picker with
 * nothing on screen explaining it.
 *
 * This is a display substitution and nothing more: it is never written back. On an
 * unopened Month there is no rail to read a leader from, so the pick stands as it is, or
 * the Roster's first active member stands in until there is a Month to pin one from.
 */
export function displayedViewer(
  picked: MemberId | undefined,
  month: Month | undefined,
  roster: readonly Member[],
): MemberId | undefined {
  if (!month) return picked ?? roster.find((member) => member.active)?.id
  if (picked && month.members.includes(picked)) return picked
  return month.members[0]
}

/**
 * What a load should write to this device, or nothing where it should write nothing.
 *
 * Only one rule ever pins a Viewer: the first load with an opened Month on screen pins
 * that Month's first member — the one the rail was already leading with, given a name so
 * that the picker holds still as a member steps around. A load on an unopened Month has
 * no rail to read, so the write waits rather than pinning the Roster's first, which may
 * not be among a past Month's members at all.
 *
 * Everything else is nothing: a device that has picked keeps its pick, and browsing a
 * Month that pick is absent from writes no substitute.
 */
export function viewerToPin(picked: MemberId | undefined, month: Month | undefined): MemberId | undefined {
  if (picked || !month) return undefined
  return month.members[0]
}

/**
 * Who the picker offers. Every active member, plus whoever it is currently naming — a
 * member deactivated since being picked, or a past Month's own member — so that the
 * control never shows a blank for a name it is meant to be displaying.
 */
export function viewerOptions<Member extends { id: MemberId; active: boolean }>(
  roster: readonly Member[],
  naming: MemberId | undefined,
): Member[] {
  return roster.filter((member) => member.active || member.id === naming)
}
