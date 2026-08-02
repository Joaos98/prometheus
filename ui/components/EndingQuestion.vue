<script setup lang="ts">
/**
 * The offer made when a row that was inherited is taken out of a Month.
 *
 * Removing a row changes what this Month holds and nothing else. The Month behind it goes
 * on passing the row forward, which is what a fresh open draws from — so the row reads as
 * one this Month is missing, and refreshing it, the only thing Drift can offer, puts back
 * exactly what the member has just taken out (ADR-0011).
 *
 * Ending the row in the Previous Month is what they almost always meant: it moves the
 * other side of the comparison, the two agree, and nothing is stored to say so. The offer
 * is made here rather than left to be discovered in a Drift card on another Month,
 * because here is where the member is and where the question makes sense.
 */
import { monthName, type MonthKey } from '../../domain/index.js'

defineProps<{ name: string; month: MonthKey; from: MonthKey }>()

defineEmits<{ end: []; leave: [] }>()
</script>

<template>
  <section class="inset" role="group" :aria-label="`End ${name} in ${monthName(from)}`">
    <p class="offered">Should {{ monthName(from) }} be the last Month for {{ name }}?</p>
    <p class="muted note">
      It is out of {{ monthName(month) }} now, but {{ monthName(from) }} still passes it on — so a
      Month opened from there brings it back, and {{ monthName(month) }} goes on reporting it as
      one it is missing. Ending it there stops the run, and {{ monthName(from) }} keeps its own
      figure either way.
    </p>

    <div class="actions">
      <button class="button-primary" type="button" @click="$emit('end')">End it there</button>
      <button class="button-quiet" type="button" @click="$emit('leave')">Leave it running</button>
    </div>
  </section>
</template>

<style scoped>
.offered {
  margin: 0;
  font-weight: 500;
}
</style>
