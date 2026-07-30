<script setup lang="ts">
import { computed } from 'vue'
import {
  formatAmount,
  leftoverBalancesOf,
  monthName,
  previousMonthKey,
  unreviewedCount,
  type Household,
  type Minor,
  type Month,
} from '../../domain/index.js'
import { nameOf } from '../members.js'

const props = defineProps<{ household: Household; month: Month }>()

/**
 * Until ticket 17 adds the Roster dropdown that picks a device's Viewer, the Month's
 * first member stands in for it, so the rail's top slot has someone to show.
 */
const balances = computed(() =>
  leftoverBalancesOf(props.month).map((balance) => ({
    ...balance,
    name: nameOf(props.household, balance.member),
  })),
)

const viewer = computed(() => balances.value[0])
const others = computed(() => balances.value.slice(1))

const copiedFrom = computed(() => previousMonthKey(props.household, props.month.key))

const rowCount = computed(
  () => props.month.income.length + props.month.expenses.length + props.month.goals.length,
)

const unreviewed = computed(() => unreviewedCount(props.month))

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)
</script>

<template>
  <aside class="rail">
    <section class="card">
      <h2 class="section-label">Leftover Balance</h2>

      <div v-if="viewer" class="viewer">
        <p class="name">{{ viewer.name }}</p>
        <dl class="subtraction">
          <dt class="muted">Spendable Income</dt>
          <dd class="figure">{{ money(viewer.spendableIncome) }}</dd>
          <dt class="muted">Shares</dt>
          <dd class="figure">− {{ money(viewer.shares) }}</dd>
          <dt class="muted">Contributions</dt>
          <dd class="figure">− {{ money(viewer.contributions) }}</dd>
        </dl>
        <div class="balance">
          <span>Leftover Balance</span>
          <span class="figure total" :class="{ negative: viewer.balance < 0 }">
            {{ money(viewer.balance) }}
          </span>
        </div>
        <p v-if="viewer.incomplete" class="pending note">
          Pending rows are not yet counted — this balance is not final.
        </p>
      </div>

      <ul v-if="others.length" class="members">
        <li v-for="other in others" :key="other.member">
          <span>{{ other.name }}</span>
          <span class="figure" :class="{ negative: other.balance < 0 }">
            {{ money(other.balance) }}
          </span>
          <span v-if="other.incomplete" class="pending-mark" title="Pending rows are not counted">
            Pending
          </span>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2 class="section-label">Review</h2>
      <p v-if="unreviewed === 0" class="secondary note">
        Every row reviewed — {{ rowCount }} in this Month.
      </p>
      <p v-else class="pending note">
        {{ unreviewed }} of {{ rowCount }} rows still Unreviewed.
      </p>
    </section>

    <section class="card">
      <h2 class="section-label">This Month</h2>
      <dl class="facts">
        <dt class="muted">Copied from</dt>
        <dd v-if="copiedFrom">{{ monthName(copiedFrom) }}</dd>
        <dd v-else class="secondary">Nothing — no Month precedes it</dd>
        <dt class="muted">Members</dt>
        <dd>{{ month.members.length }}</dd>
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

.viewer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.viewer .name {
  margin: 0;
  font-weight: 500;
}

.subtraction {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  font-size: 13px;
}

.subtraction dt,
.subtraction dd {
  margin: 0;
}

.subtraction dd {
  text-align: right;
}

.balance {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 0.5px solid var(--hairline);
}

.balance .total {
  font-size: 16px;
}

.negative {
  color: var(--fire-bright);
}

.pending {
  margin: 0;
  color: var(--fire-bright);
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
  gap: 8px;
}

.pending-mark {
  font-size: 11px;
  color: var(--fire-bright);
}

.note {
  margin: 0;
  font-size: 13px;
}

.facts {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  font-size: 13px;
}

.facts dt,
.facts dd {
  margin: 0;
}

.facts dd {
  text-align: right;
}
</style>
