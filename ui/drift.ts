import {
  formatAmount,
  type DriftField,
  type ExpenseSnapshot,
  type Household,
  type IncomeSnapshot,
  type MemberId,
  type Minor,
  type MonthRow,
  type SavingsGoal,
  type SplitRule,
} from '../domain/index.js'
import { nameOf } from './members.js'
import { ruleName } from './split-rules.js'

/** Each field of the diff as the Household names it, so a difference reads as a sentence. */
const LABELS: Record<DriftField, string> = {
  name: 'Name',
  category: 'Category',
  amount: 'Amount',
  participants: 'Participants',
  splitRule: 'Split Rule',
  lines: 'Line Items',
  member: 'Whose',
  restrictedUse: 'Restricted-Use',
  target: 'Target',
  startAmount: 'Start amount',
}

export const labelOf = (field: DriftField): string => LABELS[field]

/**
 * One field of one row, as a member would read it. The diff is neutral, so both sides are
 * rendered the same way and neither is styled as the right one.
 */
export function valueOf(household: Household, row: MonthRow, field: DriftField): string {
  const money = (amount: Minor | null): string =>
    amount === null ? 'Nothing entered' : formatAmount(amount, household.currency)

  switch (field) {
    case 'name':
      return (row as { name: string }).name
    case 'category':
      return (row as ExpenseSnapshot).category || 'None'
    case 'amount':
      return money((row as ExpenseSnapshot).amount)
    case 'target':
      return money((row as SavingsGoal).target)
    case 'startAmount':
      return money((row as SavingsGoal).startAmount)
    case 'member':
      return nameOf(household, (row as IncomeSnapshot).member)
    case 'restrictedUse':
      return (row as IncomeSnapshot).restrictedUse ? 'Restricted-Use' : 'Counts as spendable'
    case 'participants':
      return namesOf(household, (row as ExpenseSnapshot).participants)
    case 'splitRule':
      return ruleSummary(household, (row as ExpenseSnapshot).splitRule)
    case 'lines':
      return linesSummary((row as ExpenseSnapshot).lines, household)
  }
}

/** A composite's lines as a member would read them, in the order they are held. */
function linesSummary(lines: ExpenseSnapshot['lines'], household: Household): string {
  if (lines.length === 0) return 'No Line Items'
  return lines
    .map((line) => {
      const amount = line.amount === null ? 'Nothing entered' : formatAmount(line.amount, household.currency)
      return `${line.name} ${amount}`
    })
    .join(', ')
}

export function namesOf(household: Household, members: MemberId[]): string {
  return members.length === 0
    ? 'Nobody'
    : members.map((member) => nameOf(household, member)).join(', ')
}

/** A rule and its per-Participant figures, since the figures are part of what differs. */
function ruleSummary(household: Household, rule: SplitRule): string {
  if (rule.kind === 'even' || rule.kind === 'proportional') return ruleName(rule)

  const figures = Object.entries(rule.byMember).map(([member, figure]) => {
    const said = rule.kind === 'percentage' ? `${figure}%` : formatAmount(figure, household.currency)
    return `${nameOf(household, member)} ${said}`
  })
  return `${ruleName(rule)} — ${figures.join(', ')}`
}
