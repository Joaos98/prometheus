import { DomainError } from './errors.js'
import {
  openedMonth,
  replaceRow,
  requireAmount,
  requireMember,
  requireName,
  withMonth,
  type RowChange,
} from './rows.js'
import type { Household, MemberId, Minor, Month, MonthKey, RowId, SavingsGoal } from './types.js'

export interface GoalDraft {
  name: string
  target?: Minor | null
  startAmount?: Minor
  participants: MemberId[]
}

/**
 * The fields an edit names. A field left out is left alone. A `target` of `null` is
 * named: it takes the target away, leaving a goal with nothing fixed to reach.
 */
export interface GoalEdits {
  name?: string
  target?: Minor | null
  startAmount?: Minor
  participants?: MemberId[]
}

/** Records something the Household is saving toward, shared by the Participants named. */
export function addSavingsGoal(
  household: Household,
  key: MonthKey,
  draft: GoalDraft,
): RowChange<SavingsGoal> {
  const month = openedMonth(household, key)
  const row: SavingsGoal = {
    id: crypto.randomUUID(),
    name: requireName(draft.name, 'A Savings Goal'),
    target: requireTarget(draft.target ?? null),
    startAmount: requireStartAmount(draft.startAmount ?? 0),
    participants: requireParticipants(month, draft.participants),
    contributions: {},
    reviewed: true,
  }
  return { household: withGoals(household, month, [...month.goals, row]), row }
}

/**
 * Changes the fields an edit names on one goal of one Month, and nothing else. The goal
 * keeps its identity, so the Contributions of every earlier Month still count toward it.
 * An edit always clears the Unreviewed mark, whether or not the row carried it.
 */
export function editSavingsGoal(
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: GoalEdits,
): RowChange<SavingsGoal> {
  const month = openedMonth(household, key)
  const existing = goalRow(month, id)

  const participants =
    edits.participants === undefined
      ? existing.participants
      : requireParticipants(month, edits.participants)

  const row: SavingsGoal = {
    ...existing,
    ...(edits.name !== undefined && { name: requireName(edits.name, 'A Savings Goal') }),
    ...(edits.target !== undefined && { target: requireTarget(edits.target) }),
    ...(edits.startAmount !== undefined && { startAmount: requireStartAmount(edits.startAmount) }),
    participants,
    /** Somebody taken out of a goal is no longer saving for it, so their Contribution goes too. */
    contributions: onlyParticipants(existing.contributions, participants),
    reviewed: true,
  }

  return { household: withGoals(household, month, replaceRow(month.goals, id, row)), row }
}

/**
 * Confirms a goal that is correct as inherited, without editing it: the one way to clear
 * the Unreviewed mark that changes no other field.
 */
export function confirmSavingsGoal(
  household: Household,
  key: MonthKey,
  id: RowId,
): RowChange<SavingsGoal> {
  const month = openedMonth(household, key)
  const row: SavingsGoal = { ...goalRow(month, id), reviewed: true }
  return { household: withGoals(household, month, replaceRow(month.goals, id, row)), row }
}

/** Takes a goal out of a Month. Earlier Months keep the Contributions they recorded. */
export function removeSavingsGoal(household: Household, key: MonthKey, id: RowId): Household {
  const month = openedMonth(household, key)
  goalRow(month, id)
  return withGoals(
    household,
    month,
    month.goals.filter((candidate) => candidate.id !== id),
  )
}

/**
 * What one Participant puts toward one goal in one Month, entered directly rather than
 * derived from anything: goals have no Split Rule. An amount of `null` takes the
 * Contribution back to nothing entered at all.
 */
export function recordContribution(
  household: Household,
  key: MonthKey,
  id: RowId,
  member: MemberId,
  amount: Minor | null,
): RowChange<SavingsGoal> {
  const month = openedMonth(household, key)
  const existing = goalRow(month, id)
  requireMember(month, member)
  if (!existing.participants.includes(member)) {
    throw new DomainError(`${member} is not saving for ${existing.name}`)
  }

  const contributions = { ...existing.contributions }
  if (amount === null) delete contributions[member]
  else contributions[member] = requireContribution(amount)

  const row: SavingsGoal = { ...existing, contributions, reviewed: true }
  return { household: withGoals(household, month, replaceRow(month.goals, id, row)), row }
}

/** What one Participant has put toward a goal in its Month — nothing, until entered. */
export function contributionTo(goal: SavingsGoal, member: MemberId): Minor {
  return goal.contributions[member] ?? 0
}

/** What every Participant together has put toward a goal in its Month. */
export function totalContributedTo(goal: SavingsGoal): Minor {
  return Object.values(goal.contributions).reduce((total, amount) => total + amount, 0)
}

/** What one member has put toward every goal of a Month — the Leftover Balance's third term. */
export function contributionsOf(month: Month, member: MemberId): Minor {
  return month.goals.reduce((total, goal) => total + contributionTo(goal, member), 0)
}

/** The Month's goal of that identity, or nothing if this Month is not on its thread. */
export function goalIn(month: Month, id: RowId): SavingsGoal | undefined {
  return month.goals.find((candidate) => candidate.id === id)
}

function goalRow(month: Month, id: RowId): SavingsGoal {
  const row = goalIn(month, id)
  if (!row) throw new DomainError(`${month.key} holds no Savings Goal ${id}`)
  return row
}

/**
 * The Participants of a goal: a subset of the Month's members, each named once, in the
 * Month's own order so that the goal row reads the same way every time.
 */
function requireParticipants(month: Month, participants: MemberId[]): MemberId[] {
  for (const participant of participants) requireMember(month, participant)
  const named = month.members.filter((member) => participants.includes(member))
  if (named.length === 0) throw new DomainError('A Savings Goal needs somebody saving for it')
  return named
}

function requireTarget(target: Minor | null): Minor | null {
  return target === null ? null : requireSaved(target, 'A target')
}

function requireStartAmount(amount: Minor): Minor {
  return requireSaved(amount, 'A start amount')
}

function requireContribution(amount: Minor): Minor {
  return requireSaved(amount, 'A Contribution')
}

/** Every figure on a goal is money saved, so none of them is ever negative. */
function requireSaved(amount: Minor, subject: string): Minor {
  requireAmount(amount)
  if (amount < 0) throw new DomainError(`${subject} cannot be negative`)
  return amount
}

function onlyParticipants(
  contributions: Record<MemberId, Minor>,
  participants: MemberId[],
): Record<MemberId, Minor> {
  return Object.fromEntries(
    Object.entries(contributions).filter(([member]) => participants.includes(member)),
  )
}

function withGoals(household: Household, month: Month, goals: SavingsGoal[]): Household {
  return withMonth(household, { ...month, goals })
}
