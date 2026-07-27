import type { Expense, ExpenseAmount, Household, IncomeSource, Member, Month, SplitRule } from "@prometheus/engine";

/**
 * The single internal data-access interface. All persistence flows through
 * it; the self-hosted and future demo adapters both satisfy this contract,
 * swapped at build time.
 */
export interface DataStore {
  // Household config
  getCurrency(): string | null;
  setCurrency(currency: string): void;

  // Members
  addMember(name: string): Member;
  getMembers(): Member[];
  renameMember(id: string, name: string): void;

  // Income sources
  addIncomeSource(
    memberId: string,
    name: string,
    amountCents: number,
    effectiveFrom: Month,
  ): IncomeSource;
  getIncomeSources(): IncomeSource[];
  updateIncomeSourceAmount(
    id: string,
    amountCents: number,
    effectiveFrom: Month,
  ): void;
  endIncomeSource(id: string, effectiveFrom: Month): void;

  // Expenses
  addExpense(
    name: string,
    participants: string[],
    splitRule: SplitRule,
    effectiveFrom: Month,
  ): Expense;
  getExpenses(): Expense[];
  endExpense(id: string, effectiveFrom: Month): void;
  changeExpenseSplitRule(
    id: string,
    splitRule: SplitRule,
    effectiveFrom: Month,
  ): Expense;
  changeExpenseParticipants(
    id: string,
    participants: string[],
    effectiveFrom: Month,
  ): Expense;
  setExpenseAmount(
    expenseId: string,
    month: Month,
    amountCents: number,
  ): void;
  getExpenseAmounts(): ExpenseAmount[];

  // Whole-household (seed / contract)
  getHousehold(): Household;
  replaceHousehold(household: Household): void;
  close(): void;
}
