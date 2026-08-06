<script setup lang="ts">
import { computed } from 'vue'
import {
  formatAmount,
  householdExpenseTotal,
  householdRestrictedUseIncome,
  householdSpendableIncome,
  isOpened,
  leftoverBalanceOf,
  monthAt,
  monthName,
  openedMonthKeys,
  type Household,
  type Minor,
  type MonthKey,
} from '../../domain/index.js'
import ChangeChart from '../components/ChangeChart.vue'
import Masthead from '../components/Masthead.vue'
import TrendChart from '../components/TrendChart.vue'
import { useDevicePreferences } from '../device-preferences.js'
import { useCalendarMonth } from '../months.js'
import { show } from '../view.js'
import {
  axisSpan,
  axisValues,
  categoryChanges,
  categoryLayers,
  goalProgress,
  memberShareLayers,
  pendingCount,
  pendingNote,
  trendAxis,
  trendCategories,
  trendGoals,
  trendMembers,
} from '../trends.js'
import { displayedViewer } from '../viewer.js'

/**
 * `viewing` is the Month the dashboard is on. Every chart on the shared axis spans the
 * record and needs nothing of it; chart 6 compares two Months, and which two is exactly
 * what the dashboard's own navigation says — so moving Months there moves it here.
 */
const props = defineProps<{ household: Household; viewing?: MonthKey }>()

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

const money = (amount: Minor): string => formatAmount(amount, props.household.currency)

const percent = (value: number): string => `${value}%`

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
 * Chart 5 — each member's total Shares as a percentage of the Household's Expense total,
 * stacked so the full height of a drawn Month is always 100. This is the only chart that
 * draws the output of the Split Rule machinery: the dashboard shows how one Expense
 * divided, this shows what that added up to across Months. `trendMembers` again leads
 * with the Viewer, emphasised.
 */
const shareStack = computed(() => memberShareLayers(props.household, axis.value, members.value))

/**
 * Chart 2 — spending by category, stacked, so the full height is the Household's whole
 * Expense total and each band is one category's share of it. The Uncategorised group is
 * the model's `null` given a heading: not a category, nothing to rename, and last.
 *
 * A composite Expense contributes its derived total under its parent's category, because
 * a Line Item has no category of its own — one row here exactly as in the review model.
 */
const categories = computed(() => trendCategories(props.household, axis.value))

const categoryStack = computed(() =>
  categoryLayers(props.household, axis.value, categories.value),
)

/**
 * Chart 6 — what rose and what fell by category, against the Previous Month. Not a time
 * series: it reads the Month the dashboard is on, so it is not held to the axis and a
 * Month ahead of the calendar is charted here if that is where the member is standing.
 *
 * The Previous Month is the domain's own — the most recent *opened* Month, which after a
 * gap in the record is not the preceding calendar one, which is why it is named on screen.
 */
const moved = computed(() =>
  props.viewing ? categoryChanges(props.household, props.viewing) : undefined,
)

const movedTitle = computed(() =>
  props.viewing ? `What moved in ${monthName(moved.value?.to ?? props.viewing)}` : '',
)

/**
 * What either Month being compared is drawing from part of its rows, named the way every
 * chart on the axis marks the same fact. Chart 6 has no band to hatch — it is two Months
 * rather than a stretch of them — so it says it in words instead. A Pending row counts as
 * nothing on whichever side it is on, and that side's figures understate accordingly.
 */
const incomplete = computed(() => {
  const compared = moved.value
  if (!compared) return []
  return [compared.from, compared.to].flatMap((key) => {
    const note = pendingNote(pendingCount(monthAt(props.household, key)!))
    return note ? [`${monthName(key)} — ${note}`] : []
  })
})

/**
 * Why there is no comparison, said as the two situations differ. A Month nobody opened
 * holds nothing to compare; the first Month in the record has nothing behind it. Neither
 * is an empty chart, and neither is a comparison against zero.
 */
const nothingToCompare = computed(() => {
  const month = props.viewing
  if (!month || moved.value) return undefined
  if (!isOpened(props.household, month)) {
    return `${monthName(month)} has not been opened, so there is nothing to compare.`
  }
  return `${monthName(month)} is the earliest Month in the record, so there is no Previous Month to compare it with.`
})

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

    <!-- Nothing on the axis does not mean nothing on the page: chart 6 is two Months
         rather than a stretch of them, so it stands whether or not the axis does, and
         this fills the window only when it is the whole page. -->
    <div v-if="axis.length === 0" class="empty" :class="{ alone: !viewing }">
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

    <section v-if="axis.length" class="card">
      <TrendChart
        title="Income vs Expenses"
        :axis="axis"
        :series="expensesSeries"
        :stack="incomeStack"
        :format="money"
      />

      <TrendChart title="Spending by category" :axis="axis" :stack="categoryStack" :format="money" />

      <TrendChart title="Leftover Balance" :axis="axis" :series="leftoverSeries" :format="money" />

      <TrendChart
        title="Share of household spending"
        :axis="axis"
        :stack="shareStack"
        :format="percent"
      />

      <TrendChart
        v-for="goal in goalCharts"
        :key="goal.id"
        :title="goal.title"
        :axis="axis"
        :series="goal.series"
        :format="money"
      />
    </section>

    <!-- Chart 6 stands apart from the charts above it: two Months rather than a stretch
         of them, and the Month the dashboard is on rather than the record's own end. It
         is not on the axis, so it is not gated behind one either — a Household whose
         every opened Month is still ahead has no trend to draw and can still be standing
         in a Month with a Previous Month behind it. -->
    <section v-if="viewing" class="card">
      <h2 v-if="!moved || !moved.bars.length" class="section-label">{{ movedTitle }}</h2>

      <ChangeChart v-else :title="movedTitle" :bars="moved.bars" :format="money" />

      <p class="secondary note">
        <template v-if="!moved">{{ nothingToCompare }}</template>
        <template v-else-if="!moved.bars.length">
          No category moved against {{ monthName(moved.from) }}, the Previous Month.
        </template>
        <template v-else>
          Against {{ monthName(moved.from) }}, the Previous Month — the most recent one opened,
          which need not be the Month before.
        </template>
      </p>

      <!-- Either Month may still be being filled in, and a Pending row counts as nothing
           on the side it is on, so the comparison says which and how many. -->
      <p v-for="note in incomplete" :key="note" class="muted note">{{ note }}</p>
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
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Centred in the window only when nothing else is on the page. With chart 6 below it,
   filling the window would push a chart that has something to say off the bottom. */
.empty.alone {
  flex: 1;
}

.empty .card {
  max-width: 480px;
}
</style>
