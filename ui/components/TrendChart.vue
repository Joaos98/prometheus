<script setup lang="ts">
import { computed, useId } from 'vue'
import { scaleLinear } from 'd3-scale'
import { line as lineOf } from 'd3-shape'
import { monthName, monthOfYear, yearOf } from '../../domain/index.js'
import { MONTH_NAMES } from '../months.js'
import {
  pendingNote,
  segmentsOf,
  type TrendPoint,
  type TrendSeries,
  type TrendSlot,
} from '../trends.js'

const props = defineProps<{
  title: string
  axis: TrendSlot[]
  /** The lines drawn over the stack. Left out where a chart is the stack — the categories
   * chart has no figure standing apart from the bands it is made of. */
  series?: TrendSeries[]
  /**
   * Layers drawn as a stacked area beneath the plain series, each one's own magnitude
   * rather than a running total — the running total is worked out here, the same way a
   * plain series is never asked to carry another series' figure. Bottom layer first, so
   * the full height of the stack is every layer summed.
   */
  stack?: TrendSeries[]
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

/** A value the y-scale has to reach, whether a plain series' own figure or a stack layer's
 * running top — the one predicate both share for narrowing away the gaps. */
function isDrawn(value: number | undefined): value is number {
  return value !== undefined
}

/**
 * Each stack layer's own base and running top across the axis, bottom layer first — the
 * running total is worked out here so no layer carries another's figure. A slot is
 * undefined for a layer exactly where the layer beneath it is, since every layer is read
 * off the same axis and so breaks at the same Month nobody opened.
 */
const stackBounds = computed(() => {
  let base: (number | undefined)[] = props.axis.map(() => 0)
  return (props.stack ?? []).map((layer) => {
    const top = layer.values.map((value, at) =>
      value === undefined || base[at] === undefined ? undefined : base[at]! + value,
    )
    const bounds = { ...layer, base, top }
    base = top
    return bounds
  })
})

/**
 * Money is read against zero, so the baseline is always in view — a chart that crops it
 * exaggerates every change on it. A series that never moves would give a scale no height
 * at all, so it is given one unit of room and drawn flat, which is what it is.
 */
const y = computed(() => {
  const drawn = [
    ...(props.series ?? []).flatMap((one) => one.values.filter(isDrawn)),
    ...stackBounds.value.flatMap((layer) => layer.top.filter(isDrawn)),
  ]
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
 * One run of a stacked layer as a filled polygon: the top boundary forward, the base
 * boundary back. A run of one point has no polygon to draw at zero width, so it takes the
 * same slice of the axis the incomplete band already takes for the same reason.
 */
function areaPath(run: TrendPoint<{ base: number; top: number }>[]): string {
  if (run.length === 0) return ''
  if (run.length === 1) {
    const point = run[0]!
    const cx = x.value(point.index)
    const half = slotWidth.value / 2
    return (
      `M${cx - half},${y.value(point.value.top)}` +
      `L${cx + half},${y.value(point.value.top)}` +
      `L${cx + half},${y.value(point.value.base)}` +
      `L${cx - half},${y.value(point.value.base)}Z`
    )
  }
  const forward = run.map((point) => `${x.value(point.index)},${y.value(point.value.top)}`)
  const backward = [...run].reverse().map((point) => `${x.value(point.index)},${y.value(point.value.base)}`)
  return `M${forward.join('L')}L${backward.join('L')}Z`
}

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

/**
 * The stack's own colours, walked bottom layer first so the lowest — the one read most
 * often — takes the brighter of the two.
 */
const STACK_PALETTE = ['var(--ice)', 'var(--text-secondary)']

/**
 * A palette handed out one colour at a time, in the order it is asked. Only what actually
 * draws from it takes a colour: a series that arrived with one of its own, and an
 * emphasised series, take none — otherwise the Viewer leads, takes the emphasis colour,
 * and the palette's first goes to whoever is second by an accident of counting.
 */
function walking(palette: string[]): () => string {
  let taken = 0
  return () => palette[taken++ % palette.length]!
}

const stacked = computed(() => {
  const next = walking(STACK_PALETTE)
  return stackBounds.value.map((layer) => ({
    id: layer.id,
    name: layer.name,
    colour: layer.colour ?? next(),
    areas: segmentsOf(
      layer.values.map((value, at) =>
        value === undefined || layer.base[at] === undefined
          ? undefined
          : { base: layer.base[at]!, top: layer.top[at]!, own: value },
      ),
    ).map((run) => ({
      key: `${layer.id}-${run[0]!.index}`,
      d: areaPath(run),
      points: run.map((point) => ({
        at: x.value(point.index),
        topY: y.value(point.value.top),
        baseY: y.value(point.value.base),
        reading: `${monthName(props.axis[point.index]!.key)} — ${layer.name} — ${say.value(point.value.own)}`,
      })),
    })),
  }))
})

const drawn = computed(() => {
  const next = walking(PALETTE)
  return (props.series ?? []).map((one) => ({
    ...one,
    colour: one.emphasis === true ? EMPHASIS : (one.colour ?? next()),
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

      <!-- The stack: each layer filled between its own base and the running top, drawn
           behind everything else so the incomplete hatching and the plain series read
           over it rather than under it. Each Month's own slice carries its reading, the
           same way a line series' points do — the fill itself is one path, so it cannot. -->
      <g v-for="layer in stacked" :key="layer.id" class="band">
        <path v-for="area in layer.areas" :key="area.key" :d="area.d" :fill="layer.colour" />
        <template v-for="area in layer.areas" :key="`${area.key}-hover`">
          <rect
            v-for="point in area.points"
            :key="point.at"
            :x="point.at - slotWidth / 2"
            :y="point.topY"
            :width="slotWidth"
            :height="Math.max(point.baseY - point.topY, 1)"
            fill="transparent"
          >
            <title>{{ point.reading }}</title>
          </rect>
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
      <li v-for="layer in stacked" :key="layer.id">
        <span class="swatch filled" :style="{ background: layer.colour }" aria-hidden="true"></span>
        {{ layer.name }}
      </li>

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

.band path {
  opacity: 0.55;
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

/* A stacked layer's own fill at legend size, so the two read as the same mark. */
.swatch.filled {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  opacity: 0.55;
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
