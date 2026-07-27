import type { Member, MonthlySummary } from "@prometheus/engine";
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

test("when no currency is set the setup screen appears", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/household") {
        return { ok: true, json: async () => ({ currency: null, members: [] as Member[] }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );

  const wrapper = mount(App);
  await flushPromises();

  expect(wrapper.text()).toContain("Household Setup");
  expect(wrapper.text()).toContain("Currency");
});

test("when currency is set the dashboard renders members and their shares", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/household") {
        return {
          ok: true,
          json: async () => ({
            currency: "USD",
            members: [
              { id: "m1", name: "Ana" },
              { id: "m2", name: "Bruno" },
            ] as Member[],
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
  expect(wrapper.text()).toMatch(/Rent/);
});
