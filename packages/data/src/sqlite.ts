import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  Expense,
  ExpenseAmount,
  Household,
  IncomeSource,
  IncomeSourceEntry,
  Member,
  Month,
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
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS income_sources (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        name TEXT NOT NULL,
        ended_from TEXT
      );
      CREATE TABLE IF NOT EXISTS income_source_entries (
        source_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        effective_from TEXT NOT NULL,
        PRIMARY KEY (source_id, effective_from)
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        effective_from TEXT NOT NULL,
        ended_from TEXT,
        split_rule TEXT NOT NULL,
        participants TEXT NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS expense_amounts (
        expense_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        PRIMARY KEY (expense_id, month)
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
    if (this.getCurrency() !== null) {
      throw new Error("Currency is already set");
    }
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
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  renameMember(id: string, name: string): void {
    const result = this.db
      .prepare("UPDATE members SET name = ? WHERE id = ?")
      .run(name, id);
    if (result.changes === 0) {
      throw new Error("Member not found");
    }
  }

  addIncomeSource(
    memberId: string,
    name: string,
    amountCents: number,
    effectiveFrom: Month,
  ): IncomeSource {
    const id = randomUUID();
    const insert = this.db.transaction(
      (): void => {
        this.db
          .prepare(
            "INSERT INTO income_sources (id, member_id, name) VALUES (?, ?, ?)",
          )
          .run(id, memberId, name);
        this.db
          .prepare(
            "INSERT INTO income_source_entries (source_id, amount_cents, effective_from) VALUES (?, ?, ?)",
          )
          .run(id, amountCents, effectiveFrom);
      },
    );
    insert();
    return {
      id,
      memberId,
      name,
      timeline: [{ amountCents, effectiveFrom }],
    };
  }

  getIncomeSources(): IncomeSource[] {
    const sourceRows = this.db
      .prepare(
        "SELECT id, member_id, name, ended_from FROM income_sources ORDER BY id",
      )
      .all() as Array<{
      id: string;
      member_id: string;
      name: string;
      ended_from: string | null;
    }>;
    const entryRows = this.db
      .prepare(
        "SELECT source_id, amount_cents, effective_from FROM income_source_entries ORDER BY source_id, effective_from",
      )
      .all() as Array<{
      source_id: string;
      amount_cents: number;
      effective_from: string;
    }>;

    const entriesBySource = new Map<string, IncomeSourceEntry[]>();
    for (const row of entryRows) {
      const list = entriesBySource.get(row.source_id) ?? [];
      list.push({
        amountCents: row.amount_cents,
        effectiveFrom: row.effective_from,
      });
      entriesBySource.set(row.source_id, list);
    }

    return sourceRows.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      name: row.name,
      timeline: entriesBySource.get(row.id) ?? [],
      ...(row.ended_from ? { endedFrom: row.ended_from } : {}),
    }));
  }

  updateIncomeSourceAmount(
    id: string,
    amountCents: number,
    effectiveFrom: Month,
  ): void {
    this.db
      .prepare(
        "INSERT INTO income_source_entries (source_id, amount_cents, effective_from) VALUES (?, ?, ?)",
      )
      .run(id, amountCents, effectiveFrom);
  }

  endIncomeSource(id: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE income_sources SET ended_from = ? WHERE id = ?")
      .run(effectiveFrom, id);
  }

  addExpense(
    name: string,
    participants: string[],
    splitRule: SplitRule,
    effectiveFrom: Month,
  ): Expense {
    const id = randomUUID();
    const maxPos = (
      this.db
        .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM expenses")
        .get() as { maxPos: number }
    ).maxPos;
    this.db
      .prepare(
        "INSERT INTO expenses (id, name, effective_from, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        name,
        effectiveFrom,
        JSON.stringify(splitRule),
        JSON.stringify(participants),
        maxPos + 1,
      );
    return {
      id,
      name,
      participants,
      splitRule,
      effectiveFrom,
    };
  }

  getExpenses(): Expense[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, effective_from, ended_from, split_rule, participants FROM expenses ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      effective_from: string;
      ended_from: string | null;
      split_rule: string;
      participants: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      effectiveFrom: row.effective_from,
      ...(row.ended_from ? { endedFrom: row.ended_from } : {}),
      splitRule: JSON.parse(row.split_rule) as SplitRule,
      participants: JSON.parse(row.participants) as string[],
    }));
  }

  endExpense(id: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE expenses SET ended_from = ? WHERE id = ?")
      .run(effectiveFrom, id);
  }

  setExpenseAmount(
    expenseId: string,
    month: Month,
    amountCents: number,
  ): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO expense_amounts (expense_id, month, amount_cents) VALUES (?, ?, ?)",
      )
      .run(expenseId, month, amountCents);
  }

  getExpenseAmounts(): ExpenseAmount[] {
    const rows = this.db
      .prepare(
        "SELECT expense_id, month, amount_cents FROM expense_amounts ORDER BY expense_id, month",
      )
      .all() as Array<{
      expense_id: string;
      month: string;
      amount_cents: number;
    }>;
    return rows.map((row) => ({
      expenseId: row.expense_id,
      month: row.month,
      amountCents: row.amount_cents,
    }));
  }

  getHousehold(): Household {
    const householdRow = this.db
      .prepare("SELECT currency FROM household WHERE id = 1")
      .get() as { currency: string } | undefined;

    const members = this.getMembers();

    const incomeSources = this.getIncomeSources();

    const expenseRows = this.db
      .prepare(
        "SELECT id, name, effective_from, ended_from, split_rule, participants FROM expenses ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      effective_from: string;
      ended_from: string | null;
      split_rule: string;
      participants: string;
    }>;
    const expenses: Expense[] = expenseRows.map((row) => ({
      id: row.id,
      name: row.name,
      effectiveFrom: row.effective_from,
      ...(row.ended_from ? { endedFrom: row.ended_from } : {}),
      splitRule: JSON.parse(row.split_rule) as SplitRule,
      participants: JSON.parse(row.participants) as string[],
    }));

    const amountRows = this.db
      .prepare(
        "SELECT expense_id, month, amount_cents FROM expense_amounts ORDER BY expense_id, month",
      )
      .all() as Array<{
      expense_id: string;
      month: string;
      amount_cents: number;
    }>;
    const expenseAmounts: ExpenseAmount[] = amountRows.map((row) => ({
      expenseId: row.expense_id,
      month: row.month,
      amountCents: row.amount_cents,
    }));

    return {
      currency: householdRow?.currency ?? "USD",
      members,
      incomeSources,
      expenses,
      expenseAmounts,
    };
  }

  replaceHousehold(household: Household): void {
    const replace = this.db.transaction((h: Household): void => {
      this.db.exec(
        "DELETE FROM expense_amounts; DELETE FROM expenses; DELETE FROM income_source_entries; DELETE FROM income_sources; DELETE FROM members; DELETE FROM household;",
      );

      this.db
        .prepare("INSERT INTO household (id, currency) VALUES (1, ?)")
        .run(h.currency);

      const insertMember = this.db.prepare(
        "INSERT INTO members (id, name, position) VALUES (?, ?, ?)",
      );
      h.members.forEach((member, index) => {
        insertMember.run(member.id, member.name, index);
      });

      const insertSource = this.db.prepare(
        "INSERT INTO income_sources (id, member_id, name, ended_from) VALUES (?, ?, ?, ?)",
      );
      const insertEntry = this.db.prepare(
        "INSERT INTO income_source_entries (source_id, amount_cents, effective_from) VALUES (?, ?, ?)",
      );
      for (const source of h.incomeSources) {
        insertSource.run(
          source.id,
          source.memberId,
          source.name,
          source.endedFrom ?? null,
        );
        for (const entry of source.timeline) {
          insertEntry.run(source.id, entry.amountCents, entry.effectiveFrom);
        }
      }

      const insertExpense = this.db.prepare(
        "INSERT INTO expenses (id, name, effective_from, ended_from, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      h.expenses.forEach((expense, index) => {
        insertExpense.run(
          expense.id,
          expense.name,
          expense.effectiveFrom,
          expense.endedFrom ?? null,
          JSON.stringify(expense.splitRule),
          JSON.stringify(expense.participants),
          index,
        );
      });

      const insertAmount = this.db.prepare(
        "INSERT INTO expense_amounts (expense_id, month, amount_cents) VALUES (?, ?, ?)",
      );
      for (const amount of h.expenseAmounts) {
        insertAmount.run(amount.expenseId, amount.month, amount.amountCents);
      }
    });

    replace(household);
  }

  close(): void {
    this.db.close();
  }
}
