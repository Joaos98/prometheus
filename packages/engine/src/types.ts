/** A calendar month, "YYYY-MM" (e.g. "2026-07"). */
export type Month = string;

export interface Member {
  id: string;
  name: string;
  /** Members join and depart Effective From a Month. */
  joinedFrom?: Month;
  /** Members are never deleted — departed members remain in past Months. */
  departedFrom?: Month;
}

export type SplitRule =
  | { method: "even" }
  | { method: "proportional" }
  | { method: "custom"; mode: "percent"; values: Record<string, number> }
  | { method: "custom"; mode: "amount"; values: Record<string, number> };

export interface Expense {
  id: string;
  name: string;
  /** Member ids of the Participants the Expense is divided among. */
  participants: string[];
  splitRule: SplitRule;
  effectiveFrom: Month;
  /** If set, the expense is not effective in or after this Month. */
  endedFrom?: Month;
}

/** The actual amount entered for an Expense in a given Month, in integer cents. */
export interface ExpenseAmount {
  expenseId: string;
  month: Month;
  amountCents: number;
}

export interface Household {
  /** ISO 4217 currency code, set once at setup and immutable. */
  currency: string;
  members: Member[];
  incomeSources: IncomeSource[];
  expenses: Expense[];
  expenseAmounts: ExpenseAmount[];
  goals: SavingsGoal[];
  goalContributions: GoalContribution[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  participants: string[];
  splitRule: SplitRule;
  effectiveFrom: Month;
  endedFrom?: Month;
  targetAmountCents?: number;
}

export interface GoalContribution {
  goalId: string;
  month: Month;
  amountCents: number;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  targetAmountCents?: number;
  accumulatedCents: number;
}

export interface IncomeSourceEntry {
  amountCents: number;
  effectiveFrom: Month;
}

export interface IncomeSource {
  id: string;
  memberId: string;
  name: string;
  timeline: IncomeSourceEntry[];
  /** If set, the source is not effective in or after this Month. */
  endedFrom?: Month;
  /** Flagged once at setup; restricted-use income is excluded from spendable figures. */
  restrictedUse?: boolean;
}

/** One Participant's Share of a single Expense for the Month. */
export interface Share {
  expenseId: string;
  expenseName: string;
  amountCents: number;
}

export interface MemberSummary {
  memberId: string;
  name: string;
  incomeCents: number;
  restrictedCents: number;
  shares: Share[];
  totalCents: number;
  contributionCents: number;
  leftoverCents: number;
}

export interface PendingItem {
  itemId: string;
  itemName: string;
}

export interface FallbackItem {
  itemId: string;
  itemName: string;
}

export interface MonthlySummary {
  month: Month;
  currency: string;
  members: MemberSummary[];
  goalProgress: GoalProgress[];
  pendingExpenses: PendingItem[];
  pendingContributions: PendingItem[];
  fallbackExpenses: FallbackItem[];
  fallbackContributions: FallbackItem[];
}
