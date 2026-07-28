/** A calendar month, "YYYY-MM" (e.g. "2026-07"). */
export type Month = string;

export interface Member {
  id: string;
  name: string;
  joinedFrom?: Month;
  departedFrom?: Month;
}

export type SplitRule =
  | { method: "even" }
  | { method: "proportional" }
  | { method: "custom"; mode: "percent"; values: Record<string, number> }
  | { method: "custom"; mode: "amount"; values: Record<string, number> };

export interface IncomeSnapshot {
  month: Month;
  memberId: string;
  name: string;
  amountCents: number;
  restrictedUse?: boolean;
}

export interface ExpenseSnapshot {
  month: Month;
  expenseId: string;
  name: string;
  amountCents: number;
  participants: string[];
  splitRule: SplitRule;
}

export interface MonthData {
  month: Month;
  currency: string;
  members: Member[];
  incomeSnapshots: IncomeSnapshot[];
  expenseSnapshots: ExpenseSnapshot[];
  activeTemplateIds?: string[];
}

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
  leftoverCents: number;
}

export interface MonthlySummary {
  month: Month;
  currency: string;
  members: MemberSummary[];
  pendingExpenses: { expenseId: string; expenseName: string }[];
}
