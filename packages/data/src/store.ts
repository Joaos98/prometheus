import type { Expense, ExpenseAmount, GoalContribution, Household, IncomeSource, Member, Month, SavingsGoal, SplitRule } from "@prometheus/engine";

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
  addMember(name: string, joinedFrom?: Month): Member;
  getMembers(): Member[];
  renameMember(id: string, name: string): void;
  departMember(id: string, effectiveFrom: Month): void;

  // Income sources
  addIncomeSource(
    memberId: string,
    name: string,
    amountCents: number,
    effectiveFrom: Month,
    restrictedUse?: boolean,
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

  // Goals
  addGoal(
    name: string,
    participants: string[],
    splitRule: SplitRule,
    targetAmountCents: number | undefined,
    startAmountCents: number | undefined,
    effectiveFrom: Month,
  ): SavingsGoal;
  getGoals(): SavingsGoal[];
  endGoal(id: string, effectiveFrom: Month): void;
  setGoalContribution(
    goalId: string,
    month: Month,
    amountCents: number,
  ): void;
  getGoalContributions(): GoalContribution[];

  // Whole-household (seed / contract)
  getHousehold(): Household;
  replaceHousehold(household: Household): void;
  close(): void;
}
