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
        joined_from TEXT,
        departed_from TEXT,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS income_snapshots (
        month TEXT NOT NULL,
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
        split_rule TEXT NOT NULL
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

  addMember(name: string, joinedFrom?: Month): Member {
    const id = randomUUID();
    const maxPos = (
      this.db
        .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM members")
        .get() as { maxPos: number }
    ).maxPos;
    this.db
      .prepare(
        "INSERT INTO members (id, name, joined_from, position) VALUES (?, ?, ?, ?)",
      )
      .run(id, name, joinedFrom ?? null, maxPos + 1);
    return { id, name, ...(joinedFrom ? { joinedFrom } : {}) };
  }

  getMembers(): Member[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, joined_from, departed_from FROM members ORDER BY position",
      )
      .all() as Array<{
      id: string; name: string; joined_from: string | null; departed_from: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ...(r.joined_from ? { joinedFrom: r.joined_from } : {}),
      ...(r.departed_from ? { departedFrom: r.departed_from } : {}),
    }));
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

  addExpenseSnapshot(snapshot: ExpenseSnapshot): void {
    this.db
      .prepare(
        "INSERT INTO expense_snapshots (month, expense_id, name, amount_cents, participants, split_rule) VALUES (?, ?, ?, ?, ?, ?)",
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

  getMonthData(month: Month): MonthData {
    const currency = this.getCurrency() ?? "USD";
    const members = this.getMembers();
    const incomeSnapshots = this.getIncomeSnapshots().filter((s) => s.month === month);
    const expenseSnapshots = this.getExpenseSnapshots().filter((s) => s.month === month);
    return { month, currency, members, incomeSnapshots, expenseSnapshots };
  }

  replaceHousehold(data: MonthData): void {
    const txn = this.db.transaction((): void => {
      this.db.exec(
        "DELETE FROM expense_snapshots; DELETE FROM income_snapshots; DELETE FROM members; DELETE FROM household;",
      );
      this.db
        .prepare("INSERT INTO household (id, currency) VALUES (1, ?)")
        .run(data.currency);
      const insMember = this.db.prepare(
        "INSERT INTO members (id, name, joined_from, position) VALUES (?, ?, ?, ?)",
      );
      data.members.forEach((m, i) =>
        insMember.run(m.id, m.name, m.joinedFrom ?? null, i),
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
