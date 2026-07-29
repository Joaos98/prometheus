<script setup lang="ts">
import { ref } from 'vue'
import type { Currency, Minor } from '../../domain/index.js'
import { editableAmount, readAmount } from '../amount.js'

const props = withDefaults(
  defineProps<{
    currency: Currency
    name?: string
    amount?: Minor | null
    restrictedUse?: boolean
    submitLabel?: string
  }>(),
  { name: '', amount: null, restrictedUse: false, submitLabel: 'Save' },
)

const emit = defineEmits<{
  save: [{ name: string; amount: Minor | null; restrictedUse: boolean }]
  cancel: []
}>()

const name = ref(props.name)
const amount = ref(editableAmount(props.amount, props.currency))
const restrictedUse = ref(props.restrictedUse)
const failure = ref<string | undefined>(undefined)

function save(): void {
  failure.value = undefined
  try {
    emit('save', {
      name: name.value,
      amount: readAmount(amount.value, props.currency),
      restrictedUse: restrictedUse.value,
    })
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <form class="income-form" @submit.prevent="save">
    <input v-model="name" aria-label="Source" placeholder="Source" type="text" />
    <input
      v-model="amount"
      aria-label="Amount"
      :placeholder="`Amount in ${currency.code}, or nothing`"
      inputmode="decimal"
      type="text"
    />
    <label class="restricted">
      <input v-model="restrictedUse" type="checkbox" />
      <span>Restricted-Use — never counts toward Spendable Income</span>
    </label>
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
.income-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--page);
  border: 0.5px solid var(--hairline);
  border-radius: var(--radius-control);
}

.restricted {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.restricted input {
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
