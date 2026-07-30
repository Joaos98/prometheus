<script setup lang="ts">
import { computed, ref } from 'vue'
import { monthAt, monthName, type Household, type MonthKey } from '../../domain/index.js'
import ExpensesPanel from '../components/ExpensesPanel.vue'
import GoalsPanel from '../components/GoalsPanel.vue'
import IncomePanel from '../components/IncomePanel.vue'
import MonthRail from '../components/MonthRail.vue'
import RosterPanel from '../components/RosterPanel.vue'
import { CURRENCIES } from '../currencies.js'
import { useHousehold } from '../household.js'
import logo from '../../prometheus-logo.svg'

const props = defineProps<{ household: Household; viewing: MonthKey }>()

const { relabel } = useHousehold()

const month = computed(() => monthAt(props.household, props.viewing))

const managingRoster = ref(false)
const relabelling = ref(false)
const chosen = ref(props.household.currency.code)
const failure = ref<string | undefined>(undefined)

async function saveCurrency(): Promise<void> {
  const currency = CURRENCIES.find((candidate) => candidate.code === chosen.value)
  if (!currency) return
  failure.value = undefined
  try {
    await relabel(currency)
    relabelling.value = false
  } catch (cause) {
    failure.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <div class="dashboard">
    <header class="masthead">
      <div class="side">
        <img :src="logo" alt="" class="mark" />
        <span class="secondary">Prometheus</span>
      </div>

      <h1>{{ monthName(viewing) }}</h1>

      <div class="side right">
        <button class="button-quiet" type="button" @click="managingRoster = !managingRoster">
          Roster
        </button>
        <button class="button-quiet" type="button" @click="relabelling = !relabelling">
          {{ household.currency.code }} {{ household.currency.symbol.trim() }}
        </button>
      </div>
    </header>

    <div v-if="managingRoster" class="card">
      <RosterPanel :household="household" />
    </div>

    <div v-if="relabelling" class="card relabel">
      <p class="muted note">
        Relabelling converts no amount, so a currency held to a different number of decimals is
        refused.
      </p>
      <div class="relabel-controls">
        <select v-model="chosen" aria-label="Currency">
          <option v-for="currency in CURRENCIES" :key="currency.code" :value="currency.code">
            {{ currency.code }} — {{ currency.symbol.trim() }}
          </option>
        </select>
        <button class="button-primary" type="button" @click="saveCurrency">Relabel</button>
      </div>
      <p v-if="failure" class="failure note">{{ failure }}</p>
    </div>

    <p v-if="!month" class="unopened card">
      {{ monthName(viewing) }} has not been opened. Looking at it does not open it.
    </p>

    <div v-else class="columns">
      <MonthRail :household="household" :month="month" />

      <main>
        <ExpensesPanel :household="household" :month="month" />
      </main>

      <div class="right-column">
        <IncomePanel :household="household" :month="month" />
        <GoalsPanel :household="household" :month="month" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
  padding: 20px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.masthead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 0.5px solid var(--hairline);
}

.masthead h1 {
  font-size: 20px;
  text-align: center;
}

.side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.side.right {
  justify-content: flex-end;
}

.mark {
  width: 22px;
  height: 22px;
}

.relabel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.relabel-controls {
  display: flex;
  gap: 8px;
}

.relabel-controls select {
  max-width: 220px;
}

.note {
  margin: 0;
  font-size: 13px;
}

.failure {
  color: var(--fire-bright);
}

.unopened {
  margin: 0;
  color: var(--text-secondary);
}

/* ADR-0010: a pinned rail, Expenses widest in the centre, Income and goals sharing
   the right column. */
.columns {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 340px;
  gap: var(--gap);
  align-items: start;
}

.right-column {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.columns > .rail {
  position: sticky;
  top: 20px;
}

/* Below about 1240px the three columns collapse to one and the rail unpins. */
@media (max-width: 1240px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .columns > .rail {
    position: static;
  }
}
</style>
