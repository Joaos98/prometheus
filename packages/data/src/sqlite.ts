import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  ExpenseSnapshot,
  IncomeSnapshot,
  Member,
  Month,
  MonthData,
  SplitRule,
} from "@prometheus/engine";

export interface IncomeProfile {
  id: string;
  memberId: string;
  name: string;
  amountCents: number;
  restrictedUse?: boolean;
}
import type { DataStore } from "./store.js";

export class SqliteStore implements DataStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS household (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        currency TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS income_snapshots (
        month TEXT NOT NULL,
        member_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        restricted_use INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS income_profiles (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        restricted_use INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS expense_snapshots (
        month TEXT NOT NULL,
        expense_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        participants TEXT NOT NULL,
        split_rule TEXT NOT NULL,
        PRIMARY KEY (expense_id, month)
      );
      CREATE TABLE IF NOT EXISTS expense_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        default_participants TEXT NOT NULL,
        default_split_rule TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_amount_cents INTEGER,
        start_amount_cents INTEGER,
        participants TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS goal_contributions (
        goal_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount_cents INTEGER NOT NULL
      );
    `);
  }

  getCurrency(): string | null {
    const row = this.db
      .prepare("SELECT currency FROM household WHERE id = 1")
      .get() as { currency: string } | undefined;
    return row?.currency ?? null;
  }

  setCurrency(currency: string): void {
    if (this.getCurrency() !== null) throw new Error("Currency is already set");
    this.db
      .prepare("INSERT INTO household (id, currency) VALUES (1, ?)")
      .run(currency);
  }

  addMember(name: string): Member {
    const id = randomUUID();
    const maxPos = (
      this.db
        .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM members")
        .get() as { maxPos: number }
    ).maxPos;
    this.db
      .prepare("INSERT INTO members (id, name, position) VALUES (?, ?, ?)")
      .run(id, name, maxPos + 1);
    return { id, name };
  }

  getMembers(): Member[] {
    const rows = this.db
      .prepare("SELECT id, name FROM members ORDER BY position")
      .all() as Array<{ id: string; name: string }>;
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  addIncomeSnapshot(snapshot: IncomeSnapshot): void {
    this.db
      .prepare(
        "INSERT INTO income_snapshots (month, member_id, name, amount_cents, restricted_use) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        snapshot.month,
        snapshot.memberId,
        snapshot.name,
        snapshot.amountCents,
        snapshot.restrictedUse ? 1 : 0,
      );
  }

  getIncomeSnapshots(): IncomeSnapshot[] {
    const rows = this.db
      .prepare(
        "SELECT month, member_id, name, amount_cents, restricted_use FROM income_snapshots ORDER BY member_id",
      )
      .all() as Array<{
      month: string; member_id: string; name: string; amount_cents: number; restricted_use: number;
    }>;
    return rows.map((r) => ({
      month: r.month,
      memberId: r.member_id,
      name: r.name,
      amountCents: r.amount_cents,
      ...(r.restricted_use ? { restrictedUse: true } : {}),
    }));
  }

  addIncomeProfile(
    memberId: string,
    name: string,
    amountCents: number,
    restrictedUse = false,
  ): IncomeProfile {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO income_profiles (id, member_id, name, amount_cents, restricted_use) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, memberId, name, amountCents, restrictedUse ? 1 : 0);
    return { id, memberId, name, amountCents, ...(restrictedUse ? { restrictedUse: true } : {}) };
  }

  getIncomeProfiles(): IncomeProfile[] {
    const rows = this.db
      .prepare("SELECT id, member_id, name, amount_cents, restricted_use FROM income_profiles ORDER BY member_id, name")
      .all() as Array<{
      id: string; member_id: string; name: string; amount_cents: number; restricted_use: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      name: r.name,
      amountCents: r.amount_cents,
      ...(r.restricted_use ? { restrictedUse: true } : {}),
    }));
  }

  updateIncomeProfile(id: string, updates: { amountCents?: number; restrictedUse?: boolean; name?: string }): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.amountCents !== undefined) { fields.push("amount_cents = ?"); values.push(updates.amountCents); }
    if (updates.restrictedUse !== undefined) { fields.push("restricted_use = ?"); values.push(updates.restrictedUse ? 1 : 0); }
    if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
    if (fields.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE income_profiles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  removeIncomeProfile(id: string): void {
    this.db.prepare("DELETE FROM income_profiles WHERE id = ?").run(id);
  }

  snapshotProfile(month: Month): void {
    const profiles = this.getIncomeProfiles();
    const insert = this.db.prepare(
      "INSERT OR REPLACE INTO income_snapshots (month, member_id, name, amount_cents, restricted_use) VALUES (?, ?, ?, ?, ?)",
    );
    for (const p of profiles) {
      insert.run(month, p.memberId, p.name, p.amountCents, p.restrictedUse ? 1 : 0);
    }
  }

  addExpenseSnapshot(snapshot: ExpenseSnapshot): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO expense_snapshots (month, expense_id, name, amount_cents, participants, split_rule) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        snapshot.month,
        snapshot.expenseId,
        snapshot.name,
        snapshot.amountCents,
        JSON.stringify(snapshot.participants),
        JSON.stringify(snapshot.splitRule),
      );
  }

  getExpenseSnapshots(): ExpenseSnapshot[] {
    const rows = this.db
      .prepare(
        "SELECT month, expense_id, name, amount_cents, participants, split_rule FROM expense_snapshots ORDER BY expense_id, month",
      )
      .all() as Array<{
      month: string; expense_id: string; name: string; amount_cents: number; participants: string; split_rule: string;
    }>;
    return rows.map((r) => ({
      month: r.month,
      expenseId: r.expense_id,
      name: r.name,
      amountCents: r.amount_cents,
      participants: JSON.parse(r.participants) as string[],
      splitRule: JSON.parse(r.split_rule) as SplitRule,
    }));
  }

  addExpenseTemplate(
    name: string,
    defaultParticipants: string[],
    defaultSplitRule: SplitRule,
    category?: string,
  ): ExpenseTemplate {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO expense_templates (id, name, category, default_participants, default_split_rule) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, name, category ?? null, JSON.stringify(defaultParticipants), JSON.stringify(defaultSplitRule));
    return { id, name, category, defaultParticipants, defaultSplitRule, active: true };
  }

  getExpenseTemplates(): ExpenseTemplate[] {
    const rows = this.db
      .prepare("SELECT id, name, category, default_participants, default_split_rule, active FROM expense_templates ORDER BY name")
      .all() as Array<{
      id: string; name: string; category: string | null; default_participants: string; default_split_rule: string; active: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ...(r.category ? { category: r.category } : {}),
      defaultParticipants: JSON.parse(r.default_participants) as string[],
      defaultSplitRule: JSON.parse(r.default_split_rule) as SplitRule,
      active: r.active === 1,
    }));
  }

  endExpenseTemplate(id: string): void {
    this.db.prepare("UPDATE expense_templates SET active = 0 WHERE id = ?").run(id);
  }

  snapshotExpenses(month: Month): void {
    const templates = this.getExpenseTemplates().filter((t) => t.active);
    const existing = new Set(
      this.getExpenseSnapshots().filter((s) => s.month === month).map((s) => s.expenseId),
    );

    for (const t of templates) {
      if (existing.has(t.id)) continue;
      const prev = this.db
        .prepare(
          "SELECT amount_cents FROM expense_snapshots WHERE expense_id = ? AND month < ? ORDER BY month DESC LIMIT 1",
        )
        .get(t.id, month) as { amount_cents: number } | undefined;

      // Only auto-create if there's a previous amount to copy from.
      // First-month expenses stay pending (no snapshot) until the user enters an amount.
      if (prev === undefined) continue;

      this.db
        .prepare(
          "INSERT INTO expense_snapshots (month, expense_id, name, amount_cents, participants, split_rule) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          month,
          t.id,
          t.name,
          prev.amount_cents,
          JSON.stringify(t.defaultParticipants),
          JSON.stringify(t.defaultSplitRule),
        );
    }
  }

  addGoal(name: string, participants: string[], targetAmountCents?: number, startAmountCents?: number): Goal {
    const id = randomUUID();
    this.db.prepare("INSERT INTO goals (id, name, target_amount_cents, start_amount_cents, participants) VALUES (?, ?, ?, ?, ?)").run(id, name, targetAmountCents ?? null, startAmountCents ?? null, JSON.stringify(participants));
    return { id, name, participants, active: true, ...(targetAmountCents !== undefined ? { targetAmountCents } : {}), ...(startAmountCents !== undefined ? { startAmountCents } : {}) };
  }
  getGoals(): Goal[] {
    const rows = this.db.prepare("SELECT id, name, target_amount_cents, start_amount_cents, participants, active FROM goals ORDER BY name").all() as Array<{ id: string; name: string; target_amount_cents: number | null; start_amount_cents: number | null; participants: string; active: number }>;
    return rows.map((r) => ({ id: r.id, name: r.name, ...(r.target_amount_cents !== null ? { targetAmountCents: r.target_amount_cents } : {}), ...(r.start_amount_cents !== null ? { startAmountCents: r.start_amount_cents } : {}), participants: JSON.parse(r.participants) as string[], active: r.active === 1 }));
  }
  endGoal(id: string): void { this.db.prepare("UPDATE goals SET active = 0 WHERE id = ?").run(id); }
  addGoalContribution(goalId: string, memberId: string, month: Month, amountCents: number): void {
    this.db.prepare("INSERT INTO goal_contributions (goal_id, member_id, month, amount_cents) VALUES (?, ?, ?, ?)").run(goalId, memberId, month, amountCents);
  }
  getGoalContributions(): GoalContribution[] {
    const rows = this.db.prepare("SELECT goal_id, member_id, month, amount_cents FROM goal_contributions ORDER BY goal_id, member_id, month").all() as Array<{ goal_id: string; member_id: string; month: string; amount_cents: number }>;
    return rows.map((r) => ({ goalId: r.goal_id, memberId: r.member_id, month: r.month, amountCents: r.amount_cents }));
  }

  getMonthData(month: Month): MonthData {
    const currency = this.getCurrency() ?? "USD";
    const members = this.getMembers();
    const incomeSnapshots = this.getIncomeSnapshots().filter((s) => s.month === month);
    const expenseSnapshots = this.getExpenseSnapshots().filter((s) => s.month === month);
    const activeTemplateIds = this.getExpenseTemplates().filter(t => t.active).map(t => t.id);
    const goals = this.getGoals();
    const goalContributions = this.getGoalContributions();
    return { month, currency, members, incomeSnapshots, expenseSnapshots, activeTemplateIds, goals, goalContributions };
  }

  replaceHousehold(data: MonthData): void {
    const txn = this.db.transaction((): void => {
      this.db.exec(
        "DELETE FROM expense_snapshots; DELETE FROM expense_templates; DELETE FROM income_snapshots; DELETE FROM income_profiles; DELETE FROM members; DELETE FROM household;",
      );
      this.db
        .prepare("INSERT INTO household (id, currency) VALUES (1, ?)")
        .run(data.currency);
      const insMember = this.db.prepare(
        "INSERT INTO members (id, name, position) VALUES (?, ?, ?)",
      );
      data.members.forEach((m, i) =>
        insMember.run(m.id, m.name, i),
      );
      for (const s of data.incomeSnapshots) this.addIncomeSnapshot(s);
      for (const s of data.expenseSnapshots) this.addExpenseSnapshot(s);
    });
    txn();
  }

  close(): void {
    this.db.close();
  }
}
