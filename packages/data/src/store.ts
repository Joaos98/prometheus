import type { ExpenseSnapshot, Goal, GoalContribution, IncomeSnapshot, Member, Month, MonthData, SplitRule } from "@prometheus/engine";

export interface IncomeProfile {
  id: string;
  memberId: string;
  name: string;
  amountCents: number;
  restrictedUse?: boolean;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  category?: string;
  defaultParticipants: string[];
  defaultSplitRule: SplitRule;
  active: boolean;
}

export interface DataStore {
  getCurrency(): string | null;
  setCurrency(currency: string): void;
  addMember(name: string): Member;
  getMembers(): Member[];
  removeMember(id: string): void;
  addIncomeSnapshot(snapshot: IncomeSnapshot): void;
  getIncomeSnapshots(): IncomeSnapshot[];
  addIncomeProfile(memberId: string, name: string, amountCents: number, restrictedUse?: boolean): IncomeProfile;
  getIncomeProfiles(): IncomeProfile[];
  updateIncomeProfile(id: string, updates: { amountCents?: number; restrictedUse?: boolean; name?: string }): void;
  removeIncomeProfile(id: string): void;
  snapshotProfile(month: Month): void;
  addExpenseSnapshot(snapshot: ExpenseSnapshot): void;
  getExpenseSnapshots(): ExpenseSnapshot[];
  addExpenseTemplate(name: string, defaultParticipants: string[], defaultSplitRule: SplitRule, category?: string): ExpenseTemplate;
  getExpenseTemplates(): ExpenseTemplate[];
  endExpenseTemplate(id: string): void;
  snapshotExpenses(month: Month): void;
  addGoal(name: string, participants: string[], targetAmountCents?: number, startAmountCents?: number): Goal;
  getGoals(): Goal[];
  endGoal(id: string): void;
  addGoalContribution(goalId: string, memberId: string, month: Month, amountCents: number): void;
  getGoalContributions(): GoalContribution[];
  getMonthData(month: Month): MonthData;
  replaceHousehold(data: MonthData): void;
  close(): void;
}
