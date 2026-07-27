import { existsSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "@prometheus/data";
import { computeMonthlySummary } from "@prometheus/engine";
import express from "express";

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const dbPath = process.env.PROMETHEUS_DB ?? "prometheus.db";
const store = new SqliteStore(dbPath);

const app = express();
app.use(express.json());

app.get("/api/household", (_req, res) => {
  res.json({ currency: store.getCurrency(), members: store.getMembers() });
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
  const { name } = req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const member = store.addMember(name);
  res.status(201).json(member);
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
