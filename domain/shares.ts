import { spendableIncome } from './income.js'
import { basisPointsOf } from './split-rules.js'
import type { ExpenseSnapshot, MemberId, Minor, Month } from './types.js'

/** The portion of an Expense attributed to one Participant. */
export interface Share {
  member: MemberId
  amount: Minor
}

/** How an Expense came out, and whether its rule had to give way. */
export interface Split {
  shares: Share[]
  /**
   * True when a proportional rule found no Spendable Income among its Participants to
   * weight by and divided evenly instead. The stored rule is unchanged — this is what
   * happened this Month, and the Expense says so.
   */
  dividedEvenlyInstead: boolean
}

/**
 * What each Participant's Share of an Expense comes to.
 *
 * Shares sum to exactly the Expense amount, always: each Share floors to a whole minor
 * unit and the leftover units go one each to the Participants whose exact shares had
 * the largest fractional parts, ties broken by the Month's member order. Nobody is ever
 * more than one unit from their exact share, and nobody systematically absorbs the
 * rounding.
 *
 * A Pending Expense — no amount entered at all — yields no Shares. It is flagged on the
 * dashboard rather than treated as costing nothing.
 */
export function sharesOf(month: Month, expense: ExpenseSnapshot): Share[] {
  return splitOf(month, expense).shares
}

/** The Shares, with whatever the Month had to say about how they came out. */
export function splitOf(month: Month, expense: ExpenseSnapshot): Split {
  const nothing: Split = { shares: [], dividedEvenlyInstead: false }
  if (expense.amount === null) return nothing

  const amount = expense.amount
  const participants = inMemberOrder(month, expense.participants)
  if (participants.length === 0) return nothing

  const evenly = (): Share[] => divide(amount, participants, participants.map(() => 1n))
  const rule = expense.splitRule

  switch (rule.kind) {
    case 'even':
      return { shares: evenly(), dividedEvenlyInstead: false }

    case 'proportional': {
      /** Income that went backwards weighs nothing; it never makes a Share negative. */
      const weights = participants.map((member) =>
        BigInt(Math.max(0, spendableIncome(month, member))),
      )
      const weighed = weights.reduce((running, weight) => running + weight, 0n)
      return weighed === 0n
        ? { shares: evenly(), dividedEvenlyInstead: true }
        : { shares: divide(amount, participants, weights), dividedEvenlyInstead: false }
    }

    case 'percentage':
      return {
        shares: divide(
          amount,
          participants,
          participants.map((member) => basisPointsOf(rule.byMember[member] ?? 0)),
        ),
        dividedEvenlyInstead: false,
      }

    case 'fixed':
      /** Fixed amounts already total the Expense — that is the only way one can be stored. */
      return {
        shares: participants.map((member) => ({ member, amount: rule.byMember[member] ?? 0 })),
        dividedEvenlyInstead: false,
      }
  }
}

/**
 * Largest remainder, in exact integer arithmetic — no floating point anywhere near a
 * Share. With every weight equal this is an even division; the weighted rules of ticket
 * 04 hand it different weights and inherit the same exactness.
 */
function divide(amount: Minor, participants: MemberId[], weights: bigint[]): Share[] {
  const total = weights.reduce((running, weight) => running + weight, 0n)
  const scaled = BigInt(amount)

  const floors = weights.map((weight) => floorDivide(scaled * weight, total))
  const placed = floors.reduce((running, share) => running + share, 0n)

  /** What the floors left behind, and who has the strongest claim to each unit of it. */
  const claims = weights
    .map((weight, at) => ({ at, remainder: scaled * weight - floors[at]! * total }))
    .sort((one, other) => compare(other.remainder, one.remainder))

  const shares = floors.slice()
  let leftover = scaled - placed
  for (const claim of claims) {
    if (leftover <= 0n) break
    shares[claim.at] = shares[claim.at]! + 1n
    leftover -= 1n
  }

  return participants.map((member, at) => ({ member, amount: Number(shares[at]!) }))
}

/** Integer division that rounds toward negative infinity, so remainders stay positive. */
function floorDivide(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor
  const inexact = dividend % divisor !== 0n
  return inexact && dividend < 0n !== divisor < 0n ? quotient - 1n : quotient
}

function compare(one: bigint, other: bigint): number {
  return one === other ? 0 : one > other ? 1 : -1
}

/**
 * The Participants in the Month's own member order, which is what makes a tie between
 * equal fractional parts fall the same way every time the Month is rendered.
 */
function inMemberOrder(month: Month, participants: MemberId[]): MemberId[] {
  return month.members.filter((member) => participants.includes(member))
}
