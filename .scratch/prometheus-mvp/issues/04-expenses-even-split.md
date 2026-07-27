# 04 — Expenses with even split and per-Month amounts

**What to build:** Create recurring expenses — name, Participants, even Split Rule — Effective From a Month, and end them the same way. Enter each active expense's actual amount per Month. The dashboard shows every expense's per-member Shares and each member's first real Leftover Balance (Income − expense Shares, negative allowed). Active expenses with no amount entered for the displayed Month are flagged as pending — visibly distinct from an explicitly entered $0.

**Blocked by:** 03 — Income sources

**Status:** ready-for-agent

- [x] Create an expense with one or more Participants; with exactly one Participant it is an individual expense and no split choice is offered
- [x] Even split: Shares are equal within rounding and always sum exactly to the entered amount (engine seam: largest-remainder, identical results on repeated computation)
- [x] Amounts are entered per Month; the same expense can hold different amounts in different Months
- [x] Ending an expense Effective From M removes it from M onward; earlier Months keep it
- [x] An active expense with no amount for the displayed Month renders as pending and contributes nothing to totals; an explicit $0 is not flagged
- [x] Dashboard shows per-member Leftover Balance = Income − Σ expense Shares, displaying negative values plainly

## Comments

Implemented. Engine: added endedFrom and pendingExpenses to the domain model; endedFrom filtering mirrors the income endedFrom pattern; pending detection distinguishes absent amount from explicit $0; leftoverCents = incomeCents - totalCents per member. 5 new behavior tests cover endedFrom, pending, explicit $0, individual expense, and leftover formula. Data layer: 6 new contract tests for add/get/end expenses and set/get amounts (UPSERT). Server: POST /api/expenses, POST .../end, POST .../amount; household endpoint now includes expenses and expenseAmounts. Client: expense section with participant checkbox selection, per-Month amount entry, end control, pending expense list, and per-member leftover breakdown (Income - Shares = Leftover).
