<script setup lang="ts">
import { computed } from 'vue'
import { scaleLinear } from 'd3-scale'
import type { ChangeBar } from '../trends.js'

const props = defineProps<{
  title: string
  /** Already ordered and already free of the categories that did not move. */
  bars: ChangeBar[]
  format: (value: number) => string
}>()

/**
 * A diverging bar, hand-written on the same terms as `TrendChart`: a fixed logical canvas
 * scaled by the browser, d3 for the scale alone, every colour one of the app's own.
 *
 * It is not a time series and shares nothing with the axis above it. Two Months are being
 * compared, so there is no slot for a Month nobody opened and no break to draw. There is
 * no incomplete hatching either, for want of a band to hatch: a Pending row still counts
 * as nothing on the side it is on, and the view says which of the two Months hold any.
 */
const WIDTH = 720
const ROW = 28
const BAR = 14
const MARGIN = { top: 8, right: 104, bottom: 8, left: 156 }

const left = MARGIN.left
const right = WIDTH - MARGIN.right

const height = computed(() => MARGIN.top + props.bars.length * ROW + MARGIN.bottom)

/**
 * Symmetric about zero, so that a rise and a fall of the same size draw the same length
 * on opposite sides — the whole point of a diverging bar. The largest move sets both
 * ends. A single move of nothing cannot arise, since a category that did not move is not
 * here at all, but the scale is given a unit of room rather than none in any case.
 */
const x = computed(() => {
  const furthest = Math.max(1, ...props.bars.map((bar) => Math.abs(bar.change)))
  return scaleLinear().domain([-furthest, furthest]).range([left, right])
})

const zero = computed(() => x.value(0))

/**
 * A rise draws to the right of zero and a fall to the left, and the figure beside it
 * carries its own sign. That is two channels before colour is reached — colour here says
 * which category, exactly as it does in the chart above, and says nothing about direction.
 */
const rows = computed(() =>
  props.bars.map((bar, index) => {
    const at = x.value(bar.change)
    const top = MARGIN.top + index * ROW
    return {
      ...bar,
      middle: top + ROW / 2,
      top: top + (ROW - BAR) / 2,
      x: Math.min(zero.value, at),
      width: Math.max(Math.abs(at - zero.value), 1),
      figure: bar.change > 0 ? `+${props.format(bar.change)}` : props.format(bar.change),
      reading: reading(bar),
    }
  }),
)

/** What one bar says in words: the direction named, and both figures behind it. */
function reading(bar: ChangeBar): string {
  const direction = bar.change > 0 ? 'rose' : 'fell'
  const moved = props.format(Math.abs(bar.change))
  return `${bar.name} ${direction} by ${moved}, from ${props.format(bar.before)} to ${props.format(bar.after)}`
}

/**
 * What a screen reader is given, since `role="img"` makes everything inside presentational
 * and the per-bar tips reach a pointer alone. Here the bars are the whole content, so all
 * of them are said — there are as many as the Household has categories that moved.
 */
const description = computed(
  () => `${props.title}. ${rows.value.map((row) => row.reading).join('. ')}`,
)
</script>

<template>
  <figure class="chart">
    <figcaption class="section-label">{{ title }}</figcaption>

    <svg :viewBox="`0 0 ${WIDTH} ${height}`" role="img" :aria-label="description">
      <g class="bars">
        <rect
          v-for="row in rows"
          :key="row.key"
          :x="row.x"
          :y="row.top"
          :width="row.width"
          :height="BAR"
          rx="2"
          :fill="row.colour"
        >
          <title>{{ row.reading }}</title>
        </rect>
      </g>

      <!-- Zero, drawn over the bars: it is what each of them is read against. -->
      <line class="axis" :x1="zero" :x2="zero" :y1="MARGIN.top" :y2="height - MARGIN.bottom" />

      <g class="labels">
        <text
          v-for="row in rows"
          :key="`${row.key}-name`"
          :x="left - 12"
          :y="row.middle"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ row.name }}
        </text>
      </g>

      <!-- The figures in a column of their own rather than at each bar's end, so that
           they can be read down the page and a short bar's figure has room. -->
      <g class="figures">
        <text
          v-for="row in rows"
          :key="`${row.key}-figure`"
          :x="right + 12"
          :y="row.middle"
          dominant-baseline="middle"
        >
          {{ row.figure }}
        </text>
      </g>
    </svg>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--row-gap);
}

svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.axis {
  stroke: var(--hairline);
  stroke-width: 1;
}

.bars rect {
  opacity: 0.65;
}

.labels text {
  fill: var(--text-secondary);
  font-size: 12px;
}

.figures text {
  fill: var(--text-muted);
  font-size: 12px;
}
</style>
