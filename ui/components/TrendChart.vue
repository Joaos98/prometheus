<script setup lang="ts">
import { computed, useId } from 'vue'
import { scaleLinear } from 'd3-scale'
import { line as lineOf } from 'd3-shape'
import { monthName, monthOfYear, yearOf } from '../../domain/index.js'
import { MONTH_NAMES } from '../months.js'
import { pendingNote, segmentsOf, type TrendSeries, type TrendSlot } from '../trends.js'

const props = defineProps<{
  title: string
  axis: TrendSlot[]
  series: TrendSeries[]
  /** How a figure is spoken — money, a count, a percentage. Charts do not assume. */
  format?: (value: number) => string
}>()

/**
 * Hand-written SVG on a fixed logical canvas, scaled by the browser to whatever width the
 * column gives it. d3 supplies the domain, the ticks and the path string and nothing else:
 * no chart component, no canvas, no default styling to override, and so nothing of a
 * library's to leak into the dark theme. Every colour below is one of the app's own.
 */
const WIDTH = 720
const HEIGHT = 260
const MARGIN = { top: 12, right: 16, bottom: 30, left: 68 }

const left = MARGIN.left
const right = WIDTH - MARGIN.right
const top = MARGIN.top
const bottom = HEIGHT - MARGIN.bottom

/** A pattern is referenced by id, and a page holds several charts. */
const hatch = `hatch-${useId()}`

const say = computed(() => props.format ?? ((value: number) => String(value)))

/**
 * A single opened Month is a legal Household, so the axis may hold one slot. It is placed
 * mid-canvas rather than at a scale of zero width, and drawn as the dot every point
 * already gets — a line of one point has no path, which is not the same as no chart.
 */
const x = computed(() =>
  scaleLinear()
    .domain(props.axis.length > 1 ? [0, props.axis.length - 1] : [-1, 1])
    .range([left, right]),
)

/**
 * Money is read against zero, so the baseline is always in view — a chart that crops it
 * exaggerates every change on it. A series that never moves would give a scale no height
 * at all, so it is given one unit of room and drawn flat, which is what it is.
 */
const y = computed(() => {
  const drawn = props.series.flatMap((one) =>
    one.values.filter((value): value is number => value !== undefined),
  )
  const low = Math.min(0, ...drawn)
  const high = Math.max(0, ...drawn)
  return scaleLinear()
    .domain(low === high ? [low, high + 1] : [low, high])
    .nice()
    .range([bottom, top])
})

const yTicks = computed(() => y.value.ticks(4))

/**
 * Every slot is labelled where the axis is short enough to read, and every other one, or
 * every third, where it is not. The first slot always carries its label, so the axis says
 * where it starts however far it has been thinned.
 */
const labelEvery = computed(() => Math.ceil(props.axis.length / 12))

const slots = computed(() =>
  props.axis.map((slot, index) => ({
    ...slot,
    index,
    at: x.value(index),
    /** January and the first slot carry the year; the rest would just repeat it. */
    label:
      MONTH_NAMES[monthOfYear(slot.key) - 1]!.slice(0, 3) +
      (index === 0 || monthOfYear(slot.key) === 1 ? ` ${yearOf(slot.key)}` : ''),
    labelled: index % labelEvery.value === 0,
    note: pendingNote(slot.pending),
  })),
)

/** The Months drawn from part of their rows, asked once and marked in three places. */
const incomplete = computed(() => slots.value.filter((slot) => slot.note !== undefined))

/**
 * How wide a slot's own share of the plot is, which is what an incomplete band fills.
 * Capped, so a two-Month axis is not two half-page stripes.
 */
const BAND = 34

const slotWidth = computed(() =>
  props.axis.length > 1 ? Math.min((right - left) / (props.axis.length - 1), BAND) : BAND,
)

const path = computed(() => lineOf<{ index: number; value: number }>()
  .x((point) => x.value(point.index))
  .y((point) => y.value(point.value)))

/**
 * The two colours this chart spends before any series does. `--fire` is what the brief and
 * the rail keep for the figure being read, so the emphasised series takes it; the rail's
 * Pending mark is `--fire-bright`, so the incomplete hatch takes that and the two views
 * say Pending in the same colour.
 *
 * Neither is in the palette below. A plain series in either would be competing with the
 * one series that is meant to stand out, or with a mark that is not a series at all.
 */
const EMPHASIS = 'var(--fire)'
const INCOMPLETE = 'var(--fire-bright)'

/**
 * The app's own accents for everything else. Beyond them the series repeat colour and are
 * told apart by the legend, which is the honest end of a chart with more series than a
 * palette has room for — inventing a colour per member is how a chart stops being readable
 * at all.
 */
const PALETTE = ['var(--ice)', 'var(--text-secondary)', 'var(--text-muted)']

const drawn = computed(() => {
  /**
   * The palette is walked by the series drawing from it, so an emphasised series does not
   * consume a colour it is not using — otherwise the Viewer leads, takes the emphasis
   * colour, and the palette's first goes to whoever is second by an accident of counting.
   */
  let plain = 0
  return props.series.map((one) => ({
    ...one,
    colour: one.emphasis === true ? EMPHASIS : PALETTE[plain++ % PALETTE.length]!,
    /**
     * Cut into runs, so the line stops at a Month nobody opened and starts again after
     * it. Nothing is interpolated across the gap and nothing is plotted as zero there.
     */
    runs: segmentsOf(one.values).map((run) => ({
      key: `${one.id}-${run[0]!.index}`,
      d: path.value(run) ?? '',
      points: run.map((point) => ({
        ...point,
        at: x.value(point.index),
        height: y.value(point.value),
        reading: `${monthName(props.axis[point.index]!.key)} — ${say.value(point.value)}`,
      })),
    })),
  }))
})

/**
 * What a screen reader is given, since `role="img"` makes everything inside the drawing
 * presentational and the tips below reach a pointer alone. The incomplete Months are named
 * here rather than only hatched, so the same fact arrives by both roads — which is the
 * shape the rail already gives its own Pending mark.
 */
const description = computed(() => {
  const marked = incomplete.value.map((slot) => `${monthName(slot.key)}: ${slot.note}`)
  return marked.length ? `${props.title}. ${marked.join('. ')}` : props.title
})
</script>

<template>
  <figure class="chart">
    <figcaption class="section-label">{{ title }}</figcaption>

    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" :aria-label="description">
      <defs>
        <!-- The incomplete mark: hatching, so a Month drawn from part of its rows never
             reads as a plain value. -->
        <pattern :id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" :stroke="INCOMPLETE" stroke-width="1.5" />
        </pattern>
      </defs>

      <!-- Gridlines and the figures they stand for. -->
      <g class="grid">
        <template v-for="tick in yTicks" :key="tick">
          <line :x1="left" :x2="right" :y1="y(tick)" :y2="y(tick)" />
          <text :x="left - 10" :y="y(tick)" text-anchor="end" dominant-baseline="middle">
            {{ say(tick) }}
          </text>
        </template>
      </g>

      <!-- A Month holding Pending rows, hatched across its own slot, naming the count to
           anyone who hovers it. The chart's own label names it to anyone who cannot. -->
      <g class="incomplete">
        <rect
          v-for="slot in incomplete"
          :key="slot.key"
          :x="slot.at - slotWidth / 2"
          :y="top"
          :width="slotWidth"
          :height="bottom - top"
          :fill="`url(#${hatch})`"
        >
          <title>{{ monthName(slot.key) }} — {{ slot.note }}</title>
        </rect>
      </g>

      <g class="months">
        <template v-for="slot in slots" :key="slot.key">
          <text v-if="slot.labelled" :x="slot.at" :y="bottom + 18" text-anchor="middle">
            {{ slot.label }}
          </text>
        </template>
      </g>

      <line class="axis" :x1="left" :x2="right" :y1="bottom" :y2="bottom" />

      <!-- Each run is its own path. A run of one point has no path to draw, and the dots
           every point carries are what render it. -->
      <g v-for="one in drawn" :key="one.id" :class="{ series: true, emphasis: one.emphasis }">
        <path
          v-for="run in one.runs"
          :key="run.key"
          :d="run.d"
          fill="none"
          :stroke="one.colour"
        />
        <template v-for="run in one.runs" :key="`${run.key}-points`">
          <circle
            v-for="point in run.points"
            :key="point.index"
            :cx="point.at"
            :cy="point.height"
            :r="one.emphasis ? 3.5 : 2.5"
            :fill="one.colour"
          >
            <title>{{ one.name }} — {{ point.reading }}</title>
          </circle>
        </template>
      </g>
    </svg>

    <ul class="legend">
      <li v-for="one in drawn" :key="one.id" :class="{ emphasis: one.emphasis }">
        <span class="swatch" :style="{ background: one.colour }" aria-hidden="true"></span>
        {{ one.name }}
      </li>

      <!-- What the hatching means, said where anybody can read it. The count is the
           band's own to give, but a mark nothing on the page explains is a stripe. -->
      <li v-if="incomplete.length" class="marked">
        <span class="swatch hatched" aria-hidden="true"></span>
        Drawn from part of its rows
      </li>
    </ul>
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

.grid line,
.axis {
  stroke: var(--hairline);
  stroke-width: 1;
}

.grid text,
.months text {
  fill: var(--text-muted);
  font-size: 11px;
}

.incomplete rect {
  opacity: 0.16;
}

.series path {
  stroke-width: 1.5;
  opacity: 0.85;
}

.series.emphasis path {
  stroke-width: 2.5;
  opacity: 1;
}

.legend {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend li.emphasis {
  color: var(--text);
}

.swatch {
  width: 10px;
  height: 2px;
  border-radius: 1px;
}

.legend li.emphasis .swatch {
  height: 3px;
}

/* The band's own hatching at legend size, so the two read as the same mark. */
.swatch.hatched {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: repeating-linear-gradient(
    45deg,
    var(--fire-bright) 0 1.5px,
    transparent 1.5px 5px
  );
  opacity: 0.7;
}
</style>
