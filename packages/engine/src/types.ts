/** A calendar month, "YYYY-MM" (e.g. "2026-07"). */
export type Month = string;

export interface Member {
  id: string;
  name: string;
}

export type SplitRule = { method: "even" };

export interface Expense {
  id: string;
  name: string;
  /** Member ids of the Participants the Expense is divided among. */
  participants: string[];
  splitRule: SplitRule;
  effectiveFrom: Month;
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
  shares: Share[];
  totalCents: number;
}

export interface MonthlySummary {
  month: Month;
  currency: string;
  members: MemberSummary[];
}
