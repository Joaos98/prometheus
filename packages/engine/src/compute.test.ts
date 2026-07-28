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
  expect(ana.shares).toEqual([{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }]);
  expect(bruno.shares).toEqual([{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }]);
  expect(ana.leftoverCents).toBe(425000);
  expect(bruno.leftoverCents).toBe(-75000);
  expect(summary.pendingExpenses).toEqual([]);
});

test("largest-remainder distributes leftover cents deterministically", () => {
  const d: MonthData = { ...data, expenseSnapshots: [{ ...data.expenseSnapshots[0]!, amountCents: 10001 }] };
  const s = computeMonthlySummary(d);
  expect(s.members[0]!.shares[0]!.amountCents).toBe(5001);
  expect(s.members[1]!.shares[0]!.amountCents).toBe(5000);
  expect(s.members[0]!.shares[0]!.amountCents + s.members[1]!.shares[0]!.amountCents).toBe(10001);
});

test("repeated computation of the same inputs produces identical results", () => {
  expect(computeMonthlySummary(data)).toEqual(computeMonthlySummary(data));
});

test("proportional split weights shares by Spendable Income", () => {
  const d: MonthData = {
    ...data,
    incomeSnapshots: [
      { month: "2026-07", memberId: "m1", name: "Salary", amountCents: 600000 },
      { month: "2026-07", memberId: "m2", name: "Salary", amountCents: 400000 },
    ],
    expenseSnapshots: [{
      month: "2026-07", expenseId: "e1", name: "Rent", amountCents: 100000,
      participants: ["m1", "m2"], splitRule: { method: "proportional" },
    }],
  };
  const s = computeMonthlySummary(d);
  expect(s.members[0]!.totalCents).toBe(60000); // 60%
  expect(s.members[1]!.totalCents).toBe(40000); // 40%
});

test("proportional split uses Spendable Income (excludes restricted)", () => {
  const d: MonthData = {
    ...data,
    incomeSnapshots: [
      { month: "2026-07", memberId: "m1", name: "Salary", amountCents: 500000 },
      { month: "2026-07", memberId: "m1", name: "Voucher", amountCents: 80000, restrictedUse: true },
      { month: "2026-07", memberId: "m2", name: "Salary", amountCents: 400000 },
    ],
    expenseSnapshots: [{
      month: "2026-07", expenseId: "e1", name: "Rent", amountCents: 90000,
      participants: ["m1", "m2"], splitRule: { method: "proportional" },
    }],
  };
  const s = computeMonthlySummary(d);
  // Ana spendable = 500000, Bruno = 400000 → 5/9, 4/9
  expect(s.members[0]!.totalCents).toBe(50000);
  expect(s.members[1]!.totalCents).toBe(40000);
  // Ana leftover = 500000 spendable - 50000 shares = 450000
  expect(s.members[0]!.leftoverCents).toBe(450000);
});

test("custom amount split gives each participant their fixed amount", () => {
  const d: MonthData = {
    ...data,
    expenseSnapshots: [{
      month: "2026-07", expenseId: "e1", name: "Rent", amountCents: 150000,
      participants: ["m1", "m2"],
      splitRule: { method: "custom", mode: "amount", values: { m1: 90000, m2: 60000 } },
    }],
  };
  const s = computeMonthlySummary(d);
  expect(s.members[0]!.totalCents).toBe(90000);
  expect(s.members[1]!.totalCents).toBe(60000);
});

test("custom percent split distributes by percentage with rounding exactness", () => {
  const d: MonthData = {
    ...data,
    expenseSnapshots: [{
      month: "2026-07", expenseId: "e1", name: "Rent", amountCents: 100000,
      participants: ["m1", "m2"],
      splitRule: { method: "custom", mode: "percent", values: { m1: 60, m2: 40 } },
    }],
  };
  const s = computeMonthlySummary(d);
  expect(s.members[0]!.totalCents).toBe(60000);
  expect(s.members[1]!.totalCents).toBe(40000);
});

test("goal contributions are summed per member and pending goals are flagged", () => {
  const d: MonthData = {
    ...data,
    goals: [
      { id: "g1", name: "Car Fund", participants: ["m1", "m2"], active: true },
      { id: "g2", name: "Vacation", participants: ["m1"], active: true, startAmountCents: 10000 },
    ],
    goalContributions: [
      { goalId: "g1", memberId: "m1", month: "2026-07", amountCents: 30000 },
      { goalId: "g1", memberId: "m2", month: "2026-07", amountCents: 20000 },
    ],
  };
  const s = computeMonthlySummary(d);
  expect(s.goalProgress).toHaveLength(2);
  expect(s.goalProgress.find(g => g.goalId === "g1")!.accumulatedCents).toBe(50000);
  expect(s.goalProgress.find(g => g.goalId === "g2")!.accumulatedCents).toBe(10000); // startAmount only
  expect(s.pendingContributions).toEqual([{ goalId: "g2", goalName: "Vacation" }]);
  expect(s.members[0]!.leftoverCents).toBe(425000 - 30000); // spendable 500k - 75k rent - 30k goal
});

test("inactive goals are excluded from progress", () => {
  const d: MonthData = {
    ...data,
    goals: [
      { id: "g1", name: "Car Fund", participants: ["m1"], active: false, startAmountCents: 50000 },
    ],
    goalContributions: [],
  };
  const s = computeMonthlySummary(d);
  expect(s.goalProgress).toEqual([]);
  expect(s.pendingContributions).toEqual([]);
});
