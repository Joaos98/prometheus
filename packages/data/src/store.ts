import type { Household, IncomeSource, Member, Month } from "@prometheus/engine";

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

  // Whole-household (seed / contract)
  getHousehold(): Household;
  replaceHousehold(household: Household): void;
  close(): void;
}
