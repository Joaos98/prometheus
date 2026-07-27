import type { Household, Member } from "@prometheus/engine";

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

  // Whole-household (seed / contract)
  getHousehold(): Household;
  replaceHousehold(household: Household): void;
  close(): void;
}
