import { apportion } from './apportion.js'
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
   * True when the stored rule could not be applied as written and the Expense divided
   * evenly instead: a proportional rule with no Spendable Income among its Participants
   * to weight by, or a fixed rule whose amounts do not total the Expense. The stored rule
   * is unchanged — this is what happened this Month, and the Expense says so.
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

    case 'fixed': {
      /**
       * Fixed amounts already total the Expense — that is the only way one can be stored,
       * so this reads each Participant the figure that was agreed, negative ones included.
       *
       * The total is checked all the same. Nothing the engine writes can fail it, but a
       * row that arrived some other way — hand-edited storage, a file an import has yet to
       * learn to reject — must not be allowed to answer with Shares that quietly come to
       * less than the Expense. Dividing evenly is the wrong split, and says so on the row;
       * under-summing is the wrong total, and says nothing at all.
       */
      const shares = participants.map((member) => ({ member, amount: rule.byMember[member] ?? 0 }))
      const total = shares.reduce((running, share) => running + share.amount, 0)
      return total === amount
        ? { shares, dividedEvenlyInstead: false }
        : { shares: evenly(), dividedEvenlyInstead: true }
    }
  }
}

/**
 * The amount apportioned by largest remainder and paired with each Participant, in the
 * Month's own member order — which is what makes a tie between equal fractional parts
 * fall the same way every time the Month is rendered.
 */
function divide(amount: Minor, participants: MemberId[], weights: bigint[]): Share[] {
  const amounts = apportion(amount, weights)
  return participants.map((member, at) => ({ member, amount: amounts[at]! }))
}

/**
 * The Participants in the Month's own member order, which is what makes a tie between
 * equal fractional parts fall the same way every time the Month is rendered.
 */
function inMemberOrder(month: Month, participants: MemberId[]): MemberId[] {
  return month.members.filter((member) => participants.includes(member))
}
