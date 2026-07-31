import { contributionsOf } from './goals.js'
import { spendableIncome, totalIncome } from './income.js'
import { isPending } from './rows.js'
import { sharesOf } from './shares.js'
import type { MemberId, Minor, Month } from './types.js'

/**
 * A member's position for a Month: Spendable Income minus their Shares across the
 * Month's Expenses minus their Savings Goal Contributions. Never carries into a later
 * Month — every figure here is recomputed fresh from this Month's own rows.
 *
 * `totalIncome` rides alongside `spendableIncome` so a dashboard toggle can substitute
 * it into the balance for display, without this function or a Share ever weighing it.
 */
export interface LeftoverBalance {
  member: MemberId
  spendableIncome: Minor
  totalIncome: Minor
  shares: Minor
  contributions: Minor
  balance: Minor
  /**
   * True when a Pending income or expense row touches this member, so the balance is
   * missing a term rather than genuinely computed against a zero.
   */
  incomplete: boolean
}

/** The Leftover Balance of one member of the Month, with its three terms spelled out. */
export function leftoverBalanceOf(month: Month, member: MemberId): LeftoverBalance {
  const income = spendableIncome(month, member)
  const shares = month.expenses.reduce(
    (total, expense) =>
      total + (sharesOf(month, expense).find((share) => share.member === member)?.amount ?? 0),
    0,
  )
  const contributions = contributionsOf(month, member)

  const pendingIncome = month.income.some((row) => row.member === member && isPending(row))
  const pendingShare = month.expenses.some(
    (expense) => expense.participants.includes(member) && isPending(expense),
  )

  return {
    member,
    spendableIncome: income,
    totalIncome: totalIncome(month, member),
    shares,
    contributions,
    balance: income - shares - contributions,
    incomplete: pendingIncome || pendingShare,
  }
}

/** The Leftover Balance of every member of the Month, in the Month's own member order. */
export function leftoverBalancesOf(month: Month): LeftoverBalance[] {
  return month.members.map((member) => leftoverBalanceOf(month, member))
}
