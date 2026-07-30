<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  isOpened,
  monthAfter,
  monthBefore,
  monthKey,
  monthName,
  yearOf,
  type Household,
  type MonthKey,
} from '../../domain/index.js'
import { useHousehold } from '../household.js'
import { MONTH_NAMES, thisMonth } from '../months.js'

const props = defineProps<{ household: Household; viewing: MonthKey }>()

const { view } = useHousehold()

const picking = ref(false)
const year = ref(yearOf(props.viewing))

/**
 * The year at a glance: which of its Months the Household has opened and which it has
 * not, which is the shape of the record. Stepping onto any of them is a read — nothing
 * here opens anything.
 */
const months = computed(() =>
  MONTH_NAMES.map((name, index) => {
    const key = monthKey(year.value, index + 1)
    return { key, name, opened: isOpened(props.household, key), viewing: key === props.viewing }
  }),
)

const openedThisYear = computed(() => months.value.filter((month) => month.opened).length)

/**
 * The picker stays open while the steppers are used, so it follows the member across the
 * turn of a year rather than going on showing the year they left. Otherwise stepping
 * from December into January leaves a grid of the old year with nothing marked as where
 * they are, and the next Month they pick lands twelve Months from where they meant.
 */
watch(
  () => props.viewing,
  (month) => {
    year.value = yearOf(month)
  },
)

/** The picker opens on the year being viewed, wherever it was left last time. */
function togglePicker(): void {
  if (!picking.value) year.value = yearOf(props.viewing)
  picking.value = !picking.value
}

function jump(key: MonthKey): void {
  view(key)
  picking.value = false
}
</script>

<template>
  <div class="navigator">
    <div class="stepper">
      <button
        class="step"
        type="button"
        :aria-label="`Go to ${monthName(monthBefore(viewing))}`"
        @click="view(monthBefore(viewing))"
      >
        ‹
      </button>

      <button
        class="title"
        type="button"
        aria-haspopup="true"
        :aria-expanded="picking"
        @click="togglePicker"
      >
        <h1>{{ monthName(viewing) }}</h1>
        <span class="state" :class="{ unopened: !isOpened(household, viewing) }">
          {{ isOpened(household, viewing) ? 'Opened' : 'Not opened' }}
        </span>
      </button>

      <button
        class="step"
        type="button"
        :aria-label="`Go to ${monthName(monthAfter(viewing))}`"
        @click="view(monthAfter(viewing))"
      >
        ›
      </button>
    </div>

    <div v-if="picking" class="picker card">
      <div class="year">
        <button class="step" type="button" :aria-label="`${year - 1}`" @click="year -= 1">‹</button>
        <span class="figure">{{ year }}</span>
        <button class="step" type="button" :aria-label="`${year + 1}`" @click="year += 1">›</button>
      </div>

      <div class="grid">
        <button
          v-for="month in months"
          :key="month.key"
          class="month"
          :class="{ opened: month.opened, here: month.viewing }"
          type="button"
          :aria-label="`${month.name} ${year} — ${month.opened ? 'opened' : 'not opened'}`"
          :aria-current="month.viewing ? 'true' : undefined"
          @click="jump(month.key)"
        >
          <span>{{ month.name }}</span>
          <span class="mark">{{ month.opened ? 'Opened' : 'Not opened' }}</span>
        </button>
      </div>

      <div class="footer">
        <p class="muted note">
          {{ openedThisYear }} of 12 Months opened in {{ year }}. Looking at one does not open it.
        </p>
        <button class="today" type="button" @click="jump(thisMonth())">Today</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.navigator {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.step {
  padding: 2px 10px;
  font-size: 18px;
  line-height: 1.2;
  color: var(--text-secondary);
  background: none;
  border: 0.5px solid transparent;
}

.step:hover {
  color: var(--text);
  border-color: var(--hairline);
}

.title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 2px 8px;
  background: none;
  border: 0.5px solid transparent;
}

.title:hover {
  border-color: var(--hairline);
}

.title h1 {
  font-size: 20px;
  white-space: nowrap;
}

.state {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.state.unopened {
  color: var(--fire);
}

/* The picker hangs off the masthead rather than pushing the dashboard down. */
.picker {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.year {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.month {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  font-size: 13px;
  text-align: left;
  background: none;
  border: 0.5px solid var(--hairline);
}

.month:hover {
  border-color: var(--fire);
}

.month .mark {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.month.opened .mark {
  color: var(--fire);
}

.month.here {
  border-color: var(--text-secondary);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 0.5px solid var(--hairline);
}

.note {
  margin: 0;
  font-size: 12px;
  text-align: left;
}

.today {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--fire);
  background: none;
  border: 0.5px solid var(--hairline);
}

.today:hover {
  border-color: var(--fire);
}
</style>
