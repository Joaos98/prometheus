# 09 — Payment methods

**What to build:** A second Household-level list of exactly the same shape as categories,
and a second nullable id on `ExpenseSnapshot` — engine, storage, export, import and UI, in
one ticket, because tickets 05 to 08 have already built and argued every piece of it.

`PaymentMethodId`, `PaymentMethod { id, name }`, `Household.paymentMethods`,
`ExpenseSnapshot.paymentMethod: PaymentMethodId | null`. The same add and rename, the same
usage query, the same delete-and-clear with the same ordering rule and the same `reviewed`
exception, the same read-side default of `null`, the same import check, the same picker,
the same chip-or-nothing on the row, the same management modal.

**Reuse rather than duplicate.** Two lists of `{ id, name }` with identical operations is
one implementation parameterised by which list it acts on, not two copies free to drift
apart. This is spec 0003's own argument for extracting `apportion` rather than writing
largest remainder twice. If the shapes turn out to resist a shared implementation, say so in
the comments and duplicate deliberately.

**The two lists stay independent.** A payment method is not a kind of spending. They are
separate fields, separate pickers, separate lists, and an Expense may have either, both or
neither.

**Nothing computes with it.** It weights no split, enters no total, and no chart in this
spec draws it. `paymentMethod` joins `category` as a compared `DriftField` — it is a field
of the row like any other and can be corrected in an earlier Month like any other — and that
is the full extent of its involvement in the engine. Spec 0001 rules out payment tracking
of any kind; this field says how the money left the account and nothing about who paid or
whether they did, and it must not grow toward the latter.

**Blocked by:** 08

**Status:** ready-for-agent

**Suggested model:** Sonnet, medium thinking — every decision is already made; the work is
generalising what exists without weakening it.

- [ ] `PaymentMethod` and `Household.paymentMethods` exist, mirroring categories
- [ ] `ExpenseSnapshot.paymentMethod` is `PaymentMethodId | null`
- [ ] Add, rename, usage query, delete, and clear-then-delete all work as they do for
      categories
- [ ] The clear leaves `reviewed` untouched, covered by its own test
- [ ] The clear-before-delete ordering holds
- [ ] `paymentMethod` is a compared `DriftField`
- [ ] Both adapters round-trip the list and the field, asserted in `storage/port-contract.ts`
- [ ] A v1.2 Household loads with `paymentMethods: []` and every Expense unset
- [ ] Import rejects a file naming a payment method id it does not define
- [ ] The picker offers the Household's methods or none, with no silent minting
- [ ] A set method shows a chip; an unset one shows nothing
- [ ] The management modal lists, adds, renames and deletes, with the same destructive
      confirmation
- [ ] The two lists are independent: an Expense may hold either, both or neither, and no
      picker offers entries from the other list
- [ ] No total, split, Share or chart is affected by a payment method
- [ ] The shared implementation is one parameterised path, or the comments say why not
- [ ] `npm run typecheck` is clean and the full suite passes
