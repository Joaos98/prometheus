import type { LineDraft, LineEdits, LineItem, Minor, RowId, SplitRule } from '../domain/index.js'

/** How many parts a composite is made of, said the way a member would say it. */
export function lineCount(lines: LineItem[]): string {
  return lines.length === 1 ? '1 Line Item' : `${lines.length} Line Items`
}

/** One Line Item as it stands in its own two fields, before either has been read. */
export interface LineFields {
  name: string
  amount: string
}

/**
 * The four things a member can do to an Expense's Line Items, bound to the Month and the
 * row they are being done to.
 *
 * They are handed to the form rather than reached for by it, which is what keeps the form
 * the same component whether it is adding an Expense or editing one: there is no row to
 * itemise until there is a row, so an add form is simply given none of these and renders
 * no line editor.
 *
 * Each is one engine operation and one row write, landing as it is made rather than on
 * save. That is the shape ticket 01 gave the engine — lines change one at a time, so that
 * the amount they derive and the Split Rule standing against it are judged together and
 * never half-applied — and the form follows it rather than staging a list to reconcile.
 *
 * Every one that moves the total takes the Split Rule as the form's fields currently
 * stand, because a `fixed` rule only totals to one amount: it is how a member says who
 * absorbs the difference in the same breath as making it.
 */
export interface LineOperations {
  /**
   * Takes the amount as the field currently holds it, not as the row was last stored
   * with: the action says it turns *this* amount into the first line, and a member who
   * has corrected the figure and not yet saved is looking at the corrected one.
   */
  itemise: (amount: Minor) => Promise<void>
  add: (line: LineDraft, splitRule?: SplitRule) => Promise<void>
  edit: (lineId: RowId, edits: LineEdits, splitRule?: SplitRule) => Promise<void>
  remove: (lineId: RowId, splitRule?: SplitRule) => Promise<void>
}
