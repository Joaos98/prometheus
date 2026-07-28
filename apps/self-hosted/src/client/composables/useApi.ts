import type { Goal, MonthlySummary } from "@prometheus/engine";
import type { ExpenseTemplate, IncomeProfile } from "@prometheus/data";
import type { Ref } from "vue";

export function useApi(displayMonth: Ref<string>) {
  const http = {
    async get(u: string) { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
    async post(u: string, b?: unknown) { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
    async patch(u: string, b?: unknown) { const r = await fetch(u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
    async delete(u: string) { const r = await fetch(u, { method: "DELETE" }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); },
  };

  return {
    async fetchSummary(month?: string): Promise<MonthlySummary> {
      return http.get(`/api/summary?month=${month ?? displayMonth.value}`) as Promise<MonthlySummary>;
    },
    async fetchHousehold(): Promise<{ currency: string | null; members: { id: string; name: string }[]; incomeProfiles: IncomeProfile[]; expenseTemplates: ExpenseTemplate[]; goals: Goal[] }> {
      return http.get("/api/household") as Promise<any>;
    },
    async setCurrency(currency: string) { return http.post("/api/household/currency", { currency }); },

    // income
    async addIncomeProfile(memberId: string, name: string, amountCents: number, restrictedUse: boolean): Promise<IncomeProfile> {
      return http.post("/api/income-profiles", { memberId, name, amountCents, restrictedUse }) as Promise<IncomeProfile>;
    },
    async updateIncomeProfile(id: string, updates: Record<string, unknown>) { return http.patch(`/api/income-profiles/${id}`, updates); },
    async deleteIncomeProfile(id: string) { return http.delete(`/api/income-profiles/${id}`); },
    async snapshotProfile(month: string) { return http.post(`/api/income/snapshot?month=${month}`); },
    async addOneOffIncome(memberId: string, name: string, amountCents: number, month: string, restrictedUse: boolean) {
      return http.post("/api/income", { memberId, name, amountCents, month, restrictedUse });
    },

    // expenses
    async addExpenseTemplate(name: string, defaultParticipants: string[], defaultSplitRule: Record<string, unknown>, category?: string): Promise<ExpenseTemplate> {
      return http.post("/api/expense-templates", { name, defaultParticipants, defaultSplitRule, category }) as Promise<ExpenseTemplate>;
    },
    async endExpenseTemplate(id: string) { return http.post(`/api/expense-templates/${id}/end`); },
    async snapshotExpenses(month: string) { return http.post(`/api/expenses/snapshot?month=${month}`); },
    async upsertExpenseSnapshot(expenseId: string, month: string, amountCents: number, participants: string[], splitRule: Record<string, unknown>) {
      return http.post("/api/expense-snapshots", { expenseId, month, amountCents, participants, splitRule });
    },
    async propagateExpense(expenseId: string, sourceMonth: string) {
      return http.post("/api/expenses/propagate", { expenseId, sourceMonth });
    },

    // goals
    async addGoal(name: string, participants: string[], targetAmountCents?: number, startAmountCents?: number) {
      return http.post("/api/goals", { name, participants, targetAmountCents, startAmountCents });
    },
    async endGoal(id: string) { return http.post(`/api/goals/${id}/end`); },
    async addGoalContribution(goalId: string, memberId: string, month: string, amountCents: number) {
      return http.post("/api/goal-contributions", { goalId, memberId, month, amountCents });
    },

    // members
    async addMember(name: string): Promise<{ id: string; name: string }> {
      return http.post("/api/members", { name }) as Promise<{ id: string; name: string }>;
    },
  };
}
