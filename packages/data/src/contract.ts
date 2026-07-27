import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { Household } from "@prometheus/engine";
import type { DataStore } from "./store.js";

const household: Household = {
  currency: "USD",
  members: [
    { id: "m1", name: "Ana" },
    { id: "m2", name: "Bruno" },
  ],
  expenses: [
    {
      id: "e1",
      name: "Rent",
      participants: ["m1", "m2"],
      splitRule: { method: "even" },
      effectiveFrom: "2026-01",
    },
  ],
  expenseAmounts: [
    { expenseId: "e1", month: "2026-06", amountCents: 150000 },
    { expenseId: "e1", month: "2026-07", amountCents: 152000 },
  ],
};

/**
 * The data-layer contract suite. Every adapter — self-hosted now, demo mock
 * later — runs these same tests; passing them is what makes the build-time
 * swap safe.
 */
export function runDataStoreContract(
  makeStore: (path: string) => DataStore,
): void {
  const dirs: string[] = [];
  const freshPath = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "prometheus-data-"));
    dirs.push(dir);
    return join(dir, "test.db");
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("data store contract", () => {
    test("returns the household that was stored", () => {
      const store = makeStore(freshPath());
      store.replaceHousehold(household);
      expect(store.getHousehold()).toEqual(household);
      store.close();
    });

    test("persists the household across close and reopen", () => {
      const path = freshPath();
      const first = makeStore(path);
      first.replaceHousehold(household);
      first.close();

      const second = makeStore(path);
      expect(second.getHousehold()).toEqual(household);
      second.close();
    });

    test("replacing the household discards the previous one", () => {
      const store = makeStore(freshPath());
      store.replaceHousehold(household);
      store.replaceHousehold({
        ...household,
        members: [{ id: "m3", name: "Carlos" }],
      });
      const result = store.getHousehold();
      expect(result.members).toEqual([{ id: "m3", name: "Carlos" }]);
      store.close();
    });
  });
}
