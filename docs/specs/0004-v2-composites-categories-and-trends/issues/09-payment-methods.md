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

**Status:** done

**Suggested model:** Sonnet, medium thinking — every decision is already made; the work is
generalising what exists without weakening it.

- [x] `PaymentMethod` and `Household.paymentMethods` exist, mirroring categories
- [x] `ExpenseSnapshot.paymentMethod` is `PaymentMethodId | null`
- [x] Add, rename, usage query, delete, and clear-then-delete all work as they do for
      categories
- [x] The clear leaves `reviewed` untouched, covered by its own test
- [x] The clear-before-delete ordering holds
- [x] `paymentMethod` is a compared `DriftField`
- [x] Both adapters round-trip the list and the field, asserted in `storage/port-contract.ts`
- [x] A v1.2 Household loads with `paymentMethods: []` and every Expense unset
- [x] Import rejects a file naming a payment method id it does not define
- [x] The picker offers the Household's methods or none, with no silent minting
- [x] A set method shows a chip; an unset one shows nothing
- [x] The management modal lists, adds, renames and deletes, with the same destructive
      confirmation
- [x] The two lists are independent: an Expense may hold either, both or neither, and no
      picker offers entries from the other list
- [x] No total, split, Share or chart is affected by a payment method
- [x] The shared implementation is one parameterised path, or the comments say why not
- [x] `npm run typecheck` is clean and the full suite passes

## Comments

Built as a genuinely shared engine rather than a duplicated one: `domain/vocabulary.ts` is
a new generic module — `addItem`/`renameItem`/`itemUsage`/`clearItem`/`deleteItem` over a
`Vocabulary` interface (a list accessor and an Expense field accessor) — and both
`domain/categories.ts` and the new `domain/payment-methods.ts` are thin wrappers over it
that only name their list, their field, and their noun for messages. This is the same
extraction shape as `apportion`.

`domain/transfer.ts`'s import/export reader stays a separate, deliberate duplication of the
uniqueness check (documented in its own comment): it runs over an untrusted file shape
rather than a live `Household`, so it was generalised in its own way (`readVocabulary`/
`readVocabularyRef`, parameterised by noun) rather than sharing `vocabulary.ts` directly.

`storage/sqlite-store.ts` gained migration 4 (`payment_methods` column, no default) on the
same footing as migration 3's `categories` column; `storage/stored.ts`'s `fromStored` now
tracks two independent legacy flags, since a Household that already has categories (every
Household from tickets 05–08) but predates payment methods must default only the second —
covered by its own test (`defaults only payment methods on a Household that already has
categories`).

UI mirrors categories file-for-file: `ui/payment-methods.ts` (pure helpers), the write
functions on `useHousehold()` (`addPaymentMethod`/`renamePaymentMethod`/
`deletePaymentMethod`/`clearAndDeletePaymentMethod`), `PaymentMethodsPanel.vue` (management
modal), and a second picker plus "+ New payment method" inline mint in `ExpenseForm.vue`
beside the category one — independent state, independent props, an Expense may hold either.
`ExpensesPanel.vue` renders the chip on the same "chip or nothing" terms as the category
chip.

`ExpenseDraft.paymentMethod` was made optional (defaulting to `null` in
`addExpenseSnapshot`), unlike `category`, which stays required — noted in a comment on the
field itself, since every existing caller (including the demo seed, out of scope until
ticket 14) predates the field and none is required to name one.

Checked: `npm run typecheck` clean; full suite (855 tests, up from 801) passing, including
new `domain/payment-methods.test.ts` (mirroring `domain/categories.test.ts` plus an
independence test), `ui/payment-methods.test.ts`, additions to `domain/drift.test.ts`,
`domain/transfer.test.ts`, `storage/stored.test.ts`, `storage/port-contract.ts`, and
`ui/household.test.ts`'s deletion/clear flows. Verified by hand in the running demo build:
added a payment method, picked it on an existing Expense, and confirmed the chip renders
next to the category chip with no console errors.
