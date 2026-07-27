import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { Household, IncomeSource, Month } from "@prometheus/engine";
import type { DataStore } from "./store.js";

const household: Household = {
  currency: "USD",
  members: [
    { id: "m1", name: "Ana" },
    { id: "m2", name: "Bruno" },
  ],
  incomeSources: [],
  goals: [],
  goalContributions: [],
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

  describe("income sources", () => {
    const month: Month = "2026-01";

    test("addIncomeSource returns a source with the correct shape", () => {
      const store = makeStore(freshPath());
      const source = store.addIncomeSource("m1", "Salary", 500000, month);
      expect(source.id).toBeTypeOf("string");
      expect(source.memberId).toBe("m1");
      expect(source.name).toBe("Salary");
      expect(source.timeline).toEqual([
        { amountCents: 500000, effectiveFrom: month },
      ]);
      store.close();
    });

    test("getIncomeSources returns all stored sources", () => {
      const store = makeStore(freshPath());
      store.addIncomeSource("m1", "Salary", 500000, month);
      store.addIncomeSource("m2", "Gig", 80000, month);
      const sources = store.getIncomeSources();
      expect(sources).toHaveLength(2);
      store.close();
    });

    test("updateIncomeSourceAmount appends a new timeline entry", () => {
      const store = makeStore(freshPath());
      const source = store.addIncomeSource("m1", "Salary", 400000, "2026-01");
      store.updateIncomeSourceAmount(source.id, 500000, "2026-04");
      const reloaded = store.getIncomeSources()[0]!;
      expect(reloaded.timeline).toHaveLength(2);
      expect(reloaded.timeline[1]).toEqual({
        amountCents: 500000,
        effectiveFrom: "2026-04",
      });
      store.close();
    });

    test("endIncomeSource sets the endedFrom Month", () => {
      const store = makeStore(freshPath());
      const source = store.addIncomeSource("m1", "Salary", 500000, "2026-01");
      store.endIncomeSource(source.id, "2026-06");
      expect(store.getIncomeSources()[0]!.endedFrom).toBe("2026-06");
      store.close();
    });

    test("income source data persists across close and reopen", () => {
      const path = freshPath();
      const first = makeStore(path);
      const source = first.addIncomeSource("m1", "Salary", 500000, "2026-01");
      first.updateIncomeSourceAmount(source.id, 600000, "2026-04");
      first.endIncomeSource(source.id, "2026-09");
      first.close();

      const second = makeStore(path);
      const sources = second.getIncomeSources();
      expect(sources).toHaveLength(1);
      expect(sources[0]!.timeline).toHaveLength(2);
      expect(sources[0]!.endedFrom).toBe("2026-09");
      second.close();
    });
  });

  describe("expenses", () => {
    test("addExpense returns an expense with the given split rule", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1", "m2"], { method: "even" }, "2026-01");
      expect(expense.splitRule).toEqual({ method: "even" });
      store.close();
    });

    test("addExpense accepts a proportional split rule", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1", "m2"], { method: "proportional" }, "2026-01");
      expect(expense.splitRule).toEqual({ method: "proportional" });
      store.close();
    });

    test("getExpenses returns all stored expenses", () => {
      const store = makeStore(freshPath());
      store.addExpense("Rent", ["m1"], { method: "even" }, "2026-01");
      store.addExpense("Groceries", ["m1", "m2"], { method: "even" }, "2026-02");
      expect(store.getExpenses()).toHaveLength(2);
      store.close();
    });

    test("endExpense sets endedFrom", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1"], { method: "even" }, "2026-01");
      store.endExpense(expense.id, "2026-06");
      expect(store.getExpenses()[0]!.endedFrom).toBe("2026-06");
      store.close();
    });

    test("setExpenseAmount stores a per-Month amount", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1"], { method: "even" }, "2026-01");
      store.setExpenseAmount(expense.id, "2026-07", 150000);
      const amounts = store.getExpenseAmounts();
      expect(amounts).toHaveLength(1);
      expect(amounts[0]).toEqual({
        expenseId: expense.id,
        month: "2026-07",
        amountCents: 150000,
      });
      store.close();
    });

    test("setExpenseAmount to 0 is stored explicitly (not treated as missing)", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1"], { method: "even" }, "2026-01");
      store.setExpenseAmount(expense.id, "2026-07", 0);
      expect(store.getExpenseAmounts()[0]!.amountCents).toBe(0);
      store.close();
    });

    test("expense amounts persist across close and reopen", () => {
      const path = freshPath();
      const first = makeStore(path);
      const expense = first.addExpense("Rent", ["m1", "m2"], { method: "even" }, "2026-01");
      first.setExpenseAmount(expense.id, "2026-07", 152000);
      first.endExpense(expense.id, "2026-12");
      first.close();

      const second = makeStore(path);
      expect(second.getExpenses()[0]!.endedFrom).toBe("2026-12");
      expect(second.getExpenseAmounts()[0]!.amountCents).toBe(152000);
      second.close();
    });

    test("changeExpenseSplitRule ends the old expense and creates a new one with the new rule", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1", "m2"], { method: "even" }, "2026-01");
      const changed = store.changeExpenseSplitRule(expense.id, { method: "proportional" }, "2026-04");
      const all = store.getExpenses();
      expect(all).toHaveLength(2);
      expect(all[0]!.endedFrom).toBe("2026-04");
      expect(changed.splitRule).toEqual({ method: "proportional" });
      expect(changed.effectiveFrom).toBe("2026-04");
      store.close();
    });

    test("changeExpenseParticipants ends old expense and creates new one with new participants", () => {
      const store = makeStore(freshPath());
      const expense = store.addExpense("Rent", ["m1", "m2"], { method: "even" }, "2026-01");
      const changed = store.changeExpenseParticipants(expense.id, ["m1"], "2026-06");
      expect(changed.participants).toEqual(["m1"]);
      expect(changed.effectiveFrom).toBe("2026-06");
      store.close();
    });
  });

  describe("goals", () => {
    test("addGoal with startAmountCents stores and retrieves it", () => {
      const store = makeStore(freshPath());
      const goal = store.addGoal("Car", ["m1"], { method: "even" }, 500000, 100000, "2026-01");
      expect(goal.startAmountCents).toBe(100000);
      const goals = store.getGoals();
      expect(goals[0]!.startAmountCents).toBe(100000);
      store.close();
    });
  });
}
