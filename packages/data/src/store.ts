import type { ExpenseSnapshot, IncomeSnapshot, Member, Month, MonthData } from "@prometheus/engine";

export interface DataStore {
  getCurrency(): string | null;
  setCurrency(currency: string): void;
  addMember(name: string, joinedFrom?: Month): Member;
  getMembers(): Member[];
  addIncomeSnapshot(snapshot: IncomeSnapshot): void;
  getIncomeSnapshots(): IncomeSnapshot[];
  addExpenseSnapshot(snapshot: ExpenseSnapshot): void;
  getExpenseSnapshots(): ExpenseSnapshot[];
  getMonthData(month: Month): MonthData;
  replaceHousehold(data: MonthData): void;
  close(): void;
}
