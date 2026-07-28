import { expect, test } from "vitest";
import { computeMonthlySummary, type MonthData } from "./index.js";

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

test("even split divides equally, summing exactly to the total", () => {
  const summary = computeMonthlySummary(data);
  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;

  expect(ana.shares).toEqual([
    { expenseId: "e1", expenseName: "Rent", amountCents: 75000 },
  ]);
  expect(bruno.shares).toEqual([
    { expenseId: "e1", expenseName: "Rent", amountCents: 75000 },
  ]);
  expect(ana.leftoverCents).toBe(425000); // 500000 - 75000
  expect(bruno.leftoverCents).toBe(-75000); // 0 - 75000
});

test("largest-remainder distributes leftover cents deterministically", () => {
  const d: MonthData = {
    ...data,
    expenseSnapshots: [
      { ...data.expenseSnapshots[0]!, amountCents: 10001 },
    ],
  };
  const summary = computeMonthlySummary(d);
  const ana = summary.members[0]!;
  const bruno = summary.members[1]!;
  expect(ana.shares[0]!.amountCents).toBe(5001);
  expect(bruno.shares[0]!.amountCents).toBe(5000);
  expect(ana.shares[0]!.amountCents + bruno.shares[0]!.amountCents).toBe(10001);
});

test("repeated computation of the same inputs produces identical results", () => {
  expect(computeMonthlySummary(data)).toEqual(computeMonthlySummary(data));
});
