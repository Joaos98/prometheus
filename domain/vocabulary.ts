/**
 * One Household-level list of `{ id, name }` entries used as a label on an Expense —
 * categories and payment methods are the two so far (ADR-0012), and the same argument
 * spec 0003 made for extracting `apportion` out of `shares.ts` applies here: two lists
 * with identical operations are one implementation parameterised by which list it acts
 * on, not two copies free to drift apart.
 *
 * A `Vocabulary` says how to reach the list on a Household and the field on an Expense
 * that holds one of its ids. `domain/categories.ts` and `domain/payment-methods.ts` are
 * the thin, differently-named wrappers a caller actually imports — this module knows
 * nothing about categories or payment methods by name.
 */
import { DomainError } from './errors.js'
import { mintId } from './identity.js'
import { monthName } from './month-key.js'
import { openedMonthKeys } from './month.js'
import { requireName, withMonth } from './rows.js'
import type { ExpenseSnapshot, Household, MonthKey } from './types.js'

/** The shape every vocabulary entry has: an id and a name, nothing else. */
export interface VocabularyItem {
  id: string
  name: string
}

export interface Vocabulary {
  /** Singular, lower-case, for messages: "category", "payment method". */
  noun: string
  list(household: Household): VocabularyItem[]
  withList(household: Household, list: VocabularyItem[]): Household
  fieldOf(expense: ExpenseSnapshot): string | null
  withField(expense: ExpenseSnapshot, id: string | null): ExpenseSnapshot
}

/** What using an entry costs to give up: the rows that hold it and the Months they are in. */
export interface VocabularyUsage {
  rowCount: number
  /** The Months that hold at least one row of this entry, in calendar order. */
  months: MonthKey[]
}

/** One Expense with an entry taken off it, and the Month whose row it is. */
export interface VocabularyClearedRow {
  month: MonthKey
  row: ExpenseSnapshot
}

/**
 * An entry taken off every row that held it: the Household as it now stands, and the
 * rows a store has to be given, one at a time.
 */
export interface VocabularyClearance {
  household: Household
  rows: VocabularyClearedRow[]
}

/** Adds an entry to the vocabulary, its id minted fresh. */
export function addItem(vocabulary: Vocabulary, household: Household, name: string): Household {
  const named = requireName(name, subject(vocabulary))
  requireUniqueName(vocabulary, household, named)
  const item: VocabularyItem = { id: mintId(), name: named }
  return vocabulary.withList(household, [...vocabulary.list(household), item])
}

/**
 * Renames an entry. From here on every Month renders the new name, past Months
 * included — no row is touched, because a row holds only the id (ADR-0012).
 */
export function renameItem(
  vocabulary: Vocabulary,
  household: Household,
  id: string,
  name: string,
): Household {
  requireItem(vocabulary, household, id)
  const named = requireName(name, subject(vocabulary))
  requireUniqueName(vocabulary, household, named, id)
  return vocabulary.withList(
    household,
    vocabulary.list(household).map((item) => (item.id === id ? { ...item, name: named } : item)),
  )
}

/**
 * Every Expense across the whole record that holds this entry, and the Months that hold
 * one. This is what a delete confirmation names — a row count and a Month range — and
 * what tells it whether a delete is immediate or has to clear the record first.
 */
export function itemUsage(vocabulary: Vocabulary, household: Household, id: string): VocabularyUsage {
  let rowCount = 0
  const months: MonthKey[] = []
  for (const key of openedMonthKeys(household)) {
    const count = household.months[key]!.expenses.filter(
      (expense) => vocabulary.fieldOf(expense) === id,
    ).length
    if (count > 0) {
      rowCount += count
      months.push(key)
    }
  }
  return { rowCount, months }
}

/**
 * Takes an entry off every row across the whole record that holds it, leaving the entry
 * itself in the vocabulary for the `deleteItem` that follows. That order is the rule
 * (ADR-0012): the clear lands first, and a run that fails partway leaves a half-cleared
 * entry that still cannot be deleted, which is a retry rather than a corrupt state.
 * Running it again finishes the job, since it only ever looks for rows that still hold
 * the entry.
 *
 * **This is not an edit, so it does not set `reviewed`.** Nobody reviewed anything: the
 * Unreviewed count is the number a monthly review is actually run against, and a
 * deletion answering for rows in eleven Months would corrupt it.
 *
 * It cannot produce Drift either: Drift weighs what a Month holds against what a fresh
 * open would *now* produce, both from the household as it stands, and a complete clear
 * moves the held row and the inherited one together.
 *
 * The cleared rows come back alongside the Household because writes are row-scoped
 * (ADR-0008): the caller hands its store each one in turn. Which of the two halves lands
 * first is a question about a store and not about the domain, so the app orders them.
 */
export function clearItem(
  vocabulary: Vocabulary,
  household: Household,
  id: string,
): VocabularyClearance {
  requireItem(vocabulary, household, id)
  const rows: VocabularyClearedRow[] = []
  let cleared = household
  for (const key of openedMonthKeys(household)) {
    const month = household.months[key]!
    if (!month.expenses.some((expense) => vocabulary.fieldOf(expense) === id)) continue
    const expenses = month.expenses.map((expense) => {
      if (vocabulary.fieldOf(expense) !== id) return expense
      const row = vocabulary.withField(expense, null)
      rows.push({ month: key, row })
      return row
    })
    cleared = withMonth(cleared, { ...month, expenses })
  }
  return { household: cleared, rows }
}

/**
 * Takes an entry out of the vocabulary. Refused while any row still holds it: the
 * refusal names what giving it up would cost, in rows and in Months. Clearing it from
 * those rows is `clearItem`, and this is what runs once every clear has landed.
 */
export function deleteItem(vocabulary: Vocabulary, household: Household, id: string): Household {
  const item = requireItem(vocabulary, household, id)
  const usage = itemUsage(vocabulary, household, id)
  if (usage.rowCount > 0) {
    const cost = costInWords(usage)
    throw new DomainError(`"${item.name}" is ${cost} — clear it before deleting it`)
  }
  return vocabulary.withList(
    household,
    vocabulary.list(household).filter((candidate) => candidate.id !== id),
  )
}

/**
 * What giving an entry up would cost, said as a member reads it: "used by 34 rows across
 * 11 Months, June 2025 – August 2026".
 */
function costInWords(usage: VocabularyUsage): string {
  const rows = usage.rowCount === 1 ? '1 row' : `${usage.rowCount} rows`
  const first = monthName(usage.months[0]!)
  if (usage.months.length === 1) return `used by ${rows} in ${first}`
  const last = monthName(usage.months.at(-1)!)
  return `used by ${rows} across ${usage.months.length} Months, ${first} – ${last}`
}

function requireItem(vocabulary: Vocabulary, household: Household, id: string): VocabularyItem {
  const item = vocabulary.list(household).find((candidate) => candidate.id === id)
  if (!item) throw new DomainError(`${id} is not a ${vocabulary.noun} this Household has`)
  return item
}

/**
 * Two entries may not share a name, compared case-insensitively: "Groceries" and
 * "groceries" are exactly the confusion a vocabulary exists to end, not a second entry
 * worth keeping apart.
 */
function requireUniqueName(
  vocabulary: Vocabulary,
  household: Household,
  name: string,
  excluding?: string,
): void {
  const clashes = vocabulary
    .list(household)
    .some((item) => item.id !== excluding && item.name.toLowerCase() === name.toLowerCase())
  if (clashes) throw new DomainError(`A ${vocabulary.noun} named "${name}" already exists`)
}

function subject(vocabulary: Vocabulary): string {
  return `A ${vocabulary.noun}`
}
