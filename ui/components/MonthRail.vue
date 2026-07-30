<script setup lang="ts">
import { computed } from 'vue'
import { monthName, previousMonthKey, type Household, type Month } from '../../domain/index.js'
import { nameOf } from '../members.js'

const props = defineProps<{ household: Household; month: Month }>()

const members = computed(() => props.month.members.map((id) => nameOf(props.household, id)))

const copiedFrom = computed(() => previousMonthKey(props.household, props.month.key))

const rowCount = computed(
  () => props.month.income.length + props.month.expenses.length + props.month.goals.length,
)
</script>

<template>
  <aside class="rail">
    <section class="card">
      <h2 class="section-label">Leftover Balance</h2>
      <ul class="members">
        <li v-for="name in members" :key="name">
          <span>{{ name }}</span>
          <span class="figure muted">—</span>
        </li>
      </ul>
      <p class="muted note">Spendable Income, minus Shares, minus Contributions.</p>
    </section>

    <section class="card">
      <h2 class="section-label">Review</h2>
      <p class="secondary note">{{ rowCount }} rows in this Month.</p>
    </section>

    <section class="card">
      <h2 class="section-label">This Month</h2>
      <dl>
        <dt class="muted">Copied from</dt>
        <dd v-if="copiedFrom">{{ monthName(copiedFrom) }}</dd>
        <dd v-else class="secondary">Nothing — no Month precedes it</dd>
        <dt class="muted">Members</dt>
        <dd>{{ members.length }}</dd>
      </dl>
    </section>
  </aside>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.members {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.members li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.note {
  margin: 0;
  font-size: 13px;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  font-size: 13px;
}

dt,
dd {
  margin: 0;
}

dd {
  text-align: right;
}
</style>
