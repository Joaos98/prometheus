# 11 — Savings goals

**What to build:** Savings goals — individual or shared among chosen Participants — with an optional target amount and any Split Rule for contributions, mirroring expense mechanics. Contributions are entered per Month and divided among Participants by the goal's rule. Each goal shows accumulated contributions against its target. Goals end Effective From a Month; unentered contributions are flagged pending exactly like expenses. With this ticket the Leftover Balance reaches its full formula: Spendable Income − expense Shares − contribution Shares. There is no withdrawal concept — a completed goal is simply ended (ADR-0001).

**Blocked by:** 06 — Custom splits with exact-sum validation

**Status:** ready-for-agent

- [x] Create a goal with a name, optional target amount, Participants, and any Split Rule
- [x] Contributions are entered per Month and split among Participants by the goal's rule, summing exactly after rounding
- [x] Each goal displays accumulated contributions versus its target
- [x] An active goal with no contribution entered for a Month is flagged pending; an explicit $0 is not flagged
- [x] Ending a goal Effective From M removes it from M onward; history keeps it and its accumulated total
- [x] Leftover Balance = Spendable Income − expense Shares − contribution Shares; negative values display plainly
- [x] No withdrawal or spending-from-goal concept exists anywhere
