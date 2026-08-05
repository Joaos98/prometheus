import { ref, shallowRef } from 'vue'
import {
  addExpenseSnapshot,
  addIncomeSnapshot,
  addLineItem,
  addMember,
  addSavingsGoal,
  clearCategory,
  confirmExpenseSnapshot,
  confirmIncomeSnapshot,
  confirmSavingsGoal,
  deactivateMember,
  deleteCategory as deleteFromVocabulary,
  discardMonth,
  editExpenseSnapshot,
  editLineItem,
  exportHousehold,
  importHousehold,
  editIncomeSnapshot,
  editSavingsGoal,
  isOpened,
  itemiseExpense,
  monthAt,
  removeLineItem,
  setExpenseOneOff,
  setGoalOneOff,
  setIncomeOneOff,
  reactivateMember,
  recordContribution,
  refreshFromPreviousMonth,
  removeExpenseSnapshot,
  removeSavingsGoal,
  openedMonthKeys,
  openMonth,
  propagateExpenseEdit,
  propagateExpenseLines,
  propagateGoalEdit,
  propagateIncomeEdit,
  relabelCurrency,
  removeIncomeSnapshot,
  repurposeExpenseSnapshot,
  setUpHousehold,
  type CategoryId,
  type Currency,
  type ExpenseDraft,
  type ExpenseEdits,
  type GoalDraft,
  type GoalEdits,
  type Household,
  type IncomeDraft,
  type IncomeEdits,
  type LineDraft,
  type LineEdits,
  type MemberId,
  type Minor,
  type MonthKey,
  type Propagation,
  type RowId,
  type RowKind,
  type Setup,
  type SplitRule,
} from '../domain/index.js'
import type { HouseholdStore } from '../storage/port.js'
import { messageOf } from './changes.js'
import { thisMonth } from './months.js'
import { chosenSeed, chosenStore } from './store.js'

/** How often a Month left open on screen goes back and asks what has changed. */
const POLL = 20000

/**
 * A Household to start from where nothing is stored, which only the demo build has. It
 * is a program that drives the domain rather than a file of rows, so what it produces is
 * a Household like any other — the app cannot tell, and nothing below here is told.
 */
export type Seed = () => Household

/**
 * The Household the app is showing, and the one Month it is looking at. The engine
 * computes; this only holds what it returned and hands writes to the storage port.
 */
export function householdOver(store: HouseholdStore, seed?: Seed) {
  const household = shallowRef<Household | undefined>(undefined)
  const viewing = ref<MonthKey | undefined>(undefined)

  /**
   * How many times the Household on screen has been swapped for another one. Every other
   * change is to the Household a member is working in; an import is a different Household
   * arriving, and what a panel is halfway through belongs to the one that has just gone.
   */
  const replacements = ref(0)
  const loading = ref(true)
  const failure = ref<string | undefined>(undefined)

  /**
   * Changes are carried out one at a time. Each of them reads the Household in hand, hands
   * the store what changed, and puts back what the engine returned — and that last step is
   * only truthful if nothing else moved while the store was being waited on. Over the
   * browser's own storage nothing can; over a network it can, and the earlier change would
   * vanish from the screen while sitting perfectly well in storage.
   *
   * Waiting is also what keeps a refetch honest: what another member wrote is only worth
   * putting on screen when this member has nothing in flight to be overwritten.
   */
  let queue: Promise<unknown> = Promise.resolve()

  function inOrder<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work, work)
    queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /** A change to the Household in hand: what the engine returns is what the app shows. */
  function changing(work: (current: Household) => Promise<Household>): Promise<void> {
    return inOrder(async () => {
      const current = household.value
      if (!current) return
      household.value = await work(current)
    })
  }

  /**
   * The Household as it stands. Propagation reports back rather than returning nothing, so
   * unlike every other change here it cannot quietly do nothing when there is no Household
   * — there would be no report to give.
   */
  function current(): Household {
    const loaded = household.value
    if (!loaded) throw new Error('No Household is loaded')
    return loaded
  }

  function load(): Promise<void> {
    return inOrder(async () => {
      loading.value = true
      failure.value = undefined
      try {
        const stored = await store.loadHousehold()
        // Nothing stored and a seed to run is a demo being opened for the first time.
        // Every visit after this one finds the sample Household in the browser like any
        // other — including one the visitor has since emptied, which is theirs to have
        // emptied and is not quietly sown again underneath them.
        if (!stored && seed) {
          await sow(seed)
          return
        }

        household.value = stored
        viewing.value = stored ? landOn(stored) : undefined
      } catch (cause) {
        failure.value = messageOf(cause)
      } finally {
        loading.value = false
      }
    })
  }

  /**
   * Runs the seed and stores what it produced. Nothing here knows it is sample data: the
   * seed drives the same engine a member does, so what it hands back is a Household like
   * any other, landed in by the same rule as any other.
   */
  async function sow(sowing: Seed): Promise<void> {
    const seeded = sowing()
    await store.replaceHousehold(seeded)
    household.value = seeded
    viewing.value = landOn(seeded)
  }

  /**
   * Puts the sample Household back exactly as it arrived, whatever the visitor has done to
   * it. Nothing of theirs survives, which is the point — this is the way back to the shop
   * window, and it is offered only where there is a seed to run.
   */
  function reset(): Promise<void> {
    return inOrder(async () => {
      if (!seed) return
      await sow(seed)
      replacements.value += 1
    })
  }

  /**
   * What the other member has been doing. Their writes are row-scoped, so their edits are
   * already in the store whole; this is only the copy on this screen catching up. Where the
   * member is looking is left alone — a Month they discarded elsewhere simply goes back to
   * offering to be opened.
   *
   * Nobody asked for this, so nobody is told when it fails. Saying so would replace the
   * whole dashboard with an apology because a poll nobody noticed did not come back, and
   * the next change the member does make will report properly for itself.
   */
  function refresh(): Promise<void> {
    return inOrder(async () => {
      if (!household.value) return
      try {
        const loaded = await store.loadHousehold()
        if (loaded) household.value = loaded
      } catch {
        // Left as it was. It will be asked again.
      }
    })
  }

  /**
   * Keeps the screen roughly level with the other member: asked outright whenever the
   * window is come back to, and lightly on a timer while an opened Month is being looked
   * at. Nothing is pushed and nothing is watched — this is two people at a kitchen table,
   * not a collaborative editor.
   */
  function watchOtherMembers(every: number = POLL): () => void {
    const wake = (): void => void refresh()
    const woken = (): void => {
      if (!document.hidden) wake()
    }
    const tick = (): void => {
      const loaded = household.value
      if (!document.hidden && loaded && viewing.value && isOpened(loaded, viewing.value)) wake()
    }
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', woken)
    const timer = window.setInterval(tick, every)
    return () => {
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', woken)
      window.clearInterval(timer)
    }
  }

  function setUp(setup: Setup): Promise<void> {
    return inOrder(async () => {
      const created = setUpHousehold(setup)
      await store.createHousehold(created)
      household.value = created
      viewing.value = setup.startingMonth
    })
  }

  /**
   * Moving around the record, which changes nothing: looking at a Month the Household has
   * not opened is a read, and leaves it unopened.
   */
  function view(month: MonthKey): void {
    viewing.value = month
  }

  /** Opening a Month, which is the explicit act that brings its data into existence. */
  function open(month: MonthKey): Promise<void> {
    return changing(async (loaded) => {
      const after = openMonth(loaded, month)
      await store.openMonth(after.months[month]!)
      viewing.value = month
      return after
    })
  }

  /**
   * Discarding a Month: the whole Month goes, so the port is handed the Month rather than
   * a row. What is being looked at stays where it is — the Month is still the one the
   * member is on, now unopened and offering to be opened afresh.
   */
  function discard(month: MonthKey): Promise<void> {
    return changing(async (loaded) => {
      const after = discardMonth(loaded, month)
      await store.discardMonth(month)
      return after
    })
  }

  /** The whole Household as one file, taken from what is in hand rather than from the store. */
  function exportFile(): string {
    return exportHousehold(current())
  }

  /**
   * Importing a file, which replaces the Household wholesale. The engine reads the file
   * through before anything is written, so a file it cannot read throws here and the
   * Household — in the store and on screen — is left exactly as it was.
   *
   * What is being looked at cannot survive the replacement, since the Months are another
   * Household's: the newest Month with anything in it is where the member lands, as it is
   * when Prometheus is opened. Nor can anything a panel is halfway through, which is why
   * the replacement is counted — an edit typed before the import was meant for a Household
   * that no longer exists, and must never land in the one that has just arrived.
   */
  function importFile(text: string): Promise<void> {
    return inOrder(async () => {
      const imported = importHousehold(text)
      await store.replaceHousehold(imported)
      household.value = imported
      viewing.value = landOn(imported)
      replacements.value += 1
    })
  }

  /**
   * Renames the currency. No amount is converted, and the engine refuses a currency of
   * different decimal precision before any of this reaches storage.
   */
  function relabel(currency: Currency): Promise<void> {
    return changing(async (loaded) => {
      const relabelled = relabelCurrency(loaded, currency)
      await store.replaceHousehold(relabelled)
      return relabelled
    })
  }

  /**
   * The Roster, which is not a Month's row and so is written back whole, on the same
   * terms as relabelling the currency.
   */
  function addRosterMember(name: string): Promise<void> {
    return changing(async (loaded) => {
      const after = addMember(loaded, name)
      await store.replaceHousehold(after)
      return after
    })
  }

  function deactivateRosterMember(member: MemberId): Promise<void> {
    return changing(async (loaded) => {
      const after = deactivateMember(loaded, member)
      await store.replaceHousehold(after)
      return after
    })
  }

  function reactivateRosterMember(member: MemberId): Promise<void> {
    return changing(async (loaded) => {
      const after = reactivateMember(loaded, member)
      await store.replaceHousehold(after)
      return after
    })
  }

  /**
   * Deleting a category outright, which the engine refuses while any row still holds it.
   * The vocabulary is not a Month's row, so it goes back whole, as the Roster does.
   *
   * The refusal is what makes this safe to offer whenever nothing references the category:
   * between a panel reading that and a member clicking, the other member may have
   * categorised a row, and the engine is the only thing that knows.
   */
  function deleteCategory(id: CategoryId): Promise<void> {
    return changing(async (loaded) => {
      const after = deleteFromVocabulary(loaded, id)
      await store.replaceHousehold(after)
      return after
    })
  }

  /**
   * Taking a category off every row that holds it, and then out of the vocabulary. This is
   * destructive, irreversible and reaches into Months that are settled history, so nothing
   * calls it that has not said the cost out loud first (ADR-0012).
   *
   * The order is the rule, and it is why this is not one `replaceHousehold`: the clear is N
   * row-scoped writes (ADR-0008), and the vocabulary goes back only once every one of them
   * has landed. A run that stops partway leaves rows cleared, the category still listed and
   * `deleteCategory` still refusing it — a retry rather than a corrupt state, and running
   * this again finishes the job.
   *
   * What the row-scoping does not buy, though ADR-0012 reads as though it might, is a
   * concurrent edit's survival: the trailing `replaceHousehold` puts this member's whole
   * Household back, so an edit made elsewhere while this ran is overwritten at the end
   * anyway. Every Household-level change here carries that — the currency, the Roster,
   * propagation — for want of a port operation narrower than `replaceHousehold`.
   *
   * That the row writes and the vocabulary are one act as far as a member is concerned is
   * why the ordering has to live here: only the layer that talks to the store can say which
   * write lands first.
   */
  function clearAndDeleteCategory(id: CategoryId): Promise<void> {
    return changing(async (loaded) => {
      const { household: cleared, rows } = clearCategory(loaded, id)
      for (const { month, row } of rows) await store.writeRow(month, 'expenses', row)
      const after = deleteFromVocabulary(cleared, id)
      await store.replaceHousehold(after)
      return after
    })
  }

  /**
   * Income, one row at a time. The engine decides what the Household becomes; the port
   * is handed only the row that changed, so two members editing different rows never
   * collide.
   */
  function addIncome(month: MonthKey, draft: IncomeDraft): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = addIncomeSnapshot(loaded, month, draft)
      await store.writeRow(month, 'income', row)
      return after
    })
  }

  function editIncome(month: MonthKey, id: RowId, edits: IncomeEdits): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = editIncomeSnapshot(loaded, month, id, edits)
      await store.writeRow(month, 'income', row)
      return after
    })
  }

  function removeIncome(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const after = removeIncomeSnapshot(loaded, month, id)
      await store.deleteRow(month, 'income', id)
      return after
    })
  }

  /** Confirms a row that is correct as inherited, without editing it. */
  function confirmIncome(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = confirmIncomeSnapshot(loaded, month, id)
      await store.writeRow(month, 'income', row)
      return after
    })
  }

  function markIncomeAsOneOff(month: MonthKey, id: RowId, oneOff: boolean): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = setIncomeOneOff(loaded, month, id, oneOff)
      await store.writeRow(month, 'income', row)
      return after
    })
  }

  /** Expenses, one row at a time, on the same terms as income. */
  function addExpense(month: MonthKey, draft: ExpenseDraft): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = addExpenseSnapshot(loaded, month, draft)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  function editExpense(month: MonthKey, id: RowId, edits: ExpenseEdits): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = editExpenseSnapshot(loaded, month, id, edits)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  /**
   * Repurposing, which is not a row edit: it retires one identity and mints another, and
   * re-threads the row in every later Month that inherited it. A row-scoped write cannot
   * say that, so the Household goes back whole, as the Roster does.
   *
   * It answers with the identity it minted, because re-threading moves the identity into
   * the later Months and nothing else: they hold the new cost under the old cost's name
   * and figures until somebody carries this Month's across. That is Forward Propagation,
   * and it has nothing to propagate against without this.
   *
   * Nothing comes back when there is no Household loaded, which is the one case where
   * the change did not happen at all.
   */
  async function repurposeExpense(
    month: MonthKey,
    id: RowId,
    edits: ExpenseEdits,
  ): Promise<RowId | undefined> {
    let minted: RowId | undefined
    await changing(async (loaded) => {
      const { household: after, row } = repurposeExpenseSnapshot(loaded, month, id, edits)
      await store.replaceHousehold(after)
      minted = row.id
      return after
    })
    return minted
  }

  function removeExpense(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const after = removeExpenseSnapshot(loaded, month, id)
      await store.deleteRow(month, 'expenses', id)
      return after
    })
  }

  /** Confirms an Expense that is correct as inherited, without editing it. */
  function confirmExpense(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = confirmExpenseSnapshot(loaded, month, id)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  function markExpenseAsOneOff(month: MonthKey, id: RowId, oneOff: boolean): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = setExpenseOneOff(loaded, month, id, oneOff)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  /**
   * Line Items, one at a time, each landing as the one row it changes.
   *
   * A composite is one row everywhere the app counts rows, so every one of these is a
   * single `writeRow` against the parent — the engine derives the amount and judges the
   * Split Rule against it, and what comes back is the whole Expense as it now stands.
   *
   * The three that move the total take the Split Rule the form is showing, because a
   * `fixed` rule only totals to one amount. Passing the rule as it stands is how a member
   * says who absorbs the difference in the same breath as making it. Itemising moves no
   * money — the figure becomes a line of itself — so it needs no rule and takes none.
   */
  function itemise(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = itemiseExpense(loaded, month, id)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  function addExpenseLine(
    month: MonthKey,
    id: RowId,
    line: LineDraft,
    splitRule?: SplitRule,
  ): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = addLineItem(loaded, month, id, line, splitRule)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  function editExpenseLine(
    month: MonthKey,
    id: RowId,
    lineId: RowId,
    edits: LineEdits,
    splitRule?: SplitRule,
  ): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = editLineItem(loaded, month, id, lineId, edits, splitRule)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  function removeExpenseLine(
    month: MonthKey,
    id: RowId,
    lineId: RowId,
    splitRule?: SplitRule,
  ): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = removeLineItem(loaded, month, id, lineId, splitRule)
      await store.writeRow(month, 'expenses', row)
      return after
    })
  }

  /** Savings Goals, one row at a time, on the same terms as income and Expenses. */
  function addGoal(month: MonthKey, draft: GoalDraft): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = addSavingsGoal(loaded, month, draft)
      await store.writeRow(month, 'goals', row)
      return after
    })
  }

  function editGoal(month: MonthKey, id: RowId, edits: GoalEdits): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = editSavingsGoal(loaded, month, id, edits)
      await store.writeRow(month, 'goals', row)
      return after
    })
  }

  function removeGoal(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const after = removeSavingsGoal(loaded, month, id)
      await store.deleteRow(month, 'goals', id)
      return after
    })
  }

  /** Confirms a goal that is correct as inherited, without editing it. */
  function confirmGoal(month: MonthKey, id: RowId): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = confirmSavingsGoal(loaded, month, id)
      await store.writeRow(month, 'goals', row)
      return after
    })
  }

  function markGoalAsOneOff(month: MonthKey, id: RowId, oneOff: boolean): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = setGoalOneOff(loaded, month, id, oneOff)
      await store.writeRow(month, 'goals', row)
      return after
    })
  }

  /** What one Participant puts toward one goal this Month, entered directly. */
  function contribute(
    month: MonthKey,
    id: RowId,
    member: MemberId,
    amount: Minor | null,
  ): Promise<void> {
    return changing(async (loaded) => {
      const { household: after, row } = recordContribution(loaded, month, id, member, amount)
      await store.writeRow(month, 'goals', row)
      return after
    })
  }

  /**
   * Forward Propagation, which is not a row edit either: it writes one row in each of
   * however many later Months still hold the copy, so the Household goes back whole. What
   * it changed and what it passed over comes back to the caller, which is the only way the
   * member gets told where a later Month kept its own answer.
   */
  function propagateIncome(month: MonthKey, id: RowId, edits: IncomeEdits): Promise<Propagation> {
    return inOrder(() => carryForward(propagateIncomeEdit(current(), month, id, edits)))
  }

  function propagateExpense(month: MonthKey, id: RowId, edits: ExpenseEdits): Promise<Propagation> {
    return inOrder(() => carryForward(propagateExpenseEdit(current(), month, id, edits)))
  }

  function propagateGoal(month: MonthKey, id: RowId, edits: GoalEdits): Promise<Propagation> {
    return inOrder(() => carryForward(propagateGoalEdit(current(), month, id, edits)))
  }

  /**
   * Carries a composite's Line Items forward — the whole list, as a fresh open already
   * carries it, since a per-line propagation would have no per-line Unreviewed mark to
   * respect.
   *
   * What travels is read off the row here rather than handed in, and that is the point: the
   * lines are changed one at a time, so by the time a member answers this offer the list has
   * moved on from whichever single change raised it. The amount goes with them because a
   * composite that has lost its last line hands back a typed total, which is not itself a
   * line and would otherwise be left behind.
   */
  function propagateLines(month: MonthKey, id: RowId): Promise<Propagation> {
    return inOrder(() => {
      const loaded = current()
      const row = monthAt(loaded, month)?.expenses.find((expense) => expense.id === id)
      if (!row) throw new Error(`${month} holds no such Expense, so there is nothing to carry`)
      return carryForward(
        propagateExpenseLines(loaded, month, id, { lines: row.lines, amount: row.amount }),
      )
    })
  }

  /**
   * Settling one reported Drift difference the Previous Month's way. It writes one row, but
   * which row and whether it is a write at all depends on the difference, so the Household
   * goes back whole rather than as a row-scoped write the caller would have to classify.
   */
  function refreshDrifted(
    month: MonthKey,
    now: MonthKey,
    kind: RowKind,
    id: RowId,
  ): Promise<void> {
    return changing(async (loaded) => {
      const after = refreshFromPreviousMonth(loaded, month, now, kind, id)
      await store.replaceHousehold(after)
      return after
    })
  }

  async function carryForward(propagation: Propagation): Promise<Propagation> {
    await store.replaceHousehold(propagation.household)
    household.value = propagation.household
    return propagation
  }

  return {
    household,
    viewing,
    replacements,
    loading,
    failure,
    load,
    refresh,
    watchOtherMembers,
    /** Whether this build has a Household to start from and to put back — the demo alone. */
    seeded: seed !== undefined,
    reset,
    setUp,
    view,
    open,
    discard,
    relabel,
    exportFile,
    importFile,
    addRosterMember,
    deactivateRosterMember,
    reactivateRosterMember,
    deleteCategory,
    clearAndDeleteCategory,
    addIncome,
    editIncome,
    removeIncome,
    confirmIncome,
    markIncomeAsOneOff,
    propagateIncome,
    addExpense,
    editExpense,
    repurposeExpense,
    removeExpense,
    confirmExpense,
    markExpenseAsOneOff,
    propagateExpense,
    propagateLines,
    itemise,
    addExpenseLine,
    editExpenseLine,
    removeExpenseLine,
    addGoal,
    editGoal,
    removeGoal,
    confirmGoal,
    markGoalAsOneOff,
    propagateGoal,
    contribute,
    refreshDrifted,
  }
}

/**
 * Where opening Prometheus puts a member: the Month the calendar is on, whenever the
 * Household has opened it. That is the Month being lived in, and it stays the answer when
 * a Month or two ahead has been opened to plan — arriving in a Month planned for is
 * arriving in a screen of rows nobody has looked at yet, which is nobody's starting point.
 *
 * A Household that has not got that far lands on the latest Month it has opened, and one
 * with nothing opened at all lands on the calendar's own Month, which is a Month like any
 * other and offers to be opened.
 */
function landOn(household: Household): MonthKey {
  const now = thisMonth()
  if (isOpened(household, now)) return now
  return openedMonthKeys(household).at(-1) ?? now
}

/**
 * The one Household the app is working in, over whichever store this build was made with.
 * Built on first asking rather than on import, so that nothing reaches for the browser
 * until there is a browser to reach for.
 */
let app: ReturnType<typeof householdOver> | undefined

export function useHousehold(): ReturnType<typeof householdOver> {
  return (app ??= householdOver(chosenStore(), chosenSeed()))
}
