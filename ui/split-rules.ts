import type { MemberId, SplitRule } from '../domain/index.js'

/** How each Split Rule is named on screen, and what choosing it means. */
export const RULE_CHOICES: { kind: SplitRule['kind']; name: string; note: string }[] = [
  { kind: 'even', name: 'Even', note: 'Divided equally among the Participants' },
  {
    kind: 'proportional',
    name: 'Proportional',
    note: 'Weighted by Spendable Income, read from this Month as it stands',
  },
  { kind: 'percentage', name: 'Percentages', note: 'Must total exactly 100%' },
  { kind: 'fixed', name: 'Fixed amounts', note: 'Must total exactly the Expense' },
]

const NAMES = Object.fromEntries(
  RULE_CHOICES.map((choice) => [choice.kind, choice.name]),
) as Record<SplitRule['kind'], string>

export const ruleName = (rule: SplitRule): string => NAMES[rule.kind]

/** A rule's per-Participant values as editable text, keyed by member. */
export type RuleValues = Record<string, string>

/**
 * An Expense with exactly one Participant, which CONTEXT.md calls an individual expense.
 * Their Share is the whole of it whatever the rule says, so there is nothing to divide
 * and nothing to ask.
 *
 * Nobody ticked is not one of these. It yields no Shares at all rather than one, and
 * saying "individual expense" of it would name something that is not there.
 */
export const isIndividual = (participants: readonly MemberId[]): boolean =>
  participants.length === 1

/**
 * The rule an Expense is saved with: Even for an individual expense, whatever was chosen
 * before, and the choice itself for every other.
 *
 * It is forced rather than merely hidden. `splitOf` divides evenly instead when a fixed
 * rule's amounts do not total the Expense and says so on the row, and the form disables
 * its own save button in the same state — so hiding the control over a stored `fixed`
 * rule would leave a member in front of a complaint with nothing to answer it with.
 *
 * `splitRule` is a field Drift compares, so this can rewrite an inherited rule and be
 * reported as a difference against later opened Months. That is correct: something did
 * change. It happens only on an explicit save, never on inheritance.
 */
export const ruleFor = (participants: readonly MemberId[], chosen: SplitRule): SplitRule =>
  isIndividual(participants) ? { kind: 'even' } : chosen

/** The caption under a row's name: what the split is, and what came of it. */
export interface ExpenseCaption {
  /** What kind of split this is — a rule's name, or the individual expense that has none. */
  lead: string
  participants: string
  /** Said only where the stored rule could not be applied as written. */
  warning?: string
}

/**
 * How a row describes its own split. An individual expense says what it is rather than
 * naming a rule, which also covers the seam this leaves behind: a one-Participant row
 * still storing `fixed` or `percentage`, inherited and never edited, stops advertising a
 * rule the form no longer shows.
 *
 * It carries no divided-evenly-instead warning either. The warning says what happened
 * where a rule could not be applied, and with one Participant to divide among there is
 * nothing it could tell anybody.
 */
export function expenseCaption(
  expense: { participants: readonly MemberId[]; splitRule: SplitRule },
  dividedEvenlyInstead: boolean,
): ExpenseCaption {
  const individual = isIndividual(expense.participants)
  const count = expense.participants.length
  return {
    lead: individual ? 'Individual expense' : ruleName(expense.splitRule),
    participants: count === 1 ? '1 Participant' : `${count} Participants`,
    warning:
      dividedEvenlyInstead && !individual
        ? expense.splitRule.kind === 'fixed'
          ? 'The fixed amounts do not total the Expense — divided evenly'
          : 'No Spendable Income this Month — divided evenly'
        : undefined,
  }
}
