import path from "node:path";
import { existsSync } from "node:fs";
import { SqliteStore } from "@prometheus/data";
import { computeMonthlySummary } from "@prometheus/engine";
import express from "express";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const store = new SqliteStore(process.env.PROMETHEUS_DB ?? "prometheus.db");
const app = express();
app.use(express.json());

app.get("/api/household", (_req, res) => {
  res.json({
    currency: store.getCurrency(),
    members: store.getMembers(),
    incomeProfiles: store.getIncomeProfiles(),
    expenseTemplates: store.getExpenseTemplates(),
    goals: store.getGoals(),
  });
});

app.post("/api/household/currency", (req, res) => {
  const { currency } = req.body as Record<string, unknown>;
  if (!currency || typeof currency !== "string") { res.status(400).json({ error: "currency is required" }); return; }
  try { store.setCurrency(currency); res.json({ currency }); }
  catch { res.status(409).json({ error: "currency is already set" }); }
});

app.get("/api/income-profiles", (_req, res) => {
  res.json(store.getIncomeProfiles());
});

app.post("/api/income-profiles", (req, res) => {
  const { memberId, name, amountCents, restrictedUse } = req.body as Record<string, unknown>;
  if (!memberId || typeof memberId !== "string") { res.status(400).json({ error: "memberId is required" }); return; }
  if (!name || typeof name !== "string") { res.status(400).json({ error: "name is required" }); return; }
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) { res.status(400).json({ error: "amountCents must be an integer" }); return; }
  const p = store.addIncomeProfile(memberId, name, amountCents, Boolean(restrictedUse));
  res.status(201).json(p);
});

app.patch("/api/income-profiles/:id", (req, res) => {
  const { amountCents, restrictedUse, name } = req.body as Record<string, unknown>;
  const updates: { amountCents?: number; restrictedUse?: boolean; name?: string } = {};
  if (typeof amountCents === "number" && Number.isInteger(amountCents)) updates.amountCents = amountCents;
  if (typeof restrictedUse === "boolean") updates.restrictedUse = restrictedUse;
  if (typeof name === "string") updates.name = name;
  store.updateIncomeProfile(req.params.id, updates);
  res.json({ id: req.params.id, ...updates });
});

app.delete("/api/income-profiles/:id", (req, res) => {
  store.removeIncomeProfile(req.params.id);
  res.json({ deleted: req.params.id });
});

app.post("/api/expense-templates", (req, res) => {
  const { name, defaultParticipants, defaultSplitRule, category } = req.body as Record<string, unknown>;
  if (!name || !Array.isArray(defaultParticipants) || !defaultSplitRule) {
    res.status(400).json({ error: "name, defaultParticipants, and defaultSplitRule are required" });
    return;
  }
  const t = store.addExpenseTemplate(
    name as string,
    defaultParticipants as string[],
    defaultSplitRule as { method: "even" } | { method: "proportional" } | { method: "custom"; mode: "percent" | "amount"; values: Record<string, number> },
    typeof category === "string" ? category : undefined,
  );
  res.status(201).json(t);
});

app.post("/api/expense-templates/:id/end", (req, res) => {
  store.endExpenseTemplate(req.params.id);
  res.json({ id: req.params.id, active: false });
});

app.post("/api/expenses/snapshot", (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : currentMonth();
  store.snapshotExpenses(month);
  res.json({ month, snapshots: store.getMonthData(month).expenseSnapshots.length });
});

app.post("/api/expense-snapshots", (req, res) => {
  const { expenseId, month, amountCents, participants, splitRule } = req.body as Record<string, unknown>;
  if (!expenseId || !month || typeof amountCents !== "number") {
    res.status(400).json({ error: "expenseId, month, and amountCents are required" });
    return;
  }
  const templates = store.getExpenseTemplates();
  const t = templates.find((tp) => tp.id === expenseId);
  const name = t?.name ?? (expenseId as string);
  store.addExpenseSnapshot({
    month: month as string,
    expenseId: expenseId as string,
    name,
    amountCents: amountCents as number,
    participants: (participants as string[]) ?? t?.defaultParticipants ?? [],
    splitRule: (splitRule as { method: string }) ?? t?.defaultSplitRule ?? { method: "even" },
  });
  res.status(201).json({ expenseId, month });
});

app.post("/api/expenses/propagate", (req, res) => {
  const { expenseId, sourceMonth } = req.body as Record<string, unknown>;
  if (!expenseId || !sourceMonth) { res.status(400).json({ error: "expenseId and sourceMonth required" }); return; }
  const src = store.getExpenseSnapshots().find(s => s.expenseId === expenseId && s.month === sourceMonth);
  if (!src) { res.status(404).json({ error: "source snapshot not found" }); return; }
  const all = store.getExpenseSnapshots().filter(s => s.expenseId === expenseId && s.month > sourceMonth);
  for (const snap of all) {
    store.addExpenseSnapshot({ ...snap, amountCents: src.amountCents, participants: src.participants, splitRule: src.splitRule });
  }
  res.json({ propagated: all.length });
});

app.get("/api/goals", (_req, res) => { res.json(store.getGoals()); });

app.post("/api/goals", (req, res) => {
  const { name, participants, targetAmountCents, startAmountCents } = req.body as Record<string, unknown>;
  if (!name || !Array.isArray(participants)) { res.status(400).json({ error: "name and participants are required" }); return; }
  const g = store.addGoal(name as string, participants as string[], typeof targetAmountCents === "number" ? targetAmountCents as number : undefined, typeof startAmountCents === "number" ? startAmountCents as number : undefined);
  res.status(201).json(g);
});

app.post("/api/goals/:id/end", (req, res) => { store.endGoal(req.params.id); res.json({ id: req.params.id, active: false }); });

app.post("/api/goal-contributions", (req, res) => {
  const { goalId, memberId, month, amountCents } = req.body as Record<string, unknown>;
  if (!goalId || !memberId || !month || typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    res.status(400).json({ error: "invalid fields" }); return;
  }
  store.addGoalContribution(goalId as string, memberId as string, month as string, amountCents as number);
  res.status(201).json({ goalId, memberId, month, amountCents });
});

app.post("/api/income/snapshot", (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : currentMonth();
  store.snapshotProfile(month);
  res.json({ month, snapshots: store.getMonthData(month).incomeSnapshots.length });
});

app.post("/api/income", (req, res) => {
  const { memberId, name, amountCents, month, restrictedUse } = req.body as Record<string, unknown>;
  if (!memberId || !name || typeof amountCents !== "number") { res.status(400).json({ error: "invalid fields" }); return; }
  const m = (month as string) ?? currentMonth();
  store.addIncomeSnapshot({ month: m, memberId: memberId as string, name: name as string, amountCents: amountCents as number, restrictedUse: Boolean(restrictedUse) });
  res.status(201).json({ month: m });
});

app.get("/api/members", (_req, res) => {
  res.json(store.getMembers());
});

app.post("/api/members", (req, res) => {
  const { name, joinedFrom } = req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") { res.status(400).json({ error: "name is required" }); return; }
  const member = store.addMember(name, typeof joinedFrom === "string" ? joinedFrom : undefined);
  res.status(201).json(member);
});

app.get("/api/summary", (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : currentMonth();
  res.json(computeMonthlySummary(store.getMonthData(month)));
});

const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) { res.sendFile(path.join(dist, "index.html")); return; }
    next();
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Prometheus listening on http://localhost:${port}`));
