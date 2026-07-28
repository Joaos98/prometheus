import type { Expense, ExpenseAmount, IncomeSource, Member, MonthlySummary, SavingsGoal } from "@prometheus/engine";
import type { Ref } from "vue";

interface State {
  currency: Ref<string | null>;
  members: Ref<Member[]>;
  incomeSources: Ref<IncomeSource[]>;
  expenses: Ref<Expense[]>;
  expenseAmounts: Ref<ExpenseAmount[]>;
  goals: Ref<SavingsGoal[]>;
  summary: Ref<MonthlySummary | null>;
  appError: Ref<string | null>;
  displayMonth: Ref<string>;
}

async function unwrapError(r: Response): Promise<never> {
  const b = (await r.json().catch(() => ({}))) as { error?: string };
  throw new Error(b.error ?? `HTTP ${r.status}`);
}
const http = {
  async get(u: string) { const r = await fetch(u); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
  async post(u: string, b: unknown) { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
  async patch(u: string, b: unknown) { const r = await fetch(u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) await unwrapError(r); return r.json() as unknown; },
};

export function useApi(s: State) {
  const catchErr = (e: unknown) => { s.appError.value = e instanceof Error ? e.message : String(e); };

  const refreshSummary = async () => { s.summary.value = (await http.get(`/api/summary?month=${s.displayMonth.value}`)) as MonthlySummary; };
  const loadAll = async () => {
    const d = (await http.get("/api/household")) as { members: Member[]; incomeSources: IncomeSource[]; expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[] };
    s.members.value = d.members ?? []; s.incomeSources.value = d.incomeSources ?? []; s.expenses.value = d.expenses ?? []; s.expenseAmounts.value = d.expenseAmounts ?? []; s.goals.value = d.goals ?? [];
  };
  const loadHousehold = async () => {
    const d = (await http.get("/api/household")) as { currency: string | null; members: Member[]; incomeSources: IncomeSource[]; expenses: Expense[]; expenseAmounts: ExpenseAmount[]; goals: SavingsGoal[] };
    s.currency.value = d.currency; s.members.value = d.members ?? []; s.incomeSources.value = d.incomeSources ?? []; s.expenses.value = d.expenses ?? []; s.expenseAmounts.value = d.expenseAmounts ?? []; s.goals.value = d.goals ?? [];
  };

  return {
    loadHousehold, loadAll, refreshSummary,
    async submitCurrency(v: string) { try { await http.post("/api/household/currency", { currency: v }); s.currency.value = v; await refreshSummary(); } catch (e) { catchErr(e); } },
    async submitMember(name: string, joinedFrom?: string) { const m = (await http.post("/api/members", { name, joinedFrom: joinedFrom || undefined })) as Member; s.members.value = [...s.members.value, m]; return m; },
    async departMember(id: string, eff: string) { try { await http.post(`/api/members/${id}/depart`, { effectiveFrom: eff }); await loadAll(); } catch (e) { catchErr(e); } },
    async renameMember(id: string, name: string) { await http.patch(`/api/members/${id}`, { name }); s.members.value = s.members.value.map(m => m.id === id ? { ...m, name } : m); },
    async submitIncome(name: string, memberId: string, amountCents: number, effectiveFrom: string, restrictedUse: boolean, oneOff: boolean, category?: string) { const src = (await http.post("/api/income-sources", { memberId, name, amountCents, effectiveFrom, oneOff, restrictedUse, category })) as IncomeSource; s.incomeSources.value = [...s.incomeSources.value, src]; return src; },
    async updateIncomeAmount(id: string, amountCents: number, effectiveFrom: string) { await http.post(`/api/income-sources/${id}/amount`, { amountCents, effectiveFrom }); await loadAll(); },
    async endIncome(id: string, eff: string) { await http.post(`/api/income-sources/${id}/end`, { effectiveFrom: eff }); await loadAll(); },
    async submitExpense(name: string, participants: string[], splitRule: Record<string, unknown>, effectiveFrom: string, oneOff: boolean, category?: string) { const e = (await http.post("/api/expenses", { name, participants, splitRule, effectiveFrom, oneOff, category })) as Expense; s.expenses.value = [...s.expenses.value, e]; return e; },
    async submitExpenseAmount(eid: string, amountCents: number) { await http.post(`/api/expenses/${eid}/amount`, { month: s.displayMonth.value, amountCents }); await loadAll(); await refreshSummary(); },
    async endExpense(id: string, eff: string) { await http.post(`/api/expenses/${id}/end`, { effectiveFrom: eff }); await loadAll(); },
    async changeExpenseSplit(eid: string, rule: Record<string, unknown>, eff: string) { await http.post(`/api/expenses/${eid}/change-split`, { splitRule: rule, effectiveFrom: eff }); await loadAll(); await refreshSummary(); },
    async changeExpenseParticipants(eid: string, participants: string[], eff: string) { await http.post(`/api/expenses/${eid}/change-participants`, { participants, effectiveFrom: eff }); await loadAll(); await refreshSummary(); },
    async addSubItem(expenseId: string, name: string) { await http.post(`/api/expenses/${expenseId}/sub-items`, { name }); await loadAll(); },
    async submitSubItemAmount(siid: string, amountCents: number) { await http.post(`/api/sub-items/${siid}/amount`, { month: s.displayMonth.value, amountCents }); await loadAll(); await refreshSummary(); },
    async removeSubItem(siid: string) { await fetch(`/api/sub-items/${siid}`, { method: "DELETE" }); await loadAll(); await refreshSummary(); },
    async submitGoal(name: string, participants: string[], splitRule: Record<string, unknown>, targetAmountCents: number | undefined, startAmountCents: number | undefined, effectiveFrom: string, category?: string) { await http.post("/api/goals", { name, participants, splitRule, targetAmountCents, startAmountCents, effectiveFrom, category }); await loadAll(); },
    async submitGoalContribution(gid: string, amountCents: number) { await http.post(`/api/goals/${gid}/contribution`, { month: s.displayMonth.value, amountCents }); await loadAll(); await refreshSummary(); },
    async endGoal(id: string, eff: string) { await http.post(`/api/goals/${id}/end`, { effectiveFrom: eff }); await loadAll(); },
  };
}
