import Database from "better-sqlite3";
import type {
  Expense,
  ExpenseAmount,
  Household,
  Member,
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
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        effective_from TEXT NOT NULL,
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

  getHousehold(): Household {
    const householdRow = this.db
      .prepare("SELECT currency FROM household WHERE id = 1")
      .get() as { currency: string } | undefined;

    const memberRows = this.db
      .prepare("SELECT id, name FROM members ORDER BY position")
      .all() as Array<{ id: string; name: string }>;
    const members: Member[] = memberRows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    const expenseRows = this.db
      .prepare(
        "SELECT id, name, effective_from, split_rule, participants FROM expenses ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      effective_from: string;
      split_rule: string;
      participants: string;
    }>;
    const expenses: Expense[] = expenseRows.map((row) => ({
      id: row.id,
      name: row.name,
      effectiveFrom: row.effective_from,
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
      expenses,
      expenseAmounts,
    };
  }

  replaceHousehold(household: Household): void {
    const replace = this.db.transaction((h: Household): void => {
      this.db.exec(
        "DELETE FROM expense_amounts; DELETE FROM expenses; DELETE FROM members; DELETE FROM household;",
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

      const insertExpense = this.db.prepare(
        "INSERT INTO expenses (id, name, effective_from, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?)",
      );
      h.expenses.forEach((expense, index) => {
        insertExpense.run(
          expense.id,
          expense.name,
          expense.effectiveFrom,
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
