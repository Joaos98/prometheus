<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  appearedBefore,
  formatAmount,
  isComposite,
  isOneOff,
  isPending,
  isReviewed,
  previousMonthKey,
  renamingAsks,
  splitOf,
  type ExpenseEdits,
  type ExpenseSnapshot,
  type Household,
  type Minor,
  type Month,
  type MonthKey,
  type RowId,
} from '../../domain/index.js'
import { laterOpenedMonths, type Carrying } from '../carry-forward.js'
import { useChanges } from '../changes.js'
import { useDevicePreferences } from '../device-preferences.js'
import { endingTag } from '../ending.js'
import { filterNote, participantChoices, participantsIn } from '../expense-filter.js'
import { useHousehold } from '../household.js'
import { lineCount, type LineOperations } from '../lines.js'
import { membersOf, nameOf } from '../members.js'
import { expenseCaption } from '../split-rules.js'
import CarryForward from './CarryForward.vue'
import ConfirmMark from './ConfirmMark.vue'
import EndingQuestion from './EndingQuestion.vue'
import ExpenseForm from './ExpenseForm.vue'
import MonthPanel from './MonthPanel.vue'
import OneOffMark from './OneOffMark.vue'
import RepurposeQuestion from './RepurposeQuestion.vue'
import UnreviewedMark from './UnreviewedMark.vue'

const props = defineProps<{ household: Household; month: Month }>()

const {
  addExpense,
  editExpense,
  repurposeExpense,
  removeExpense,
  confirmExpense,
  markExpenseAsOneOff,
  itemise,
  addExpenseLine,
  editExpenseLine,
  removeExpenseLine,
} = useHousehold()

const { failure, report } = useChanges()

const adding = ref(false)
const editing = ref<RowId | undefined>(undefined)

/**
 * An edit held back while the member says whether this is still the same Expense. It
 * outlives the question so that going back to the form finds what was typed, rather
 * than the row as it stood before any of this.
 */
const held = ref<{ id: RowId; was: string; edits: Required<ExpenseEdits> } | undefined>(undefined)
const asking = ref(false)

/** An edit that has landed, waiting on whether it should reach the later Months too. */
const carrying = ref<Carrying | undefined>(undefined)

/** A row just taken out, waiting on whether the run behind it should end as well. */
const ended = ref<{ id: RowId; name: string; from: MonthKey } | undefined>(undefined)

/**
 * An Expense taken out of this Month, and then the offer to end the run behind it. Only
 * one with a past raises it: an Expense recorded here recurs from nowhere, so taking it
 * out leaves nothing still passing it on.
 */
async function remove(expense: ExpenseSnapshot): Promise<void> {
  const from = previousMonthKey(props.household, props.month.key)
  const recurring = appearedBefore(props.household, props.month.key, 'expenses', expense.id)
  if (!(await report(removeExpense(props.month.key, expense.id)))) return
  ended.value = recurring && from ? { id: expense.id, name: expense.name, from } : undefined
}

async function endRun(): Promise<void> {
  if (!ended.value) return
  await report(markExpenseAsOneOff(ended.value.from, ended.value.id, true))
  ended.value = undefined
}

const members = computed(() => membersOf(props.household, props.month))

const later = computed(() => laterOpenedMonths(props.household, props.month.key))

const { expenseFilter } = useDevicePreferences()

/**
 * The list narrowed to one Participant, and nothing else narrowed with it. This is a lens
 * over this panel: the rail's Leftover Balances, its review meter and its entry count are
 * facts about the Month and stay Month-wide, which is why the header has to say how much
 * it is hiding.
 *
 * The filter never moves on its own. An Expense saved with Participants outside it leaves
 * the list, and the count is what explains where it went.
 */
const shown = computed(() => participantsIn(props.month.expenses, expenseFilter.value))

const rows = computed(() =>
  shown.value.map((expense) => {
    const split = splitOf(props.month, expense)
    return {
      expense,
      caption: expenseCaption(expense, split.dividedEvenlyInstead),
      shares: split.shares.map((share) => ({
        name: nameOf(props.household, share.member),
        amount: share.amount,
      })),
    }
  }),
)

/** This Month's members, plus whoever is filtered on where this Month has not got them. */
const choices = computed(() =>
  participantChoices(members.value, expenseFilter.value, (member) =>
    nameOf(props.household, member),
  ),
)

const narrowed = computed(() =>
  filterNote(expenseFilter.value, shown.value.length, props.month.expenses.length),
)

/** Whoever the list is narrowed to, named — for the sentence an empty list leaves behind. */
const filteredName = computed(() =>
  expenseFilter.value ? nameOf(props.household, expenseFilter.value) : undefined,
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

/**
 * Which composites are showing their lines, held on this device and nowhere else.
 *
 * ADR-0010 records the centre column's spare vertical room as headroom kept for exactly
 * this, and expanding a row into its parts is what it kept the room for. Collapsed is the
 * default because the room is a fixed amount rather than an unlimited one: several
 * composites open at once push the Shares below them down the page, and Shares under their
 * Expense are what that ADR chose the layout to protect. Any number may be opened — this
 * holds a set, not one row — but each is a member asking for it.
 *
 * Which rows are open is not a fact about the Household, so it is not written to one, and
 * it is not carried between Months either: the panel is rebuilt per Month, and a row
 * expanded in July says nothing about August.
 */
const expanded = ref<Set<RowId>>(new Set())

function toggleLines(id: RowId): void {
  const showing = new Set(expanded.value)
  if (!showing.delete(id)) showing.add(id)
  expanded.value = showing
}

/**
 * The four line operations, bound to this Month and one row, for the form to carry out.
 * The form is handed them rather than reaching for them, so that an add form — which has
 * no row yet to itemise — is simply given none and renders no line editor.
 */
function lineOperationsFor(expense: ExpenseSnapshot): LineOperations {
  return {
    itemise: (amount) => itemiseHolding(expense, amount),
    add: (line, splitRule) => addExpenseLine(props.month.key, expense.id, line, splitRule),
    edit: (lineId, edits, splitRule) =>
      editExpenseLine(props.month.key, expense.id, lineId, edits, splitRule),
    remove: (lineId, splitRule) =>
      removeExpenseLine(props.month.key, expense.id, lineId, splitRule),
  }
}

/**
 * Itemising the amount the member is looking at, which is not always the one the row was
 * stored with: the engine turns the *stored* figure into the first line, so a figure
 * corrected in the field and not yet saved is landed first and itemised second.
 *
 * The two cannot half-apply in any way that loses the figure. If the correction is refused
 * the row is untouched and nothing is itemised; if it lands, the row now holds a figure, so
 * the itemise that follows cannot be refused for want of one.
 *
 * That first write is a correction to an amount like any other, so it earns the same offer
 * to reach the later Months — leaving it out would make this the one path in the panel
 * where a figure changes and the Months already open after this one are never mentioned.
 */
async function itemiseHolding(expense: ExpenseSnapshot, amount: Minor): Promise<void> {
  const corrected = amount !== expense.amount
  if (corrected) await editExpense(props.month.key, expense.id, { amount })
  await itemise(props.month.key, expense.id)
  if (corrected && later.value.length > 0) {
    carrying.value = { kind: 'expenses', id: expense.id, name: expense.name, edits: { amount } }
  }
}

/** Whether stopping this row here ends a run, or marks a cost that only ever was this one. */
const ends = (id: RowId): boolean =>
  appearedBefore(props.household, props.month.key, 'expenses', id)

/**
 * A change made from a form — or from the question a rename asks — which closes once it
 * is accepted and stays open if it is not. A change made from a row uses `report`
 * instead, so that confirming or removing one Expense never throws away another the
 * member is halfway through editing.
 */
async function attempt(change: Promise<void>): Promise<void> {
  if (!(await report(change))) return
  adding.value = false
  close()
}

function edit(expense: ExpenseSnapshot): void {
  close()
  editing.value = expense.id
}

function close(): void {
  editing.value = undefined
  asking.value = false
  held.value = undefined
}

/**
 * Saving an edit, except that renaming a row this Month inherited is the one edit the
 * app cannot carry out on its own: the engine says whether the row could be either, and
 * only the member knows which was meant.
 */
function save(expense: ExpenseSnapshot, edits: Required<ExpenseEdits>): void {
  held.value = { id: expense.id, was: expense.name, edits }
  if (renamingAsks(props.household, props.month.key, expense.id, edits.name)) {
    asking.value = true
    return
  }
  void saveEdit(expense, edits)
}

/**
 * An edit that lands, and then the offer to carry it into the Months already open after
 * this one — which is the whole of Forward Propagation from where the member sits. Only
 * an edit raises it: a cost recorded here for the first time is on no later Month's
 * thread, so there is nothing there for it to correct.
 */
async function saveEdit(expense: ExpenseSnapshot, edits: Required<ExpenseEdits>): Promise<void> {
  const landing = withoutDerivedAmount(expense, edits)
  if (!(await report(editExpense(props.month.key, expense.id, landing)))) return
  close()
  if (later.value.length > 0) {
    carrying.value = { kind: 'expenses', id: expense.id, name: expense.name, edits: landing }
  }
}

/**
 * The edit as it can actually be made. What a composite costs is what its lines come to,
 * so it has no typeable amount and the engine refuses one — the form shows the running
 * total where the field would be, and the figure the form still carries from before it was
 * itemised is dropped here rather than sent to be turned away.
 */
function withoutDerivedAmount(
  expense: ExpenseSnapshot,
  edits: Required<ExpenseEdits>,
): ExpenseEdits {
  if (!isComposite(expense)) return edits
  const { amount: _derived, ...rest } = edits
  return rest
}

/**
 * Answering the rename question with "a different cost begins here", and then the same
 * offer an edit gets. The engine has moved the minted identity into every later Month
 * that inherited the old one, so those rows are this cost now — under the old cost's
 * name and figures, until somebody carries this Month's across. The offer is made
 * against the identity that came back, never the one just retired: no Month holds that
 * any more.
 */
async function repurpose(expense: ExpenseSnapshot, edits: Required<ExpenseEdits>): Promise<void> {
  const landing = withoutDerivedAmount(expense, edits)
  let minted: RowId | undefined
  const done = await report(
    (async () => {
      minted = await repurposeExpense(props.month.key, expense.id, landing)
    })(),
  )
  if (!done) return
  adding.value = false
  close()
  if (minted && later.value.length > 0) {
    carrying.value = { kind: 'expenses', id: minted, name: edits.name.trim(), edits: landing }
  }
}

/** What the edit form opens with: the row, or the edit the question is holding back. */
function editValues(expense: ExpenseSnapshot): Required<ExpenseEdits> {
  const pending = held.value?.id === expense.id ? held.value.edits : undefined
  return pending ?? {
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    participants: expense.participants,
    splitRule: expense.splitRule,
  }
}
</script>

<template>
  <MonthPanel title="Expenses">
    <template #header>
      <div class="lens">
        <span v-if="narrowed" class="muted note">{{ narrowed }}</span>
        <!-- Its own control, not the Viewer: this asks what one member is in, which is a
             question anybody can ask about anybody. -->
        <select v-model="expenseFilter" class="filter" aria-label="Show Expenses for">
          <option :value="undefined">Everyone</option>
          <option v-for="member in choices" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
        <button v-if="!adding" class="link-action" type="button" @click="adding = true">
          + Add an Expense
        </button>
      </div>
    </template>

    <p v-if="failure" class="failure note">{{ failure }}</p>

    <CarryForward
      v-if="carrying"
      :month="month.key"
      :later="later"
      :carrying="carrying"
      @done="carrying = undefined"
    />

    <EndingQuestion
      v-if="ended"
      :name="ended.name"
      :month="month.key"
      :from="ended.from"
      @end="endRun()"
      @leave="ended = undefined"
    />

    <ExpenseForm
      v-if="adding"
      :currency="household.currency"
      :members="members"
      submit-label="Add the Expense"
      adding
      @cancel="adding = false"
      @save="(draft) => attempt(addExpense(month.key, draft))"
    />

    <p v-if="month.expenses.length === 0 && !adding" class="muted note">
      No Expenses in this Month yet.
    </p>
    <!-- The filter stays where it was put, so an empty list says whose it is rather than
         quietly clearing itself. -->
    <p v-else-if="rows.length === 0 && !adding" class="muted note">
      No Expenses in this Month have {{ filteredName }} as a Participant.
    </p>

    <template v-for="{ expense, shares, caption } in rows" :key="expense.id">
      <RepurposeQuestion
        v-if="asking && held?.id === expense.id"
        :was="held.was"
        :becomes="held.edits.name.trim()"
        @continued="saveEdit(expense, held!.edits)"
        @repurposed="repurpose(expense, held!.edits)"
        @cancel="asking = false"
      />

      <ExpenseForm
        v-else-if="editing === expense.id"
        :currency="household.currency"
        :members="members"
        v-bind="editValues(expense)"
        :lines="expense.lines"
        :line-operations="lineOperationsFor(expense)"
        @cancel="close()"
        @save="(edits) => save(expense, edits)"
      />

      <article v-else class="expense">
        <div class="body">
          <button
            class="row-body"
            type="button"
            :aria-label="`Edit ${expense.name}`"
            @click="edit(expense)"
          >
            <div class="line">
              <span class="name">{{ expense.name }}</span>
              <span v-if="expense.category" class="tag">{{ expense.category }}</span>
              <span v-if="isComposite(expense)" class="tag">{{ lineCount(expense.lines) }}</span>
              <span v-if="isOneOff(expense)" class="tag one-off">
                {{ endingTag(ends(expense.id)) }}
              </span>
              <UnreviewedMark v-if="!isReviewed(expense)" :name="expense.name" />
              <span v-if="isPending(expense)" class="pending">Pending — no amount entered</span>
              <span v-else class="figure total">{{ money(expense.amount!) }}</span>
            </div>

            <div class="line rule">
              <span class="muted">{{ caption.lead }}</span>
              <span class="muted">·</span>
              <span class="muted">{{ caption.participants }}</span>
              <span v-if="caption.warning" class="fallback">{{ caption.warning }}</span>
            </div>

            <ul v-if="shares.length" class="shares">
              <li v-for="share in shares" :key="share.name">
                <span class="secondary">{{ share.name }}</span>
                <span class="figure">{{ money(share.amount) }}</span>
              </li>
            </ul>
          </button>

          <!-- What the total is made of, and which part of it is still missing a figure. -->
          <ul v-if="isComposite(expense) && expanded.has(expense.id)" class="line-items">
            <li v-for="line in expense.lines" :key="line.id">
              <span class="secondary">{{ line.name }}</span>
              <span v-if="line.amount === null" class="pending">No figure entered</span>
              <span v-else class="figure">{{ money(line.amount) }}</span>
            </li>
          </ul>
        </div>

        <!-- Collapsed by default, and its own control rather than part of the row: opening
             a composite to read it is not the same act as opening it to edit it. -->
        <button
          v-if="isComposite(expense)"
          class="row-action disclose"
          type="button"
          :aria-expanded="expanded.has(expense.id)"
          :aria-label="`${expanded.has(expense.id) ? 'Hide' : 'Show'} the Line Items of ${expense.name}`"
          @click="toggleLines(expense.id)"
        >
          {{ expanded.has(expense.id) ? '▾' : '▸' }}
        </button>
        <ConfirmMark
          v-if="!isReviewed(expense)"
          :name="expense.name"
          @click="report(confirmExpense(month.key, expense.id))"
        />
        <OneOffMark
          :name="expense.name"
          :ending="ends(expense.id)"
          :marked="isOneOff(expense)"
          @toggle="(oneOff) => report(markExpenseAsOneOff(month.key, expense.id, oneOff))"
        />
        <button
          class="row-action remove tip"
          type="button"
          data-tip="Remove from this Month — later Months inherit its absence"
          :aria-label="`Remove ${expense.name}`"
          @click="remove(expense)"
        >
          ×
        </button>
      </article>
    </template>
  </MonthPanel>
</template>

<style scoped>
/* The panel's own controls: what is being hidden, the lens hiding it, and the way to add
   a row. They wrap to a second line rather than squeezing the picker to a sliver. */
.lens {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px 10px;
}

.filter {
  width: auto;
  max-width: 160px;
  padding: 4px 8px;
  font-size: 12px;
}

.expense {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

/* The row and whatever it has expanded beneath it, which the controls sit beside as one. */
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.body .row-body {
  align-items: stretch;
}

/* Set in under the row they belong to and quieter than it: a composite's parts are a
   reading of the total above them, not rows of their own. */
.line-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 4px;
  padding: 6px 8px 0 20px;
  list-style: none;
  font-size: 12px;
  line-height: 1.35;
  border-left: 0.5px solid var(--hairline);
  margin-left: 8px;
}

.line-items li {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.line-items .figure,
.line-items .pending {
  margin-left: auto;
}

.disclose {
  font-size: 11px;
}

/* Where the line runs out, the amount drops below the name rather than the name being
   broken up to make room for it. */
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.name {
  font-weight: 500;
}

.total {
  margin-left: auto;
}

/* The two dense lines under the name sit closer than body text: they are a caption on
   the row above them, not prose. */
.rule {
  font-size: 12px;
  line-height: 1.35;
}

.fallback {
  color: var(--text-secondary);
}

.pending {
  margin-left: auto;
  font-size: 12px;
  color: var(--fire-bright);
}

.shares {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  line-height: 1.35;
}

.shares li {
  display: flex;
  gap: 6px;
}

/* The row's own controls line up with its first line, not its middle. */
.expense .row-action {
  margin-top: 6px;
}

.remove {
  padding: 4px 7px;
}
</style>
