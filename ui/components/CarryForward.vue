<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { monthName, type MonthKey, type Propagation } from '../../domain/index.js'
import type { Carrying } from '../carry-forward.js'
import { messageOf } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ month: MonthKey; later: MonthKey[]; carrying: Carrying }>()

const emit = defineEmits<{ done: [] }>()

const { propagateIncome, propagateExpense, propagateGoal } = useHousehold()

const carried = ref<Propagation | undefined>(undefined)
const failure = ref<string | undefined>(undefined)

/**
 * A report is about the one edit it was run for. The panel holds this component in place
 * across edits, so without this a second edit arrives to find the first one's report
 * still showing: its offer would never be made, and dismissing what looks like a finished
 * report would throw the second correction away with nothing said.
 */
watch(
  () => props.carrying,
  () => {
    carried.value = undefined
    failure.value = undefined
  },
)

const names = (months: MonthKey[]): string => months.map(monthName).join(', ')

/**
 * What the walk passed over, grouped by why. Every reason is worth saying, but only the
 * first is a decision somebody made: those are the Months to go and look at.
 */
const kept = computed(() =>
  (carried.value?.skipped ?? []).filter((skip) => skip.reason === 'reviewed'),
)
const missing = computed(() =>
  (carried.value?.skipped ?? []).filter((skip) => skip.reason === 'absent'),
)
const refused = computed(() =>
  (carried.value?.skipped ?? []).filter((skip) => skip.reason === 'refused'),
)

async function carry(): Promise<void> {
  failure.value = undefined
  try {
    carried.value = await propagate()
  } catch (cause) {
    failure.value = messageOf(cause)
  }
}

function propagate(): Promise<Propagation> {
  const { kind, id, edits } = props.carrying
  if (kind === 'income') return propagateIncome(props.month, id, edits)
  if (kind === 'expenses') return propagateExpense(props.month, id, edits)
  return propagateGoal(props.month, id, edits)
}
</script>

<template>
  <section class="carry" role="group" :aria-label="`Carry ${carrying.name} forward`">
    <template v-if="!carried">
      <p class="offered">Carry the change to {{ carrying.name }} into the later Months?</p>
      <p class="muted note">
        {{ names(later) }} {{ later.length === 1 ? 'was' : 'were' }} opened before this change, so
        {{ later.length === 1 ? 'it still holds' : 'they still hold' }} the figure copied from here.
        Only values nobody has looked at yet are replaced — anything already answered for is left
        as it stands.
      </p>

      <div class="answers">
        <button class="button-primary" type="button" @click="carry()">Carry it forward</button>
        <button class="button-quiet" type="button" @click="emit('done')">Leave them</button>
      </div>
    </template>

    <template v-else>
      <p v-if="carried.changed.length" class="offered">
        Carried into {{ names(carried.changed) }}.
      </p>
      <p v-else class="offered">No later Month took the change.</p>

      <p v-if="kept.length" class="muted note">
        {{ names(kept.map((skip) => skip.month)) }} kept
        {{ kept.length === 1 ? 'its' : 'their' }} own answer — somebody has already been through
        {{ kept.length === 1 ? 'that Month' : 'those Months' }}, and a correction made here never
        undoes a decision made there.
      </p>

      <p v-if="missing.length" class="muted note">
        {{ names(missing.map((skip) => skip.month)) }} does not hold this row at all.
      </p>

      <p v-for="skip in refused" :key="skip.month" class="muted note">
        {{ monthName(skip.month) }} could not take it: {{ skip.because }}
      </p>

      <div class="answers">
        <button class="button-quiet" type="button" @click="emit('done')">Done</button>
      </div>
    </template>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </section>
</template>

<style scoped>
.carry {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--page);
  border: 0.5px solid var(--hairline);
  border-radius: var(--radius-control);
}

.offered {
  margin: 0;
  font-weight: 500;
}

.note {
  margin: 0;
  font-size: 12px;
}

.answers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.answers .button-primary {
  padding: 6px 14px;
}

.failure {
  color: var(--fire-bright);
}
</style>
