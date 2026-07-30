import type {
  ExpenseSnapshot,
  IncomeSnapshot,
  Member,
  Month,
  MonthKey,
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
 */
export function inheritMonth(previous: Month, key: MonthKey, roster: Member[]): Month {
  return {
    key,
    members: inheritMembers(previous.members, roster),
    income: previous.income.filter(notOneOff).map(inheritIncome),
    expenses: previous.expenses.filter(notOneOff).map(inheritExpense),
    goals: previous.goals.filter(notOneOff).map(inheritGoal),
  }
}

function notOneOff(row: { oneOff: boolean }): boolean {
  return !row.oneOff
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
 */
function inheritIncome(row: IncomeSnapshot): IncomeSnapshot {
  return { ...row, reviewed: false, oneOff: false }
}

function inheritExpense(row: ExpenseSnapshot): ExpenseSnapshot {
  return {
    ...row,
    participants: [...row.participants],
    splitRule: inheritSplitRule(row.splitRule),
    reviewed: false,
    oneOff: false,
  }
}

/**
 * A goal carries its name, target, start amount and Participants into the new Month, and
 * its Contributions start at nothing: what anybody put in last Month was put in last
 * Month, and Accumulated Progress finds it there rather than by carrying it along. The
 * start amount is likewise inherited unchanged — it is the baseline from before
 * Prometheus, not a running total.
 */
function inheritGoal(goal: SavingsGoal): SavingsGoal {
  return {
    ...goal,
    participants: [...goal.participants],
    contributions: {},
    reviewed: false,
    oneOff: false,
  }
}

function inheritSplitRule(rule: SplitRule): SplitRule {
  switch (rule.kind) {
    case 'percentage':
      return { kind: 'percentage', byMember: { ...rule.byMember } }
    case 'fixed':
      return { kind: 'fixed', byMember: { ...rule.byMember } }
    default:
      return { ...rule }
  }
}
