<script setup lang="ts">
/**
 * Confirming a row as reviewed, as the same control in every panel — a checkmark beside
 * the flag it answers, the two together back to the width the row had before either
 * grew a word.
 */
defineProps<{ name: string }>()
</script>

<template>
  <button
    class="row-action accent confirm-mark tip"
    type="button"
    :aria-label="`Confirm ${name}`"
    data-tip="Confirm — mark this row reviewed"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  </button>
</template>

<style scoped>
.confirm-mark {
  display: flex;
  align-items: center;
  padding: 5px 6px;
}

svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
