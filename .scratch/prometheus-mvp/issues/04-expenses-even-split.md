# 04 — Expenses with even split and per-Month amounts

**What to build:** Create recurring expenses — name, Participants, even Split Rule — Effective From a Month, and end them the same way. Enter each active expense's actual amount per Month. The dashboard shows every expense's per-member Shares and each member's first real Leftover Balance (Income − expense Shares, negative allowed). Active expenses with no amount entered for the displayed Month are flagged as pending — visibly distinct from an explicitly entered $0.

**Blocked by:** 03 — Income sources

**Status:** ready-for-agent

- [ ] Create an expense with one or more Participants; with exactly one Participant it is an individual expense and no split choice is offered
- [ ] Even split: Shares are equal within rounding and always sum exactly to the entered amount (engine seam: largest-remainder, identical results on repeated computation)
- [ ] Amounts are entered per Month; the same expense can hold different amounts in different Months
- [ ] Ending an expense Effective From M removes it from M onward; earlier Months keep it
- [ ] An active expense with no amount for the displayed Month renders as pending and contributes nothing to totals; an explicit $0 is not flagged
- [ ] Dashboard shows per-member Leftover Balance = Income − Σ expense Shares, displaying negative values plainly
