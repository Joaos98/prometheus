<script setup lang="ts">
/**
 * The band across the top of every view: the mark on the left, whatever names the subject
 * in the middle, and the view's own controls on the right.
 *
 * One component rather than one per view, because the brand row, the three-group grid and
 * the width at which it comes apart are facts about the app rather than about a Month or
 * about trends. What goes in the middle and on the right is the view's, and is slotted —
 * the Month navigator and its settings buttons have nothing to do with the trends view's
 * way back, and neither belongs here.
 */
import logo from '../../prometheus-logo.svg'
</script>

<template>
  <header class="masthead">
    <div class="side">
      <img :src="logo" alt="" class="mark" />
      <span class="secondary">Prometheus</span>
    </div>

    <slot name="middle" />

    <div class="side right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.masthead {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--hairline);
}

.side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.side.right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* A control here keeps its own width and its own line: squeezed to fit, a picker becomes
   a sliver and the longer labels break across two rows. */
.side.right :deep(select) {
  width: 156px;
  flex: none;
}

.side.right :deep(button) {
  white-space: nowrap;
}

.mark {
  width: 22px;
  height: 22px;
}

/*
  Below about 1240px the three groups on one line stop being three groups and become a
  squeezed picker beside labels breaking across two rows, so the logo, the subject and the
  controls each take a line of their own and the subject stays centred between them. The
  dashboard's columns collapse at the same width and for the same reason.
*/
@media (max-width: 1240px) {
  .masthead {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .side,
  .side.right {
    justify-content: center;
  }
}
</style>
