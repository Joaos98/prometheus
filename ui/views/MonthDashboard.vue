<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { monthAt, type Household, type MonthKey } from '../../domain/index.js'
import DemoPanel from '../components/DemoPanel.vue'
import ExpensesPanel from '../components/ExpensesPanel.vue'
import GoalsPanel from '../components/GoalsPanel.vue'
import HouseholdFile from '../components/HouseholdFile.vue'
import IncomePanel from '../components/IncomePanel.vue'
import MonthDrift from '../components/MonthDrift.vue'
import MonthNavigator from '../components/MonthNavigator.vue'
import MonthRail from '../components/MonthRail.vue'
import RosterPanel from '../components/RosterPanel.vue'
import UnopenedMonth from '../components/UnopenedMonth.vue'
import { useChanges } from '../changes.js'
import { CURRENCIES } from '../currencies.js'
import { useDevicePreferences } from '../device-preferences.js'
import { useHousehold } from '../household.js'
import { thisMonth } from '../months.js'
import logo from '../../prometheus-logo.svg'

const props = defineProps<{ household: Household; viewing: MonthKey }>()

const { relabel, replacements, seeded } = useHousehold()
const { failure, report } = useChanges()
const { viewer } = useDevicePreferences()

const month = computed(() => monthAt(props.household, props.viewing))

/**
 * Only an active member can be picked as the Viewer — a Month past their departure
 * still names them, but this device's own preference is a Roster concern, not a Month
 * one. The already-picked Viewer stays listed even if deactivated since, so the
 * dropdown never shows "nobody" for a choice that is still standing.
 */
const viewerOptions = computed(() =>
  props.household.roster.filter((member) => member.active || member.id === viewer.value),
)

/** Bridges the select's empty-string "nobody" option to the Viewer's own undefined. */
const chosenViewer = computed({
  get: () => viewer.value ?? '',
  set: (value: string) => {
    viewer.value = value === '' ? undefined : value
  },
})

/**
 * The Month the calendar is on. The engine will not guess it — only a Month after this one
 * can drift, and which one that is is the device's to say, not the Household's.
 *
 * Read again whenever the window comes back, because Prometheus is the kind of thing left
 * open on a tab: a session that spans the turn of a month would otherwise go on treating
 * the Month that has just arrived as one still ahead, and offer to refresh a Month that
 * has stopped being a plan.
 */
const now = ref(thisMonth())

function catchUpWithTheCalendar(): void {
  now.value = thisMonth()
}

onMounted(() => {
  window.addEventListener('focus', catchUpWithTheCalendar)
  document.addEventListener('visibilitychange', catchUpWithTheCalendar)
})

onUnmounted(() => {
  window.removeEventListener('focus', catchUpWithTheCalendar)
  document.removeEventListener('visibilitychange', catchUpWithTheCalendar)
})

const managingRoster = ref(false)
const relabelling = ref(false)
const transferring = ref(false)
const explainingTheDemo = ref(false)
const chosen = ref(props.household.currency.code)

/** The chooser closes once the currency is relabelled, and stays open to say why not. */
async function saveCurrency(): Promise<void> {
  const currency = CURRENCIES.find((candidate) => candidate.code === chosen.value)
  if (!currency) return
  if (!(await report(relabel(currency)))) return
  relabelling.value = false
}
</script>

<template>
  <div class="dashboard">
    <header class="masthead">
      <div class="side">
        <img :src="logo" alt="" class="mark" />
        <span class="secondary">Prometheus</span>
      </div>

      <MonthNavigator :household="household" :viewing="viewing" />

      <div class="side right">
        <select v-model="chosenViewer" aria-label="Viewer">
          <option value="">Viewer: nobody</option>
          <option v-for="member in viewerOptions" :key="member.id" :value="member.id">
            Viewer: {{ member.name }}
          </option>
        </select>
        <button class="button-quiet" type="button" @click="managingRoster = !managingRoster">
          Roster
        </button>
        <button class="button-quiet" type="button" @click="transferring = !transferring">
          Household file
        </button>
        <button class="button-quiet" type="button" @click="relabelling = !relabelling">
          {{ household.currency.code }} {{ household.currency.symbol.trim() }}
        </button>
        <button
          v-if="seeded"
          class="button-quiet"
          type="button"
          @click="explainingTheDemo = !explainingTheDemo"
        >
          Demo
        </button>
      </div>
    </header>

    <div v-if="explainingTheDemo" class="card">
      <DemoPanel />
    </div>

    <div v-if="managingRoster" class="card">
      <RosterPanel :household="household" />
    </div>

    <div v-if="transferring" class="card">
      <HouseholdFile :household="household" />
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

    <UnopenedMonth v-if="!month" :household="household" :viewing="viewing" />

    <template v-else>
      <MonthDrift :household="household" :viewing="viewing" :now="now" />

      <!--
        Keyed on the Month, so moving to another one builds the panels afresh rather than
        reusing them. What a panel holds while a member is halfway through something — the
        row being edited, an amount typed but not saved, a rename waiting to be answered —
        is about the Month it was started in and means nothing in another. Without this,
        stepping to the next Month leaves the form open and its next save lands there,
        which is how an edit meant for July gets written to August.

        Keyed on the import that replaced the Household too, for the same reason and a
        worse version of it: an import lands on whichever Month the arriving Household
        ends at, which may be the very Month on screen. What was half-typed belongs to
        the Household that has just gone, and where a row of the same identity exists in
        the one that arrived — restoring a backup of this same Household — saving it
        would quietly write it there.
      -->
      <div :key="`${viewing}/${replacements}`" class="columns">
        <MonthRail :household="household" :month="month" :now="now" />

        <main>
          <ExpensesPanel :household="household" :month="month" />
        </main>

        <div class="right-column">
          <IncomePanel :household="household" :month="month" />
          <GoalsPanel :household="household" :month="month" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.masthead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--hairline);
}

.side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.side.right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* A control the masthead holds keeps its own width and its own line: squeezed to fit,
   the Viewer picker becomes a sliver and the longer labels break across two rows. */
.side.right select {
  width: 156px;
  flex: none;
}

.side.right button {
  white-space: nowrap;
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

/* ADR-0010: a pinned rail, Expenses widest in the centre, Income and goals sharing
   the right column. The three start level, which is what the centred Month name in
   the masthead is for. */
.columns {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr) 372px;
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
  top: 16px;
}

/*
  Below about 1240px the three columns collapse to one and the rail unpins. The
  masthead comes apart at the same width and for the same reason: three groups on one
  line stops being three groups and becomes a squeezed picker beside labels breaking
  across two rows, so the logo, the Month and the controls each take a line of their
  own and the Month stays centred between them.
*/
@media (max-width: 1240px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Nothing is pinned or beside anything any more, so the panels that were columns
     spread across the one column's width instead of each taking a full-width band and
     pushing the rest of the Month a screen further down. */
  .columns > .rail,
  .right-column {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .columns > .rail > *,
  .right-column > * {
    flex: 1 1 300px;
  }

  .masthead {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .side,
  .side.right {
    justify-content: center;
  }
}
</style>
