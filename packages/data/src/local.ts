import type {
  ExpenseSnapshot,
  Goal,
  GoalContribution,
  IncomeSnapshot,
  Member,
  Month,
  MonthData,
  SplitRule,
} from "@prometheus/engine";
import type { DataStore, ExpenseTemplate, IncomeProfile } from "./store.js";

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(`prometheus:${key}`); return v ? JSON.parse(v) as T : fallback; }
  catch { return fallback; }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(`prometheus:${key}`, JSON.stringify(value));
}

export class LocalStore implements DataStore {
  private uid(): string { return crypto.randomUUID(); }

  getCurrency(): string | null { return load<string | null>("currency", null); }
  setCurrency(c: string): void { if (this.getCurrency() !== null) throw new Error("already set"); save("currency", c); }

  addMember(name: string, joinedFrom?: string): Member {
    const members = this.getMembers();
    const m: Member = { id: this.uid(), name, ...(joinedFrom ? { joinedFrom } : {}) };
    members.push(m);
    save("members", members);
    return m;
  }
  getMembers(): Member[] { return load<Member[]>("members", []); }

  addIncomeSnapshot(s: IncomeSnapshot): void { const snaps = this.getIncomeSnapshots(); snaps.push(s); save("incomeSnapshots", snaps); }
  getIncomeSnapshots(): IncomeSnapshot[] { return load<IncomeSnapshot[]>("incomeSnapshots", []); }

  addIncomeProfile(memberId: string, name: string, amountCents: number, restrictedUse?: boolean): IncomeProfile {
    const profs = this.getIncomeProfiles();
    const p: IncomeProfile = { id: this.uid(), memberId, name, amountCents, ...(restrictedUse ? { restrictedUse } : {}) };
    profs.push(p); save("incomeProfiles", profs); return p;
  }
  getIncomeProfiles(): IncomeProfile[] { return load<IncomeProfile[]>("incomeProfiles", []); }
  updateIncomeProfile(id: string, u: { amountCents?: number; restrictedUse?: boolean; name?: string }): void {
    const profs = this.getIncomeProfiles().map(p => p.id === id ? { ...p, ...u } : p);
    save("incomeProfiles", profs);
  }
  removeIncomeProfile(id: string): void {
    save("incomeProfiles", this.getIncomeProfiles().filter(p => p.id !== id));
  }
  snapshotProfile(month: string): void {
    const profs = this.getIncomeProfiles();
    const snaps = this.getIncomeSnapshots().filter(s => s.month !== month);
    for (const p of profs) snaps.push({ month, memberId: p.memberId, name: p.name, amountCents: p.amountCents, restrictedUse: p.restrictedUse });
    save("incomeSnapshots", snaps);
  }

  addExpenseSnapshot(s: ExpenseSnapshot): void {
    const snaps = this.getExpenseSnapshots().filter(e => !(e.expenseId === s.expenseId && e.month === s.month));
    snaps.push(s); save("expenseSnapshots", snaps);
  }
  getExpenseSnapshots(): ExpenseSnapshot[] { return load<ExpenseSnapshot[]>("expenseSnapshots", []); }

  addExpenseTemplate(name: string, dp: string[], dsr: SplitRule, cat?: string): ExpenseTemplate {
    const temps = this.getExpenseTemplates();
    const t: ExpenseTemplate = { id: this.uid(), name, category: cat, defaultParticipants: dp, defaultSplitRule: dsr, active: true };
    temps.push(t); save("expenseTemplates", temps); return t;
  }
  getExpenseTemplates(): ExpenseTemplate[] { return load<ExpenseTemplate[]>("expenseTemplates", []); }
  endExpenseTemplate(id: string): void {
    save("expenseTemplates", this.getExpenseTemplates().map(t => t.id === id ? { ...t, active: false } : t));
  }
  snapshotExpenses(month: string): void {
    const temps = this.getExpenseTemplates().filter(t => t.active);
    const snaps = this.getExpenseSnapshots().filter(s => s.month !== month);
    const existing = new Set(snaps.map(s => s.expenseId));
    for (const t of temps) {
      if (existing.has(t.id)) continue;
      const prev = snaps.filter(s => s.expenseId === t.id && s.month < month).sort((a, b) => b.month.localeCompare(a.month))[0];
      if (!prev) continue;
      snaps.push({ month, expenseId: t.id, name: t.name, amountCents: prev.amountCents, participants: t.defaultParticipants, splitRule: t.defaultSplitRule });
    }
    save("expenseSnapshots", snaps);
  }

  addGoal(name: string, participants: string[], targetAmountCents?: number, startAmountCents?: number): Goal {
    const goals = this.getGoals();
    const g: Goal = { id: this.uid(), name, participants, active: true, ...(targetAmountCents !== undefined ? { targetAmountCents } : {}), ...(startAmountCents !== undefined ? { startAmountCents } : {}) };
    goals.push(g); save("goals", goals); return g;
  }
  getGoals(): Goal[] { return load<Goal[]>("goals", []); }
  endGoal(id: string): void { save("goals", this.getGoals().map(g => g.id === id ? { ...g, active: false } : g)); }
  addGoalContribution(goalId: string, memberId: string, month: string, amountCents: number): void {
    const cons = this.getGoalContributions();
    cons.push({ goalId, memberId, month, amountCents });
    save("goalContributions", cons);
  }
  getGoalContributions(): GoalContribution[] { return load<GoalContribution[]>("goalContributions", []); }

  getMonthData(month: string): MonthData {
    return {
      month,
      currency: this.getCurrency() ?? "USD",
      members: this.getMembers(),
      incomeSnapshots: this.getIncomeSnapshots().filter(s => s.month === month),
      expenseSnapshots: this.getExpenseSnapshots().filter(s => s.month === month),
      activeTemplateIds: this.getExpenseTemplates().filter(t => t.active).map(t => t.id),
      goals: this.getGoals(),
      goalContributions: this.getGoalContributions(),
    };
  }

  replaceHousehold(data: MonthData): void {
    save("currency", data.currency);
    save("members", data.members);
    save("incomeSnapshots", data.incomeSnapshots);
    save("expenseSnapshots", data.expenseSnapshots);
    save("incomeProfiles", []);
    save("expenseTemplates", []);
    save("goals", []);
    save("goalContributions", []);
  }

  close(): void {}
}
