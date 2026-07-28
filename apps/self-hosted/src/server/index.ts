import path from "node:path";
import { existsSync } from "node:fs";
import { SqliteStore } from "@prometheus/data";
import { computeMonthlySummary } from "@prometheus/engine";
import express from "express";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);
const cm = currentMonth();

const store = new SqliteStore(process.env.PROMETHEUS_DB ?? "prometheus.db");
if (store.getCurrency() === null) {
  store.setCurrency("USD");
  store.addMember("Ana");
  store.addMember("Bruno");
  store.addIncomeSnapshot({ month: cm, memberId: store.getMembers()[0]!.id, name: "Salary", amountCents: 500000 });
  store.addExpenseSnapshot({
    month: cm,
    expenseId: "e1",
    name: "Rent",
    amountCents: 150000,
    participants: store.getMembers().map((m) => m.id),
    splitRule: { method: "even" },
  });
}

const app = express();
app.use(express.json());

app.get("/api/summary", (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : cm;
  res.json(computeMonthlySummary(store.getMonthData(month)));
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
app.listen(port, () => console.log(`Prometheus listening on http://localhost:${port}`));
