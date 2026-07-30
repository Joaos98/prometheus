import { DomainError } from './errors.js'
import { formatAmount } from './money.js'
import { requireAmount } from './rows.js'
import type { Currency, MemberId, Minor, SplitRule } from './types.js'

/** Percentages are held to two decimal places, so 100% is exactly 10000 of these. */
const WHOLE = 10_000n

/**
 * Checks a Split Rule against the Expense it is attached to, and refuses it if the two
 * do not agree.
 *
 * A rule is only ever valid relative to a particular amount and a particular set of
 * Participants, so this is the one place that decides — and it is given the Expense as
 * it *would* stand, never a half-applied edit. That is what makes it impossible to
 * change an amount out from under a fixed rule: both are judged together or not at all.
 */
export function requireConsistentRule(
  rule: SplitRule,
  amount: Minor | null,
  participants: MemberId[],
  currency: Currency,
): SplitRule {
  switch (rule.kind) {
    case 'even':
    case 'proportional':
      return rule

    case 'percentage': {
      requireOneValuePerParticipant(rule.byMember, participants, 'A percentage rule')
      const total = participants.reduce(
        (running, member) => running + basisPointsOf(rule.byMember[member]!),
        0n,
      )
      if (total !== WHOLE) {
        throw new DomainError(
          `The percentages total ${percent(total)} — ${percent(difference(total, WHOLE))} ${total < WHOLE ? 'short of' : 'more than'} 100%`,
        )
      }
      return rule
    }

    case 'fixed': {
      requireOneValuePerParticipant(rule.byMember, participants, 'A fixed rule')
      if (amount === null) {
        throw new DomainError(
          'A fixed rule needs an amount to total to, and this Expense has none entered',
        )
      }
      const total = participants.reduce(
        (running, member) => running + requireAmount(rule.byMember[member]!)!,
        0,
      )
      if (total !== amount) {
        throw new DomainError(
          `The fixed amounts total ${formatAmount(total, currency)} — ${formatAmount(Math.abs(amount - total), currency)} ${total < amount ? 'short of' : 'more than'} the Expense's ${formatAmount(amount, currency)}`,
        )
      }
      return rule
    }
  }
}

/**
 * A percentage as the whole number of hundredths it stands for. Anything finer is
 * refused rather than rounded, so a rule that looks like it totals 100 always does.
 */
export function basisPointsOf(percentage: number): bigint {
  if (!Number.isFinite(percentage)) throw new DomainError(`${percentage} is not a percentage`)
  if (percentage < 0) throw new DomainError('A percentage cannot be negative')

  const scaled = Math.round(percentage * 100)
  if (Math.abs(percentage * 100 - scaled) > 1e-9) {
    throw new DomainError(
      `Percentages are held to two decimal places, so ${percentage} cannot be stored exactly`,
    )
  }
  return BigInt(scaled)
}

function requireOneValuePerParticipant(
  byMember: Record<MemberId, unknown>,
  participants: MemberId[],
  subject: string,
): void {
  const named = Object.keys(byMember)
  const covers = participants.every((member) => byMember[member] !== undefined)
  if (!covers || named.length !== participants.length) {
    throw new DomainError(`${subject} needs one value for each Participant and no others`)
  }
}

function difference(one: bigint, other: bigint): bigint {
  return one < other ? other - one : one - other
}

/** Basis points as a member would read them: `90%`, `33.33%`. */
function percent(points: bigint): string {
  const whole = points / 100n
  const hundredths = Number(points % 100n)
  const fraction = hundredths === 0 ? '' : `.${String(hundredths).padStart(2, '0').replace(/0$/, '')}`
  return `${whole}${fraction}%`
}
