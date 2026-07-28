import type { MonthlySummary } from "@prometheus/engine";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, test, vi } from "vitest";
import App from "./App.vue";

const summary: MonthlySummary = {
  month: "2026-07",
  currency: "USD",
  members: [
    { memberId: "m1", name: "Ana", incomeCents: 500000, shares: [], totalCents: 0, leftoverCents: 500000 },
    { memberId: "m2", name: "Bruno", incomeCents: 0, shares: [], totalCents: 0, leftoverCents: 0 },
  ],
  pendingExpenses: [],
  goalProgress: [],
  pendingContributions: [],
};

test("dashboard renders without crashing", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/household") return { ok: true, json: async () => ({ currency: "USD", members: [{ id: "m1", name: "Ana" }], incomeProfiles: [], expenseTemplates: [], goals: [] }) };
    return { ok: true, json: async () => summary };
  }));
  const wrapper = mount(App);
  await flushPromises();
  expect(wrapper.text()).toContain("Prometheus");
});
