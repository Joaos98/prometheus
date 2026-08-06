<script setup lang="ts">
import { computed } from 'vue'
import {
  formatAmount,
  householdExpenseTotal,
  householdRestrictedUseIncome,
  householdSpendableIncome,
  leftoverBalanceOf,
  monthAt,
  monthName,
  openedMonthKeys,
  type Household,
  type MemberId,
} from '../../domain/index.js'
import Masthead from '../components/Masthead.vue'
import TrendChart from '../components/TrendChart.vue'
import { useDevicePreferences } from '../device-preferences.js'
import { useCalendarMonth } from '../months.js'
import { show } from '../view.js'
import {
  axisSpan,
  axisValues,
  goalProgress,
  trendAxis,
  trendGoals,
  trendMembers,
  type TrendSlot,
} from '../trends.js'
import { displayedViewer } from '../viewer.js'

const props = defineProps<{ household: Household }>()

/**
 * The Restricted-Use toggle is `useDevicePreferences()`'s other value and is not read
 * here, nor anywhere else in this view. It exists because the Leftover Balance is one
 * number and a number can show one value; a chart has room for both, so the preference
 * has nothing to decide here (CONTEXT.md confines it to that figure alone).
 */
const { viewer } = useDevicePreferences()

const now = useCalendarMonth()

/** Opened Months up to this one, month by month on the calendar, gaps and all. */
const axis = computed(() => trendAxis(props.household, now.value))

/**
 * The device's pick, or the Roster's first active member where nothing has been picked
 * yet. There is no one Month here to substitute against, and none is substituted: where
 * the charted Months hold this member nowhere, `trendMembers` emphasises nobody rather
 * than standing somebody in, because this view has no picker to say who was stood in.
 *
 * It orders and emphasises a series and does nothing else: every member the charted
 * Months hold is drawn.
 */
const naming = computed(() => displayedViewer(viewer.value, undefined, props.household.roster))

const members = computed(() => trendMembers(props.household, axis.value, naming.value))

const money = (amount: number): string => formatAmount(amount, props.household.currency)

/**
 * Chart 1 — income vs expenses. Income is one stacked series, Spendable Income with
 * Restricted-Use Income above it, so the full height is total Income and the band is
 * what is actually spendable: the whole point of the distinction, readable at a glance
 * rather than reconstructed across panels. This is why the view has no Restricted-Use
 * toggle — the toggle exists because the Leftover Balance is one number, and a chart has
 * room for both without it.
 */
const incomeStack = computed(() => [
  {
    id: 'spendable',
    name: 'Spendable Income',
    values: axisValues(props.household, axis.value, householdSpendableIncome),
  },
  {
    id: 'restricted-use',
    name: 'Restricted-Use Income',
    values: axisValues(props.household, axis.value, householdRestrictedUseIncome),
  },
])

const expensesSeries = computed(() => [
  {
    id: 'expenses',
    name: 'Expenses',
    emphasis: true,
    values: axisValues(props.household, axis.value, householdExpenseTotal),
  },
])

/**
 * Chart 3 — one Savings Goal per section, its Accumulated Progress as of each Month —
 * never as of today — beside its target where it names one across the stretch charted.
 * A goal with no target across the whole stretch draws with no target line at all.
 */
const goalCharts = computed(() =>
  trendGoals(props.household, axis.value).map((goal) => {
    const progress = goalProgress(props.household, axis.value, goal)
    return {
      id: goal.id,
      title: `${goal.name} — progress`,
      series: progress.target ? [progress.progress, progress.target] : [progress.progress],
    }
  }),
)

/**
 * Chart 4 — the app's headline number, per member, on Spendable Income (CONTEXT.md's
 * default basis). `trendMembers` already leads with the Viewer, emphasised, exactly as
 * the rail does.
 */
const leftoverSeries = computed(() =>
  members.value.map((member) => ({
    id: member.id,
    name: member.name,
    emphasis: member.emphasis,
    values: axisValues(props.household, axis.value, (month) =>
      leftoverBalanceOf(month, member.id).balance,
    ),
  })),
)

/**
 * A placeholder while tickets 11 to 13 build the six charts: how many rows each member
 * appears on, Month by Month. It draws nothing anybody needs, and it exercises every rule
 * the axis has — the slot an unopened Month keeps, the break a series takes across it,
 * the mark on a Month with Pending rows, and the Viewer's series leading and emphasised.
 *
 * The count is worked out here rather than in `ui/trends.ts` because it goes when the six
 * charts arrive; nothing else in the view reaches into a Month's rows.
 */
const entries = computed(() =>
  members.value.map((member) => ({
    ...member,
    values: axis.value.map((slot) => entryCountFor(slot, member.id)),
  })),
)

function entryCountFor(slot: TrendSlot, member: MemberId): number | undefined {
  const month = monthAt(props.household, slot.key)
  if (!month) return undefined
  return (
    month.income.filter((row) => row.member === member).length +
    month.expenses.filter((row) => row.participants.includes(member)).length +
    month.goals.filter((row) => row.participants.includes(member)).length
  )
}

/**
 * Two empty states, because they are two different situations. A Household that has never
 * opened a Month has nothing recorded; one whose only Months are ahead has recorded plans,
 * and a plan is exactly what a trend leaves out.
 */
const nothingYet = computed(() => openedMonthKeys(props.household).length === 0)

const span = computed(() => axisSpan(axis.value))
</script>

<template>
  <div class="trends">
    <Masthead>
      <template #middle>
        <h1 class="title">Trends</h1>
      </template>

      <template #right>
        <button class="button-quiet" type="button" @click="show('month')">Back to the Month</button>
      </template>
    </Masthead>

    <p v-if="span" class="secondary note">
      {{ span }} — opened Months up to this one. A Month ahead holds a plan and is left out.
    </p>

    <div v-if="axis.length === 0" class="empty">
      <section class="card">
        <h2 class="section-label">Nothing to chart yet</h2>
        <p v-if="nothingYet" class="secondary note">
          No Month has been opened, so there is nothing to draw. Open one and the charts fill in
          behind it.
        </p>
        <p v-else class="secondary note">
          Every opened Month is still ahead of {{ monthName(now) }}. A trend covers Months up to
          this one, because a Month ahead holds a plan rather than a record.
        </p>
      </section>
    </div>

    <section v-else class="card">
      <TrendChart
        title="Income vs Expenses"
        :axis="axis"
        :series="expensesSeries"
        :stack="incomeStack"
        :format="money"
      />

      <TrendChart title="Leftover Balance" :axis="axis" :series="leftoverSeries" :format="money" />

      <TrendChart
        v-for="goal in goalCharts"
        :key="goal.id"
        :title="goal.title"
        :axis="axis"
        :series="goal.series"
        :format="money"
      />

      <TrendChart title="Entries recorded" :axis="axis" :series="entries" />
      <p class="muted note">
        A placeholder while the remaining charts are built: how many rows each member appears on,
        Month by Month.
      </p>
    </section>
  </div>
</template>

<style scoped>
.trends {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--row-gap);
}

/* A view whose subject is many Months is one column of full-width charts: the axis is
   the whole point of it, and an axis squeezed into a third of the page stops being
   readable long before the page runs out of room. */
.trends > .card {
  max-width: 1000px;
  width: 100%;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty .card {
  max-width: 480px;
}
</style>
