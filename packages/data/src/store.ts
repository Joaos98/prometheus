import type { Household } from "@prometheus/engine";

/**
 * The single internal data-access interface. All persistence flows through
 * it; the self-hosted and future demo adapters both satisfy this contract,
 * swapped at build time.
 */
export interface DataStore {
  getHousehold(): Household;
  replaceHousehold(household: Household): void;
  close(): void;
}
