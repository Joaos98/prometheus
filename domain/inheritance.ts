import type {
  ExpenseSnapshot,
  IncomeSnapshot,
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
 * The member list comes from the Previous Month rather than from the Roster, which is
 * what keeps a past Month rendering exactly as it did after somebody leaves.
 *
 * Every copy is deep. A Month owns its rows outright, so editing one Month can never
 * reach into another, however many Months a row has been carried through. What is
 * shared is the row's identity, and only that: it is the thread that lets propagation
 * and history follow the same cost across the Months.
 */
export function inheritMonth(previous: Month, key: MonthKey): Month {
  return {
    key,
    members: [...previous.members],
    income: previous.income.map(inheritIncome),
    expenses: previous.expenses.map(inheritExpense),
    goals: previous.goals.map(inheritGoal),
  }
}

function inheritIncome(row: IncomeSnapshot): IncomeSnapshot {
  return { ...row }
}

function inheritExpense(row: ExpenseSnapshot): ExpenseSnapshot {
  return {
    ...row,
    participants: [...row.participants],
    splitRule: inheritSplitRule(row.splitRule),
  }
}

/** Ticket 10 gives a Goal its Contributions, which start the Month at nothing. */
function inheritGoal(goal: SavingsGoal): SavingsGoal {
  return { ...goal }
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
