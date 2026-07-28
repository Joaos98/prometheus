import type { ExpenseSnapshot, IncomeSnapshot, Member, Month, MonthData } from "@prometheus/engine";

export interface IncomeProfile {
  id: string;
  memberId: string;
  name: string;
  amountCents: number;
  restrictedUse?: boolean;
}

export interface DataStore {
  getCurrency(): string | null;
  setCurrency(currency: string): void;
  addMember(name: string, joinedFrom?: Month): Member;
  getMembers(): Member[];
  addIncomeSnapshot(snapshot: IncomeSnapshot): void;
  getIncomeSnapshots(): IncomeSnapshot[];
  addIncomeProfile(memberId: string, name: string, amountCents: number, restrictedUse?: boolean): IncomeProfile;
  getIncomeProfiles(): IncomeProfile[];
  updateIncomeProfile(id: string, updates: { amountCents?: number; restrictedUse?: boolean; name?: string }): void;
  removeIncomeProfile(id: string): void;
  snapshotProfile(month: Month): void;
  addExpenseSnapshot(snapshot: ExpenseSnapshot): void;
  getExpenseSnapshots(): ExpenseSnapshot[];
  getMonthData(month: Month): MonthData;
  replaceHousehold(data: MonthData): void;
  close(): void;
}
