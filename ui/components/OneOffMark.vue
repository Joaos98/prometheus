<script setup lang="ts">
/**
 * Marking a row One-Off, as the same control in every panel.
 *
 * It is the one row control carrying an icon rather than a word. The design brief asks
 * for outline icons used sparingly and names the flag among them, and this is where the
 * dashboard needs one: spelled out, the label is wider than the whole Income row can
 * give it, and three text controls beside a name and an amount is what pushed that
 * column past its width. The word is still there for anyone who hovers, and for anyone
 * reading the row aloud.
 */
defineProps<{ name: string }>()
</script>

<template>
  <button
    class="row-action one-off-mark"
    type="button"
    :aria-label="`Mark ${name} One-Off`"
    title="Mark One-Off — this Month alone, and the next Month opened does not inherit it"
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
