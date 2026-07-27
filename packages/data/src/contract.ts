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

  describe("currency", () => {
    test("getCurrency returns null when currency has not been set", () => {
      const store = makeStore(freshPath());
      expect(store.getCurrency()).toBeNull();
      store.close();
    });

    test("setCurrency stores the currency and persists it", () => {
      const path = freshPath();
      const first = makeStore(path);
      first.setCurrency("EUR");
      expect(first.getCurrency()).toBe("EUR");
      first.close();

      const second = makeStore(path);
      expect(second.getCurrency()).toBe("EUR");
      second.close();
    });

    test("setCurrency throws when currency is already set", () => {
      const store = makeStore(freshPath());
      store.setCurrency("EUR");
      expect(() => store.setCurrency("USD")).toThrow();
      expect(store.getCurrency()).toBe("EUR");
      store.close();
    });
  });

  describe("members", () => {
    test("addMember adds a member with a generated id", () => {
      const store = makeStore(freshPath());
      const member = store.addMember("Ana");
      expect(member.id).toBeTypeOf("string");
      expect(member.name).toBe("Ana");
      store.close();
    });

    test("getMembers returns members in insertion order", () => {
      const store = makeStore(freshPath());
      store.addMember("Ana");
      store.addMember("Bruno");
      const members = store.getMembers();
      expect(members).toHaveLength(2);
      expect(members[0]!.name).toBe("Ana");
      expect(members[1]!.name).toBe("Bruno");
      store.close();
    });

    test("renameMember changes the member's name", () => {
      const store = makeStore(freshPath());
      const member = store.addMember("Ana");
      store.renameMember(member.id, "Anna");
      expect(store.getMembers()[0]!.name).toBe("Anna");
      store.close();
    });

    test("renameMember persists the new name across reopen", () => {
      const path = freshPath();
      const first = makeStore(path);
      const member = first.addMember("Ana");
      first.renameMember(member.id, "Anna");
      first.close();

      const second = makeStore(path);
      expect(second.getMembers()[0]!.name).toBe("Anna");
      second.close();
    });

    test("renameMember throws when the member does not exist", () => {
      const store = makeStore(freshPath());
      expect(() => store.renameMember("nonexistent", "X")).toThrow();
      store.close();
    });
  });
}
