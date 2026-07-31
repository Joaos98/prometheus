<script setup lang="ts">
import { computed } from 'vue'
import {
  driftAhead,
  driftCount,
  entryCount,
  formatAmount,
  leftoverBalancesOf,
  monthName,
  previousMonthKey,
  unreviewedCount,
  type Household,
  type Minor,
  type Month,
  type MonthKey,
} from '../../domain/index.js'
import { useDevicePreferences } from '../device-preferences.js'
import { nameOf } from '../members.js'
import DiscardMonth from './DiscardMonth.vue'

const props = defineProps<{ household: Household; month: Month; now: MonthKey }>()

const { viewer: viewerId, leftoverDisplay } = useDevicePreferences()

/**
 * The figure this device has chosen to lead the balance with — Spendable Income by
 * default, or total Income when the toggle counts Restricted-Use in too. This is a
 * display substitution only: Shares and Contributions are the same either way, and no
 * Split Rule ever reads it.
 */
const balances = computed(() =>
  leftoverBalancesOf(props.month).map((balance) => {
    const income = leftoverDisplay.value === 'total' ? balance.totalIncome : balance.spendableIncome
    return {
      ...balance,
      name: nameOf(props.household, balance.member),
      income,
      balance: income - balance.shares - balance.contributions,
    }
  }),
)

const includeRestrictedUse = computed({
  get: () => leftoverDisplay.value === 'total',
  set: (value: boolean) => {
    leftoverDisplay.value = value ? 'total' : 'spendable'
  },
})

const incomeLabel = computed(() => (leftoverDisplay.value === 'total' ? 'Income' : 'Spendable Income'))

/**
 * The Viewer leads the rail, sorted first, when this device has picked one who is in
 * this Month. With no Viewer picked, the Month's own order stands in — the rail looked
 * exactly like this before ticket 17, and stays fully usable with nobody chosen.
 */
const ordered = computed(() => {
  const chosen = balances.value.find((balance) => balance.member === viewerId.value)
  if (!chosen) return balances.value
  return [chosen, ...balances.value.filter((balance) => balance.member !== chosen.member)]
})

const viewer = computed(() => ordered.value[0])
const others = computed(() => ordered.value.slice(1))

const copiedFrom = computed(() => previousMonthKey(props.household, props.month.key))

const rowCount = computed(() => entryCount(props.month))

const unreviewed = computed(() => unreviewedCount(props.month))

/**
 * ADR-0010 puts the Drift standing against later opened Months among this Month's facts:
 * correcting a figure here is exactly when a member wants to know which Months ahead were
 * copied before it and no longer agree.
 */
const ahead = computed(() =>
  driftAhead(props.household, props.month.key, props.now).map((drift) => ({
    month: drift.month,
    differences: driftCount(drift),
  })),
)

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)
</script>

<template>
  <aside class="rail">
    <section class="card">
      <div class="section-header">
        <h2 class="section-label">Leftover Balance</h2>
        <label class="toggle">
          <input v-model="includeRestrictedUse" type="checkbox" />
          Count Restricted-Use
        </label>
      </div>

      <div v-if="viewer" class="viewer">
        <p class="name">{{ viewer.name }}</p>
        <dl class="subtraction">
          <dt class="muted">{{ incomeLabel }}</dt>
          <dd class="figure">{{ money(viewer.income) }}</dd>
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
        <dt class="muted">Entries</dt>
        <dd>{{ rowCount }}</dd>
      </dl>

      <!-- Neutral by ADR-0001: a difference ahead is a fact about the record, not a fault. -->
      <div v-if="ahead.length" class="ahead">
        <p class="muted note">Drifted from this Month</p>
        <dl class="facts">
          <template v-for="later in ahead" :key="later.month">
            <dt class="secondary">{{ monthName(later.month) }}</dt>
            <dd class="secondary">
              {{ later.differences }} {{ later.differences === 1 ? 'difference' : 'differences' }}
            </dd>
          </template>
        </dl>
      </div>

      <DiscardMonth :month="month" />
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

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: normal;
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

.ahead {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 0.5px solid var(--hairline);
}
</style>
