import type { SplitRule } from '../domain/index.js'

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
