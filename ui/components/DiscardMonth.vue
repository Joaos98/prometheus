<script setup lang="ts">
import { computed, ref } from 'vue'
import { entryCount, monthName, type Month } from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ month: Month }>()

const { discard } = useHousehold()
const { failure, report } = useChanges()

const asking = ref(false)

/**
 * The one destructive action in the Household, so it says the number before it proceeds
 * rather than after — and says it of the Month as it stands right now, not as it stood
 * when the question was asked.
 */
const entries = computed(() => entryCount(props.month))

const counted = computed(() => (entries.value === 1 ? '1 entry' : `${entries.value} entries`))

async function confirm(): Promise<void> {
  if (!(await report(discard(props.month.key)))) return
  asking.value = false
}
</script>

<template>
  <div class="discard">
    <button v-if="!asking" class="ask" type="button" @click="asking = true">
      Discard this Month
    </button>

    <div v-else class="question">
      <p class="lead">
        Discarding {{ monthName(month.key) }} returns it to unopened. {{ counted }} will be lost.
      </p>
      <p class="muted note">
        Every other Month is left as it is, and this one can be opened afresh from the Previous
        Month.
      </p>
      <div class="actions">
        <button class="destructive" type="button" @click="confirm">
          Discard, losing {{ counted }}
        </button>
        <button class="button-quiet" type="button" @click="asking = false">Keep it</button>
      </div>
      <p v-if="failure" class="failure note">{{ failure }}</p>
    </div>
  </div>
</template>

<style scoped>
.discard {
  padding-top: 12px;
  border-top: 0.5px solid var(--hairline);
}

.ask {
  padding: 0;
  font-size: 13px;
  color: var(--text-muted);
  background: none;
  border: none;
}

.ask:hover {
  color: var(--fire-bright);
}

.question {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead {
  margin: 0;
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.destructive {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--fire-bright);
  background: none;
  border: 0.5px solid var(--fire-bright);
}

.destructive:hover {
  color: var(--page);
  background: var(--fire-bright);
}

.failure {
  color: var(--fire-bright);
}

.note {
  margin: 0;
  font-size: 12px;
}
</style>
