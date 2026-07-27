import type { Expense, ExpenseAmount, IncomeSource, Member, MonthlySummary, SavingsGoal } from "@prometheus/engine";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, test, vi } from "vitest";
import App from "./App.vue";

const summary: MonthlySummary = {
  month: "2026-07", currency: "USD",
  members: [
    { memberId: "m1", name: "Ana", incomeCents: 500000, restrictedCents: 0, contributionCents: 0, shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }], totalCents: 75000, leftoverCents: 425000 },
    { memberId: "m2", name: "Bruno", incomeCents: 400000, restrictedCents: 0, contributionCents: 0, shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }], totalCents: 75000, leftoverCents: 325000 },
  ],
  pendingExpenses: [], pendingContributions: [], fallbackExpenses: [], fallbackContributions: [], goalProgress: [],
};
const memberList: Member[] = [{ id: "m1", name: "Ana" }, { id: "m2", name: "Bruno" }];
const expense: Expense = { id: "e1", name: "Rent", participants: ["m1", "m2"], splitRule: { method: "even" }, effectiveFrom: "2026-01" };
const was: ExpenseAmount = { expenseId: "e1", month: "2026-07", amountCents: 150000 };

test("when no currency is set the setup screen appears", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/household") return { ok: true, json: async () => ({ currency: null, members: [], incomeSources: [], expenses: [], expenseAmounts: [], goals: [] }) };
    throw new Error(`unexpected fetch: ${url}`);
  }));
  const wrapper = mount(App);
  await flushPromises();
  expect(wrapper.text()).toContain("Welcome to Prometheus");
  expect(wrapper.text()).toContain("Currency");
});

test("when currency is set the overview page renders balance cards", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/household") return { ok: true, json: async () => ({ currency: "USD", members: memberList, incomeSources: [], expenses: [expense], expenseAmounts: [was], goals: [] as SavingsGoal[] }) };
    if (typeof url === "string" && url.startsWith("/api/summary")) return { ok: true, json: async () => summary };
    throw new Error(`unexpected fetch: ${url}`);
  }));
  const wrapper = mount(App);
  await flushPromises();
  expect(wrapper.text()).toContain("Prometheus");
  expect(wrapper.text()).toContain("Overview");
  expect(wrapper.text()).toContain("Ana");
  expect(wrapper.text()).toContain("Bruno");
  expect(wrapper.text()).toContain("Active expenses");
  expect(wrapper.text()).toContain("Goal progress");
  expect(wrapper.text()).toContain("Leftover");
});
