import type { MonthlySummary } from "@prometheus/engine";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, test, vi } from "vitest";
import App from "./App.vue";

const summary: MonthlySummary = {
  month: "2026-07",
  currency: "USD",
  members: [
    { memberId: "m1", name: "Ana", incomeCents: 500000, shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }], totalCents: 75000, leftoverCents: 425000 },
    { memberId: "m2", name: "Bruno", incomeCents: 0, shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }], totalCents: 75000, leftoverCents: -75000 },
  ],
};

test("dashboard renders member names and their shares", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => summary })));
  const wrapper = mount(App);
  await flushPromises();
  expect(wrapper.text()).toContain("Ana");
  expect(wrapper.text()).toContain("Bruno");
  expect(wrapper.text()).toContain("Rent");
});
