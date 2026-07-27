# 03 — Income sources

**What to build:** Each member's Income Sources: add a source (name, amount, Effective From Month), update its amount Effective From a chosen Month, and end it Effective From a chosen Month. Income carries forward automatically — set it once and every later Month includes it until changed or ended. The dashboard shows per-member Income for the displayed Month as the sum of their sources in effect.

**Blocked by:** 02 — Household and member setup

**Status:** ready-for-agent

- [ ] Adding a source Effective From Month M makes it appear in M and every later Month with no further entry
- [ ] Updating a source's amount Effective From M changes M onward; earlier Months keep the old amount (engine seam test)
- [ ] Ending a source Effective From M removes it from M onward; earlier Months keep it
- [ ] A member can have multiple concurrent sources; dashboard Income is their sum for that Month
- [ ] Dashboard shows per-member Income for the displayed Month
- [ ] All income data persists across restarts via the data layer
