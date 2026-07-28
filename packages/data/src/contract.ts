import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import type { MonthData } from "@prometheus/engine";
import type { DataStore } from "./store.js";

const data: MonthData = {
  month: "2026-07",
  currency: "USD",
  members: [
    { id: "m1", name: "Ana" },
    { id: "m2", name: "Bruno" },
  ],
  incomeSnapshots: [
    { month: "2026-07", memberId: "m1", name: "Salary", amountCents: 500000 },
  ],
  expenseSnapshots: [
    {
      month: "2026-07",
      expenseId: "e1",
      name: "Rent",
      amountCents: 150000,
      participants: ["m1", "m2"],
      splitRule: { method: "even" },
    },
  ],
};

export function runDataStoreContract(makeStore: (path: string) => DataStore): void {
  const dirs: string[] = [];
  const freshPath = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "prometheus-data-"));
    dirs.push(dir);
    return join(dir, "test.db");
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  describe("data store contract", () => {
    test("round-trips a full household via replace/get", () => {
      const store = makeStore(freshPath());
      store.replaceHousehold(data);
      const result = store.getMonthData("2026-07");
      expect(result.members).toEqual(data.members);
      expect(result.incomeSnapshots).toEqual(data.incomeSnapshots);
      expect(result.expenseSnapshots).toEqual(data.expenseSnapshots);
      store.close();
    });

    test("persists across close and reopen", () => {
      const path = freshPath();
      const first = makeStore(path);
      first.replaceHousehold(data);
      first.close();
      const second = makeStore(path);
      expect(second.getMonthData("2026-07").members).toEqual(data.members);
      second.close();
    });

    test("income and expense snapshots are retrievable per month", () => {
      const store = makeStore(freshPath());
      store.replaceHousehold(data);
      store.addIncomeSnapshot({ month: "2026-08", memberId: "m1", name: "Salary", amountCents: 550000 });
      expect(store.getMonthData("2026-08").incomeSnapshots).toHaveLength(1);
      expect(store.getMonthData("2026-08").expenseSnapshots).toHaveLength(0);
      store.close();
    });
  });

  describe("income profiles", () => {
    test("add and retrieve income profiles", () => {
      const store = makeStore(freshPath());
      const p = store.addIncomeProfile("m1", "Salary", 500000);
      expect(p.name).toBe("Salary");
      expect(store.getIncomeProfiles()).toEqual([p]);
      store.close();
    });

    test("update profile changes amount", () => {
      const store = makeStore(freshPath());
      const p = store.addIncomeProfile("m1", "Salary", 500000);
      store.updateIncomeProfile(p.id, { amountCents: 600000 });
      expect(store.getIncomeProfiles()[0]!.amountCents).toBe(600000);
      store.close();
    });

    test("remove profile deletes it", () => {
      const store = makeStore(freshPath());
      const p = store.addIncomeProfile("m1", "Salary", 500000);
      store.removeIncomeProfile(p.id);
      expect(store.getIncomeProfiles()).toEqual([]);
      store.close();
    });

    test("snapshotProfile copies profiles into income snapshots for a month", () => {
      const store = makeStore(freshPath());
      store.addIncomeProfile("m1", "Salary", 500000, true);
      store.addIncomeProfile("m2", "Freelance", 80000);
      store.snapshotProfile("2026-07");
      const snaps = store.getMonthData("2026-07").incomeSnapshots;
      expect(snaps).toHaveLength(2);
      expect(snaps[0]!.restrictedUse).toBe(true);
      store.close();
    });

    test("snapshotProfile does not overwrite existing snapshots for other months", () => {
      const store = makeStore(freshPath());
      store.addIncomeProfile("m1", "Salary", 500000);
      store.snapshotProfile("2026-07");
      store.updateIncomeProfile(store.getIncomeProfiles()[0]!.id, { amountCents: 600000 });
      store.snapshotProfile("2026-08");
      expect(store.getMonthData("2026-07").incomeSnapshots[0]!.amountCents).toBe(500000);
      expect(store.getMonthData("2026-08").incomeSnapshots[0]!.amountCents).toBe(600000);
      store.close();
    });
  });

  describe("expense templates", () => {
    test("add and retrieve templates", () => {
      const store = makeStore(freshPath());
      const t = store.addExpenseTemplate("Rent", ["m1", "m2"], { method: "even" });
      expect(t.name).toBe("Rent");
      expect(store.getExpenseTemplates()).toEqual([t]);
      store.close();
    });

    test("endExpenseTemplate sets active to false", () => {
      const store = makeStore(freshPath());
      const t = store.addExpenseTemplate("Rent", ["m1"], { method: "even" });
      store.endExpenseTemplate(t.id);
      expect(store.getExpenseTemplates()[0]!.active).toBe(false);
      store.close();
    });

    test("snapshotExpenses copies previous month amounts to new month", () => {
      const store = makeStore(freshPath());
      store.addExpenseTemplate("Rent", ["m1", "m2"], { method: "even" });
      // Create a snapshot for July with amount 150000
      store.addExpenseSnapshot({ month: "2026-07", expenseId: store.getExpenseTemplates()[0]!.id, name: "Rent", amountCents: 150000, participants: ["m1", "m2"], splitRule: { method: "even" } });
      store.snapshotExpenses("2026-08");
      const snaps = store.getMonthData("2026-08").expenseSnapshots;
      expect(snaps).toHaveLength(1);
      expect(snaps[0]!.amountCents).toBe(150000);
      store.close();
    });

    test("snapshotExpenses does not overwrite existing snapshots", () => {
      const store = makeStore(freshPath());
      store.addExpenseTemplate("Rent", ["m1"], { method: "even" });
      store.addExpenseSnapshot({ month: "2026-08", expenseId: store.getExpenseTemplates()[0]!.id, name: "Rent", amountCents: 160000, participants: ["m1"], splitRule: { method: "even" } });
      store.snapshotExpenses("2026-08");
      expect(store.getMonthData("2026-08").expenseSnapshots[0]!.amountCents).toBe(160000);
      store.close();
    });

    test("snapshotExpenses does not create snapshot when no previous month exists (first-month stays pending)", () => {
      const store = makeStore(freshPath());
      store.addExpenseTemplate("Rent", ["m1"], { method: "even" });
      store.snapshotExpenses("2026-07");
      expect(store.getMonthData("2026-07").expenseSnapshots).toEqual([]);
      store.close();
    });
  });
}
