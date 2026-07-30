import { DomainError } from './errors.js'
import { editExpenseSnapshot, expenseIn, type ExpenseEdits } from './expenses.js'
import { monthAt, openedMonthKeys } from './month.js'
import { openedMonth, type RowChange } from './rows.js'
import type { ExpenseSnapshot, Household, MonthKey, RowId } from './types.js'

/**
 * Whether renaming this Expense Snapshot to `name` has to ask the member what they
 * meant: is this the same cost under a new name, or a different cost taking its place?
 *
 * The two are identical in the row and demand opposite handling, so no rule can tell
 * them apart — which is why this is a question rather than a decision. It arises only
 * for a row that could be either: one that arrived by inheritance, still sharing its
 * identity with an earlier Month, and so carrying a history that renaming would
 * silently hand to whatever the new name means. A row created in this Month has no
 * thread behind it to inherit or to end, so renaming it is only ever a correction.
 *
 * The prompt is the UI's to raise; eligibility is the engine's to answer. The question
 * is asked of the name alone — category, amount, Participants and Split Rule are
 * per-Month fields, and changing them says nothing about which cost this is.
 */
export function renamingAsks(
  household: Household,
  key: MonthKey,
  id: RowId,
  name: string,
): boolean {
  const month = monthAt(household, key)
  const row = month && expenseIn(month, id)
  if (!row) return false
  if (name.trim() === row.name) return false
  return inherited(household, key, id)
}

/**
 * Answers the question with "a different cost begins here": the row keeps its place in
 * the Month but is given a freshly minted identity, so the old thread ends at the
 * Previous Month and the new one starts here.
 *
 * The mint carries forward through every later opened Month that had inherited the old
 * identity, because those rows descend from this one — they are the same cost this row
 * has become, whatever they are still called. Inheritance is the only way an identity
 * travels, so holding it is proof of descent and there is no later row the mint should
 * pass over.
 *
 * Only the identity moves. Every other field of a later Month is that Month's own, and
 * carrying this Month's new name into them is Forward Propagation's business, not this.
 */
export function repurposeExpenseSnapshot(
  household: Household,
  key: MonthKey,
  id: RowId,
  edits: ExpenseEdits,
): RowChange<ExpenseSnapshot> {
  const month = openedMonth(household, key)
  if (!expenseIn(month, id)) throw new DomainError(`${month.key} holds no Expense ${id}`)
  if (!inherited(household, key, id)) {
    throw new DomainError(
      `No Month before ${month.key} holds the Expense ${id}, so there is no thread to end`,
    )
  }

  const edited = editExpenseSnapshot(household, key, id, edits)
  const minted = crypto.randomUUID()
  return {
    household: rethread(edited.household, key, id, minted),
    row: { ...edited.row, id: minted },
  }
}

/**
 * Whether the row carries a thread that predates this Month — which is what makes a
 * rename ambiguous, and the exact thing "arrived by inheritance" means.
 *
 * It asks every earlier opened Month rather than only the Previous one. Ordinarily
 * those answer alike, since inheritance carries a row from each Month to the next. They
 * part company when a Month in between has since dropped the row: the history is still
 * there in the Months before it, and renaming would still hand that history to whatever
 * the new name means. Looking only one Month back would call such a row this Month's
 * own and let the rename through unasked.
 *
 * An identity travels no way but inheritance, so a row recorded in this Month bears an
 * identity no earlier Month can hold, and is never mistaken for one with a past.
 */
function inherited(household: Household, key: MonthKey, id: RowId): boolean {
  return openedMonthKeys(household)
    .filter((opened) => opened < key)
    .some((opened) => expenseIn(monthAt(household, opened)!, id) !== undefined)
}

/**
 * Gives the row, and every later Month's descendant of it, its new identity.
 *
 * A later Month that does not hold the row is passed over rather than stopping the
 * walk. The cost ended there and began again afterwards, or a member has since taken it
 * out of that one Month; either way the Months beyond it hold the identity only by
 * having inherited it, so they are on this thread and must come with it. Stopping at
 * the gap would leave the retired identity alive after it, which is the old thread
 * resuming rather than ending.
 */
function rethread(household: Household, from: MonthKey, id: RowId, minted: RowId): Household {
  const months = { ...household.months }
  for (const key of openedMonthKeys(household).filter((opened) => opened >= from)) {
    const month = months[key]!
    if (!expenseIn(month, id)) continue
    months[key] = {
      ...month,
      expenses: month.expenses.map((row) => (row.id === id ? { ...row, id: minted } : row)),
    }
  }
  return { ...household, months }
}
