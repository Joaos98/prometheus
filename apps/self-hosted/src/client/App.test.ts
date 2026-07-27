import type { MonthlySummary } from "@prometheus/engine";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App.vue";

const summary: MonthlySummary = {
  month: "2026-07",
  currency: "USD",
  members: [
    {
      memberId: "m1",
      name: "Ana",
      shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }],
      totalCents: 75000,
    },
    {
      memberId: "m2",
      name: "Bruno",
      shares: [{ expenseId: "e1", expenseName: "Rent", amountCents: 75000 }],
      totalCents: 75000,
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => summary,
    }),
  );
});

test("the dashboard renders each member with their shares", async () => {
  const wrapper = mount(App);
  await flushPromises();

  expect(wrapper.text()).toContain("2026-07");
  expect(wrapper.text()).toContain("Ana");
  expect(wrapper.text()).toContain("Bruno");
  expect(wrapper.text()).toContain("Rent");
});
