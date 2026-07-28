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
}
