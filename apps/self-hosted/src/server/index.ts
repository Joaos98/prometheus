import { existsSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "@prometheus/data";
import { computeMonthlySummary, type Household } from "@prometheus/engine";
import express from "express";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const seedHousehold = (): Household => ({
  currency: "USD",
  members: [
    { id: "m1", name: "Ana" },
    { id: "m2", name: "Bruno" },
  ],
  expenses: [
    {
      id: "e1",
      name: "Rent",
      participants: ["m1", "m2"],
      splitRule: { method: "even" },
      effectiveFrom: "2020-01",
    },
  ],
  expenseAmounts: [
    { expenseId: "e1", month: currentMonth(), amountCents: 150000 },
  ],
});

const dbPath = process.env.PROMETHEUS_DB ?? "prometheus.db";
const store = new SqliteStore(dbPath);
if (store.getHousehold().members.length === 0) {
  store.replaceHousehold(seedHousehold());
}

const app = express();

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
