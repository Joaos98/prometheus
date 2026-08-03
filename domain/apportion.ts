/**
 * Largest remainder, in exact integer arithmetic — no floating point anywhere near an
 * apportioned total. Each weight's share is floored first, and the leftover units go one
 * each to the weights whose exact shares had the largest fractional parts, ties broken by
 * position, so the result always sums to exactly `total`.
 *
 * With every weight equal this is an even division. Pure arithmetic — no members, no
 * money, no `Minor` — so `shares.ts`'s Shares of an Expense and `income.ts`'s percentages
 * of the Household's income both stand on the same one implementation.
 *
 * The weights must not sum to zero — there is no principled way to apportion a total
 * among claims that are all worth nothing. Every caller in this codebase checks that
 * before calling; this only turns the BigInt division's own opaque failure into a named one.
 */
export function apportion(total: number, weights: bigint[]): number[] {
  const sum = weights.reduce((running, weight) => running + weight, 0n)
  if (sum === 0n) throw new Error('apportion: weights must not all be zero')

  const scaled = BigInt(total)

  const floors = weights.map((weight) => floorDivide(scaled * weight, sum))
  const placed = floors.reduce((running, share) => running + share, 0n)

  /** What the floors left behind, and who has the strongest claim to each unit of it. */
  const claims = weights
    .map((weight, at) => ({ at, remainder: scaled * weight - floors[at]! * sum }))
    .sort((one, other) => compare(other.remainder, one.remainder))

  const shares = floors.slice()
  let leftover = scaled - placed
  for (const claim of claims) {
    if (leftover <= 0n) break
    shares[claim.at] = shares[claim.at]! + 1n
    leftover -= 1n
  }

  return shares.map((share) => Number(share))
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
