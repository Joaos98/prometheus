import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  Expense,
  ExpenseAmount,
  GoalContribution,
  Household,
  IncomeSource,
  IncomeSourceEntry,
  Member,
  Month,
  SavingsGoal,
  SplitRule,
  SubItem,
  SubItemAmount,
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
      CREATE TABLE IF NOT EXISTS income_sources (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        restricted_use INTEGER NOT NULL DEFAULT 0,
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
        category TEXT,
        effective_from TEXT NOT NULL,
        ended_from TEXT,
        split_rule TEXT NOT NULL,
        participants TEXT NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        effective_from TEXT NOT NULL,
        ended_from TEXT,
        target_amount_cents INTEGER,
        start_amount_cents INTEGER,
        split_rule TEXT NOT NULL,
        participants TEXT NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS goal_contributions (
        goal_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        PRIMARY KEY (goal_id, month)
      );
      CREATE TABLE IF NOT EXISTS expense_amounts (
        expense_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        PRIMARY KEY (expense_id, month)
      );
      CREATE TABLE IF NOT EXISTS sub_items (
        id TEXT PRIMARY KEY,
        expense_id TEXT NOT NULL,
        name TEXT NOT NULL,
        ended_from TEXT
      );
      CREATE TABLE IF NOT EXISTS sub_item_amounts (
        sub_item_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        PRIMARY KEY (sub_item_id, month)
      );
    `);
    this.migrate();
  }

  private migrate(): void {
    this.addColumnIfMissing("expenses", "ended_from", "TEXT");
    this.addColumnIfMissing(
      "income_sources",
      "restricted_use",
      "INTEGER NOT NULL DEFAULT 0",
    );
    this.addColumnIfMissing("members", "joined_from", "TEXT");
    this.addColumnIfMissing("members", "departed_from", "TEXT");
    this.addColumnIfMissing("goals", "start_amount_cents", "INTEGER");
    this.addColumnIfMissing("income_sources", "category", "TEXT");
    this.addColumnIfMissing("expenses", "category", "TEXT");
    this.addColumnIfMissing("goals", "category", "TEXT");
    this.addColumnIfMissing("sub_items", "ended_from", "TEXT");
  }

  private addColumnIfMissing(
    table: string,
    column: string,
    type: string,
  ): void {
    const cols = this.db
      .prepare(`PRAGMA table_info('${table}')`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    }
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
      id: string;
      name: string;
      joined_from: string | null;
      departed_from: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ...(row.joined_from ? { joinedFrom: row.joined_from } : {}),
      ...(row.departed_from ? { departedFrom: row.departed_from } : {}),
    }));
  }

  departMember(id: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE members SET departed_from = ? WHERE id = ?")
      .run(effectiveFrom, id);
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
    restrictedUse = false,
    category?: string,
  ): IncomeSource {
    const id = randomUUID();
    const insert = this.db.transaction(
      (): void => {
        this.db
          .prepare(
            "INSERT INTO income_sources (id, member_id, name, category, restricted_use) VALUES (?, ?, ?, ?, ?)",
          )
          .run(id, memberId, name, category ?? null, restrictedUse ? 1 : 0);
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
      ...(category ? { category } : {}),
      ...(restrictedUse ? { restrictedUse: true } : {}),
    };
  }

  getIncomeSources(): IncomeSource[] {
    const sourceRows = this.db
      .prepare(
        "SELECT id, member_id, name, category, restricted_use, ended_from FROM income_sources ORDER BY id",
      )
      .all() as Array<{
      id: string;
      member_id: string;
      name: string;
      category: string | null;
      restricted_use: number;
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
      ...(row.category ? { category: row.category } : {}),
      ...(row.restricted_use ? { restrictedUse: true } : {}),
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
    category?: string,
  ): Expense {
    const id = randomUUID();
    const maxPos = (
      this.db
        .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM expenses")
        .get() as { maxPos: number }
    ).maxPos;
    this.db
      .prepare(
        "INSERT INTO expenses (id, name, category, effective_from, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        name,
        category ?? null,
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
      ...(category ? { category } : {}),
    };
  }

  getExpenses(): Expense[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, category, effective_from, ended_from, split_rule, participants FROM expenses ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      category: string | null;
      effective_from: string;
      ended_from: string | null;
      split_rule: string;
      participants: string;
    }>;
    const expenses: Expense[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      ...(row.category ? { category: row.category } : {}),
      effectiveFrom: row.effective_from,
      ...(row.ended_from ? { endedFrom: row.ended_from } : {}),
      splitRule: JSON.parse(row.split_rule) as SplitRule,
      participants: JSON.parse(row.participants) as string[],
    }));
    const subItems = this.getSubItems();
    for (const expense of expenses) {
      const kids = subItems.filter((s) => s.expenseId === expense.id);
      if (kids.length > 0) expense.subItems = kids;
    }
    return expenses;
  }

  endExpense(id: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE expenses SET ended_from = ? WHERE id = ?")
      .run(effectiveFrom, id);
  }

  private getExpenseById(id: string): Expense | undefined {
    return this.getExpenses().find((e) => e.id === id);
  }

  addSubItem(expenseId: string, name: string): SubItem {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO sub_items (id, expense_id, name) VALUES (?, ?, ?)")
      .run(id, expenseId, name);
    return { id, expenseId, name };
  }

  getSubItems(): SubItem[] {
    const rows = this.db
      .prepare("SELECT id, expense_id, name, ended_from FROM sub_items ORDER BY id")
      .all() as Array<{ id: string; expense_id: string; name: string; ended_from: string | null }>;
    return rows.map((row) => ({ id: row.id, expenseId: row.expense_id, name: row.name, ...(row.ended_from ? { endedFrom: row.ended_from } : {}) }));
  }

  getSubItemAmounts(): SubItemAmount[] {
    const rows = this.db
      .prepare("SELECT sub_item_id, month, amount_cents FROM sub_item_amounts ORDER BY sub_item_id, month")
      .all() as Array<{ sub_item_id: string; month: string; amount_cents: number }>;
    return rows.map((row) => ({ subItemId: row.sub_item_id, month: row.month, amountCents: row.amount_cents }));
  }

  setSubItemAmount(subItemId: string, month: Month, amountCents: number): void {
    this.db
      .prepare("INSERT OR REPLACE INTO sub_item_amounts (sub_item_id, month, amount_cents) VALUES (?, ?, ?)")
      .run(subItemId, month, amountCents);
  }

  endSubItem(subItemId: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE sub_items SET ended_from = ? WHERE id = ?")
      .run(effectiveFrom, subItemId);
  }

  changeExpenseSplitRule(
    id: string,
    splitRule: SplitRule,
    effectiveFrom: Month,
  ): Expense {
    const old = this.getExpenseById(id);
    if (!old) throw new Error("Expense not found");

    const change = this.db.transaction((): Expense => {
      this.endExpense(id, effectiveFrom);
      return this.addExpense(
        old.name,
        old.participants,
        splitRule,
        effectiveFrom,
      );
    });
    return change();
  }

  changeExpenseParticipants(
    id: string,
    participants: string[],
    effectiveFrom: Month,
  ): Expense {
    const old = this.getExpenseById(id);
    if (!old) throw new Error("Expense not found");

    const change = this.db.transaction((): Expense => {
      this.endExpense(id, effectiveFrom);
      return this.addExpense(
        old.name,
        participants,
        old.splitRule,
        effectiveFrom,
      );
    });
    return change();
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

  addGoal(
    name: string,
    participants: string[],
    splitRule: SplitRule,
    targetAmountCents: number | undefined,
    startAmountCents: number | undefined,
    effectiveFrom: Month,
    category?: string,
  ): SavingsGoal {
    const id = randomUUID();
    const maxPos = (
      this.db
        .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM goals")
        .get() as { maxPos: number }
    ).maxPos;
    this.db
      .prepare(
        "INSERT INTO goals (id, name, category, effective_from, target_amount_cents, start_amount_cents, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        name,
        category ?? null,
        effectiveFrom,
        targetAmountCents ?? null,
        startAmountCents ?? null,
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
      ...(category ? { category } : {}),
      ...(targetAmountCents !== undefined ? { targetAmountCents } : {}),
      ...(startAmountCents !== undefined ? { startAmountCents } : {}),
    };
  }

  getGoals(): SavingsGoal[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, category, effective_from, ended_from, target_amount_cents, start_amount_cents, split_rule, participants FROM goals ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      category: string | null;
      effective_from: string;
      ended_from: string | null;
      target_amount_cents: number | null;
      start_amount_cents: number | null;
      split_rule: string;
      participants: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ...(row.category ? { category: row.category } : {}),
      effectiveFrom: row.effective_from,
      ...(row.ended_from ? { endedFrom: row.ended_from } : {}),
      ...(row.target_amount_cents !== null
        ? { targetAmountCents: row.target_amount_cents }
        : {}),
      ...(row.start_amount_cents !== null
        ? { startAmountCents: row.start_amount_cents }
        : {}),
      splitRule: JSON.parse(row.split_rule) as SplitRule,
      participants: JSON.parse(row.participants) as string[],
    }));
  }

  endGoal(id: string, effectiveFrom: Month): void {
    this.db
      .prepare("UPDATE goals SET ended_from = ? WHERE id = ?")
      .run(effectiveFrom, id);
  }

  setGoalContribution(
    goalId: string,
    month: Month,
    amountCents: number,
  ): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO goal_contributions (goal_id, month, amount_cents) VALUES (?, ?, ?)",
      )
      .run(goalId, month, amountCents);
  }

  getGoalContributions(): GoalContribution[] {
    const rows = this.db
      .prepare(
        "SELECT goal_id, month, amount_cents FROM goal_contributions ORDER BY goal_id, month",
      )
      .all() as Array<{
      goal_id: string;
      month: string;
      amount_cents: number;
    }>;
    return rows.map((row) => ({
      goalId: row.goal_id,
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
    const goals = this.getGoals();
    const goalContributions = this.getGoalContributions();

    const expenseRows = this.db
      .prepare(
        "SELECT id, name, category, effective_from, ended_from, split_rule, participants FROM expenses ORDER BY position",
      )
      .all() as Array<{
      id: string;
      name: string;
      category: string | null;
      effective_from: string;
      ended_from: string | null;
      split_rule: string;
      participants: string;
    }>;
    const expenses: Expense[] = expenseRows.map((row) => ({
      id: row.id,
      name: row.name,
      ...(row.category ? { category: row.category } : {}),
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

    const subItems = this.getSubItems();
    const subItemAmounts = this.getSubItemAmounts();

    for (const expense of expenses) {
      const kids = subItems.filter((s) => s.expenseId === expense.id);
      if (kids.length > 0) expense.subItems = kids;
    }

    return {
      currency: householdRow?.currency ?? "USD",
      members,
      incomeSources,
      subItems,
      subItemAmounts,
      goals,
      goalContributions,
      expenses,
      expenseAmounts,
    };
  }

  replaceHousehold(household: Household): void {
    const replace = this.db.transaction((h: Household): void => {
      this.db.exec(
        "DELETE FROM sub_item_amounts; DELETE FROM sub_items; DELETE FROM goal_contributions; DELETE FROM goals; DELETE FROM expense_amounts; DELETE FROM expenses; DELETE FROM income_source_entries; DELETE FROM income_sources; DELETE FROM members; DELETE FROM household;",
      );

      this.db
        .prepare("INSERT INTO household (id, currency) VALUES (1, ?)")
        .run(h.currency);

      const insertMember = this.db.prepare(
        "INSERT INTO members (id, name, joined_from, departed_from, position) VALUES (?, ?, ?, ?, ?)",
      );
      h.members.forEach((member, index) => {
        insertMember.run(
          member.id,
          member.name,
          member.joinedFrom ?? null,
          member.departedFrom ?? null,
          index,
        );
      });

      const insertSource = this.db.prepare(
        "INSERT INTO income_sources (id, member_id, name, category, restricted_use, ended_from) VALUES (?, ?, ?, ?, ?, ?)",
      );
      const insertEntry = this.db.prepare(
        "INSERT INTO income_source_entries (source_id, amount_cents, effective_from) VALUES (?, ?, ?)",
      );
      for (const source of h.incomeSources) {
        insertSource.run(
          source.id,
          source.memberId,
          source.name,
          source.category ?? null,
          source.restrictedUse ? 1 : 0,
          source.endedFrom ?? null,
        );
        for (const entry of source.timeline) {
          insertEntry.run(source.id, entry.amountCents, entry.effectiveFrom);
        }
      }

      const insertExpense = this.db.prepare(
        "INSERT INTO expenses (id, name, category, effective_from, ended_from, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      h.expenses.forEach((expense, index) => {
        insertExpense.run(
          expense.id,
          expense.name,
          expense.category ?? null,
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

      const insertSubItem = this.db.prepare(
        "INSERT INTO sub_items (id, expense_id, name, ended_from) VALUES (?, ?, ?, ?)",
      );
      for (const si of h.subItems) {
        insertSubItem.run(si.id, si.expenseId, si.name, si.endedFrom ?? null);
      }
      const insertSIAmount = this.db.prepare(
        "INSERT INTO sub_item_amounts (sub_item_id, month, amount_cents) VALUES (?, ?, ?)",
      );
      for (const a of h.subItemAmounts) {
        insertSIAmount.run(a.subItemId, a.month, a.amountCents);
      }

      const insertGoal = this.db.prepare(
        "INSERT INTO goals (id, name, category, effective_from, ended_from, target_amount_cents, start_amount_cents, split_rule, participants, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      h.goals.forEach((goal, index) => {
        insertGoal.run(
          goal.id,
          goal.name,
          goal.category ?? null,
          goal.effectiveFrom,
          goal.endedFrom ?? null,
          goal.targetAmountCents ?? null,
          goal.startAmountCents ?? null,
          JSON.stringify(goal.splitRule),
          JSON.stringify(goal.participants),
          index,
        );
      });

      const insertContribution = this.db.prepare(
        "INSERT INTO goal_contributions (goal_id, month, amount_cents) VALUES (?, ?, ?)",
      );
      for (const c of h.goalContributions) {
        insertContribution.run(c.goalId, c.month, c.amountCents);
      }
    });

    replace(household);
  }

  close(): void {
    this.db.close();
  }
}
