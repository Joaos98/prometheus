<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { monthAt, type Household, type MemberId, type MonthKey } from '../../domain/index.js'
import CategoriesPanel from '../components/CategoriesPanel.vue'
import DemoPanel from '../components/DemoPanel.vue'
import ExpensesPanel from '../components/ExpensesPanel.vue'
import GoalsPanel from '../components/GoalsPanel.vue'
import HouseholdFile from '../components/HouseholdFile.vue'
import IncomePanel from '../components/IncomePanel.vue'
import MonthDrift from '../components/MonthDrift.vue'
import MonthNavigator from '../components/MonthNavigator.vue'
import MonthRail from '../components/MonthRail.vue'
import Modal from '../components/Modal.vue'
import PaymentMethodsPanel from '../components/PaymentMethodsPanel.vue'
import RosterPanel from '../components/RosterPanel.vue'
import UnopenedMonth from '../components/UnopenedMonth.vue'
import { useChanges } from '../changes.js'
import { CURRENCIES } from '../currencies.js'
import { useDevicePreferences } from '../device-preferences.js'
import { useHousehold } from '../household.js'
import { thisMonth } from '../months.js'
import { SETTINGS_TITLES, toggleSettings, type SettingsPanel } from '../settings.js'
import { displayedViewer, viewerOptions, viewerToPin } from '../viewer.js'
import logo from '../../prometheus-logo.svg'

const props = defineProps<{ household: Household; viewing: MonthKey }>()

const { relabel, replacements, seeded } = useHousehold()
const { failure, report } = useChanges()
const { viewer } = useDevicePreferences()

const month = computed(() => monthAt(props.household, props.viewing))

/**
 * Whoever the rail is leading with: this device's pick where the Month has them, and the
 * Month's own first member where it does not. The picker names that and nothing else, so
 * it is never wrong about the screen. It is read, never written — a Month the pick is
 * absent from substitutes on display and leaves storage alone.
 */
const naming = computed(() => displayedViewer(viewer.value, month.value, props.household.roster))

/**
 * Every active member, plus whoever is being named — a member deactivated since being
 * picked, or a past Month's own member — so the control never shows a blank. There is no
 * option for nobody: with nobody picked the rail still led with somebody, so the option
 * named an absence that was never on screen.
 */
const options = computed(() => viewerOptions(props.household.roster, naming.value))

/** Reads the rail's leader back; writes only what a member has actually picked. */
const chosenViewer = computed({
  get: () => naming.value,
  set: (value: MemberId) => {
    viewer.value = value
  },
})

/**
 * The one rule that pins a Viewer without anybody picking: the first load with an opened
 * Month on screen names the member the rail was already leading with, so that the picker
 * holds still afterwards rather than changing as a member steps between Months. It fires
 * at most once — the moment anything is stored, there is nothing left to pin — and waits
 * where the first Month seen is unopened.
 */
watch(
  month,
  (opened) => {
    const pin = viewerToPin(viewer.value, opened)
    if (pin) viewer.value = pin
  },
  { immediate: true },
)

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

/** The one settings modal open over the Month, if any. */
const settings = ref<SettingsPanel | undefined>(undefined)

/** The button pressed last, which is where focus goes back to when its modal closes. */
const opener = ref<HTMLElement | undefined>(undefined)

function press(button: SettingsPanel, event: MouseEvent): void {
  opener.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  settings.value = toggleSettings(settings.value, button)
}

const chosen = ref(props.household.currency.code)

/** The chooser closes once the currency is relabelled, and stays open to say why not. */
async function saveCurrency(): Promise<void> {
  const currency = CURRENCIES.find((candidate) => candidate.code === chosen.value)
  if (!currency) return
  if (!(await report(relabel(currency)))) return
  settings.value = undefined
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
          <option v-for="member in options" :key="member.id" :value="member.id">
            Viewer: {{ member.name }}
          </option>
        </select>
        <button class="button-quiet" type="button" @click="press('roster', $event)">Roster</button>
        <button class="button-quiet" type="button" @click="press('categories', $event)">
          Categories
        </button>
        <button class="button-quiet" type="button" @click="press('payment-methods', $event)">
          Payment methods
        </button>
        <button class="button-quiet" type="button" @click="press('household-file', $event)">
          Household file
        </button>
        <button class="button-quiet" type="button" @click="press('currency', $event)">
          {{ household.currency.code }} {{ household.currency.symbol.trim() }}
        </button>
        <button v-if="seeded" class="button-quiet" type="button" @click="press('demo', $event)">
          Demo
        </button>
      </div>
    </header>

    <!--
      None of these is about the Month, so none of them renders in its flow. They open
      over the page and the Month stays exactly where it was.

      One modal element for all of them, keyed on which panel is open so that pressing a
      second button builds a fresh one rather than re-titling the one already there. Which
      button to hand focus back to is the press's to say, not the modal's — it reads the
      opener once on mount, so each panel restores focus to the button that opened it.
    -->
    <Modal
      v-if="settings"
      :key="settings"
      :title="SETTINGS_TITLES[settings]"
      :opener="opener"
      @close="settings = undefined"
    >
      <DemoPanel v-if="settings === 'demo'" />

      <RosterPanel v-else-if="settings === 'roster'" :household="household" />

      <CategoriesPanel v-else-if="settings === 'categories'" :household="household" />

      <PaymentMethodsPanel v-else-if="settings === 'payment-methods'" :household="household" />

      <!-- An import that lands leaves this open, still carrying the sentence
           `HouseholdFile.vue` prints. Dismissing it reveals the Household that arrived. -->
      <HouseholdFile v-else-if="settings === 'household-file'" :household="household" />

      <div v-else class="relabel">
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
    </Modal>

    <!--
      The card is the only thing on this page — no rail, no columns — so it takes the
      whole of what is left beneath the masthead and sits in the middle of it. Anchored
      to the corner instead, a Month nobody has opened reads as a layout that failed to
      load rather than a Month that is genuinely empty.
    -->
    <div v-if="!month" class="empty-month">
      <UnopenedMonth :household="household" :viewing="viewing" />
    </div>

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
  flex: 1;
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

.empty-month {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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
