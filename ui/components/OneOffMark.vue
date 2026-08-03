<script setup lang="ts">
/**
 * Stopping a row being inherited, or letting it be inherited again — the same control in
 * every panel, and a toggle rather than a one-way switch.
 *
 * It is the one row control carrying an icon rather than a word. The design brief asks
 * for outline icons used sparingly and names the flag among them, and this is where the
 * dashboard needs one: spelled out, the label is wider than the whole Income row can
 * give it, and three text controls beside a name and an amount is what pushed that
 * column past its width. The words are still there for anyone who hovers or tabs to it,
 * and for anyone reading the row aloud.
 *
 * Those words depend on what the row is. Marking a cost that has run for a year One-Off
 * would say it was a one-time cost, which it never was — so a row with a past Ends Here
 * instead. Same mark, same effect, and the only honest thing to call each. That reading
 * only applies to the unmarked wording: once marked, the control's job is undoing it, and
 * says so regardless of which of the two the row is.
 */
defineProps<{ name: string; ending: boolean; marked: boolean }>()
</script>

<template>
  <button
    class="row-action one-off-mark tip"
    :class="{ accent: marked }"
    type="button"
    :aria-pressed="marked"
    :aria-label="
      marked
        ? `Unmark ${name}, so the next Month opened inherits it again`
        : ending
          ? `Mark ${name} as ending here`
          : `Mark ${name} One-Off`
    "
    :data-tip="
      marked
        ? 'Marked — click to let the next Month opened inherit it again'
        : ending
          ? 'Ends Here — its last Month, and the next Month opened does not inherit it'
          : 'Mark One-Off — this Month alone, and the next Month opened does not inherit it'
    "
  >
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 14.5V2.5M4 3h8l-1.8 2.6L12 8.2H4" />
    </svg>
  </button>
</template>

<style scoped>
.one-off-mark {
  display: flex;
  align-items: center;
  padding: 5px 6px;
}

svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
