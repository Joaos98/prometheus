import type { Expense, SplitRule } from "./types.js";

/**
 * Validates a custom SplitRule at creation time.
 * - Percent mode: values must sum to exactly 100.
 * - Amount mode: always valid at creation (the sum matches the expense
 *   total at that time; the caller provides the check).
 * Returns null if valid, or an error message string.
 */
export function validateCustomSplitRule(rule: SplitRule): string | null {
  if (rule.method !== "custom") return null;

  if (rule.mode === "percent") {
    const total = Object.values(rule.values).reduce((sum, v) => sum + v, 0);
    if (total !== 100) {
      return `Percentages sum to ${total} — must total exactly 100`;
    }
  }

  return null;
}

/**
 * Validates that a Month's amount entry is compatible with the expense's
 * SplitRule.
 * - Amount-mode custom splits: the entered amount must equal the sum of
 *   the fixed per-participant Shares.
 * Returns null if valid, or an error message string.
 */
export function validateExpenseAmount(
  expense: Expense,
  amountCents: number,
): string | null {
  if (expense.splitRule.method !== "custom") return null;
  if (expense.splitRule.mode !== "amount") return null;

  const total = Object.values(expense.splitRule.values).reduce(
    (sum, v) => sum + v,
    0,
  );
  if (amountCents !== total) {
    return `Amount (${amountCents}) must equal the sum of fixed shares (${total})`;
  }
  return null;
}
