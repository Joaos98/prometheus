import { existsSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "@prometheus/data";
import { computeMonthlySummary, type SplitRule, validateCustomSplitRule, validateExpenseAmount } from "@prometheus/engine";
import express from "express";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const nextMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + 1;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
};

const dbPath = process.env.PROMETHEUS_DB ?? "prometheus.db";
const store = new SqliteStore(dbPath);

const app = express();
app.use(express.json());

app.get("/api/household", (_req, res) => {
  res.json({
    currency: store.getCurrency(),
    members: store.getMembers(),
    incomeSources: store.getIncomeSources(),
    expenses: store.getExpenses(),
    expenseAmounts: store.getExpenseAmounts(),
    goals: store.getGoals(),
    goalContributions: store.getGoalContributions(),
  });
});

app.post("/api/household/currency", (req, res) => {
  const { currency } = req.body as Record<string, unknown>;
  if (!currency || typeof currency !== "string") {
    res.status(400).json({ error: "currency is required" });
    return;
  }
  try {
    store.setCurrency(currency);
    res.json({ currency });
  } catch (e) {
    if (e instanceof Error && e.message === "Currency is already set") {
      res.status(409).json({ error: "currency is already set" });
      return;
    }
    throw e;
  }
});

app.post("/api/members", (req, res) => {
  const { name, joinedFrom } = req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const member = store.addMember(
    name,
    typeof joinedFrom === "string" ? joinedFrom : undefined,
  );
  res.status(201).json(member);
});

app.post("/api/members/:id/depart", (req, res) => {
  const { effectiveFrom } = req.body as Record<string, unknown>;
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  store.departMember(req.params.id, effectiveFrom);
  res.json({ id: req.params.id, departedFrom: effectiveFrom });
});

app.patch("/api/members/:id", (req, res) => {
  const { name } = req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    store.renameMember(req.params.id, name);
    res.json({ id: req.params.id, name });
  } catch {
    res.status(404).json({ error: "member not found" });
  }
});

app.post("/api/income-sources", (req, res) => {
  const { memberId, name, amountCents, effectiveFrom } = req.body as Record<
    string,
    unknown
  >;
  if (!memberId || typeof memberId !== "string") {
    res.status(400).json({ error: "memberId is required" });
    return;
  }
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    res.status(400).json({ error: "amountCents must be an integer" });
    return;
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  const source = store.addIncomeSource(
    memberId,
    name,
    amountCents,
    effectiveFrom,
    Boolean(req.body.restrictedUse),
  );
  if (req.body.oneOff) {
    store.endIncomeSource(source.id, nextMonth(effectiveFrom));
  }
  res.status(201).json(source);
});

app.post("/api/income-sources/:id/amount", (req, res) => {
  const { amountCents, effectiveFrom } = req.body as Record<string, unknown>;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    res.status(400).json({ error: "amountCents must be an integer" });
    return;
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  store.updateIncomeSourceAmount(req.params.id, amountCents, effectiveFrom);
  res.json({ id: req.params.id, amountCents, effectiveFrom });
});

app.post("/api/income-sources/:id/end", (req, res) => {
  const { effectiveFrom } = req.body as Record<string, unknown>;
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  store.endIncomeSource(req.params.id, effectiveFrom);
  res.json({ id: req.params.id, endedFrom: effectiveFrom });
});

app.post("/api/expenses", (req, res) => {
  const { name, participants, splitRule, effectiveFrom } = req.body as Record<
    string,
    unknown
  >;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!Array.isArray(participants)) {
    res.status(400).json({ error: "participants must be an array" });
    return;
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  const rule =
    splitRule && typeof splitRule === "object"
      ? (splitRule as { method: string })
      : { method: "even" };
  const validMethods = ["even", "proportional", "custom"];
  if (!validMethods.includes(rule.method)) {
    res.status(400).json({ error: "invalid splitRule.method" });
    return;
  }
  const typedRule = rule as unknown as { method: string; mode?: string; values?: Record<string, number> };
  const validationError = validateCustomSplitRule(typedRule as never);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  const expense = store.addExpense(
    name,
    participants as string[],
    typedRule as { method: "even" } | { method: "proportional" } | { method: "custom"; mode: "percent" | "amount"; values: Record<string, number> },
    effectiveFrom,
  );
  if (req.body.oneOff) {
    store.endExpense(expense.id, nextMonth(effectiveFrom));
  }
  res.status(201).json(expense);
});

app.post("/api/expenses/:id/end", (req, res) => {
  const { effectiveFrom } = req.body as Record<string, unknown>;
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  store.endExpense(req.params.id, effectiveFrom);
  res.json({ id: req.params.id, endedFrom: effectiveFrom });
});

app.post("/api/expenses/:id/amount", (req, res) => {
  const { month, amountCents } = req.body as Record<string, unknown>;
  if (!month || typeof month !== "string") {
    res.status(400).json({ error: "month is required" });
    return;
  }
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    res.status(400).json({ error: "amountCents must be an integer" });
    return;
  }
  const expenses = store.getExpenses();
  const expense = expenses.find((e) => e.id === req.params.id);
  if (!expense) {
    res.status(404).json({ error: "expense not found" });
    return;
  }
  const validationError = validateExpenseAmount(expense, amountCents);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  store.setExpenseAmount(req.params.id, month, amountCents);
  res.json({ expenseId: req.params.id, month, amountCents });
});

app.post("/api/expenses/:id/change-split", (req, res) => {
  const { splitRule, effectiveFrom } = req.body as Record<string, unknown>;
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  const rule = splitRule as { method: string };
  const validMethods = ["even", "proportional", "custom"];
  if (!rule || !validMethods.includes(rule.method)) {
    res.status(400).json({ error: "invalid splitRule" });
    return;
  }
  const validationError = validateCustomSplitRule(rule as never);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  try {
    const expense = store.changeExpenseSplitRule(
      req.params.id,
      rule as SplitRule,
      effectiveFrom,
    );
    res.json(expense);
  } catch {
    res.status(404).json({ error: "expense not found" });
  }
});

app.post("/api/expenses/:id/change-participants", (req, res) => {
  const { participants, effectiveFrom } = req.body as Record<
    string,
    unknown
  >;
  if (!Array.isArray(participants)) {
    res.status(400).json({ error: "participants must be an array" });
    return;
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  try {
    const expense = store.changeExpenseParticipants(
      req.params.id,
      participants as string[],
      effectiveFrom,
    );
    res.json(expense);
  } catch {
    res.status(404).json({ error: "expense not found" });
  }
});

app.post("/api/goals", (req, res) => {
  const { name, participants, splitRule, targetAmountCents, effectiveFrom } =
    req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!Array.isArray(participants)) {
    res.status(400).json({ error: "participants must be an array" });
    return;
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  const rule =
    splitRule && typeof splitRule === "object"
      ? (splitRule as { method: string })
      : { method: "even" };
  const validMethods = ["even", "proportional", "custom"];
  if (!validMethods.includes(rule.method)) {
    res.status(400).json({ error: "invalid splitRule.method" });
    return;
  }
  const goal = store.addGoal(
    name,
    participants as string[],
    rule as { method: "even" } | { method: "proportional" },
    typeof targetAmountCents === "number" ? (targetAmountCents as number) : undefined,
    effectiveFrom,
  );
  res.status(201).json(goal);
});

app.post("/api/goals/:id/end", (req, res) => {
  const { effectiveFrom } = req.body as Record<string, unknown>;
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    res.status(400).json({ error: "effectiveFrom is required" });
    return;
  }
  store.endGoal(req.params.id, effectiveFrom);
  res.json({ id: req.params.id, endedFrom: effectiveFrom });
});

app.post("/api/goals/:id/contribution", (req, res) => {
  const { month, amountCents } = req.body as Record<string, unknown>;
  if (!month || typeof month !== "string") {
    res.status(400).json({ error: "month is required" });
    return;
  }
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    res.status(400).json({ error: "amountCents must be an integer" });
    return;
  }
  store.setGoalContribution(req.params.id, month, amountCents);
  res.json({ goalId: req.params.id, month, amountCents });
});

app.get("/api/summary", (req, res) => {
  const month =
    typeof req.query.month === "string" ? req.query.month : currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: "month must be YYYY-MM" });
    return;
  }
  res.json(computeMonthlySummary(store.getHousehold(), month));
});

const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(dist, "index.html"));
      return;
    }
    next();
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Prometheus listening on http://localhost:${port}`);
});
