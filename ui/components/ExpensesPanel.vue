<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  formatAmount,
  isPending,
  sharesOf,
  type ExpenseSnapshot,
  type Household,
  type Minor,
  type Month,
  type RowId,
  type SplitRule,
} from '../../domain/index.js'
import { useHousehold } from '../household.js'
import { membersOf, nameOf } from '../members.js'
import ExpenseForm from './ExpenseForm.vue'
import MonthPanel from './MonthPanel.vue'

const props = defineProps<{ household: Household; month: Month }>()

const { addExpense, editExpense, removeExpense } = useHousehold()

const adding = ref(false)
const editing = ref<RowId | undefined>(undefined)
const failure = ref<string | undefined>(undefined)

const members = computed(() => membersOf(props.household, props.month))

const rows = computed(() =>
  props.month.expenses.map((expense) => ({
    expense,
    shares: sharesOf(props.month, expense).map((share) => ({
      name: nameOf(props.household, share.member),
      amount: share.amount,
    })),
  })),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

/** How each Split Rule is named on a row. Ticket 04's rules join this list. */
const RULE_NAMES: Record<SplitRule['kind'], string> = { even: 'Even' }

const ruleName = (rule: SplitRule): string => RULE_NAMES[rule.kind]

const participantCount = (expense: ExpenseSnapshot): string =>
  expense.participants.length === 1 ? '1 Participant' : `${expense.participants.length} Participants`

async function attempt(change: Promise<void>): Promise<void> {
  failure.value = undefined
  try {
    await change
    adding.value = false
    editing.value = undefined
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
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

    <template v-for="{ expense, shares } in rows" :key="expense.id">
      <ExpenseForm
        v-if="editing === expense.id"
        :currency="household.currency"
        :members="members"
        :name="expense.name"
        :category="expense.category"
        :amount="expense.amount"
        :participants="expense.participants"
        @cancel="editing = undefined"
        @save="(edits) => attempt(editExpense(month.key, expense.id, edits))"
      />

      <article v-else class="expense">
        <button
          class="body"
          type="button"
          :aria-label="`Edit ${expense.name}`"
          @click="editing = expense.id"
        >
          <div class="line">
            <span class="name">{{ expense.name }}</span>
            <span v-if="expense.category" class="tag">{{ expense.category }}</span>
            <span v-if="isPending(expense)" class="pending">Pending — no amount entered</span>
            <span v-else class="figure total">{{ money(expense.amount!) }}</span>
          </div>

          <div class="line rule">
            <span class="muted">{{ ruleName(expense.splitRule) }}</span>
            <span class="muted">·</span>
            <span class="muted">{{ participantCount(expense) }}</span>
          </div>

          <ul v-if="shares.length" class="shares">
            <li v-for="share in shares" :key="share.name">
              <span class="secondary">{{ share.name }}</span>
              <span class="figure">{{ money(share.amount) }}</span>
            </li>
          </ul>
        </button>

        <button
          class="remove"
          type="button"
          :aria-label="`Remove ${expense.name}`"
          @click="attempt(removeExpense(month.key, expense.id))"
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

.rule {
  font-size: 12px;
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
