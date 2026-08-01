<script setup lang="ts">
/**
 * Flagging a row Unreviewed, as the same marker in every panel.
 *
 * It answers to nothing — there is no click, only a state to see — so it is a span
 * rather than a button, but `tabindex` keeps it reachable the same way a control is,
 * for the tip to reach anyone tabbing the row rather than only anyone hovering it.
 */
defineProps<{ name: string }>()
</script>

<template>
  <span
    class="unreviewed-mark tip"
    tabindex="0"
    :aria-label="`${name} is Unreviewed`"
    data-tip="Unreviewed — not yet checked this Month"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3.5v5.8" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  </span>
</template>

<style scoped>
.unreviewed-mark {
  display: flex;
  align-items: center;
  padding: 2px;
  color: var(--fire);
}

svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
