# 11 — Savings goals

**What to build:** Savings goals — individual or shared among chosen Participants — with an optional target amount and any Split Rule for contributions, mirroring expense mechanics. Contributions are entered per Month and divided among Participants by the goal's rule. Each goal shows accumulated contributions against its target. Goals end Effective From a Month; unentered contributions are flagged pending exactly like expenses. With this ticket the Leftover Balance reaches its full formula: Spendable Income − expense Shares − contribution Shares. There is no withdrawal concept — a completed goal is simply ended (ADR-0001).

**Blocked by:** 06 — Custom splits with exact-sum validation

**Status:** ready-for-agent

- [ ] Create a goal with a name, optional target amount, Participants (exactly one = individual goal), and any Split Rule — even, proportional, or custom in either mode
- [ ] Contributions are entered per Month and split among Participants by the goal's rule, summing exactly after rounding (engine seam)
- [ ] Each goal displays accumulated contributions versus its target (or versus no target for open-ended goals)
- [ ] An active goal with no contribution entered for a Month is flagged pending; an explicit $0 is not flagged
- [ ] Ending a goal Effective From M removes it from M onward; history keeps it and its accumulated total
- [ ] Leftover Balance = Spendable Income − expense Shares − contribution Shares (engine seam); negative values display plainly
- [ ] No withdrawal or spending-from-goal concept exists anywhere
