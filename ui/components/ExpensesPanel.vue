<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatAmount,
  isPending,
  isReviewed,
  renamingAsks,
  splitOf,
  type ExpenseEdits,
  type ExpenseSnapshot,
  type Household,
  type Minor,
  type Month,
  type RowId,
} from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'
import { membersOf, nameOf } from '../members.js'
import { ruleName } from '../split-rules.js'
import ExpenseForm from './ExpenseForm.vue'
import MonthPanel from './MonthPanel.vue'
import RepurposeQuestion from './RepurposeQuestion.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addExpense, editExpense, repurposeExpense, removeExpense, confirmExpense } =
  useHousehold()

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

const members = computed(() => membersOf(props.household, props.month))

const rows = computed(() =>
  props.month.expenses.map((expense) => {
    const split = splitOf(props.month, expense)
    return {
      expense,
      dividedEvenlyInstead: split.dividedEvenlyInstead,
      shares: split.shares.map((share) => ({
        name: nameOf(props.household, share.member),
        amount: share.amount,
      })),
    }
  }),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

const participantCount = (expense: ExpenseSnapshot): string =>
  expense.participants.length === 1 ? '1 Participant' : `${expense.participants.length} Participants`

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
  void attempt(editExpense(props.month.key, expense.id, edits))
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
      <button v-if="!adding" class="add" type="button" @click="adding = true">+ Add expense</button>
    </template>

    <p v-if="failure" class="failure note">{{ failure }}</p>

    <ExpenseForm
      v-if="adding"
      :currency="household.currency"
      :members="members"
      submit-label="Add expense"
      @cancel="adding = false"
      @save="(draft) => attempt(addExpense(month.key, draft))"
    />

    <p v-if="rows.length === 0 && !adding" class="muted note">No Expenses in this Month yet.</p>

    <template v-for="{ expense, shares, dividedEvenlyInstead } in rows" :key="expense.id">
      <RepurposeQuestion
        v-if="asking && held?.id === expense.id"
        :was="held.was"
        :becomes="held.edits.name.trim()"
        @continued="attempt(editExpense(month.key, expense.id, held!.edits))"
        @repurposed="attempt(repurposeExpense(month.key, expense.id, held!.edits))"
        @cancel="asking = false"
      />

      <ExpenseForm
        v-else-if="editing === expense.id"
        :currency="household.currency"
        :members="members"
        v-bind="editValues(expense)"
        @cancel="close()"
        @save="(edits) => save(expense, edits)"
      />

      <article v-else class="expense">
        <button
          class="body"
          type="button"
          :aria-label="`Edit ${expense.name}`"
          @click="edit(expense)"
        >
          <div class="line">
            <span class="name">{{ expense.name }}</span>
            <span v-if="expense.category" class="tag">{{ expense.category }}</span>
            <span v-if="!isReviewed(expense)" class="tag unreviewed">Unreviewed</span>
            <span v-if="isPending(expense)" class="pending">Pending — no amount entered</span>
            <span v-else class="figure total">{{ money(expense.amount!) }}</span>
          </div>

          <div class="line rule">
            <span class="muted">{{ ruleName(expense.splitRule) }}</span>
            <span class="muted">·</span>
            <span class="muted">{{ participantCount(expense) }}</span>
            <span v-if="dividedEvenlyInstead" class="fallback">
              No Spendable Income this Month — divided evenly
            </span>
          </div>

          <ul v-if="shares.length" class="shares">
            <li v-for="share in shares" :key="share.name">
              <span class="secondary">{{ share.name }}</span>
              <span class="figure">{{ money(share.amount) }}</span>
            </li>
          </ul>
        </button>

        <button
          v-if="!isReviewed(expense)"
          class="confirm"
          type="button"
          :aria-label="`Confirm ${expense.name}`"
          @click="report(confirmExpense(month.key, expense.id))"
        >
          Confirm
        </button>
        <button
          class="remove"
          type="button"
          :aria-label="`Remove ${expense.name}`"
          @click="report(removeExpense(month.key, expense.id))"
        >
          ×
        </button>
      </article>
    </template>
  </MonthPanel>
</template>

<style scoped>
.expense {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  text-align: left;
  background: none;
  border: 0.5px solid transparent;
  border-radius: var(--radius-control);
}

.body:hover {
  border-color: var(--hairline);
}

.line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.name {
  font-weight: 500;
}

.total {
  margin-left: auto;
}

.tag {
  padding: 1px 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border: 0.5px solid var(--hairline);
  border-radius: 999px;
}

.unreviewed {
  color: var(--fire);
  border-color: var(--fire);
}

.rule {
  font-size: 12px;
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
  gap: 6px 18px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
}

.shares li {
  display: flex;
  gap: 6px;
}

.confirm {
  align-self: flex-start;
  margin-top: 10px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--fire);
  background: none;
  border: 0.5px solid var(--hairline);
}

.confirm:hover {
  border-color: var(--fire);
}

.remove {
  padding: 8px;
  color: var(--text-muted);
  background: none;
  border: 0.5px solid transparent;
}

.remove:hover {
  color: var(--text);
  border-color: var(--hairline);
}

.add {
  padding: 0;
  color: var(--fire);
  background: none;
  border: none;
  font-size: 13px;
}

.failure {
  margin: 0;
  color: var(--fire-bright);
}

.note {
  font-size: 13px;
}
</style>
