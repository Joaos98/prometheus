<script setup lang="ts">
import { ref } from 'vue'
import type { Currency, MemberId, Minor } from '../../domain/index.js'
import { editableAmount, readAmount } from '../amount.js'

const props = withDefaults(
  defineProps<{
    currency: Currency
    members: { id: MemberId; name: string }[]
    name?: string
    category?: string
    amount?: Minor | null
    participants?: MemberId[]
    submitLabel?: string
  }>(),
  { name: '', category: '', amount: null, participants: undefined, submitLabel: 'Save' },
)

const emit = defineEmits<{
  save: [{ name: string; category: string; amount: Minor | null; participants: MemberId[] }]
  cancel: []
}>()

const name = ref(props.name)
const category = ref(props.category)
const amount = ref(editableAmount(props.amount, props.currency))
const participants = ref<MemberId[]>(
  props.participants ?? props.members.map((member) => member.id),
)
const failure = ref<string | undefined>(undefined)

function save(): void {
  failure.value = undefined
  try {
    emit('save', {
      name: name.value,
      category: category.value,
      amount: readAmount(amount.value, props.currency),
      participants: participants.value,
    })
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <form class="expense-form" @submit.prevent="save">
    <div class="line">
      <input v-model="name" aria-label="Expense" placeholder="What is it" type="text" />
      <input v-model="category" aria-label="Category" placeholder="Category" type="text" />
      <input
        v-model="amount"
        aria-label="Amount"
        :placeholder="`Amount in ${currency.code}, or nothing`"
        inputmode="decimal"
        type="text"
      />
    </div>

    <fieldset>
      <legend class="section-label">Participants — divided evenly</legend>
      <label v-for="member in members" :key="member.id" class="participant">
        <input
          v-model="participants"
          :value="member.id"
          :aria-label="member.name"
          type="checkbox"
        />
        <span>{{ member.name }}</span>
      </label>
    </fieldset>

    <p v-if="failure" class="failure">{{ failure }}</p>

    <div class="actions">
      <button class="button-primary" type="submit" :disabled="name.trim() === ''">
        {{ submitLabel }}
      </button>
      <button class="button-quiet" type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.expense-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--page);
  border: 0.5px solid var(--hairline);
  border-radius: var(--radius-control);
}

.line {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
}

fieldset {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: none;
}

legend {
  padding: 0;
  margin-bottom: 6px;
}

.participant {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.participant input {
  width: auto;
  accent-color: var(--fire);
}

.failure {
  margin: 0;
  font-size: 12px;
  color: var(--fire-bright);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions .button-primary {
  padding: 6px 14px;
}
</style>
