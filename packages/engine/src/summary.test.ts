import { expect, test } from "vitest";
import { computeMonthlySummary } from "./index.js";
import type { Household } from "./index.js";

const household: Household = {
  currency: "USD",
  members: [
    { id: "m1", name: "Ana" },
    { id: "m2", name: "Bruno" },
  ],
  incomeSources: [],
  expenses: [
    {
      id: "e1",
      name: "Rent",
      participants: ["m1", "m2"],
      splitRule: { method: "even" },
      effectiveFrom: "2026-01",
    },
  ],
  expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 150000 }],
};

test("an even split divides the expense equally among its participants", () => {
  const summary = computeMonthlySummary(household, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1");
  const bruno = summary.members.find((m) => m.memberId === "m2");
  expect(ana?.shares).toEqual([
    { expenseId: "e1", expenseName: "Rent", amountCents: 75000 },
  ]);
  expect(bruno?.shares).toEqual([
    { expenseId: "e1", expenseName: "Rent", amountCents: 75000 },
  ]);
});

test("leftover cents are distributed to the first participants in member order, summing exactly to the total", () => {
  const odd: Household = {
    ...household,
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 10001 }],
  };
  const summary = computeMonthlySummary(odd, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1");
  const bruno = summary.members.find((m) => m.memberId === "m2");
  expect(ana?.shares[0]?.amountCents).toBe(5001);
  expect(bruno?.shares[0]?.amountCents).toBe(5000);
  const total = summary.members.reduce(
    (sum, m) => sum + (m.shares[0]?.amountCents ?? 0),
    0,
  );
  expect(total).toBe(10001);
});

test("member order, not participants array order, decides who takes leftover cents", () => {
  const reversed: Household = {
    ...household,
    expenses: [{ ...household.expenses[0]!, participants: ["m2", "m1"] }],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 10001 }],
  };
  const summary = computeMonthlySummary(reversed, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1");
  const bruno = summary.members.find((m) => m.memberId === "m2");
  expect(ana?.shares[0]?.amountCents).toBe(5001);
  expect(bruno?.shares[0]?.amountCents).toBe(5000);
});

test("repeated computation of the same inputs produces identical results", () => {
  const first = computeMonthlySummary(household, "2026-07");
  const second = computeMonthlySummary(household, "2026-07");
  expect(second).toEqual(first);
});

test("an expense effective from a later month does not appear in earlier months", () => {
  const summary = computeMonthlySummary(household, "2025-12");
  for (const member of summary.members) {
    expect(member.shares).toEqual([]);
    expect(member.totalCents).toBe(0);
  }
});

test("the summary contains exactly one row per household member", () => {
  const three: Household = {
    ...household,
    members: [
      { id: "m1", name: "Ana" },
      { id: "m2", name: "Bruno" },
      { id: "m3", name: "Carlos" },
    ],
  };
  const summary = computeMonthlySummary(three, "2026-07");
  expect(summary.members).toHaveLength(3);
  expect(summary.members[0]?.memberId).toBe("m1");
  expect(summary.members[1]?.memberId).toBe("m2");
  expect(summary.members[2]?.memberId).toBe("m3");
});

test("income carries forward: a source set once appears in every later Month", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
      },
    ],
  };

  const jan = computeMonthlySummary(h, "2026-01");
  const jul = computeMonthlySummary(h, "2026-07");

  expect(jan.members.find((m) => m.memberId === "m1")!.incomeCents).toBe(
    500000,
  );
  expect(jul.members.find((m) => m.memberId === "m1")!.incomeCents).toBe(
    500000,
  );
});

test("updating a source amount from M changes M onward, not earlier Months", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [
          { amountCents: 400000, effectiveFrom: "2026-01" },
          { amountCents: 500000, effectiveFrom: "2026-04" },
        ],
      },
    ],
  };

  expect(
    computeMonthlySummary(h, "2026-03").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(400000);
  expect(
    computeMonthlySummary(h, "2026-04").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(500000);
  expect(
    computeMonthlySummary(h, "2026-07").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(500000);
});

test("ending a source from M removes it from M onward", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
        endedFrom: "2026-06",
      },
    ],
  };

  expect(
    computeMonthlySummary(h, "2026-05").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(500000);
  expect(
    computeMonthlySummary(h, "2026-06").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(0);
});

test("multiple sources per member sum to the member's Income", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 400000, effectiveFrom: "2026-01" }],
      },
      {
        id: "is2",
        memberId: "m1",
        name: "Freelance",
        timeline: [{ amountCents: 80000, effectiveFrom: "2026-01" }],
      },
    ],
  };

  expect(
    computeMonthlySummary(h, "2026-07").members.find(
      (m) => m.memberId === "m1",
    )!.incomeCents,
  ).toBe(480000);
});
