<script setup lang="ts">
import { ref } from 'vue'
import type { Currency, MemberId, Minor } from '../../domain/index.js'
import { editableAmount, readAmount } from '../amount.js'
import { messageOf } from '../changes.js'

const props = withDefaults(
  defineProps<{
    currency: Currency
    members: { id: MemberId; name: string }[]
    name?: string
    target?: Minor | null
    startAmount?: Minor
    participants?: MemberId[]
    submitLabel?: string
  }>(),
  {
    name: '',
    target: null,
    startAmount: 0,
    participants: undefined,
    submitLabel: 'Save',
  },
)

const emit = defineEmits<{
  save: [{ name: string; target: Minor | null; startAmount: Minor; participants: MemberId[] }]
  cancel: []
}>()

const name = ref(props.name)
const target = ref(editableAmount(props.target, props.currency))
const startAmount = ref(editableAmount(props.startAmount, props.currency))
const participants = ref<MemberId[]>(props.participants ?? props.members.map((one) => one.id))
const failure = ref<string | undefined>(undefined)

function save(): void {
  failure.value = undefined
  try {
    emit('save', {
      name: name.value,
      target: readAmount(target.value, props.currency),
      startAmount: readAmount(startAmount.value, props.currency) ?? 0,
      participants: participants.value,
    })
  } catch (cause) {
    failure.value = messageOf(cause)
  }
}
</script>

<template>
  <form class="goal-form" @submit.prevent="save">
    <input v-model="name" aria-label="Savings Goal" placeholder="What are we saving for" type="text" />

    <div class="line">
      <label class="value">
        <span class="section-label">Target</span>
        <input
          v-model="target"
          aria-label="Target"
          :placeholder="`${currency.code}, or nothing`"
          inputmode="decimal"
          type="text"
        />
      </label>
      <label class="value">
        <span class="section-label">Start amount</span>
        <input
          v-model="startAmount"
          aria-label="Start amount"
          :placeholder="currency.code"
          inputmode="decimal"
          type="text"
        />
      </label>
    </div>

    <p class="muted note">
      A target is optional. The start amount is what was already saved before Prometheus.
    </p>

    <fieldset>
      <legend class="section-label">Participants</legend>
      <label v-for="member in members" :key="member.id" class="choice">
        <input v-model="participants" :value="member.id" :aria-label="member.name" type="checkbox" />
        <span>{{ member.name }}</span>
      </label>
    </fieldset>

    <p v-if="failure" class="failure note">{{ failure }}</p>

    <div class="actions">
      <button class="button-primary" type="submit" :disabled="name.trim() === ''">
        {{ submitLabel }}
      </button>
      <button class="button-quiet" type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.goal-form {
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
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.value {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.choice {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.choice input {
  width: auto;
  accent-color: var(--fire);
}

.note {
  margin: 0;
  font-size: 12px;
}

.failure {
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
