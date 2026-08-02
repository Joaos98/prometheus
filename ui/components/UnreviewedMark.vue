<script setup lang="ts">
/**
 * Flagging a row Unreviewed, as the same marker in every panel.
 *
 * It answers to nothing — there is no click, only a state to see — so it is a span
 * rather than a button, but `tabindex` keeps it reachable the same way a control is,
 * for the tip to reach anyone tabbing the row rather than only anyone hovering it.
 *
 * The glyph is an `i`, not a `!`. ADR-0001 keeps warning styling for Pending, which is a
 * genuine error state; an Unreviewed row holds a perfectly good number that nobody has
 * read yet, which is something to look at rather than something wrong. The fire accent is
 * what asks for the attention, and the glyph says what kind.
 *
 * Lucide's `info`, drawn inline on its own 24 grid rather than pulled in as a dependency,
 * as the other marks here are. At 13px its 2px stroke lands at about 1.1px on screen,
 * which is where OneOffMark and ConfirmMark already sit.
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
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
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
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
