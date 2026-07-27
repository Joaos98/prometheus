import { expect, test } from "vitest";
import { computeMonthlySummary, validateCustomSplitRule, validateExpenseAmount } from "./index.js";
import type { Household, SplitRule } from "./index.js";

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
  goals: [],
  goalContributions: [],
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

test("an ended expense does not produce shares in or after the end Month", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        ...household.expenses[0]!,
        endedFrom: "2026-06",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-05", amountCents: 150000 }],
  };

  const may = computeMonthlySummary(h, "2026-05");
  expect(may.members[0]!.shares).toHaveLength(1);
  expect(may.members[0]!.totalCents).toBe(75000);

  const jun = computeMonthlySummary(h, "2026-06");
  expect(jun.members[0]!.shares).toEqual([]);
  expect(jun.members[0]!.totalCents).toBe(0);
  expect(jun.pendingExpenses).toHaveLength(0);
});

test("an active expense with no amount for the Month is flagged as pending and contributes nothing", () => {
  const h: Household = {
    ...household,
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
    expenseAmounts: [],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  expect(summary.pendingExpenses).toEqual([
    { itemId: "e1", itemName: "Rent" },
  ]);
  for (const member of summary.members) {
    expect(member.shares).toEqual([]);
    expect(member.totalCents).toBe(0);
  }
});

test("an explicit $0 amount is not flagged as pending (distinct from unentered)", () => {
  const h: Household = {
    ...household,
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
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 0 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  expect(summary.pendingExpenses).toEqual([]);
  for (const member of summary.members) {
    expect(member.totalCents).toBe(0);
  }
});

test("an expense with exactly one Participant divides the full amount to that person", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        id: "e1",
        name: "Gym",
        participants: ["m1"],
        splitRule: { method: "even" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 4000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(4000);
  expect(bruno.totalCents).toBe(0);
});

test("Leftover Balance = Spendable Income − Σ expense Shares, negative when expenses exceed income", () => {
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

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.leftoverCents).toBe(425000); // 500000 income - 75000 expense share
  expect(bruno.leftoverCents).toBe(-75000); // 0 income - 75000 expense share
});

test("a proportional split distributes shares weighted by each participant's income", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 600000, effectiveFrom: "2026-01" }],
      },
      {
        id: "is2",
        memberId: "m2",
        name: "Salary",
        timeline: [{ amountCents: 400000, effectiveFrom: "2026-01" }],
      },
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 100000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(60000); // 60% of 1000.00
  expect(bruno.totalCents).toBe(40000); // 40% of 1000.00
  expect(ana.totalCents + bruno.totalCents).toBe(100000);
  expect(summary.fallbackExpenses).toEqual([]);
});

test("a proportional split with leftover cents distributes them exactly to sum to the total", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
      },
      {
        id: "is2",
        memberId: "m2",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
      },
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 10001 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const total = summary.members.reduce((s, m) => s + m.totalCents, 0);
  expect(total).toBe(10001);
});

test("a zero-income participant gets a zero share from proportional split when others have income", () => {
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
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 100000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(100000);
  expect(bruno.totalCents).toBe(0);
});

test("when no participant has income, a proportional split falls back to even with a flag", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 100000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(50000);
  expect(bruno.totalCents).toBe(50000);
  expect(summary.fallbackExpenses).toEqual([
    { itemId: "e1", itemName: "Rent" },
  ]);
});

test("validateCustomSplitRule: percent mode rejects when sum != 100", () => {
  const rule: SplitRule = {
    method: "custom",
    mode: "percent",
    values: { m1: 60, m2: 30 },
  };
  const error = validateCustomSplitRule(rule);
  expect(error).toBe("Percentages sum to 90 — must total exactly 100");
});

test("validateCustomSplitRule: percent mode accepts exact 100", () => {
  const rule: SplitRule = {
    method: "custom",
    mode: "percent",
    values: { m1: 60, m2: 40 },
  };
  expect(validateCustomSplitRule(rule)).toBeNull();
});

test("validateCustomSplitRule: non-custom rules pass validation", () => {
  expect(validateCustomSplitRule({ method: "even" })).toBeNull();
  expect(validateCustomSplitRule({ method: "proportional" })).toBeNull();
});

test("validateExpenseAmount: amount mode rejects when amount != sum of values", () => {
  const expense = {
    id: "e1",
    name: "Rent",
    participants: ["m1", "m2"],
    effectiveFrom: "2026-01",
    splitRule: {
      method: "custom" as const,
      mode: "amount" as const,
      values: { m1: 90000, m2: 60000 },
    },
  };
  const error = validateExpenseAmount(expense, 200000);
  expect(error).toBe(
    "Amount (200000) must equal the sum of fixed shares (150000)",
  );
});

test("validateExpenseAmount: amount mode accepts when amount equals sum", () => {
  const expense = {
    id: "e1",
    name: "Rent",
    participants: ["m1", "m2"],
    effectiveFrom: "2026-01",
    splitRule: {
      method: "custom" as const,
      mode: "amount" as const,
      values: { m1: 90000, m2: 60000 },
    },
  };
  expect(validateExpenseAmount(expense, 150000)).toBeNull();
});

test("validateExpenseAmount: non-custom expenses pass validation", () => {
  const expense = {
    id: "e1",
    name: "Rent",
    participants: ["m1"],
    effectiveFrom: "2026-01",
    splitRule: { method: "even" as const },
  };
  expect(validateExpenseAmount(expense, 100000)).toBeNull();
});

test("custom percent split distributes shares by percentage, summing exactly to the total", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: {
          method: "custom",
          mode: "percent",
          values: { m1: 60, m2: 40 },
        },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 100000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(60000);
  expect(bruno.totalCents).toBe(40000);
  expect(ana.totalCents + bruno.totalCents).toBe(100000);
});

test("custom percent split with leftover cents distributes them exactly", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: {
          method: "custom",
          mode: "percent",
          values: { m1: 50, m2: 50 },
        },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 10001 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");
  const total = summary.members.reduce((s, m) => s + m.totalCents, 0);
  expect(total).toBe(10001);
});

test("custom amount split gives each participant their fixed amount", () => {
  const h: Household = {
    ...household,
    incomeSources: [],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: {
          method: "custom",
          mode: "amount",
          values: { m1: 90000, m2: 60000 },
        },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 150000 }],
  };

  const summary = computeMonthlySummary(h, "2026-07");

  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;
  expect(ana.totalCents).toBe(90000);
  expect(bruno.totalCents).toBe(60000);
  expect(ana.totalCents + bruno.totalCents).toBe(150000);
});

test("state changes effective from M never leak into months earlier than M", () => {
  const h: Household = {
    ...household,
    incomeSources: [
      {
        id: "is1",
        memberId: "m1",
        name: "Salary",
        timeline: [
          { amountCents: 400000, effectiveFrom: "2026-01" },
          { amountCents: 600000, effectiveFrom: "2026-06" },
        ],
      },
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [
      { expenseId: "e1", month: "2026-05", amountCents: 100000 },
      { expenseId: "e1", month: "2026-07", amountCents: 100000 },
    ],
  };

  // May: income is still 400k (600k starts June); Ana gets 100% of 100000
  const may = computeMonthlySummary(h, "2026-05");
  expect(
    may.members.find((m) => m.memberId === "m1")!.incomeCents,
  ).toBe(400000);
  expect(
    may.members.find((m) => m.memberId === "m1")!.totalCents,
  ).toBe(100000);

  // July: income is 600k; Ana still gets 100% (Bruno has 0 income)
  const jul = computeMonthlySummary(h, "2026-07");
  expect(
    jul.members.find((m) => m.memberId === "m1")!.incomeCents,
  ).toBe(600000);
  expect(
    jul.members.find((m) => m.memberId === "m1")!.totalCents,
  ).toBe(100000);

  // Verify May is untouched after computing July
  const mayAgain = computeMonthlySummary(h, "2026-05");
  expect(mayAgain).toEqual(may);
});

test("a one-off income source affects exactly its own Month and carries nothing forward", () => {
  const h: Household = {
    currency: "USD",
    members: [
      { id: "m1", name: "Ana" },
      { id: "m2", name: "Bruno" },
    ],
    incomeSources: [
      {
        id: "bonus",
        memberId: "m1",
        name: "Bonus",
        timeline: [{ amountCents: 50000, effectiveFrom: "2026-03" }],
        endedFrom: "2026-04",
      },
    ],
    expenses: [],
    expenseAmounts: [],
    goals: [],
    goalContributions: [],
  };

  expect(
    computeMonthlySummary(h, "2026-02").members[0]!.incomeCents,
  ).toBe(0);
  expect(
    computeMonthlySummary(h, "2026-03").members[0]!.incomeCents,
  ).toBe(50000);
  expect(
    computeMonthlySummary(h, "2026-04").members[0]!.incomeCents,
  ).toBe(0);
});

test("a one-off expense affects exactly its own Month and nothing before or after", () => {
  const h: Household = {
    currency: "USD",
    members: [{ id: "m1", name: "Ana" }],
    incomeSources: [],
    expenses: [
      {
        id: "repair",
        name: "Repair",
        participants: ["m1"],
        splitRule: { method: "even" },
        effectiveFrom: "2026-05",
        endedFrom: "2026-06",
      },
    ],
    expenseAmounts: [{ expenseId: "repair", month: "2026-05", amountCents: 20000 }],
    goals: [],
    goalContributions: [],
  };

  expect(computeMonthlySummary(h, "2026-04").members[0]!.totalCents).toBe(0);
  expect(computeMonthlySummary(h, "2026-05").members[0]!.totalCents).toBe(20000);
  expect(computeMonthlySummary(h, "2026-06").members[0]!.totalCents).toBe(0);
});

test("proportional split uses Spendable Income, excluding restricted-use sources", () => {
  const h: Household = {
    currency: "USD",
    members: [
      { id: "m1", name: "Ana" },
      { id: "m2", name: "Bruno" },
    ],
    incomeSources: [
      {
        id: "salary1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
      },
      {
        id: "voucher",
        memberId: "m1",
        name: "Meal Voucher",
        timeline: [{ amountCents: 80000, effectiveFrom: "2026-01" }],
        restrictedUse: true,
      },
      {
        id: "salary2",
        memberId: "m2",
        name: "Salary",
        timeline: [{ amountCents: 400000, effectiveFrom: "2026-01" }],
      },
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1", "m2"],
        splitRule: { method: "proportional" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 90000 }],
    goals: [],
    goalContributions: [],
  };

  const summary = computeMonthlySummary(h, "2026-07");
  const ana = summary.members.find((m) => m.memberId === "m1")!;
  const bruno = summary.members.find((m) => m.memberId === "m2")!;

  // Ana: spendable=500000, Bruno: spendable=400000 → Ana 5/9, Bruno 4/9
  expect(ana.incomeCents).toBe(580000); // total including restricted
  expect(ana.restrictedCents).toBe(80000);
  expect(ana.totalCents).toBe(50000); // 5/9 of 90000
  expect(bruno.incomeCents).toBe(400000);
  expect(bruno.restrictedCents).toBe(0);
  expect(bruno.totalCents).toBe(40000); // 4/9 of 90000
});

test("Leftover Balance defaults to Spendable Income minus expense Shares", () => {
  const h: Household = {
    currency: "USD",
    members: [{ id: "m1", name: "Ana" }],
    incomeSources: [
      {
        id: "s1",
        memberId: "m1",
        name: "Salary",
        timeline: [{ amountCents: 500000, effectiveFrom: "2026-01" }],
      },
      {
        id: "v1",
        memberId: "m1",
        name: "Voucher",
        timeline: [{ amountCents: 50000, effectiveFrom: "2026-01" }],
        restrictedUse: true,
      },
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        participants: ["m1"],
        splitRule: { method: "even" },
        effectiveFrom: "2026-01",
      },
    ],
    expenseAmounts: [{ expenseId: "e1", month: "2026-07", amountCents: 300000 }],
    goals: [],
    goalContributions: [],
  };

  const summary = computeMonthlySummary(h, "2026-07");
  const ana = summary.members[0]!;
  expect(ana.leftoverCents).toBe(200000); // (500000 - 50000 restricted) - 300000
});
