# 03 — Income sources

**What to build:** Each member's Income Sources: add a source (name, amount, Effective From Month), update its amount Effective From a chosen Month, and end it Effective From a chosen Month. Income carries forward automatically — set it once and every later Month includes it until changed or ended. The dashboard shows per-member Income for the displayed Month as the sum of their sources in effect.

**Blocked by:** 02 — Household and member setup

**Status:** ready-for-agent

- [x] Adding a source Effective From Month M makes it appear in M and every later Month with no further entry
- [x] Updating a source's amount Effective From M changes M onward; earlier Months keep the old amount (engine seam test)
- [x] Ending a source Effective From M removes it from M onward; earlier Months keep it
- [x] A member can have multiple concurrent sources; dashboard Income is their sum for that Month
- [x] Dashboard shows per-member Income for the displayed Month
- [x] All income data persists across restarts via the data layer

## Comments

Implemented. Engine: `IncomeSource` type with timeline entries + `endedFrom`, `computeIncomeByMember` resolves effective-dated state per Month, 4 new behavior tests (carry-forward, amount update, end, multiple sources). Data layer: 5 new contract tests for add/get/update/end/persist income sources; two SQLite tables (`income_sources` + `income_source_entries`). Server: `POST /api/income-sources`, `POST /api/income-sources/:id/amount`, `POST /api/income-sources/:id/end`. Client: income section on dashboard with per-member totals from the engine, add/update/end forms. E2E verified: month-by-month carry-forward, effective-dated updates, end semantics. Future ticket scope noted: one-off income (#13), restricted-use flag (#14-15).
