import type {
  Expense,
  ExpenseAmount,
  IncomeSource,
  Member,
  MonthlySummary,
} from "@prometheus/engine";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, test, vi } from "vitest";
import App from "./App.vue";

const summary: MonthlySummary = {
  month: "2026-07",
  currency: "USD",
  members: [
    {
      memberId: "m1",
      name: "Ana",
      incomeCents: 500000,
      restrictedCents: 0,
      contributionCents: 0,
      shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }],
      totalCents: 75000,
      leftoverCents: 425000,
    },
    {
      memberId: "m2",
      name: "Bruno",
      incomeCents: 400000,
      restrictedCents: 0,
      contributionCents: 0,
      shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }],
      totalCents: 75000,
      leftoverCents: 325000,
    },
  ],
  pendingExpenses: [],
  pendingContributions: [],
  fallbackExpenses: [],
  fallbackContributions: [],
  goalProgress: [],
};

const memberList: Member[] = [
  { id: "m1", name: "Ana" },
  { id: "m2", name: "Bruno" },
];

const householdData = {
  currency: null as string | null,
  members: [] as Member[],
  incomeSources: [] as IncomeSource[],
  expenses: [] as Expense[],
  expenseAmounts: [] as ExpenseAmount[],
};

test("when no currency is set the setup screen appears", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/household") {
        return { ok: true, json: async () => ({ ...householdData }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );

  const wrapper = mount(App);
  await flushPromises();

  expect(wrapper.text()).toContain("Household Setup");
  expect(wrapper.text()).toContain("Currency");
});

test("when currency is set the dashboard renders members, income, expenses and leftover", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/household") {
        return {
          ok: true,
          json: async () => ({
            ...householdData,
            currency: "USD",
            members: memberList,
          }),
        };
      }
      if (typeof url === "string" && url.startsWith("/api/summary")) {
        return { ok: true, json: async () => summary };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );

  const wrapper = mount(App);
  await flushPromises();

  expect(wrapper.text()).toContain("2026-07");
  expect(wrapper.text()).toContain("Ana");
  expect(wrapper.text()).toContain("Bruno");
  expect(wrapper.text()).toContain("Income");
  expect(wrapper.text()).toContain("Expenses");
  expect(wrapper.text()).toContain("Leftover");
  expect(wrapper.text()).toMatch(/Rent/);
});
