import { isOneOff } from './rows.js'
import { requireConsistentRule } from './split-rules.js'
import type {
  Currency,
  ExpenseSnapshot,
  Household,
  IncomeSnapshot,
  Member,
  MemberId,
  Minor,
  Month,
  MonthKey,
  MonthRow,
  RowKind,
  SavingsGoal,
  SplitRule,
} from './types.js'

/**
 * The Month that opening `key` produces from the Previous Month: its members and every
 * one of its rows, copied wholesale, every field intact. This is the one rule the whole
 * model reduces to — nothing is defined outside a Month, so what a Month holds can only
 * have come from the Month before it, and an Expense stops recurring simply by being
 * absent from a Month, since later Months inherit that absence.
 *
 * The member list starts from the Previous Month rather than being re-derived from the
 * Roster wholesale, which is what keeps a past Month rendering exactly as it did after
 * somebody leaves. But opening is also where a Roster change since the Previous Month
 * was opened becomes visible: anyone deactivated since is dropped, and anyone added or
 * reactivated since is appended, with no record of an absence.
 *
 * Every copy is deep. A Month owns its rows outright, so editing one Month can never
 * reach into another, however many Months a row has been carried through. What is
 * shared is the row's identity, and only that: it is the thread that lets propagation
 * and history follow the same cost across the Months.
 *
 * A row marked One-Off in the Previous Month is left out entirely rather than copied and
 * un-marked: it belonged to that Month alone, so there is nothing here for the new Month
 * to inherit.
 *
 * Every row that does come across is reconciled against the new Month's member list,
 * because that list is the one thing here that is not a straight copy. A row is only ever
 * about people who are members of the Month holding it — an income row belongs to one of
 * them, Participants are a subset of them — and this is the only place a Month is built
 * where that could stop being true. Leaving it untrue is what would let an Expense divide
 * among somebody the Month has never had, which no later validation would catch and which
 * would quietly stop its Shares totalling the Expense.
 */
export function inheritMonth(previous: Month, key: MonthKey, household: Household): Month {
  const members = inheritMembers(previous.members, household.roster)
  return {
    key,
    members,
    income: kept(previous.income).flatMap((row) => inheritIncome(row, members)),
    expenses: kept(previous.expenses).flatMap((row) =>
      inheritExpense(row, members, household.currency),
    ),
    goals: kept(previous.goals).flatMap((goal) => inheritGoal(goal, members)),
  }
}

/**
 * One row reconciled against a member list, on exactly the terms inheritance reconciles
 * the rows it copies — nothing at all when there is nobody left for it to be about.
 *
 * Opening a Month is not the only place a row is handed to a member list that is not the
 * one it was worked out against: refreshing a drifted row takes a row computed for the
 * members a fresh open *would* give the Month and lands it in the Month as it stands,
 * whose membership may itself have drifted. That row has to be reconciled again, or the
 * invariant this module exists to keep is broken by the other door.
 */
export function rowForMembers(
  kind: RowKind,
  row: MonthRow,
  members: MemberId[],
  currency: Currency,
): MonthRow | undefined {
  if (kind === 'income') return inheritIncome(row as IncomeSnapshot, members)[0]
  if (kind === 'expenses') return inheritExpense(row as ExpenseSnapshot, members, currency)[0]
  return inheritGoal(row as SavingsGoal, members)[0]
}

/** A row marked One-Off belonged to its Month alone, so there is nothing here to inherit. */
function kept<Row extends { oneOff: boolean }>(rows: Row[]): Row[] {
  return rows.filter((row) => !isOneOff(row))
}

function inheritMembers(previous: Month['members'], roster: Member[]): Month['members'] {
  const active = new Set(roster.filter((member) => member.active).map((member) => member.id))
  const carried = previous.filter((member) => active.has(member))
  const joined = roster
    .filter((member) => member.active && !carried.includes(member.id))
    .map((member) => member.id)
  return [...carried, ...joined]
}

/**
 * Every row that arrives by inheritance is Unreviewed until edited or confirmed, and
 * never carries the One-Off mark — that belongs to the Month it was set in, not to this
 * one.
 *
 * An income row is one member's, so it comes across only if that member is one of this
 * Month's. Somebody who has left the Roster takes what they earned with them; the Months
 * they were a member of keep saying what they said.
 */
function inheritIncome(row: IncomeSnapshot, members: MemberId[]): IncomeSnapshot[] {
  if (!members.includes(row.member)) return []
  return [{ ...row, reviewed: false, oneOff: false }]
}

/**
 * An Expense comes across divided among whichever of its Participants are members here.
 * With none of them left there is nobody to divide it among, so it stops recurring the
 * way any Expense does — by being absent, which the Months after this one inherit.
 */
function inheritExpense(
  row: ExpenseSnapshot,
  members: MemberId[],
  currency: Currency,
): ExpenseSnapshot[] {
  const participants = row.participants.filter((member) => members.includes(member))
  if (participants.length === 0) return []
  return [
    {
      ...row,
      participants,
      splitRule: inheritSplitRule(row.splitRule, participants, row.amount, currency),
      reviewed: false,
      oneOff: false,
    },
  ]
}

/**
 * A goal carries its name, target, start amount and Participants into the new Month, and
 * its Contributions start at nothing: what anybody put in last Month was put in last
 * Month, and Accumulated Progress finds it there rather than by carrying it along. The
 * start amount is likewise inherited unchanged — it is the baseline from before
 * Prometheus, not a running total.
 */
function inheritGoal(goal: SavingsGoal, members: MemberId[]): SavingsGoal[] {
  const participants = goal.participants.filter((member) => members.includes(member))
  if (participants.length === 0) return []
  return [{ ...goal, participants, contributions: {}, reviewed: false, oneOff: false }]
}

/**
 * The Split Rule as it applies to the Participants who are actually here.
 *
 * `even` and `proportional` name nobody and so need nothing. A `percentage` or `fixed`
 * rule names a figure per Participant, and once one of them is gone those figures no
 * longer total what they have to total — the agreement they recorded was between people
 * who are no longer all here. Rather than rescale it into something nobody agreed, or
 * store a rule that does not add up, the Expense falls back to dividing evenly and
 * arrives Unreviewed like everything else, so somebody is asked to look at it.
 *
 * A rule that still adds up is kept exactly as it was — which is every rule when nobody
 * has left, and also one that only named the departed Participant for nothing.
 */
function inheritSplitRule(
  rule: SplitRule,
  participants: MemberId[],
  amount: Minor | null,
  currency: Currency,
): SplitRule {
  const narrowed = onlyParticipants(rule, participants)
  try {
    return requireConsistentRule(narrowed, amount, participants, currency)
  } catch {
    return { kind: 'even' }
  }
}

function onlyParticipants(rule: SplitRule, participants: MemberId[]): SplitRule {
  switch (rule.kind) {
    case 'percentage':
      return { kind: 'percentage', byMember: figuresFor(rule.byMember, participants) }
    case 'fixed':
      return { kind: 'fixed', byMember: figuresFor(rule.byMember, participants) }
    default:
      return { ...rule }
  }
}

/** A rule holds one figure per Participant and no others, so a departure takes its own. */
function figuresFor<Figure>(
  byMember: Record<MemberId, Figure>,
  participants: MemberId[],
): Record<MemberId, Figure> {
  return Object.fromEntries(
    Object.entries(byMember).filter(([member]) => participants.includes(member)),
  )
}
