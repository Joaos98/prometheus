<script setup lang="ts">
import { computed } from 'vue'
import {
  entryCount,
  monthAt,
  monthName,
  previousMonthKey,
  type Household,
  type MonthKey,
} from '../../domain/index.js'
import { useChanges } from '../changes.js'
import { useHousehold } from '../household.js'

const props = defineProps<{ household: Household; viewing: MonthKey }>()

const { open } = useHousehold()
const { failure, report } = useChanges()

/** What opening would copy: the Previous Month, and how much of it would arrive. */
const source = computed(() => {
  const key = previousMonthKey(props.household, props.viewing)
  if (!key) return undefined
  const entries = entryCount(monthAt(props.household, key)!)
  return { key, counted: entries === 1 ? '1 entry' : `${entries} entries` }
})
</script>

<template>
  <section class="card unopened">
    <h2 class="section-label">Not opened</h2>

    <p class="lead">
      {{ monthName(viewing) }} has not been opened. Looking at it does not open it.
    </p>

    <p v-if="source" class="secondary">
      Opening it copies {{ source.counted }} from {{ monthName(source.key) }} — every row, every field,
      each arriving Unreviewed.
    </p>
    <p v-else class="secondary">
      No opened Month precedes it, so it would open with the active Roster and no rows.
    </p>

    <div class="actions">
      <button class="button-primary" type="button" @click="report(open(viewing))">
        Open {{ monthName(viewing) }}
      </button>
    </div>

    <p v-if="failure" class="failure note">{{ failure }}</p>
  </section>
</template>

<style scoped>
.unopened {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 560px;
}

.lead,
.secondary {
  margin: 0;
}

.actions {
  margin-top: 4px;
}

.failure {
  color: var(--fire-bright);
}

.note {
  margin: 0;
  font-size: 13px;
}
</style>
